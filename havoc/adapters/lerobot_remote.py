"""Lerobot Remote Adapter — ruft Robot Bridge auf dem Lerobot-Laptop per HTTP auf."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from adapters.base import RobotAdapter

logger = logging.getLogger(__name__)

# Havoc nutzt mm, Lerobot nutzt Meter
MM_TO_M = 0.001


class LerobotRemoteAdapter(RobotAdapter):
    """Steuert Lerobot SO101 über HTTP-Bridge auf anderem Laptop."""

    def __init__(self, base_url: str = "http://192.168.1.10:9000", timeout: float = 10.0):
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    async def _post(self, path: str, json: dict[str, Any] | None = None) -> dict:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(f"{self._base}{path}", json=json or {})
            r.raise_for_status()
            return r.json()

    async def _get(self, path: str) -> dict:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.get(f"{self._base}{path}")
            r.raise_for_status()
            return r.json()

    def _parse_position(self, position: str) -> tuple[float, float, float]:
        """'x,y,z,rx,ry,rz' (mm) -> (x, y, z) in Meter."""
        parts = position.split(",")
        x_mm = float(parts[0]) if len(parts) > 0 else 0
        y_mm = float(parts[1]) if len(parts) > 1 else 0
        z_mm = float(parts[2]) if len(parts) > 2 else 0
        return x_mm * MM_TO_M, y_mm * MM_TO_M, z_mm * MM_TO_M

    async def pick(self) -> dict:
        await self._post("/grip", {"action": "close"})
        return {"status": "OK", "adapter": "lerobot_remote", "action": "pick"}

    async def place(self, bin_id: str) -> dict:
        await self._post("/grip", {"action": "open"})
        return {"status": "OK", "adapter": "lerobot_remote", "bin": bin_id}

    async def move(self, position: str) -> dict:
        x, y, z = self._parse_position(position)
        await self._post("/move", {"x": x, "y": y, "z": z, "duration": 1.0})
        return {"status": "OK", "adapter": "lerobot_remote"}

    async def stop(self) -> dict:
        # Lerobot Bridge hat kein EmergencyStop — ggf. erweitern
        logger.warning("Lerobot stop not implemented in bridge")
        return {"status": "STOPPED", "adapter": "lerobot_remote"}

    async def heartbeat(self) -> dict:
        try:
            data = await self._get("/heartbeat")
            return {"status": "OK", "adapter": "lerobot_remote", **data}
        except Exception as e:
            return {"status": "ERROR", "adapter": "lerobot_remote", "error": str(e)}

    async def preflight(self) -> dict:
        try:
            data = await self._get("/health")
            if data.get("robot_connected"):
                return {"status": "OK", "adapter": "lerobot_remote", "checks": ["bridge_ok", "robot_connected"]}
            return {"status": "WARN", "adapter": "lerobot_remote", "checks": ["bridge_ok"], "error": "robot not connected"}
        except Exception as e:
            return {"status": "ERROR", "adapter": "lerobot_remote", "error": str(e), "checks": []}
