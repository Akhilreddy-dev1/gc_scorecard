from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[room_id].add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(room_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(room_id, None)

    async def broadcast(self, room_id: str, payload: dict) -> None:
        for connection in tuple(self.active_connections.get(room_id, ())):
            try:
                await connection.send_json(payload)
            except WebSocketDisconnect:
                self.disconnect(room_id, connection)


manager = ConnectionManager()
