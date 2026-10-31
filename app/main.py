from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, SessionLocal, engine, get_db
from app.routers.scoring_rules import router as scoring_rules_router
from app.seed import seed_scoring_rules
from app.websocket_events import ChatEvent, record_event
from app.websocket_manager import manager


def initialize_database(
    database_engine: Engine = engine,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> None:
    Base.metadata.create_all(bind=database_engine)
    with session_factory() as db:
        seed_scoring_rules(db)


def create_app(
    database_engine: Engine = engine,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize_database(database_engine, session_factory)
        yield

    app = FastAPI(title="Gamified Group Chat API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_app_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = get_app_db
    app.include_router(scoring_rules_router)

    @app.websocket("/ws/groups/{group_id}")
    async def group_chat(websocket: WebSocket, group_id: str) -> None:
        await manager.connect(group_id, websocket)
        try:
            while True:
                try:
                    event = ChatEvent.model_validate(await websocket.receive_json())
                    with session_factory() as db:
                        points_awarded, total_points, live_scores = record_event(
                            db,
                            UUID(group_id),
                            event,
                        )
                    await manager.broadcast(
                        group_id,
                        {
                            "type": event.event_type,
                            "user_id": str(event.user_id),
                            "content": event.content,
                            "message_id": event.message_id,
                            "media_url": event.media_url,
                            "points_awarded": points_awarded,
                            "total_points": total_points,
                            "live_scores": live_scores,
                        },
                    )
                except (ValueError, ValidationError) as error:
                    await websocket.send_json({"error": str(error)})
        except WebSocketDisconnect:
            manager.disconnect(group_id, websocket)

    return app


app = create_app()
