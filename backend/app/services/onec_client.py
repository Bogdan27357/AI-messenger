import httpx
from typing import Optional

from app.config import settings

TIMEOUT = 30.0


class OneCClient:
    def __init__(self):
        self.base_url = settings.ONEC_URL
        self.token = settings.ONEC_TOKEN

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def get_counterparties(self, query: str = "") -> list[dict]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/counterparties",
                    params={"q": query} if query else {},
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return []

    async def get_flights(self, date: str = "") -> list[dict]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/flights",
                    params={"date": date} if date else {},
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return []

    async def get_employees(self, dept: str = "") -> list[dict]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/employees",
                    params={"dept": dept} if dept else {},
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return []

    async def get_stats(self) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.get(f"{self.base_url}/stats", headers=self._headers())
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return {"counterparties": 0, "flights": 0, "employees": 0, "documents": 0, "connected": False}

    async def save_document(self, category: str, data: dict, file_base64: str, filename: str, user: str) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/documents",
                    json={
                        "category": category,
                        "data": data,
                        "file_base64": file_base64,
                        "filename": filename,
                        "user": user,
                    },
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                return {"status": "error", "message": str(e)}


onec_client = OneCClient()
