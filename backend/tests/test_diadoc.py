import pytest
from app.services.diadoc_client import DiadocClient


def test_diadoc_client_init():
    client = DiadocClient()
    assert client.base_url is not None


def test_diadoc_headers():
    client = DiadocClient()
    headers = client._headers()
    assert "Authorization" in headers
    assert "DiadocAuth" in headers["Authorization"]
