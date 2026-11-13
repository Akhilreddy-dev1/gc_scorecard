import os
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.database import Base, normalize_database_url
from app.main import create_app
from app.models import Group, User
from app.routers.groups import PRIVATE_GROUP_ID, issue_auth_token


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


def test_settings_encode_special_characters_in_database_password():
    settings = Settings(
        db_user="postgres",
        db_password="p@ss word#1",
        db_host="pooler.supabase.com",
        db_port=6543,
        db_name="postgres",
    )

    assert settings.database_url == (
        "postgresql+psycopg://postgres:p%40ss+word%231"
        "@pooler.supabase.com:6543/postgres"
    )


def test_scoring_rules_endpoint_returns_defaults():
    app, _ = build_test_app()

    with TestClient(app) as client:
        response = client.get(
            "/api/scoring-rules",
            headers={"Origin": "https://frontend-wheat-gamma-11.vercel.app"},
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "https://frontend-wheat-gamma-11.vercel.app"
    )
    assert {rule["action"]: rule["points"] for rule in response.json()} == {
        "text_message": 3,
        "reaction": 1,
        "media_upload": 4,
        "share_reel": 5,
    }


def test_health_endpoint():
    app, _ = build_test_app()

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_endpoint_supports_service_probes():
    app, _ = build_test_app()

    with TestClient(app) as client:
        get_response = client.get("/")
        head_response = client.head("/")

    assert get_response.status_code == 200
    assert get_response.json()["health"] == "/health"
    assert head_response.status_code == 200


def test_websocket_event_updates_and_broadcasts_score():
    previous_secret = os.environ.get("AUTH_SECRET")
    os.environ["AUTH_SECRET"] = "test-secret"
    get_settings.cache_clear()
    try:
        app, session_factory = build_test_app()
        user_id = uuid4()
        with session_factory() as db:
            db.add(User(id=user_id, username="Akhil"))
            db.add(Group(id=PRIVATE_GROUP_ID, name="The unfiltered hoomans"))
            db.commit()
        token = issue_auth_token(user_id, "akhil")

        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/groups/{PRIVATE_GROUP_ID}?token={token}") as websocket:
                websocket.send_json(
                    {
                        "type": "text",
                        "user_id": str(user_id),
                        "content": "Hello team",
                    }
                )
                payload = websocket.receive_json()
    finally:
        if previous_secret is None:
            os.environ.pop("AUTH_SECRET", None)
        else:
            os.environ["AUTH_SECRET"] = previous_secret
        get_settings.cache_clear()

    assert payload["type"] == "text"
    assert payload["points_awarded"] == 3
    assert payload["total_points"] == 3
    assert payload["username"] == "Akhil"
