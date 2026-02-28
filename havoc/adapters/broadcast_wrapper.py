"""Broadcast-Wrapper — sendet Roboter-Events an HMI für Animationen."""

from __future__ import annotations

from typing import Any, Callable, Coroutine

from adapters.base import RobotAdapter
from models import FactoryFloorEvent

BroadcastFn = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class BroadcastAdapter(RobotAdapter):
    """Wraps einen Roboter-Adapter und broadcastet Events an die HMI."""

    def __init__(self, inner: RobotAdapter, broadcast: BroadcastFn | None = None):
        self._inner = inner
        self._broadcast = broadcast

    async def _send(self, event: FactoryFloorEvent) -> None:
        if self._broadcast:
            await self._broadcast(event.model_dump())

    async def pick(self) -> dict:
        r = await self._inner.pick()
        await self._send(FactoryFloorEvent(animation="PICK"))
        return r

    async def place(self, bin_id: str) -> dict:
        r = await self._inner.place(bin_id)
        await self._send(FactoryFloorEvent(animation="PLACE", target=bin_id))
        return r

    async def move(self, position: str) -> dict:
        r = await self._inner.move(position)
        await self._send(FactoryFloorEvent(animation="MOVE", target=position))
        return r

    async def stop(self) -> dict:
        r = await self._inner.stop()
        await self._send(FactoryFloorEvent(animation="STOP"))
        return r

    async def heartbeat(self) -> dict:
        return await self._inner.heartbeat()

    async def preflight(self) -> dict:
        return await self._inner.preflight()
