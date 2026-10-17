"""Application Configuration for ZeroHertz Backend."""

import json
import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Base directory for the repository
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env if present
load_dotenv(BASE_DIR / ".env")


class Settings:
    """ZeroHertz application configuration settings."""

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

    # Database
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", str(BASE_DIR / "zerohertz.db"))

    # Security & Limits
    MAX_AUDIO_PAYLOAD_BYTES: int = int(os.getenv("MAX_AUDIO_PAYLOAD_BYTES", "5242880"))  # 5MB

    @property
    def allowed_origins(self) -> List[str]:
        raw = os.getenv(
            "ALLOWED_ORIGINS",
            '["http://localhost:3000","http://localhost:5173","http://127.0.0.1:8000","http://localhost:8000","*"]',
        )
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [item.strip() for item in raw.split(",") if item.strip()]

    # DSP DTMF Configuration
    DSP_SAMPLE_RATE_DEFAULT: int = int(os.getenv("DSP_SAMPLE_RATE_DEFAULT", "8000"))
    DSP_MIN_FRAME_MS: float = float(os.getenv("DSP_MIN_FRAME_MS", "20.0"))
    DSP_MIN_TONE_DURATION_MS: float = float(os.getenv("DSP_MIN_TONE_DURATION_MS", "40.0"))
    DSP_MIN_SILENCE_DURATION_MS: float = float(os.getenv("DSP_MIN_SILENCE_DURATION_MS", "40.0"))
    DSP_ENERGY_THRESHOLD: float = float(os.getenv("DSP_ENERGY_THRESHOLD", "1e-4"))
    DSP_TWIST_MIN_DB: float = float(os.getenv("DSP_TWIST_MIN_DB", "-6.0"))
    DSP_TWIST_MAX_DB: float = float(os.getenv("DSP_TWIST_MAX_DB", "6.0"))
    DSP_SECOND_HARMONIC_MAX_RATIO: float = float(os.getenv("DSP_SECOND_HARMONIC_MAX_RATIO", "0.15"))

    # Agent & Portal Automation
    PORTAL_URL: str = os.getenv("PORTAL_URL", f"http://localhost:{PORT}/portal.html")
    CONFIRMATION_TIMEOUT_SECONDS: int = int(os.getenv("CONFIRMATION_TIMEOUT_SECONDS", "120"))
    HEADLESS_BROWSER: bool = os.getenv("HEADLESS_BROWSER", "true").lower() in ("true", "1", "yes")

    # Optional Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
