from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_user: str | None = None
    db_password: str | None = None
    db_host: str | None = None
    db_port: int = 6543
    db_name: str = "postgres"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def database_url(self) -> str:
        if not all((self.db_user, self.db_password, self.db_host)):
            return "sqlite:///./scorecard.db"

        encoded_password = quote_plus(self.db_password)
        return (
            f"postgresql+psycopg://{self.db_user}:{encoded_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
