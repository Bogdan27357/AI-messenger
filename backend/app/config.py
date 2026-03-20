from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://pulkovo:secret@postgres:5432/pulkovo"
    OLLAMA_URL: str = "http://ollama:11434"
    QDRANT_URL: str = "http://qdrant:6333"

    ONEC_URL: str = "https://1c.pulkovo.internal/api"
    ONEC_TOKEN: str = ""

    DIADOC_API_URL: str = "https://diadoc-api.kontur.ru"
    DIADOC_API_KEY: str = ""

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    TEMPLATES_DIR: str = "app/templates"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
