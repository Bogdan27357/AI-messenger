"""Smartway travel service client (API + RPA fallback)."""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.core.config import settings

logger = logging.getLogger(__name__)


class SmartwayClient:
    """Client for Smartway travel service.

    Attempts API access first; falls back to browser automation (RPA) if needed.
    """

    def __init__(self):
        self.base_url = settings.smartway.base_url.rstrip("/")
        self.login = settings.smartway.login
        self.password = settings.smartway.password
        self._session_token: str | None = None

    async def authenticate(self) -> str:
        """Authenticate with Smartway and get session token."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/auth/login",
                json={"login": self.login, "password": self.password},
            )
            resp.raise_for_status()
            data = resp.json()
            self._session_token = data.get("token", "")
            return self._session_token

    async def _headers(self) -> dict[str, str]:
        if not self._session_token:
            await self.authenticate()
        return {
            "Authorization": f"Bearer {self._session_token}",
            "Accept": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_trips(
        self,
        status: str = "completed",
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get trips from Smartway."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.base_url}/api/trips",
                headers=headers,
                params={"status": status, "limit": limit},
            )
            resp.raise_for_status()
            return resp.json().get("trips", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def download_receipt(self, trip_id: str, document_id: str) -> bytes:
        """Download a receipt/itinerary document."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                f"{self.base_url}/api/trips/{trip_id}/documents/{document_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.content

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_trip_documents(self, trip_id: str) -> list[dict[str, Any]]:
        """List documents for a specific trip."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.base_url}/api/trips/{trip_id}/documents",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json().get("documents", [])

    async def download_via_rpa(self, trip_id: str) -> list[dict[str, Any]]:
        """Fallback: download documents via browser automation (Playwright).

        Returns list of {filename, content_bytes} for downloaded documents.
        """
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("Playwright not installed for RPA fallback")
            return []

        documents = []
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()

            # Login
            await page.goto(f"{self.base_url}/login")
            await page.fill('input[name="login"]', self.login)
            await page.fill('input[name="password"]', self.password)
            await page.click('button[type="submit"]')
            await page.wait_for_load_state("networkidle")

            # Navigate to trip
            await page.goto(f"{self.base_url}/trips/{trip_id}")
            await page.wait_for_load_state("networkidle")

            # Find and download receipt links
            download_links = await page.query_selector_all('a[href*="download"], a[href*="receipt"]')
            for link in download_links:
                async with page.expect_download() as download_info:
                    await link.click()
                download = await download_info.value
                path = await download.path()
                if path:
                    with open(path, "rb") as f:
                        documents.append({
                            "filename": download.suggested_filename,
                            "content": f.read(),
                        })

            await browser.close()

        logger.info("Downloaded %d documents via RPA for trip %s", len(documents), trip_id)
        return documents


smartway_client = SmartwayClient()
