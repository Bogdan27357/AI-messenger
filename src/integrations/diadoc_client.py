"""Kontur.Diadoc API client for electronic document management (EDI/YUЗЭДО)."""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.core.config import settings

logger = logging.getLogger(__name__)


class DiadocClient:
    """Client for Kontur.Diadoc REST API."""

    def __init__(self):
        self.api_url = settings.diadoc.api_url.rstrip("/")
        self.api_key = settings.diadoc.api_key
        self.login = settings.diadoc.login
        self.password = settings.diadoc.password
        self._token: str | None = None

    async def _get_token(self) -> str:
        """Authenticate and get session token."""
        if self._token:
            return self._token

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.api_url}/V3/Authenticate",
                params={"type": "password"},
                headers={"Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key}"},
                json={"login": self.login, "password": self.password},
            )
            resp.raise_for_status()
            self._token = resp.text.strip('"')
            return self._token

    async def _headers(self) -> dict[str, str]:
        token = await self._get_token()
        return {
            "Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key},ddauth_token={token}",
            "Content-Type": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_organizations(self) -> list[dict[str, Any]]:
        """Get user's organizations (boxes)."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.api_url}/GetMyOrganizations",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json().get("Organizations", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def search_documents(
        self,
        box_id: str,
        doc_type: str = "UniversalTransferDocument",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[dict[str, Any]]:
        """Search for closing documents (Acts/UPD) in a box."""
        headers = await self._headers()
        params: dict[str, Any] = {
            "boxId": box_id,
            "filterCategory": doc_type,
        }
        if date_from:
            params["timestampFromTicks"] = date_from
        if date_to:
            params["timestampToTicks"] = date_to

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.api_url}/V3/GetDocuments",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            return resp.json().get("Documents", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def create_document(
        self,
        box_id: str,
        document_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a reconciliation document in Diadoc."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.api_url}/V2/PostMessage",
                headers=headers,
                json={
                    "FromBoxId": box_id,
                    **document_data,
                },
            )
            resp.raise_for_status()
            return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def send_for_signing(
        self,
        box_id: str,
        message_id: str,
        signer_info: dict[str, Any],
    ) -> dict[str, Any]:
        """Send document for signing to the responsible manager."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.api_url}/V3/PostMessagePatch",
                headers=headers,
                json={
                    "BoxId": box_id,
                    "MessageId": message_id,
                    "SignerInfo": signer_info,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def get_document_content(self, box_id: str, message_id: str, entity_id: str) -> bytes:
        """Download document content."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.api_url}/V4/GetEntityContent",
                headers=headers,
                params={
                    "boxId": box_id,
                    "messageId": message_id,
                    "entityId": entity_id,
                },
            )
            resp.raise_for_status()
            return resp.content


diadoc_client = DiadocClient()
