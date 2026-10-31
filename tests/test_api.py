from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, normalize_database_url
from app.main import create_app
from app.models import Group, User


def build_test_app():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(test_engine)
    return create_app(test_engine, test_session), test_session


def test_plain_postgres_url_uses_psycopg_three_driver():
    assert normalize_database_url("postgresql://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )
    assert normalize_database_url("postgres://user:pass@host/db") == (
        "postgresql+psycopg://user:pass@host/db"
    )


def test_scoring_rules_endpoint_returns_defaults():
    app, _ = build_test_app()

    with TestClient(app) as client:
        response = client.get("/api/scoring-rules")

    assert response.status_code == 200
    assert {rule["action"]: rule["points"] for rule in response.json()} == {
        "text_message": 3,
        "reaction": 1,
        "media_upload": 4,
        "share_reel": 5,
    }


def test_websocket_event_updates_and_broadcasts_score():
    app, session_factory = build_test_app()
    user_id = uuid4()
    group_id = uuid4()
    with session_factory() as db:
        db.add(User(id=user_id, username="Ada"))
        db.add(Group(id=group_id, name="Builders"))
        db.commit()

    with TestClient(app) as client:
        with client.websocket_connect(f"/ws/groups/{group_id}") as websocket:
            websocket.send_json(
                {
                    "type": "text",
                    "user_id": str(user_id),
                    "content": "Hello team",
                }
            )
            payload = websocket.receive_json()

    assert payload["type"] == "text"
    assert payload["points_awarded"] == 3
    assert payload["total_points"] == 3
    assert payload["live_scores"] == [
        {"user_id": str(user_id), "username": "Ada", "points": 3}
    ]
