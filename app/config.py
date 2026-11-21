"""Application configuration loaded from environment variables (.env)."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed settings for the Server-Monitor service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "production"
    LOG_LEVEL: str = "INFO"
    APP_PORT: int = 8085

    # Beszel Hub connection (read-only API)
    BESZEL_URL: str = "http://host.docker.internal:8090"
    BESZEL_EMAIL: str = ""
    BESZEL_PASSWORD: str = ""
    BESZEL_TIMEOUT_SECONDS: float = 3.0

    # News-AI companion API for Nokia 6.1 battery history
    NEWS_AI_API_URL: str = "http://news_ai_app:8000"
    NEWS_AI_TIMEOUT_SECONDS: float = 4.0

    # Public ports for external quick links on Agents page
    BESZEL_PUBLIC_PORT: int = 8090
    ADGUARD_PUBLIC_PORT: int = 3053


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings singleton."""
    return Settings()


settings = get_settings()
