"""Pydantic Models and Schemas for ZeroHertz Backend."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SessionStatus(str, Enum):
    INITIALIZED = "INITIALIZED"
    PORTAL_OPENED = "PORTAL_OPENED"
    FORM_FILLED = "FORM_FILLED"
    WAITING_FOR_ACOUSTIC_CONFIRMATION = "WAITING_FOR_ACOUSTIC_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    SUBMITTED = "SUBMITTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"


class EventType(str, Enum):
    CONNECTION_ESTABLISHED = "CONNECTION_ESTABLISHED"
    SESSION_CREATED = "SESSION_CREATED"
    DSP_FRAME_ANALYZED = "DSP_FRAME_ANALYZED"
    DTMF_KEY_DETECTED = "DTMF_KEY_DETECTED"
    INTENT_PARSED = "INTENT_PARSED"
    PORTAL_OPENED = "PORTAL_OPENED"
    FIELD_FILLED = "FIELD_FILLED"
    WAITING_FOR_ACOUSTIC_SIGNATURE = "WAITING_FOR_ACOUSTIC_SIGNATURE"
    ACOUSTIC_SIGNATURE_VERIFIED = "ACOUSTIC_SIGNATURE_VERIFIED"
    ACOUSTIC_SIGNATURE_REJECTED = "ACOUSTIC_SIGNATURE_REJECTED"
    SUBMITTED = "SUBMITTED"
    TRANSACTION_FAILED = "TRANSACTION_FAILED"
    SESSION_CANCELLED = "SESSION_CANCELLED"


# ---------------------------------------------------------------------------
# DSP Schemas
# ---------------------------------------------------------------------------

class DspDecodeRequest(BaseModel):
    """Payload for decoding DTMF audio."""
    audio_base64: Optional[str] = Field(None, description="Base64 encoded raw PCM or WAV audio bytes")
    audio_format: str = Field("pcm_s16le", description="Audio format: 'pcm_s16le', 'pcm_f32le', 'wav', or 'mulaw'")
    sample_rate: int = Field(8000, description="Sampling rate in Hz (8000 or 44100 supported)")
    session_id: Optional[str] = Field(None, description="Optional associated session ID")
    raw_samples: Optional[List[float]] = Field(None, description="Direct float audio samples in [-1.0, 1.0]")

    @field_validator("sample_rate")
    def validate_sample_rate(cls, v: int) -> int:
        if v not in (8000, 44100, 16000, 22050, 48000):
            raise ValueError("Supported sample rates are 8000, 16000, 22050, 44100, 48000 Hz")
        return v


class DspFrameResult(BaseModel):
    """Result of analyzing an individual audio frame."""
    frame_index: int
    timestamp_ms: float
    detected_key: Optional[str] = None
    low_freq: Optional[float] = None
    high_freq: Optional[float] = None
    low_power: float = 0.0
    high_power: float = 0.0
    total_energy: float = 0.0
    twist_db: Optional[float] = None
    second_harmonic_ratio: Optional[float] = None
    is_valid_dtmf: bool = False
    rejection_reason: Optional[str] = None


class DspDecodeResponse(BaseModel):
    """Response returned from DTMF decoding."""
    detected_sequence: str = Field(..., description="Continuous string of decoded DTMF keys")
    packets: List[str] = Field(default_factory=list, description="Extracted packets between * and #")
    confirmation_detected: bool = Field(False, description="True if '#5' confirmation sequence was recognized")
    total_frames_analyzed: int
    duration_ms: float
    sample_rate: int
    frame_details: List[DspFrameResult] = Field(default_factory=list)


class VerifyFrequencyPairRequest(BaseModel):
    """Test utility to verify Goertzel detection on synthetic or candidate frequency pair."""
    low_freq: float = Field(..., description="Low group frequency candidate in Hz")
    high_freq: float = Field(..., description="High group frequency candidate in Hz")
    sample_rate: int = Field(8000, description="Sample rate in Hz")
    duration_ms: float = Field(50.0, description="Duration in ms")
    amplitude: float = Field(0.5, description="Peak amplitude (0.0 to 1.0)")
    twist_db: float = Field(0.0, description="Twist in dB between high and low frequencies")
    noise_level: float = Field(0.0, description="Gaussian noise standard deviation")


class VerifyFrequencyPairResponse(BaseModel):
    """Result of frequency pair synthetic verification."""
    detected_key: Optional[str]
    is_valid: bool
    calculated_twist_db: float
    low_power: float
    high_power: float
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Intent & Agent Schemas
# ---------------------------------------------------------------------------

class IntentExecutionRequest(BaseModel):
    """Citizen intent expression request."""
    prompt: str = Field(..., min_length=2, max_length=1000, description="Citizen input in English, Hindi, or Hinglish")
    session_id: Optional[str] = Field(None, description="Optional existing session ID to resume or reuse")
    override_data: Optional[Dict[str, Any]] = Field(None, description="Optional overrides for parsed form fields")


class IntentParsedData(BaseModel):
    """Parsed structured intent extracted from prompt."""
    beneficiary_id: str
    citizen_name: str
    service_type: str
    facility_select: str
    department_select: str
    priority: str = "Standard"
    confidence: float = 1.0
    language_detected: str = "en"
    raw_prompt: str


class IntentExecutionResponse(BaseModel):
    """Response returned upon intent execution and browser staging."""
    session_id: str
    status: SessionStatus
    parsed_intent: IntentParsedData
    challenge_token: str = Field(..., description="Acoustic challenge token required for submission (e.g. #5)")
    expires_at: str
    message: str
    portal_preview_url: str


# ---------------------------------------------------------------------------
# Confirmation & Session Management Schemas
# ---------------------------------------------------------------------------

class SessionConfirmRequest(BaseModel):
    """Request to submit confirmation for a staged session."""
    challenge_response: str = Field(..., description="Should be '#5' or raw DTMF acoustic token")
    audio_base64: Optional[str] = Field(None, description="Optional raw audio confirmation recording to verify via DSP")


class SessionConfirmResponse(BaseModel):
    """Response to session confirmation attempt."""
    session_id: str
    status: SessionStatus
    success: bool
    receipt_reference_id: Optional[str] = None
    message: str
    transaction_id: Optional[str] = None


class SessionCancelResponse(BaseModel):
    """Response to session cancellation."""
    session_id: str
    status: SessionStatus
    message: str


class SessionDetail(BaseModel):
    """Comprehensive details of a session."""
    session_id: str
    status: SessionStatus
    challenge_token: str
    created_at: str
    expires_at: str
    confirmed_at: Optional[str] = None
    citizen_name: Optional[str] = None
    beneficiary_id: Optional[str] = None
    service_type: Optional[str] = None
    facility_select: Optional[str] = None
    department_select: Optional[str] = None
    receipt_reference_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Transaction Schemas
# ---------------------------------------------------------------------------

class TransactionDetail(BaseModel):
    """Transaction record detail."""
    transaction_id: str
    session_id: str
    status: TransactionStatus
    payload_json: str
    receipt_reference_id: Optional[str] = None
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Audit Schemas
# ---------------------------------------------------------------------------

class AuditEventItem(BaseModel):
    """Audit log item with cryptographically chained SHA-256 hash."""
    id: int
    event_type: str
    session_id: Optional[str] = None
    payload_json: str
    prev_hash: str
    current_hash: str
    timestamp: str


class AuditListResponse(BaseModel):
    """List of audit events with integrity status."""
    events: List[AuditEventItem]
    chain_valid: bool
    total_records: int


# ---------------------------------------------------------------------------
# Portal Form Schemas
# ---------------------------------------------------------------------------

class PortalSubmissionRequest(BaseModel):
    """Request payload sent when submitting the Citizen Portal form."""
    beneficiary_id: str = Field(..., min_length=3, max_length=64)
    citizen_name: str = Field(..., min_length=2, max_length=128)
    service_type: str = Field(..., min_length=2, max_length=128)
    facility_select: str = Field(..., min_length=2, max_length=128)
    department_select: str = Field(..., min_length=2, max_length=128)
    acoustic_token_field: str = Field(..., description="Must match the active session challenge token")
    priority: str = Field("Standard", description="Standard, Urgent, or Emergency")
    session_id: Optional[str] = None


class PortalSubmissionResponse(BaseModel):
    """Response returned upon portal submission."""
    success: bool
    receipt_reference_id: str
    message: str
    timestamp: str
    beneficiary_id: str
    citizen_name: str
    service_type: str


class PortalRecordItem(BaseModel):
    """Portal record returned from database."""
    reference_id: str
    session_id: Optional[str] = None
    beneficiary_id: str
    citizen_name: str
    service_type: str
    facility: str
    department: str
    priority: str
    acoustic_token: str
    created_at: str


# ---------------------------------------------------------------------------
# WebSocket & Diagnostics Schemas
# ---------------------------------------------------------------------------

class WebSocketMessage(BaseModel):
    """Format for command center WebSocket transmissions."""
    type: EventType
    session_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    payload: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    environment: str
    version: str


class DiagnosticsResponse(BaseModel):
    """In-depth diagnostics response."""
    status: str
    timestamp: str
    version: str
    uptime_seconds: float
    database: Dict[str, Any]
    dsp_engine: Dict[str, Any]
    active_sessions_count: int
    active_ws_connections: int
    audio_limits_bytes: int
