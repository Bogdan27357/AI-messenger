"""Unit tests for configuration."""

import os


def test_settings_load():
    """Test that settings can be instantiated."""
    from src.core.config import Settings
    s = Settings()
    assert s.ollama.base_url
    assert s.qdrant.port == 6333
    assert s.postgres.port == 5432


def test_postgres_dsn():
    """Test DSN generation."""
    from src.core.config import Settings
    s = Settings()
    dsn = s.postgres.dsn
    assert "postgresql+asyncpg://" in dsn
    assert s.postgres.db in dsn
