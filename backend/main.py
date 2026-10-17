"""ZeroHertz (0Hz) FastAPI Main Application.

Exposes REST and WebSocket endpoints for acoustic verification, DSP DTMF decoding,
citizen intent orchestration, cryptographic audit trails, and citizen portal services.
"""

import asyncio
import base64
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from backend.agent_worker import (
    cancel_session_workflow,
    initiate_session_workflow,
    verify_and_submit_confirmation,
)
from backend.config import BASE_DIR, settings
from backend.database import db, get_utc_now
from backend.dsp_engine import (
    FrameDetection,
    GoertzelDTMFEngine,
    decode_audio_stream,
    decode_mulaw,
    generate_dtmf_tone,
    parse_audio_payload,
)
from backend.event_bus import event_bus
from backend.schemas import (
    AuditEventItem,
    AuditListResponse,
    DiagnosticsResponse,
    DspDecodeRequest,
    DspDecodeResponse,
    DspFrameResult,
    EventType,
    HealthResponse,
    IntentExecutionRequest,
    IntentExecutionResponse,
    PortalRecordItem,
    PortalSubmissionRequest,
    PortalSubmissionResponse,
    SessionCancelResponse,
    SessionConfirmRequest,
    SessionConfirmResponse,
    SessionDetail,
    SessionStatus,
    TransactionDetail,
    VerifyFrequencyPairRequest,
    VerifyFrequencyPairResponse,
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("zerohertz.main")

# Uptime tracker
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and graceful shutdown."""
    logger.info("Initializing ZeroHertz Core Engine...")
    db.init_db()
    db.log_audit_event("SYSTEM_STARTUP", {"version": "1.0.0", "env": settings.ENVIRONMENT})
    yield
    logger.info("Shutting down ZeroHertz Application...")
    db.log_audit_event("SYSTEM_SHUTDOWN", {"version": "1.0.0"})


app = FastAPI(
    title="ZeroHertz (0Hz) Acoustic-Verified Transaction API",
    description="High-integrity offline-capable citizen transaction bridge powered by acoustic Goertzel DTMF cryptography.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Static File & Portal Serving
# ---------------------------------------------------------------------------

PORTAL_PATH = BASE_DIR / "portal.html"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"


@app.get("/portal.html", response_class=HTMLResponse)
async def serve_portal():
    """Serve the citizen services portal simulation frontend."""
    if PORTAL_PATH.is_file():
        return FileResponse(str(PORTAL_PATH))
    return HTMLResponse("<h3>Portal interface file portal.html not found.</h3>", status_code=404)


# Mount frontend dist assets if available
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend-assets")


@app.get("/", response_class=HTMLResponse)
async def serve_root():
    """Serve the frontend dashboard SPA, or fall back to portal.html."""
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    if PORTAL_PATH.is_file():
        return FileResponse(str(PORTAL_PATH))
    return HTMLResponse("<h3>ZeroHertz — Frontend not built. Run 'npm run build' in frontend/.</h3>", status_code=404)


# ---------------------------------------------------------------------------
# Health & Diagnostics Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
async def get_health():
    """Liveness and readiness health probe."""
    return HealthResponse(
        status="healthy",
        timestamp=get_utc_now(),
        environment=settings.ENVIRONMENT,
        version="1.0.0",
    )


@app.get("/api/diagnostics", response_model=DiagnosticsResponse)
async def get_diagnostics():
    """Detailed operational and subsystem telemetry."""
    is_chain_valid, audit_rows = db.verify_audit_chain()
    active_sessions = db.list_sessions(limit=500)

    return DiagnosticsResponse(
        status="ok",
        timestamp=get_utc_now(),
        version="1.0.0",
        uptime_seconds=round(time.time() - START_TIME, 2),
        database={
            "path": settings.SQLITE_DB_PATH,
            "audit_chain_valid": is_chain_valid,
            "total_audit_events": len(audit_rows),
        },
        dsp_engine={
            "sample_rate_default": settings.DSP_SAMPLE_RATE_DEFAULT,
            "supported_sample_rates": [8000, 16000, 22050, 44100, 48000],
            "supported_codecs": ["pcm_s16le", "pcm_f32le", "wav", "mulaw"],
            "second_harmonic_max_ratio": settings.DSP_SECOND_HARMONIC_MAX_RATIO,
            "twist_bounds_db": [settings.DSP_TWIST_MIN_DB, settings.DSP_TWIST_MAX_DB],
        },
        active_sessions_count=len(active_sessions),
        active_ws_connections=event_bus.get_connection_count(),
        audio_limits_bytes=settings.MAX_AUDIO_PAYLOAD_BYTES,
    )


# ---------------------------------------------------------------------------
# DSP Audio Processing Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/dsp/decode", response_model=DspDecodeResponse)
async def decode_dsp_audio(req: DspDecodeRequest):
    """Process an audio buffer, running Goertzel DTMF decoding and state machine verification."""
    # 1. Acquire raw samples
    if req.raw_samples is not None and len(req.raw_samples) > 0:
        samples = np.array(req.raw_samples, dtype=np.float32)
        sample_rate = req.sample_rate
    elif req.audio_base64:
        # Check payload size
        raw_bytes = base64.b64decode(req.audio_base64)
        if len(raw_bytes) > settings.MAX_AUDIO_PAYLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Audio payload ({len(raw_bytes)} bytes) exceeds maximum limit ({settings.MAX_AUDIO_PAYLOAD_BYTES} bytes)",
            )
        try:
            samples, sample_rate = parse_audio_payload(raw_bytes, req.audio_format, req.sample_rate)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse audio: {str(e)}")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'audio_base64' or 'raw_samples' must be provided",
        )

    # 2. Run DSP Stream Analysis
    import numpy as np  # local assurance
    keys_str, packets, is_confirmed, detections = decode_audio_stream(samples, sample_rate)

    # 3. Log DTMF events and publish real-time telemetry
    frame_results: List[DspFrameResult] = []
    for d in detections:
        res = DspFrameResult(
            frame_index=d.frame_index,
            timestamp_ms=d.timestamp_ms,
            detected_key=d.detected_key,
            low_freq=d.low_freq,
            high_freq=d.high_freq,
            low_power=d.low_power,
            high_power=d.high_power,
            total_energy=d.total_energy,
            twist_db=d.twist_db,
            second_harmonic_ratio=d.second_harmonic_ratio,
            is_valid_dtmf=d.is_valid,
            rejection_reason=d.rejection_reason,
        )
        frame_results.append(res)

        if d.is_valid and d.detected_key:
            db.record_dtmf_event(
                session_id=req.session_id,
                frame_index=d.frame_index,
                detected_key=d.detected_key,
                low_freq=d.low_freq,
                high_freq=d.high_freq,
                twist_db=d.twist_db,
                total_energy=d.total_energy,
                is_valid=d.is_valid,
            )
            asyncio.create_task(
                event_bus.publish(
                    EventType.DTMF_KEY_DETECTED,
                    {
                        "session_id": req.session_id,
                        "key": d.detected_key,
                        "low_freq": d.low_freq,
                        "high_freq": d.high_freq,
                        "timestamp_ms": d.timestamp_ms,
                    },
                    session_id=req.session_id,
                )
            )

    duration_ms = (len(samples) / float(sample_rate)) * 1000.0

    return DspDecodeResponse(
        detected_sequence=keys_str,
        packets=packets,
        confirmation_detected=is_confirmed,
        total_frames_analyzed=len(detections),
        duration_ms=round(duration_ms, 2),
        sample_rate=sample_rate,
        frame_details=frame_results,
    )


@app.post("/api/dsp/verify-frequency-pair", response_model=VerifyFrequencyPairResponse)
async def verify_frequency_pair(req: VerifyFrequencyPairRequest):
    """Synthetic frequency pair analysis for Goertzel testing and calibration."""
    import numpy as np

    n_samples = int(req.sample_rate * (req.duration_ms / 1000.0))
    t = np.arange(n_samples) / float(req.sample_rate)

    high_gain = 10.0 ** (req.twist_db / 20.0)
    low_wave = np.sin(2.0 * np.pi * req.low_freq * t)
    high_wave = np.sin(2.0 * np.pi * req.high_freq * t) * high_gain
    combined = (low_wave + high_wave) / (1.0 + high_gain) * req.amplitude

    if req.noise_level > 0.0:
        noise = np.random.normal(0, req.noise_level, n_samples)
        combined += noise

    engine = GoertzelDTMFEngine()
    det = engine.analyze_frame(combined.astype(np.float32), req.sample_rate)

    return VerifyFrequencyPairResponse(
        detected_key=det.detected_key,
        is_valid=det.is_valid,
        calculated_twist_db=det.twist_db or 0.0,
        low_power=det.low_power,
        high_power=det.high_power,
        rejection_reason=det.rejection_reason,
    )


# ---------------------------------------------------------------------------
# Intent Execution & Session Workflow
# ---------------------------------------------------------------------------

@app.post("/api/execute-intent", response_model=IntentExecutionResponse)
async def execute_citizen_intent(req: IntentExecutionRequest):
    """Accept natural language intent, stage citizen portal, and initialize confirmation gate."""
    try:
        sid, parsed, challenge, expires_at = await initiate_session_workflow(
            prompt=req.prompt,
            session_id=req.session_id,
            override_data=req.override_data,
        )
        return IntentExecutionResponse(
            session_id=sid,
            status=SessionStatus.INITIALIZED,
            parsed_intent=parsed,
            challenge_token=challenge,
            expires_at=expires_at,
            message="Citizen intent parsed successfully. Portal staged. Awaiting acoustic signature '#5'.",
            portal_preview_url=settings.PORTAL_URL,
        )
    except Exception as e:
        logger.error("Intent execution failure: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intent execution error: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Sessions Management
# ---------------------------------------------------------------------------

@app.get("/api/sessions", response_model=List[SessionDetail])
async def list_sessions(limit: int = Query(50, ge=1, le=500)):
    """List recent sessions."""
    rows = db.list_sessions(limit=limit)
    return [SessionDetail(**r) for r in rows]


@app.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Retrieve full details of a specific session."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session '{session_id}' not found")
    return SessionDetail(**session)


@app.post("/api/sessions/{session_id}/confirm", response_model=SessionConfirmResponse)
async def confirm_session(session_id: str, req: SessionConfirmRequest):
    """Enforce acoustic confirmation gate, submitting form upon valid '#5' signature."""
    challenge_token = req.challenge_response

    # If audio is supplied, verify '#5' acoustically through DSP engine first
    if req.audio_base64:
        raw_bytes = base64.b64decode(req.audio_base64)
        samples, srate = parse_audio_payload(raw_bytes, "pcm_s16le", 8000)
        _, _, is_confirmed, _ = decode_audio_stream(samples, srate)
        if not is_confirmed:
            db.record_confirmation_attempt(
                session_id, req.challenge_response, "#5", False, "Acoustic sequence #5 not found in audio waveform"
            )
            return SessionConfirmResponse(
                session_id=session_id,
                status=SessionStatus.WAITING_FOR_ACOUSTIC_CONFIRMATION,
                success=False,
                receipt_reference_id=None,
                message="Acoustic validation failed: Distinct '#5' sequence not recognized in audio signal.",
                transaction_id=None,
            )
        challenge_token = "#5"

    success, msg, receipt_id, tx_id = await verify_and_submit_confirmation(
        session_id=session_id,
        provided_challenge=challenge_token,
    )

    if not success:
        return SessionConfirmResponse(
            session_id=session_id,
            status=SessionStatus.WAITING_FOR_ACOUSTIC_CONFIRMATION,
            success=False,
            receipt_reference_id=None,
            message=msg,
            transaction_id=None,
        )

    return SessionConfirmResponse(
        session_id=session_id,
        status=SessionStatus.SUBMITTED,
        success=True,
        receipt_reference_id=receipt_id,
        message=msg,
        transaction_id=tx_id,
    )


@app.post("/api/sessions/{session_id}/cancel", response_model=SessionCancelResponse)
async def cancel_session(session_id: str):
    """Explicitly abort a pending session."""
    success, msg = await cancel_session_workflow(session_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
    return SessionCancelResponse(
        session_id=session_id,
        status=SessionStatus.CANCELLED,
        message=msg,
    )


# ---------------------------------------------------------------------------
# Transactions Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/transactions", response_model=List[TransactionDetail])
async def list_transactions(limit: int = Query(50, ge=1, le=500)):
    """List recent transaction records."""
    rows = db.list_transactions(limit=limit)
    return [TransactionDetail(**r) for r in rows]


@app.get("/api/transactions/{transaction_id}", response_model=TransactionDetail)
async def get_transaction(transaction_id: str):
    """Retrieve details of a single transaction."""
    tx = db.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction '{transaction_id}' not found")
    return TransactionDetail(**tx)


# ---------------------------------------------------------------------------
# Cryptographic Audit Trail
# ---------------------------------------------------------------------------

@app.get("/api/audit", response_model=AuditListResponse)
async def get_audit_trail(limit: int = Query(100, ge=1, le=1000)):
    """Return cryptographic SHA-256 chained audit logs and proof of chain validity."""
    is_valid, all_records = db.verify_audit_chain()
    recent_events = db.get_audit_events(limit=limit)
    return AuditListResponse(
        events=[AuditEventItem(**e) for e in recent_events],
        chain_valid=is_valid,
        total_records=len(all_records),
    )


# ---------------------------------------------------------------------------
# Portal Form Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/portal/records", response_model=List[PortalRecordItem])
async def list_portal_records(limit: int = Query(50, ge=1, le=500)):
    """List records filed in the mock citizen portal registry."""
    rows = db.list_portal_records(limit=limit)
    return [PortalRecordItem(**r) for r in rows]


@app.post("/api/portal/submit", response_model=PortalSubmissionResponse)
async def submit_portal_form(req: PortalSubmissionRequest):
    """Submit application directly to citizen services portal.
    
    Acoustic token '#5' is required to satisfy security gate.
    """
    clean_token = req.acoustic_token_field.strip()
    if clean_token != "#5":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid acoustic token '{clean_token}'. Authorized token '#5' required.",
        )

    ref_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
    now = get_utc_now()

    db.insert_portal_record(
        reference_id=ref_id,
        beneficiary_id=req.beneficiary_id,
        citizen_name=req.citizen_name,
        service_type=req.service_type,
        facility=req.facility_select,
        department=req.department_select,
        priority=req.priority,
        acoustic_token=clean_token,
        session_id=req.session_id,
    )

    db.log_audit_event(
        "PORTAL_RECORD_CREATED",
        {"reference_id": ref_id, "beneficiary_id": req.beneficiary_id, "service": req.service_type},
        session_id=req.session_id,
    )

    return PortalSubmissionResponse(
        success=True,
        receipt_reference_id=ref_id,
        message="Application successfully registered with public portal registry.",
        timestamp=now,
        beneficiary_id=req.beneficiary_id,
        citizen_name=req.citizen_name,
        service_type=req.service_type,
    )


@app.get("/api/portal/records/{reference_id}", response_model=PortalRecordItem)
async def get_portal_record(reference_id: str):
    """Retrieve portal submission by receipt reference ID."""
    rec = db.get_portal_record(reference_id)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Reference ID '{reference_id}' not found")
    return PortalRecordItem(**rec)


# ---------------------------------------------------------------------------
# WebSocket Command Center Stream
# ---------------------------------------------------------------------------

@app.websocket("/ws/command-center")
async def websocket_command_center(websocket: WebSocket):
    """Command Center WebSocket streaming live DSP detections and agent state events."""
    await websocket.accept()
    queue = await event_bus.register(websocket)

    try:
        while True:
            # Wait for event from bus and forward to connected client
            event_data = await queue.get()
            await websocket.send_json(event_data)
    except WebSocketDisconnect:
        logger.info("Command center client disconnected gracefully")
    except Exception as e:
        logger.warning("WebSocket transmission error: %s", e)
    finally:
        await event_bus.unregister(websocket)


# ---------------------------------------------------------------------------
# Twilio Voice & Media Stream Stubs (Integration Ready)
# ---------------------------------------------------------------------------

@app.post("/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """TwiML webhook handling inbound telephony calls and connecting media stream."""
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi">ZeroHertz acoustic transaction gate active. Please transmit acoustic verification tones.</Say>
    <Connect>
        <Stream url="wss://zerohertz.local/twilio/stream" />
    </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@app.websocket("/twilio/stream")
async def twilio_stream_websocket(websocket: WebSocket):
    """Bi-directional Twilio media stream receiving base64 G.711 mu-law telephony audio."""
    await websocket.accept()
    logger.info("Twilio telephony media stream connected")
    try:
        while True:
            msg_text = await websocket.receive_text()
            data = json.loads(msg_text)
            if data.get("event") == "media":
                payload_b64 = data["media"]["payload"]
                raw_bytes = base64.b64decode(payload_b64)
                # Decode G.711 mu-law samples for streaming DTMF detection
                samples = decode_mulaw(raw_bytes)
                # Process audio frames in real time
                pass
            elif data.get("event") == "stop":
                logger.info("Twilio media stream stopped")
                break
    except WebSocketDisconnect:
        logger.info("Twilio stream disconnected")
    except Exception as e:
        logger.warning("Twilio stream error: %s", e)
