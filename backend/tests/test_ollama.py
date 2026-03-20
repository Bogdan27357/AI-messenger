import pytest
from app.services.ollama import OllamaClient


def test_ollama_client_init():
    client = OllamaClient()
    assert client.base_url is not None


def test_ollama_default_url():
    client = OllamaClient()
    assert "11434" in client.base_url or "ollama" in client.base_url
