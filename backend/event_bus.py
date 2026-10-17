"""Async WebSocket Event Distribution Bus for ZeroHertz Command Center."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket

from backend.schemas import EventType

logger = logging.getLogger("zerohertz.event_bus")


class EventBus:
    """Async event bus distributing real-time telemetry to connected WebSocket clients."""

    def __init__(self, queue_maxsize: int = 100):
        self.queue_maxsize = queue_maxsize
        self._subscribers: Dict[WebSocket, asyncio.Queue] = {}
        self._lock = asyncio.Lock()

    async def register(self, websocket: WebSocket) -> asyncio.Queue:
        """Register a new WebSocket connection and provide an isolated bounded event queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=self.queue_maxsize)
        async with self._lock:
            self._subscribers[websocket] = queue
        logger.info("WebSocket subscriber connected. Active clients: %d", len(self._subscribers))

        # Send initial connection establishment message
        init_event = {
            "type": EventType.CONNECTION_ESTABLISHED.value,
            "session_id": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "message": "Connected to ZeroHertz Command Center Telemetry Stream",
                "active_subscribers": len(self._subscribers),
            },
        }
        await queue.put(init_event)
        return queue

    async def unregister(self, websocket: WebSocket) -> None:
        """Safely unregister a disconnected WebSocket client."""
        async with self._lock:
            if websocket in self._subscribers:
                del self._subscribers[websocket]
        logger.info("WebSocket subscriber disconnected. Active clients: %d", len(self._subscribers))

    async def publish(
        self,
        event_type: EventType | str,
        payload: Dict[str, Any],
        session_id: Optional[str] = None,
    ) -> None:
        """Broadcast an event to all connected WebSocket clients."""
        ev_type_str = event_type.value if isinstance(event_type, EventType) else str(event_type)
        event_data = {
            "type": ev_type_str,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }

        async with self._lock:
            subscribers = list(self._subscribers.items())

        for ws, queue in subscribers:
            try:
                if queue.full():
                    try:
                        # Drop oldest item to prevent lag and avoid blocking
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(event_data)
            except Exception as e:
                logger.warning("Failed to queue event for WebSocket: %s", e)

    def get_connection_count(self) -> int:
        """Return the count of active WebSocket subscribers."""
        return len(self._subscribers)


event_bus = EventBus()
