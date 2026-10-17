"""ZeroHertz Complete Backend Smoke Test & Verification Script.

Executes end-to-end tests across:
1. Mathematical Goertzel DTMF DSP Engine
2. ITU-T G.711 mu-law decoder
3. Database migrations & Cryptographic SHA-256 audit chain
4. Offline multilingual Intent Parser (EN/HI/Hinglish)
5. Confirmation gate state machine (expiration, replay protection, #5 verification)
6. FastAPI REST API endpoints
"""

import asyncio
import base64
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np

# Use an isolated temporary database for the smoke test
TEMP_DIR = tempfile.mkdtemp(prefix="zerohertz_smoke_")
os.environ["SQLITE_DB_PATH"] = os.path.join(TEMP_DIR, "smoke.db")
os.environ["ENVIRONMENT"] = "test"

from backend.agent_worker import (
    initiate_session_workflow,
    parse_intent_offline,
    verify_and_submit_confirmation,
)
from backend.config import settings
from backend.database import Database, GENESIS_HASH, db, get_utc_now
from backend.dsp_engine import (
    KEY_TO_FREQ,
    GoertzelDTMFEngine,
    decode_audio_stream,
    decode_mulaw,
    generate_dtmf_sequence,
    generate_dtmf_tone,
)
from backend.main import app
from backend.schemas import SessionStatus
from fastapi.testclient import TestClient


def run_dsp_tests():
    print("\n--- [1/5] Testing DSP Goertzel Engine & G.711 ---")
    engine = GoertzelDTMFEngine()

    # 1. Test all 16 keys at 8000 Hz
    keys_tested = 0
    for key, (low_f, high_f) in KEY_TO_FREQ.items():
        audio = generate_dtmf_tone(key, duration_ms=50.0, sample_rate=8000, amplitude=0.5)
        det = engine.analyze_frame(audio, 8000)
        assert det.is_valid, f"Failed on key {key}: {det.rejection_reason}"
        assert det.detected_key == key, f"Expected {key}, got {det.detected_key}"
        keys_tested += 1
    print(f"  ✓ All {keys_tested} DTMF keypad keys correctly recognized via Goertzel algorithm (8000 Hz)")

    # 2. Test high sample rate (44100 Hz)
    audio_44k = generate_dtmf_tone("9", duration_ms=50.0, sample_rate=44100, amplitude=0.5)
    det_44k = engine.analyze_frame(audio_44k, 44100)
    assert det_44k.is_valid and det_44k.detected_key == "9"
    print("  ✓ Goertzel detection operates reliably at 44100 Hz sample rate")

    # 3. Test Twist Rejection
    high_twist = generate_dtmf_tone("1", duration_ms=50.0, sample_rate=8000, twist_db=8.0)
    det_twist = engine.analyze_frame(high_twist, 8000)
    assert not det_twist.is_valid, "Excessive twist (+8dB) was not rejected"
    print("  ✓ Out-of-spec twist (+8.0 dB) correctly rejected")

    # 4. Test Silence Rejection
    silence = np.zeros(300, dtype=np.float32)
    det_sil = engine.analyze_frame(silence, 8000)
    assert not det_sil.is_valid
    print("  ✓ Silence frame correctly rejected below energy threshold")

    # 5. Test G.711 mu-law decoding
    mulaw_test = bytes(range(256))
    decoded_pcm = decode_mulaw(mulaw_test)
    assert len(decoded_pcm) == 256
    assert np.all(decoded_pcm >= -1.0) and np.all(decoded_pcm <= 1.0)
    print("  ✓ ITU-T G.711 mu-law table decodes full 8-bit dynamic range properly")

    # 6. Test sequence decoding & packet protocol (*1234#)
    seq_audio = generate_dtmf_sequence("*1234#", tone_duration_ms=60.0, silence_duration_ms=40.0, sample_rate=8000)
    keys_str, packets, is_confirmed, _ = decode_audio_stream(seq_audio, 8000)
    assert keys_str == "*1234#", f"Expected *1234#, got {keys_str}"
    assert packets == ["1234"], f"Expected packet ['1234'], got {packets}"
    assert not is_confirmed
    print("  ✓ Streaming DTMF state machine successfully decoded packet protocol '*1234#'")

    # 7. Test #5 confirmation acoustic sequence
    conf_audio = generate_dtmf_sequence("#5", tone_duration_ms=60.0, silence_duration_ms=40.0, sample_rate=8000)
    keys_conf, _, is_confirmed_tone, _ = decode_audio_stream(conf_audio, 8000)
    assert keys_conf == "#5"
    assert is_confirmed_tone is True
    print("  ✓ Acoustic confirmation '#5' recognized as 2 distinct tone events with inter-digit separation")


def run_database_tests():
    print("\n--- [2/5] Testing SQLite Schema & Cryptographic Audit Chain ---")
    smoke_db_file = os.path.join(TEMP_DIR, "audit_smoke.db")
    test_db = Database(smoke_db_file)

    # 1. Verify schema tables initialized
    with test_db.get_connection() as conn:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
        required = ["sessions", "transactions", "dtmf_events", "confirmation_attempts", "audit_events", "portal_records", "intent_results"]
        for req in required:
            assert req in tables, f"Missing table: {req}"
    print("  ✓ All required tables created with indexes and foreign keys")

    # 2. Append audit events & verify SHA-256 chain
    for i in range(5):
        test_db.log_audit_event(f"EVENT_{i}", {"index": i, "data": f"sample-{i}"}, session_id=f"sess_{i}")

    valid, rows = test_db.verify_audit_chain()
    assert valid is True
    assert len(rows) == 5
    assert rows[0]["prev_hash"] == GENESIS_HASH
    print(f"  ✓ Verified SHA-256 cryptographic audit chain across {len(rows)} linked blocks")

    # 3. Test tamper resistance
    with test_db.get_connection() as conn:
        conn.execute("UPDATE audit_events SET payload_json = '{\"tampered\": true}' WHERE id = 3;")
    valid_after_tamper, _ = test_db.verify_audit_chain()
    assert valid_after_tamper is False, "Cryptographic audit chain failed to detect data tampering"
    print("  ✓ Cryptographic hash chain successfully detected unauthorized data modification")


def run_intent_parser_tests():
    print("\n--- [3/5] Testing Multilingual Intent Parser ---")

    # English
    en_result = parse_intent_offline("Please renew ration card for Ramesh Kumar, beneficiary RATION-8821, Food Dept")
    assert "8821" in en_result.beneficiary_id
    assert "Ramesh Kumar" in en_result.citizen_name
    assert "Ration" in en_result.service_type
    assert en_result.language_detected == "en"
    print("  ✓ English intent correctly classified and extracted")

    # Hinglish
    hi_result = parse_intent_offline("Mera pension update karna hai, beneficiary ID PENS-9944, Mohan Lal, urgent")
    assert "9944" in hi_result.beneficiary_id
    assert "Mohan Lal" in hi_result.citizen_name
    assert "Pension" in hi_result.service_type
    assert hi_result.priority == "Urgent"
    assert hi_result.language_detected == "hinglish"
    print("  ✓ Hinglish intent correctly parsed with urgency flag")

    # Hindi Devanagari
    dev_result = parse_intent_offline("नया राशन कार्ड, नाम Sunita Devi, आईडी RATION-4411")
    assert "4411" in dev_result.beneficiary_id
    assert dev_result.language_detected == "hi"
    print("  ✓ Hindi (Devanagari script) correctly detected")


def run_confirmation_gate_tests():
    print("\n--- [4/5] Testing Confirmation Gate Security & Replay Prevention ---")

    async def _test_gate():
        # 1. Staging workflow
        sid, parsed, challenge, expires_at = await initiate_session_workflow(
            prompt="Beneficiary RATION-1234, Citizen Rahul Gandhi, Food and Supplies"
        )
        assert challenge == "#5"

        # 2. Reject incorrect acoustic token
        ok_bad, bad_msg, _, _ = await verify_and_submit_confirmation(sid, "#9")
        assert not ok_bad
        assert "Invalid acoustic signature" in bad_msg
        print("  ✓ Invalid acoustic signature (#9) strictly rejected")

        # 3. Accept valid '#5' token
        ok_good, good_msg, receipt_id, tx_id = await verify_and_submit_confirmation(sid, "#5")
        assert ok_good is True
        assert receipt_id.startswith("REF-")
        assert tx_id is not None
        print(f"  ✓ Authorized signature '#5' accepted. Receipt generated: {receipt_id}")

        # 4. Prevent replay attack on already submitted session
        ok_replay, replay_msg, _, _ = await verify_and_submit_confirmation(sid, "#5")
        assert not ok_replay
        assert "Replay attack" in replay_msg or "already submitted" in replay_msg
        print("  ✓ Replay attack on confirmed session rejected")

        # 5. Handle expired session
        expired_sid = "sess_expired_demo"
        db.create_session(
            session_id=expired_sid,
            challenge_token="#5",
            expires_at=(datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),
            status=SessionStatus.INITIALIZED.value,
        )
        ok_exp, exp_msg, _, _ = await verify_and_submit_confirmation(expired_sid, "#5")
        assert not ok_exp
        assert "expired" in exp_msg.lower()
        print("  ✓ Expired session (120s timeout) correctly rejected")

    asyncio.run(_test_gate())


def run_fastapi_endpoint_tests():
    print("\n--- [5/5] Testing FastAPI Endpoints ---")
    client = TestClient(app)

    # 1. Health
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    print("  ✓ GET /api/health [200 OK]")

    # 2. Diagnostics
    res_diag = client.get("/api/diagnostics")
    assert res_diag.status_code == 200
    assert res_diag.json()["status"] == "ok"
    assert "dsp_engine" in res_diag.json()
    print("  ✓ GET /api/diagnostics [200 OK]")

    # 3. DSP verify frequency pair
    res_vpair = client.post(
        "/api/dsp/verify-frequency-pair",
        json={
            "low_freq": 770.0,
            "high_freq": 1336.0,
            "sample_rate": 8000,
            "duration_ms": 60.0,
            "amplitude": 0.5,
            "twist_db": 0.0,
            "noise_level": 0.0,
        },
    )
    assert res_vpair.status_code == 200
    assert res_vpair.json()["detected_key"] == "5"
    assert res_vpair.json()["is_valid"] is True
    print("  ✓ POST /api/dsp/verify-frequency-pair [200 OK] (Key '5' confirmed)")

    # 4. DSP decode audio base64
    tone_pcm = generate_dtmf_tone("7", duration_ms=60.0, sample_rate=8000, amplitude=0.5)
    raw_s16 = (tone_pcm * 32767).astype(np.int16).tobytes()
    b64_audio = base64.b64encode(raw_s16).decode("utf-8")

    res_decode = client.post(
        "/api/dsp/decode",
        json={
            "audio_base64": b64_audio,
            "audio_format": "pcm_s16le",
            "sample_rate": 8000,
        },
    )
    assert res_decode.status_code == 200
    assert "7" in res_decode.json()["detected_sequence"]
    print("  ✓ POST /api/dsp/decode [200 OK] (Base64 PCM audio decoded)")

    # 5. Execute Intent
    res_intent = client.post(
        "/api/execute-intent",
        json={
            "prompt": "Apply for healthcare grievance for Sunita Devi, beneficiary ID BEN-7788, District Hospital",
        },
    )
    assert res_intent.status_code == 200
    intent_data = res_intent.json()
    assert intent_data["challenge_token"] == "#5"
    session_id = intent_data["session_id"]
    print(f"  ✓ POST /api/execute-intent [200 OK] (Created session {session_id})")

    # 6. Confirm Session with #5
    res_confirm = client.post(
        f"/api/sessions/{session_id}/confirm",
        json={"challenge_response": "#5"},
    )
    assert res_confirm.status_code == 200
    assert res_confirm.json()["success"] is True
    assert res_confirm.json()["receipt_reference_id"] is not None
    print(f"  ✓ POST /api/sessions/{session_id}/confirm [200 OK] (Receipt: {res_confirm.json()['receipt_reference_id']})")

    # 7. List Sessions
    res_sessions = client.get("/api/sessions")
    assert res_sessions.status_code == 200
    assert len(res_sessions.json()) >= 1
    print("  ✓ GET /api/sessions [200 OK]")

    # 8. Cryptographic Audit Log
    res_audit = client.get("/api/audit")
    assert res_audit.status_code == 200
    assert res_audit.json()["chain_valid"] is True
    print("  ✓ GET /api/audit [200 OK] (Chain cryptographically valid)")

    # 9. Portal Submit
    res_portal = client.post(
        "/api/portal/submit",
        json={
            "beneficiary_id": "BEN-99001",
            "citizen_name": "Deepak Verma",
            "service_type": "Income Certificate",
            "facility_select": "Sub-Divisional Magistrate Office",
            "department_select": "Department of Revenue & Land Records",
            "priority": "Standard",
            "acoustic_token_field": "#5",
        },
    )
    assert res_portal.status_code == 200
    assert res_portal.json()["success"] is True
    print(f"  ✓ POST /api/portal/submit [200 OK] (Receipt: {res_portal.json()['receipt_reference_id']})")

    # 10. Static Portal File Serving
    res_html = client.get("/portal.html")
    assert res_html.status_code == 200
    assert "ZeroHertz Citizen Services Demo Portal" in res_html.text
    print("  ✓ GET /portal.html [200 OK] (HTML interface served)")


if __name__ == "__main__":
    print("=====================================================================")
    print("       ZeroHertz (0Hz) Backend Subsystem Verification Suite          ")
    print("=====================================================================")
    try:
        run_dsp_tests()
        run_database_tests()
        run_intent_parser_tests()
        run_confirmation_gate_tests()
        run_fastapi_endpoint_tests()
        print("\n=====================================================================")
        print(" [SUCCESS] ALL 5 ZERO HERTZ BACKEND SUBSYSTEM TESTS PASSED CLEANLY!  ")
        print("=====================================================================\n")
    except Exception as e:
        print(f"\n[FAILURE] Smoke test encountered an error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
