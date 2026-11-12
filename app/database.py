from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    return database_url


database_url = normalize_database_url(get_settings().database_url)
is_postgres = database_url.startswith("postgresql+")

engine = create_engine(
    database_url,
    future=True,
    pool_pre_ping=True,
    connect_args=(
        {
            "connect_timeout": 10,
            "sslmode": "require",
            # Supabase's transaction pooler does not support prepared statements.
            "prepare_threshold": None,
        }
        if is_postgres
        else {"check_same_thread": False}
    ),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
