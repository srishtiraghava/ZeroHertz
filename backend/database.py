"""SQLite Database Layer with Schema Migration, Canonical SHA-256 Audit Chain, and Parameterized CRUD."""

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

from backend.config import settings

GENESIS_HASH = "0" * 64


def get_utc_now() -> str:
    """Return ISO-8601 formatted UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def canonical_json(data: Any) -> str:
    """Deterministic JSON string for canonical serialization."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


class Database:
    """Thread-safe SQLite database manager."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.SQLITE_DB_PATH
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(
            self.db_path,
            timeout=30.0,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def init_db(self) -> None:
        """Initialize all schema tables and indexes idempotently."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Schema versioning table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL,
                description TEXT NOT NULL
            );
            """)

            # Sessions table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                challenge_token TEXT NOT NULL,
                citizen_name TEXT,
                beneficiary_id TEXT,
                service_type TEXT,
                facility_select TEXT,
                department_select TEXT,
                priority TEXT DEFAULT 'Standard',
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                confirmed_at TEXT,
                receipt_reference_id TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);")

            # Transactions table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                status TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                receipt_reference_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);")

            # DTMF events table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS dtmf_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                timestamp TEXT NOT NULL,
                frame_index INTEGER NOT NULL,
                detected_key TEXT,
                low_freq REAL,
                high_freq REAL,
                twist_db REAL,
                total_energy REAL,
                is_valid INTEGER NOT NULL
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_dtmf_session ON dtmf_events(session_id);")

            # Confirmation attempts table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS confirmation_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                challenge_provided TEXT NOT NULL,
                expected_token TEXT NOT NULL,
                is_valid INTEGER NOT NULL,
                attempted_at TEXT NOT NULL,
                error_reason TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_confirm_session ON confirmation_attempts(session_id);")

            # Audit events table (cryptographic hash chain)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                session_id TEXT,
                payload_json TEXT NOT NULL,
                prev_hash TEXT NOT NULL,
                current_hash TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_events(session_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);")

            # Portal records table (mock citizen registry)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS portal_records (
                reference_id TEXT PRIMARY KEY,
                session_id TEXT,
                beneficiary_id TEXT NOT NULL,
                citizen_name TEXT NOT NULL,
                service_type TEXT NOT NULL,
                facility TEXT NOT NULL,
                department TEXT NOT NULL,
                priority TEXT NOT NULL,
                acoustic_token TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_portal_beneficiary ON portal_records(beneficiary_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_portal_session ON portal_records(session_id);")

            # Intent results table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS intent_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                raw_prompt TEXT NOT NULL,
                parsed_json TEXT NOT NULL,
                confidence REAL NOT NULL,
                language TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_intent_session ON intent_results(session_id);")

            # Record baseline migration
            cursor.execute("SELECT version FROM schema_migrations WHERE version = 1;")
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO schema_migrations (version, applied_at, description) VALUES (1, ?, ?)",
                    (get_utc_now(), "Initial ZeroHertz core schema with SHA-256 audit chain"),
                )

    # -----------------------------------------------------------------------
    # Cryptographic Audit Hash Chain
    # -----------------------------------------------------------------------

    def log_audit_event(self, event_type: str, payload: Dict[str, Any], session_id: Optional[str] = None) -> int:
        """Append an audit event, cryptographically linking to the previous event via SHA-256."""
        now = get_utc_now()
        canon_payload = canonical_json(payload)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            # Fetch last audit event hash
            cursor.execute("SELECT id, current_hash FROM audit_events ORDER BY id DESC LIMIT 1;")
            last_row = cursor.fetchone()
            if last_row:
                prev_id = last_row["id"]
                prev_hash = last_row["current_hash"]
                next_id = prev_id + 1
            else:
                prev_hash = GENESIS_HASH
                next_id = 1

            # Compute current hash over (next_id, prev_hash, event_type, session_id, timestamp, canon_payload)
            hash_input = f"{next_id}:{prev_hash}:{event_type}:{session_id or ''}:{now}:{canon_payload}"
            current_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

            cursor.execute(
                """
                INSERT INTO audit_events (event_type, session_id, payload_json, prev_hash, current_hash, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_type, session_id, canon_payload, prev_hash, current_hash, now),
            )
            return cursor.lastrowid

    def verify_audit_chain(self) -> Tuple[bool, List[Dict[str, Any]]]:
        """Verify the integrity of the audit log hash chain."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_events ORDER BY id ASC;")
            rows = [dict(r) for r in cursor.fetchall()]

        if not rows:
            return True, []

        prev_hash = GENESIS_HASH
        for row in rows:
            expected_input = f"{row['id']}:{row['prev_hash']}:{row['event_type']}:{row['session_id'] or ''}:{row['timestamp']}:{row['payload_json']}"
            computed_hash = hashlib.sha256(expected_input.encode("utf-8")).hexdigest()

            if row["prev_hash"] != prev_hash or row["current_hash"] != computed_hash:
                return False, rows
            prev_hash = row["current_hash"]

        return True, rows

    def get_audit_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_events ORDER BY id DESC LIMIT ?;", (limit,))
            return [dict(r) for r in cursor.fetchall()]

    # -----------------------------------------------------------------------
    # Sessions CRUD
    # -----------------------------------------------------------------------

    def create_session(
        self,
        session_id: str,
        challenge_token: str,
        expires_at: str,
        citizen_name: Optional[str] = None,
        beneficiary_id: Optional[str] = None,
        service_type: Optional[str] = None,
        facility_select: Optional[str] = None,
        department_select: Optional[str] = None,
        priority: str = "Standard",
        status: str = "INITIALIZED",
    ) -> Dict[str, Any]:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO sessions (
                    session_id, status, challenge_token, citizen_name, beneficiary_id,
                    service_type, facility_select, department_select, priority,
                    created_at, expires_at, confirmed_at, receipt_reference_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (
                    session_id,
                    status,
                    challenge_token,
                    citizen_name,
                    beneficiary_id,
                    service_type,
                    facility_select,
                    department_select,
                    priority,
                    now,
                    expires_at,
                ),
            )
        self.log_audit_event("SESSION_CREATED", {"session_id": session_id, "challenge_token": challenge_token}, session_id)
        return self.get_session(session_id) or {}

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE session_id = ?;", (session_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?;", (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def update_session_status(
        self,
        session_id: str,
        status: str,
        confirmed_at: Optional[str] = None,
        receipt_reference_id: Optional[str] = None,
    ) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            updates = ["status = ?"]
            params: List[Any] = [status]
            if confirmed_at is not None:
                updates.append("confirmed_at = ?")
                params.append(confirmed_at)
            if receipt_reference_id is not None:
                updates.append("receipt_reference_id = ?")
                params.append(receipt_reference_id)
            params.append(session_id)
            cursor.execute(f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?;", params)

    # -----------------------------------------------------------------------
    # Transactions CRUD
    # -----------------------------------------------------------------------

    def create_transaction(
        self,
        transaction_id: str,
        session_id: str,
        status: str,
        payload: Dict[str, Any],
        receipt_reference_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = get_utc_now()
        payload_str = json.dumps(payload)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO transactions (
                    transaction_id, session_id, status, payload_json, receipt_reference_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (transaction_id, session_id, status, payload_str, receipt_reference_id, now, now),
            )
        return self.get_transaction(transaction_id) or {}

    def get_transaction(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions WHERE transaction_id = ?;", (transaction_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_transactions(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?;", (limit,))
            return [dict(r) for r in cursor.fetchall()]

    def update_transaction_status(
        self,
        transaction_id: str,
        status: str,
        receipt_reference_id: Optional[str] = None,
    ) -> None:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if receipt_reference_id:
                cursor.execute(
                    "UPDATE transactions SET status = ?, receipt_reference_id = ?, updated_at = ? WHERE transaction_id = ?;",
                    (status, receipt_reference_id, now, transaction_id),
                )
            else:
                cursor.execute(
                    "UPDATE transactions SET status = ?, updated_at = ? WHERE transaction_id = ?;",
                    (status, now, transaction_id),
                )

    # -----------------------------------------------------------------------
    # Confirmation Attempts
    # -----------------------------------------------------------------------

    def record_confirmation_attempt(
        self,
        session_id: str,
        challenge_provided: str,
        expected_token: str,
        is_valid: bool,
        error_reason: Optional[str] = None,
    ) -> None:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO confirmation_attempts (
                    session_id, challenge_provided, expected_token, is_valid, attempted_at, error_reason
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (session_id, challenge_provided, expected_token, 1 if is_valid else 0, now, error_reason),
            )

    # -----------------------------------------------------------------------
    # DTMF Events
    # -----------------------------------------------------------------------

    def record_dtmf_event(
        self,
        session_id: Optional[str],
        frame_index: int,
        detected_key: Optional[str],
        low_freq: Optional[float],
        high_freq: Optional[float],
        twist_db: Optional[float],
        total_energy: float,
        is_valid: bool,
    ) -> None:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO dtmf_events (
                    session_id, timestamp, frame_index, detected_key, low_freq, high_freq, twist_db, total_energy, is_valid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    now,
                    frame_index,
                    detected_key,
                    low_freq,
                    high_freq,
                    twist_db,
                    total_energy,
                    1 if is_valid else 0,
                ),
            )

    # -----------------------------------------------------------------------
    # Portal Records
    # -----------------------------------------------------------------------

    def insert_portal_record(
        self,
        reference_id: str,
        beneficiary_id: str,
        citizen_name: str,
        service_type: str,
        facility: str,
        department: str,
        priority: str,
        acoustic_token: str,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO portal_records (
                    reference_id, session_id, beneficiary_id, citizen_name,
                    service_type, facility, department, priority, acoustic_token, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reference_id,
                    session_id,
                    beneficiary_id,
                    citizen_name,
                    service_type,
                    facility,
                    department,
                    priority,
                    acoustic_token,
                    now,
                ),
            )
        return self.get_portal_record(reference_id) or {}

    def get_portal_record(self, reference_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM portal_records WHERE reference_id = ?;", (reference_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_portal_records(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM portal_records ORDER BY created_at DESC LIMIT ?;", (limit,))
            return [dict(r) for r in cursor.fetchall()]

    # -----------------------------------------------------------------------
    # Intent Results
    # -----------------------------------------------------------------------

    def record_intent_result(
        self,
        session_id: str,
        raw_prompt: str,
        parsed_data: Dict[str, Any],
        confidence: float,
        language: str,
    ) -> None:
        now = get_utc_now()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO intent_results (session_id, raw_prompt, parsed_json, confidence, language, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (session_id, raw_prompt, json.dumps(parsed_data), confidence, language, now),
            )


db = Database()
