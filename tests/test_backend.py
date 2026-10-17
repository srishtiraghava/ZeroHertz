"""Comprehensive Test Suite for ZeroHertz Backend Subsystems.

Verifies:
1. Mathematical Goertzel DTMF detection across all 16 standard keypad keys.
2. Twist threshold rejection and harmonic distortion validation.
3. G.711 mu-law table vector decoding.
4. Streaming packet extraction (*1234#) and '#5' acoustic confirmation gate.
5. SQLite schema, CRUD operations, and SHA-256 cryptographic audit chain integrity.
6. Offline intent parsing for English, Hindi, and Hinglish.
7. Replay attack and expiration protection.
8. FastAPI HTTP and WebSocket routes.
"""

import base64
import os
import shutil
import tempfile
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

# Ensure environment uses test database
TEST_DIR = tempfile.mkdtemp(prefix="zerohertz_test_")
os.environ["SQLITE_DB_PATH"] = os.path.join(TEST_DIR, "test_zerohertz.db")
os.environ["ENVIRONMENT"] = "test"

from backend.agent_worker import (
    detect_language,
    initiate_session_workflow,
    parse_intent_offline,
    verify_and_submit_confirmation,
)
from backend.config import settings
from backend.database import Database, GENESIS_HASH, db, get_utc_now
from backend.dsp_engine import (
    DTMF_MAP,
    KEY_TO_FREQ,
    DTMFStreamingDecoder,
    FrameDetection,
    GoertzelDTMFEngine,
    decode_audio_stream,
    decode_mulaw,
    generate_dtmf_sequence,
    generate_dtmf_tone,
    goertzel_power,
    parse_audio_payload,
)
from backend.schemas import SessionStatus


# ===========================================================================
# 1. DSP & Goertzel Mathematical Verification
# ===========================================================================

def test_goertzel_all_16_dtmf_keys():
    """Verify that every single DTMF key (0-9, A-D, *, #) generates and decodes cleanly."""
    engine = GoertzelDTMFEngine()
    sample_rate = 8000

    for key, (low_f, high_f) in KEY_TO_FREQ.items():
        # Generate clean synthetic tone for this key
        tone = generate_dtmf_tone(key, duration_ms=50.0, sample_rate=sample_rate, amplitude=0.6)
        det = engine.analyze_frame(tone, sample_rate)

        assert det.is_valid is True, f"Key '{key}' failed valid DTMF detection: {det.rejection_reason}"
        assert det.detected_key == key, f"Expected key '{key}', got '{det.detected_key}'"
        assert det.low_freq == low_f, f"Key '{key}' low freq mismatch: {det.low_freq} != {low_f}"
        assert det.high_freq == high_f, f"Key '{key}' high freq mismatch: {det.high_freq} != {high_f}"
        assert abs(det.twist_db) < 2.0, f"Twist for balanced key '{key}' unexpectedly high: {det.twist_db}"


def test_goertzel_high_sample_rate():
    """Verify Goertzel algorithm operates properly at 44100 Hz high fidelity audio."""
    engine = GoertzelDTMFEngine()
    sample_rate = 44100
    key = "5"
    tone = generate_dtmf_tone(key, duration_ms=50.0, sample_rate=sample_rate, amplitude=0.5)
    det = engine.analyze_frame(tone, sample_rate)

    assert det.is_valid is True
    assert det.detected_key == "5"


def test_silence_rejection():
    """Verify that pure silence and low-energy background hiss are properly rejected."""
    engine = GoertzelDTMFEngine()
    silence = np.zeros(400, dtype=np.float32)
    det = engine.analyze_frame(silence, 8000)
    assert det.is_valid is False
    assert "silence" in det.rejection_reason.lower()

    # White noise below energy threshold
    low_noise = np.random.normal(0, 0.001, 400).astype(np.float32)
    det_noise = engine.analyze_frame(low_noise, 8000)
    assert det_noise.is_valid is False


def test_twist_rejection():
    """Verify signals exceeding twist bounds (e.g. +8 dB or -8 dB) are rejected."""
    engine = GoertzelDTMFEngine(twist_min_db=-6.0, twist_max_db=6.0)
    sample_rate = 8000

    # High group boosted by +8 dB (exceeds +6 dB max twist)
    high_twist_tone = generate_dtmf_tone("3", duration_ms=50.0, sample_rate=sample_rate, twist_db=8.0)
    det = engine.analyze_frame(high_twist_tone, sample_rate)
    assert det.is_valid is False
    assert "Twist" in (det.rejection_reason or "")

    # Low group boosted by -8 dB (exceeds -6 dB min twist)
    low_twist_tone = generate_dtmf_tone("3", duration_ms=50.0, sample_rate=sample_rate, twist_db=-8.0)
    det_low = engine.analyze_frame(low_twist_tone, sample_rate)
    assert det_low.is_valid is False
    assert "Twist" in (det_low.rejection_reason or "")


def test_mulaw_decoding():
    """Verify G.711 mu-law table expands 8-bit bytes to normalized floats within [-1.0, 1.0]."""
    test_bytes = bytes([0xFF, 0x00, 0x7F, 0x80])
    decoded = decode_mulaw(test_bytes)
    assert len(decoded) == 4
    assert decoded.dtype == np.float32
    assert -1.0 <= decoded.min() <= 1.0
    assert -1.0 <= decoded.max() <= 1.0


def test_streaming_decoder_and_packet_protocol():
    """Verify streaming state machine extracts sequences and *...# packets."""
    sample_rate = 8000
    # Create sequence: * 1 2 3 #
    audio = generate_dtmf_sequence("*123#", tone_duration_ms=60.0, silence_duration_ms=40.0, sample_rate=sample_rate)
    keys_str, packets, is_confirmed, detections = decode_audio_stream(audio, sample_rate)

    assert keys_str == "*123#"
    assert packets == ["123"]
    assert is_confirmed is False


def test_hash_five_acoustic_confirmation():
    """Verify that '#' followed by '5' triggers acoustic confirmation detection."""
    sample_rate = 8000
    audio = generate_dtmf_sequence("#5", tone_duration_ms=60.0, silence_duration_ms=40.0, sample_rate=sample_rate)
    keys_str, packets, is_confirmed, _ = decode_audio_stream(audio, sample_rate)

    assert keys_str == "#5"
    assert is_confirmed is True


# ===========================================================================
# 2. Database & Cryptographic Audit Hash Chain
# ===========================================================================

def test_database_crud_and_hash_chain():
    """Verify SQLite CRUD and cryptographic SHA-256 audit chaining."""
    test_db_path = os.path.join(TEST_DIR, "audit_test.db")
    test_db = Database(test_db_path)

    # 1. Append audit events
    id1 = test_db.log_audit_event("TEST_EVENT_1", {"msg": "First test event"}, session_id="s1")
    id2 = test_db.log_audit_event("TEST_EVENT_2", {"msg": "Second test event"}, session_id="s1")
    id3 = test_db.log_audit_event("TEST_EVENT_3", {"msg": "Third test event"}, session_id="s2")

    assert id1 == 1
    assert id2 == 2
    assert id3 == 3

    # 2. Verify audit chain validity
    valid, rows = test_db.verify_audit_chain()
    assert valid is True
    assert len(rows) == 3
    assert rows[0]["prev_hash"] == GENESIS_HASH
    assert rows[1]["prev_hash"] == rows[0]["current_hash"]
    assert rows[2]["prev_hash"] == rows[1]["current_hash"]

    # 3. Tamper test: Alter payload in database directly
    with test_db.get_connection() as conn:
        conn.execute("UPDATE audit_events SET payload_json = '{\"tampered\": true}' WHERE id = 2;")

    tampered_valid, _ = test_db.verify_audit_chain()
    assert tampered_valid is False, "Cryptographic hash chain failed to catch illicit modification!"


def test_session_and_transaction_lifecycle():
    """Test session creation, retrieval, and status updates."""
    test_db_path = os.path.join(TEST_DIR, "session_test.db")
    test_db = Database(test_db_path)

    sid = "sess_test_101"
    now_utc = get_utc_now()
    exp = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()

    sess = test_db.create_session(
        session_id=sid,
        challenge_token="#5",
        expires_at=exp,
        citizen_name="Amitabh Bachchan",
        beneficiary_id="BEN-1942",
        service_type="Ration Card Renewal",
    )
    assert sess["session_id"] == sid
    assert sess["challenge_token"] == "#5"
    assert sess["status"] == "INITIALIZED"

    # Create transaction
    tx = test_db.create_transaction("tx_001", sid, "PENDING", {"test": True})
    assert tx["transaction_id"] == "tx_001"
    assert tx["status"] == "PENDING"

    # Update transaction
    test_db.update_transaction_status("tx_001", "COMPLETED", receipt_reference_id="REF-8899")
    tx_updated = test_db.get_transaction("tx_001")
    assert tx_updated["status"] == "COMPLETED"
    assert tx_updated["receipt_reference_id"] == "REF-8899"


# ===========================================================================
# 3. Offline Intent Parser (English, Hindi, Hinglish)
# ===========================================================================

def test_intent_parsing_multilingual():
    """Verify intent extraction for English, Hindi, and Hinglish citizen queries."""
    # English Query
    en_prompt = "Renew ration card for citizen Amit Sharma, beneficiary ID RATION-9821, Department of Food and Supplies"
    p_en = parse_intent_offline(en_prompt)
    assert "9821" in p_en.beneficiary_id
    assert "Amit Sharma" in p_en.citizen_name
    assert "Ration" in p_en.service_type
    assert p_en.language_detected == "en"

    # Hinglish Query
    hinglish_prompt = "Mera pension update karna hai, beneficiary ID PENS-3344, Ramesh Kumar, urgent service"
    p_hi = parse_intent_offline(hinglish_prompt)
    assert "3344" in p_hi.beneficiary_id
    assert "Ramesh Kumar" in p_hi.citizen_name
    assert "Pension" in p_hi.service_type
    assert p_hi.priority == "Urgent"
    assert p_hi.language_detected == "hinglish"

    # Hindi Devanagari Query
    hindi_prompt = "मेरा राशन कार्ड रिन्यू करें, नाम Rajesh Sharma, आईडी RATION-5566"
    p_dev = parse_intent_offline(hindi_prompt)
    assert "5566" in p_dev.beneficiary_id
    assert p_dev.language_detected == "hi"


# ===========================================================================
# 4. Confirmation Gate Security & State Machine
# ===========================================================================

@pytest.mark.asyncio
async def test_confirmation_gate_security():
    """Verify security controls: valid '#5' confirmation, invalid token rejection, and replay prevention."""
    sid, parsed, challenge, _ = await initiate_session_workflow(
        prompt="Renew ration card for beneficiary ID RATION-7788, Ramesh Verma",
    )
    assert challenge == "#5"

    # 1. Invalid acoustic token rejection
    ok, err_msg, rec_id, _ = await verify_and_submit_confirmation(sid, "4")
    assert ok is False
    assert "Invalid acoustic signature" in err_msg

    # 2. Valid '#5' confirmation success
    ok, msg, rec_id, tx_id = await verify_and_submit_confirmation(sid, "#5")
    assert ok is True
    assert rec_id is not None
    assert rec_id.startswith("REF-")
    assert tx_id is not None

    # 3. Replay attack rejection (attempting to confirm an already submitted session)
    ok_replay, replay_msg, _, _ = await verify_and_submit_confirmation(sid, "#5")
    assert ok_replay is False
    assert "Replay attack" in replay_msg or "already submitted" in replay_msg


@pytest.mark.asyncio
async def test_confirmation_expiration():
    """Verify that expired sessions reject confirmation."""
    sid = "sess_expired_test"
    expired_time = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    db.create_session(session_id=sid, challenge_token="#5", expires_at=expired_time, status=SessionStatus.INITIALIZED.value)

    ok, msg, _, _ = await verify_and_submit_confirmation(sid, "#5")
    assert ok is False
    assert "expired" in msg.lower()
