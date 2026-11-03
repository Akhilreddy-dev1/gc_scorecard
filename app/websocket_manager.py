import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from redis.asyncio.client import PubSub

from app.config import get_settings


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._subscriptions: dict[WebSocket, tuple[PubSub, asyncio.Task[None]]] = {}
        redis_url = get_settings().redis_url
        self.redis = Redis.from_url(redis_url, decode_responses=True) if redis_url else None

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[room_id].add(websocket)
        if self.redis is None:
            return

        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self._channel(room_id))
        task = asyncio.create_task(self._listen(room_id, websocket, pubsub))
        self._subscriptions[websocket] = (pubsub, task)

    async def _listen(self, room_id: str, websocket: WebSocket, pubsub: PubSub) -> None:
        try:
            async for message in pubsub.listen():
                if message.get("type") == "message":
                    await websocket.send_text(message["data"])
        except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
            return
        except Exception:
            # The socket will close when its client or function instance disconnects.
            return

    async def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(room_id)
        if connections:
            connections.discard(websocket)
            if not connections:
                self.active_connections.pop(room_id, None)

        subscription = self._subscriptions.pop(websocket, None)
        if subscription:
            pubsub, task = subscription
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            await pubsub.aclose()

    async def broadcast(self, room_id: str, payload: dict[str, Any]) -> None:
        if self.redis is not None:
            await self.redis.publish(self._channel(room_id), json.dumps(payload))
            return

        for connection in tuple(self.active_connections.get(room_id, ())):
            try:
                await connection.send_json(payload)
            except (WebSocketDisconnect, RuntimeError):
                await self.disconnect(room_id, connection)

    @staticmethod
    def _channel(room_id: str) -> str:
        return f"scorecard:room:{room_id}"


manager = ConnectionManager()
