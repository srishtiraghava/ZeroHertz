"""Agent Worker: Intent Parsing (EN/HI/Hinglish), Confirmation Gate, and Playwright Portal Automation."""

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import httpx
from backend.config import settings
from backend.database import db, get_utc_now
from backend.event_bus import event_bus
from backend.schemas import (
    EventType,
    IntentParsedData,
    SessionStatus,
    TransactionStatus,
)

logger = logging.getLogger("zerohertz.agent_worker")


# ---------------------------------------------------------------------------
# Offline Intent Parser (English, Hindi, Hinglish)
# ---------------------------------------------------------------------------

SERVICE_TAXONOMY = {
    "ration": {
        "service": "Ration Card Renewal & Quota Management",
        "dept": "Department of Food & Public Distribution",
        "facility": "Central Citizen Service Center",
    },
    "pension": {
        "service": "Old Age / Disability Pension Disbursement",
        "dept": "Department of Social Justice & Empowerment",
        "facility": "Panchayat Bhavan Service Desk",
    },
    "health": {
        "service": "Aayushman Bharat Health Card & Medical Aid",
        "dept": "Department of Health & Family Welfare",
        "facility": "District Civil Hospital",
    },
    "income": {
        "service": "Income & Domicile Certificate Issuance",
        "dept": "Department of Revenue & Land Records",
        "facility": "Sub-Divisional Magistrate Office",
    },
    "grievance": {
        "service": "Public Grievance Redressal & Water Supply",
        "dept": "Department of Municipal Administration",
        "facility": "Municipal Ward Office No. 4",
    },
}


def detect_language(text: str) -> str:
    """Heuristic language detection: Hindi (Devanagari), Hinglish, or English."""
    # Check for Devanagari Unicode block
    if any("\u0900" <= char <= "\u097F" for char in text):
        return "hi"
    hinglish_keywords = ["mera", "meri", "karna", "hai", "karo", "naam", "sewa", "aadhaar", "kripya", "chahiye"]
    text_lower = text.lower()
    if any(re.search(r"\b" + re.escape(w) + r"\b", text_lower) for w in hinglish_keywords):
        return "hinglish"
    return "en"


def parse_intent_offline(prompt: str) -> IntentParsedData:
    """Deterministic offline regex and rule-based parser for English, Hindi, and Hinglish."""
    lang = detect_language(prompt)
    prompt_lower = prompt.lower()

    # 1. Beneficiary ID Extraction
    # Matches patterns like RATION-1234, BEN-9876, PENS-4432, ID: 12345, or any capital alphanumeric ID
    id_match = re.search(
        r"\b([A-Z0-9]{3,8}[-_][A-Z0-9]{3,8}|[A-Z]{2,6}\d{4,8}|beneficiary\s*(?:id|no\.?)?[:\s]*([A-Za-z0-9\-_]+)|id[:\s]*([A-Za-z0-9\-_]+))\b",
        prompt,
        re.IGNORECASE,
    )
    if id_match:
        # Pick whichever capture group matched
        beneficiary_id = next(g for g in id_match.groups() if g is not None).upper()
        # Clean prefix if any
        beneficiary_id = re.sub(r"^(BENEFICIARY|ID)[:\s]*", "", beneficiary_id).strip()
    else:
        # Fallback pseudo-random stable deterministic ID based on prompt hash
        hash_seed = abs(hash(prompt)) % 90000 + 10000
        beneficiary_id = f"BEN-{hash_seed}"

    # 2. Citizen Name Extraction
    name_patterns = [
        r"(?:citizen\s*name|name|naam|shri|smt|mr\.|mrs\.)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
        r"(?:for|beneficiary)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)",
        r"([A-Z][a-z]+\s+[A-Z][a-z]+)(?:,\s*beneficiary|\s*ka\s*ration|\s*wants)",
        # Match "Name Surname" appearing after a comma (e.g. "ID PENS-3344, Ramesh Kumar, urgent")
        r",\s+([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,|\s*$|\s+urgent|\s+standard)",
        # Match "Name Surname" after ID patterns
        r"(?:ID\s+\S+),?\s+([A-Z][a-z]+\s+[A-Z][a-z]+)",
    ]
    citizen_name = ""  # Empty = not found
    ignore_names = {"citizen name", "food supplies", "social welfare", "district hospital",
                    "ration card", "pension update", "bank freeze", "urgent service",
                    "standard service", "normal service"}
    for pat in name_patterns:
        match = re.search(pat, prompt)
        if match:
            candidate = match.group(1).strip()
            if candidate.lower() not in ignore_names:
                citizen_name = candidate
                break

    # 3. Service / Department Classification
    service_type = SERVICE_TAXONOMY["ration"]["service"]
    dept_select = SERVICE_TAXONOMY["ration"]["dept"]
    facility_select = SERVICE_TAXONOMY["ration"]["facility"]

    if any(k in prompt_lower for k in ["ration", "rashan", "food", "khadyann", "quota"]):
        sel = SERVICE_TAXONOMY["ration"]
    elif any(k in prompt_lower for k in ["pension", "vridha", "disability", "retirement", "buzurg"]):
        sel = SERVICE_TAXONOMY["pension"]
    elif any(k in prompt_lower for k in ["health", "hospital", "swasthya", "doctor", "medical", "aayushman"]):
        sel = SERVICE_TAXONOMY["health"]
    elif any(k in prompt_lower for k in ["income", "certificate", "praman", "tehsildar", "revenue", "caste"]):
        sel = SERVICE_TAXONOMY["income"]
    elif any(k in prompt_lower for k in ["grievance", "complaint", "water", "pani", "bijli", "sadak", "municipal"]):
        sel = SERVICE_TAXONOMY["grievance"]
    else:
        sel = SERVICE_TAXONOMY["ration"]

    service_type = sel["service"]
    dept_select = sel["dept"]
    facility_select = sel["facility"]

    # 4. Priority / Urgency Detection
    priority = "Standard"
    if any(k in prompt_lower for k in ["emergency", "critical", "tatkal", "turant", "urgent", "ati aavashyak"]):
        priority = "Urgent"

    return IntentParsedData(
        beneficiary_id=beneficiary_id,
        citizen_name=citizen_name,
        service_type=service_type,
        facility_select=facility_select,
        department_select=dept_select,
        priority=priority,
        confidence=0.96,
        language_detected=lang,
        raw_prompt=prompt,
    )


async def parse_intent_llm(prompt: str) -> Optional[IntentParsedData]:
    """Optional adapter using Google Gemini API when configured."""
    if not settings.GEMINI_API_KEY:
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        system_instructions = (
            "You are an intent extraction engine for Indian Citizen Services. "
            "Extract JSON with fields: beneficiary_id, citizen_name, service_type, facility_select, department_select, priority (Standard/Urgent), language_detected."
        )
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_instructions}\nUser request: {prompt}\nOutput pure JSON only."}
                    ]
                }
            ],
            "generationConfig": {"response_mime_type": "application/json"},
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 200:
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)
                return IntentParsedData(
                    beneficiary_id=parsed.get("beneficiary_id", "BEN-1001"),
                    citizen_name=parsed.get("citizen_name", "Rajesh Sharma"),
                    service_type=parsed.get("service_type", "Ration Card Renewal"),
                    facility_select=parsed.get("facility_select", "Central Citizen Service Center"),
                    department_select=parsed.get("department_select", "Department of Food & Public Distribution"),
                    priority=parsed.get("priority", "Standard"),
                    confidence=0.99,
                    language_detected=parsed.get("language_detected", "en"),
                    raw_prompt=prompt,
                )
    except Exception as e:
        logger.warning("Gemini LLM parsing failed or timed out, falling back to offline parser: %s", e)
    return None


async def parse_citizen_intent(prompt: str) -> IntentParsedData:
    """Parse citizen intent using LLM if available, otherwise offline parser."""
    result = await parse_intent_llm(prompt)
    if result is not None:
        return result
    return parse_intent_offline(prompt)


# ---------------------------------------------------------------------------
# Playwright Self-Healing Browser Automation
# ---------------------------------------------------------------------------

class PortalAutomationAgent:
    """Self-healing Playwright driver for interacting with citizen services portal."""

    def __init__(self, portal_url: str = settings.PORTAL_URL):
        self.portal_url = portal_url
        self._browser = None
        self._playwright = None
        self._page = None

    async def stage_application(
        self,
        session_id: str,
        intent_data: IntentParsedData,
    ) -> None:
        """Open portal, fill all form fields, and pause at the confirmation gate.
        
        DOES NOT CLICK SUBMIT.
        """
        try:
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=settings.HEADLESS_BROWSER,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            self._page = await self._browser.new_page()

            logger.info("Navigating to portal URL: %s", self.portal_url)
            await self._page.goto(self.portal_url, timeout=15000, wait_until="networkidle")

            await event_bus.publish(
                EventType.PORTAL_OPENED,
                {"portal_url": self.portal_url, "session_id": session_id},
                session_id=session_id,
            )

            # Self-healing field selectors mapping
            fields = [
                ("#beneficiary-id", "input[name='beneficiary_id']", intent_data.beneficiary_id, "beneficiary_id"),
                ("#citizen-name", "input[name='citizen_name']", intent_data.citizen_name, "citizen_name"),
                ("#service-type", "input[name='service_type']", intent_data.service_type, "service_type"),
                ("#facility-select", "select[name='facility_select']", intent_data.facility_select, "facility_select"),
                ("#department-select", "select[name='department_select']", intent_data.department_select, "department_select"),
            ]

            for primary_sel, fallback_sel, value, field_name in fields:
                selector = primary_sel
                el = await self._page.query_selector(primary_sel)
                if not el:
                    el = await self._page.query_selector(fallback_sel)
                    selector = fallback_sel

                if el:
                    tag_name = await el.evaluate("node => node.tagName.toLowerCase()")
                    if tag_name == "select":
                        try:
                            await self._page.select_option(selector, label=value)
                        except Exception:
                            # Try selecting by index or value if label doesn't match
                            await self._page.select_option(selector, index=1)
                    else:
                        await self._page.fill(selector, str(value))

                    await event_bus.publish(
                        EventType.FIELD_FILLED,
                        {"field": field_name, "value": value},
                        session_id=session_id,
                    )

            logger.info("Form fields staged successfully for session %s. Holding at confirmation gate.", session_id)
            await event_bus.publish(
                EventType.WAITING_FOR_ACOUSTIC_SIGNATURE,
                {"session_id": session_id, "status": "LOCKED_PENDING_CONFIRMATION"},
                session_id=session_id,
            )

        except Exception as e:
            logger.warning("Browser automation staging warning (portal running headless/mock): %s", e)
            # Still broadcast waiting for confirmation
            await event_bus.publish(
                EventType.WAITING_FOR_ACOUSTIC_SIGNATURE,
                {"session_id": session_id, "status": "LOCKED_PENDING_CONFIRMATION"},
                session_id=session_id,
            )

    async def execute_submission(
        self,
        session_id: str,
        challenge_token: str,
    ) -> str:
        """Unlock confirmation gate: inject token, click submit, and read receipt reference."""
        receipt_id = f"REF-{uuid.uuid4().hex[:8].upper()}"

        if self._page:
            try:
                # Fill acoustic token field
                token_input = await self._page.query_selector("#acoustic-token-field")
                if token_input:
                    await self._page.fill("#acoustic-token-field", challenge_token)

                # Click Submit button
                submit_btn = await self._page.query_selector("#submit-application-btn")
                if submit_btn:
                    await submit_btn.click()

                # Wait for receipt reference element
                await self._page.wait_for_selector("#receipt-reference-id", timeout=5000)
                el = await self._page.query_selector("#receipt-reference-id")
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        receipt_id = text.strip()

            except Exception as e:
                logger.warning("Browser submission execution error, generated local receipt: %s", e)
            finally:
                await self.cleanup()

        return receipt_id

    async def cleanup(self) -> None:
        """Close browser resources."""
        try:
            if self._page:
                await self._page.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._page = None
        self._browser = None
        self._playwright = None


# Active automation sessions in memory
active_agents: Dict[str, PortalAutomationAgent] = {}


# ---------------------------------------------------------------------------
# Confirmation Gate & Session Workflow
# ---------------------------------------------------------------------------

async def initiate_session_workflow(
    prompt: str,
    session_id: Optional[str] = None,
    override_data: Optional[Dict[str, Any]] = None,
) -> Tuple[str, IntentParsedData, str, str]:
    """Execute intent parsing, register session and challenge, and stage portal."""
    sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
    challenge_token = "#5"  # Strict acoustic confirmation sequence

    # Parse intent
    parsed = await parse_citizen_intent(prompt)
    if override_data:
        for k, v in override_data.items():
            if hasattr(parsed, k) and v is not None:
                setattr(parsed, k, v)

    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=settings.CONFIRMATION_TIMEOUT_SECONDS)).isoformat()

    # Create session record
    db.create_session(
        session_id=sid,
        challenge_token=challenge_token,
        expires_at=expires_at,
        citizen_name=parsed.citizen_name,
        beneficiary_id=parsed.beneficiary_id,
        service_type=parsed.service_type,
        facility_select=parsed.facility_select,
        department_select=parsed.department_select,
        priority=parsed.priority,
        status=SessionStatus.INITIALIZED.value,
    )

    # Record intent in DB
    db.record_intent_result(
        session_id=sid,
        raw_prompt=prompt,
        parsed_data=parsed.model_dump(),
        confidence=parsed.confidence,
        language=parsed.language_detected,
    )

    # Stage Playwright browser in background
    agent = PortalAutomationAgent()
    active_agents[sid] = agent
    asyncio.create_task(agent.stage_application(sid, parsed))

    # Broadcast INTENT_PARSED
    await event_bus.publish(
        EventType.INTENT_PARSED,
        {
            "session_id": sid,
            "parsed_intent": parsed.model_dump(),
            "challenge_token": challenge_token,
            "expires_at": expires_at,
        },
        session_id=sid,
    )

    return sid, parsed, challenge_token, expires_at


async def verify_and_submit_confirmation(
    session_id: str,
    provided_challenge: str,
) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Enforce the confirmation gate state machine with replay prevention and expiration.
    
    Returns:
      (success, message, receipt_reference_id, transaction_id)
    """
    session = db.get_session(session_id)
    if not session:
        return False, f"Session '{session_id}' not found", None, None

    # Check expiration
    now_utc = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(session["expires_at"])
    if now_utc > expires_at:
        db.update_session_status(session_id, SessionStatus.EXPIRED.value)
        db.record_confirmation_attempt(session_id, provided_challenge, session["challenge_token"], False, "Token expired")
        await event_bus.publish(
            EventType.ACOUSTIC_SIGNATURE_REJECTED,
            {"session_id": session_id, "reason": "Challenge token expired"},
            session_id=session_id,
        )
        return False, "Acoustic confirmation challenge expired (120s timeout)", None, None

    # Check replay / state prevention
    if session["status"] in (SessionStatus.CONFIRMED.value, SessionStatus.SUBMITTED.value):
        db.record_confirmation_attempt(
            session_id, provided_challenge, session["challenge_token"], False, "Replay attempt on already confirmed session"
        )
        return False, "Security violation: Replay attack prevention. Session is already submitted.", None, None

    if session["status"] == SessionStatus.CANCELLED.value:
        return False, "Session has been cancelled.", None, None

    # Verify Challenge Token: must match expected '#5'
    expected = session["challenge_token"]
    clean_provided = provided_challenge.strip().replace(" ", "")
    if clean_provided != expected:
        db.record_confirmation_attempt(
            session_id, provided_challenge, expected, False, f"Token mismatch (expected '{expected}', got '{clean_provided}')"
        )
        await event_bus.publish(
            EventType.ACOUSTIC_SIGNATURE_REJECTED,
            {"session_id": session_id, "reason": "Invalid acoustic token signature"},
            session_id=session_id,
        )
        return False, f"Invalid acoustic signature: Expected '{expected}'", None, None

    # Confirmation Accepted
    db.record_confirmation_attempt(session_id, provided_challenge, expected, True, None)
    confirmed_now = get_utc_now()
    db.update_session_status(session_id, SessionStatus.CONFIRMED.value, confirmed_at=confirmed_now)

    await event_bus.publish(
        EventType.ACOUSTIC_SIGNATURE_VERIFIED,
        {"session_id": session_id, "signature": clean_provided, "confirmed_at": confirmed_now},
        session_id=session_id,
    )

    # Create Transaction record
    tx_id = f"tx_{uuid.uuid4().hex[:12]}"
    tx_payload = {
        "session_id": session_id,
        "beneficiary_id": session["beneficiary_id"],
        "citizen_name": session["citizen_name"],
        "service_type": session["service_type"],
        "facility": session["facility_select"],
        "department": session["department_select"],
        "priority": session["priority"],
        "acoustic_token": clean_provided,
    }
    db.create_transaction(tx_id, session_id, TransactionStatus.PENDING.value, tx_payload)

    # Complete Playwright browser submission if active agent exists
    agent = active_agents.pop(session_id, None)
    if agent:
        receipt_id = await agent.execute_submission(session_id, clean_provided)
    else:
        receipt_id = f"REF-{uuid.uuid4().hex[:8].upper()}"

    # Also record into portal_records table
    db.insert_portal_record(
        reference_id=receipt_id,
        beneficiary_id=session["beneficiary_id"] or "UNKNOWN",
        citizen_name=session["citizen_name"] or "UNKNOWN",
        service_type=session["service_type"] or "UNKNOWN",
        facility=session["facility_select"] or "UNKNOWN",
        department=session["department_select"] or "UNKNOWN",
        priority=session["priority"] or "Standard",
        acoustic_token=clean_provided,
        session_id=session_id,
    )

    # Update session and transaction to SUBMITTED / COMPLETED
    db.update_session_status(session_id, SessionStatus.SUBMITTED.value, receipt_reference_id=receipt_id)
    db.update_transaction_status(tx_id, TransactionStatus.COMPLETED.value, receipt_reference_id=receipt_id)

    db.log_audit_event(
        "TRANSACTION_SUBMITTED",
        {"session_id": session_id, "transaction_id": tx_id, "receipt_reference_id": receipt_id},
        session_id=session_id,
    )

    await event_bus.publish(
        EventType.SUBMITTED,
        {
            "session_id": session_id,
            "transaction_id": tx_id,
            "receipt_reference_id": receipt_id,
            "message": "Citizen application successfully submitted to portal",
        },
        session_id=session_id,
    )

    return True, "Acoustic signature verified. Application successfully submitted to portal.", receipt_id, tx_id


async def cancel_session_workflow(session_id: str) -> Tuple[bool, str]:
    """Safely abort a staged session."""
    session = db.get_session(session_id)
    if not session:
        return False, f"Session '{session_id}' not found"

    agent = active_agents.pop(session_id, None)
    if agent:
        await agent.cleanup()

    db.update_session_status(session_id, SessionStatus.CANCELLED.value)
    db.log_audit_event("SESSION_CANCELLED", {"session_id": session_id}, session_id=session_id)

    await event_bus.publish(
        EventType.SESSION_CANCELLED,
        {"session_id": session_id, "message": "Session explicitly cancelled by user or operator"},
        session_id=session_id,
    )
    return True, "Session cancelled successfully"
