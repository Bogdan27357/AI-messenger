"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic import Field


class OllamaSettings(BaseSettings):
    base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    model_primary: str = Field("qwen2.5:32b", alias="OLLAMA_MODEL_PRIMARY")
    model_fast: str = Field("qwen2.5:7b", alias="OLLAMA_MODEL_FAST")
    model_embedding: str = Field("nomic-embed-text", alias="OLLAMA_MODEL_EMBEDDING")
    model_vision: str = Field("llava:13b", alias="OLLAMA_MODEL_VISION")
    timeout: int = Field(300, alias="OLLAMA_TIMEOUT")


class QdrantSettings(BaseSettings):
    host: str = Field("localhost", alias="QDRANT_HOST")
    port: int = Field(6333, alias="QDRANT_PORT")
    grpc_port: int = Field(6334, alias="QDRANT_GRPC_PORT")


class PostgresSettings(BaseSettings):
    host: str = Field("localhost", alias="POSTGRES_HOST")
    port: int = Field(5432, alias="POSTGRES_PORT")
    db: str = Field("mas_db", alias="POSTGRES_DB")
    user: str = Field("mas_user", alias="POSTGRES_USER")
    password: str = Field("mas_secret_password", alias="POSTGRES_PASSWORD")

    @property
    def dsn(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.db}"

    @property
    def dsn_sync(self) -> str:
        return f"postgresql+psycopg2://{self.user}:{self.password}@{self.host}:{self.port}/{self.db}"


class RedisSettings(BaseSettings):
    host: str = Field("localhost", alias="REDIS_HOST")
    port: int = Field(6379, alias="REDIS_PORT")
    password: str = Field("mas_redis_password", alias="REDIS_PASSWORD")

    @property
    def url(self) -> str:
        return f"redis://:{self.password}@{self.host}:{self.port}/0"


class RabbitMQSettings(BaseSettings):
    host: str = Field("localhost", alias="RABBITMQ_HOST")
    port: int = Field(5672, alias="RABBITMQ_PORT")
    user: str = Field("mas_user", alias="RABBITMQ_USER")
    password: str = Field("mas_rabbit_password", alias="RABBITMQ_PASSWORD")

    @property
    def url(self) -> str:
        return f"amqp://{self.user}:{self.password}@{self.host}:{self.port}//"


class MinIOSettings(BaseSettings):
    endpoint: str = Field("localhost:9000", alias="MINIO_ENDPOINT")
    access_key: str = Field("mas_minio_user", alias="MINIO_ACCESS_KEY")
    secret_key: str = Field("mas_minio_password", alias="MINIO_SECRET_KEY")
    bucket: str = Field("mas-documents", alias="MINIO_BUCKET")
    secure: bool = Field(False, alias="MINIO_SECURE")


class OneCSettings(BaseSettings):
    base_url: str = Field("", alias="ODATA_1C_BASE_URL")
    username: str = Field("", alias="ODATA_1C_USERNAME")
    password: str = Field("", alias="ODATA_1C_PASSWORD")


class ExchangeSettings(BaseSettings):
    server: str = Field("", alias="EXCHANGE_SERVER")
    username: str = Field("", alias="EXCHANGE_USERNAME")
    password: str = Field("", alias="EXCHANGE_PASSWORD")
    email: str = Field("", alias="EXCHANGE_EMAIL")


class DiadocSettings(BaseSettings):
    api_url: str = Field("", alias="DIADOC_API_URL")
    api_key: str = Field("", alias="DIADOC_API_KEY")
    login: str = Field("", alias="DIADOC_LOGIN")
    password: str = Field("", alias="DIADOC_PASSWORD")


class SmartwaySettings(BaseSettings):
    base_url: str = Field("", alias="SMARTWAY_BASE_URL")
    login: str = Field("", alias="SMARTWAY_LOGIN")
    password: str = Field("", alias="SMARTWAY_PASSWORD")


class AppSettings(BaseSettings):
    secret_key: str = Field("change-me", alias="SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(480, alias="JWT_EXPIRE_MINUTES")
    log_level: str = Field("INFO", alias="LOG_LEVEL")
    environment: str = Field("development", alias="ENVIRONMENT")

    # Agent-specific
    categorizer_poll_interval: int = Field(300, alias="CATEGORIZER_POLL_INTERVAL")
    categorizer_similarity_threshold: float = Field(0.75, alias="CATEGORIZER_SIMILARITY_THRESHOLD")
    legal_max_pages: int = Field(50, alias="LEGAL_MAX_PAGES")
    travel_ocr_confidence_threshold: float = Field(0.9, alias="TRAVEL_OCR_CONFIDENCE_THRESHOLD")


class Settings:
    """Aggregated settings for the entire application."""

    def __init__(self) -> None:
        self.ollama = OllamaSettings()
        self.qdrant = QdrantSettings()
        self.postgres = PostgresSettings()
        self.redis = RedisSettings()
        self.rabbitmq = RabbitMQSettings()
        self.minio = MinIOSettings()
        self.one_c = OneCSettings()
        self.exchange = ExchangeSettings()
        self.diadoc = DiadocSettings()
        self.smartway = SmartwaySettings()
        self.app = AppSettings()


settings = Settings()
