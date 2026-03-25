"""1C:Enterprise OData REST API client."""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.core.config import settings

logger = logging.getLogger(__name__)


class OneCClient:
    """Client for 1C:Enterprise via OData REST API."""

    def __init__(self):
        self.base_url = settings.one_c.base_url.rstrip("/")
        self.auth = (settings.one_c.username, settings.one_c.password)

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            auth=self.auth,
            timeout=60.0,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_purchase_requests(
        self, status: str = "Согласована", top: int = 50
    ) -> list[dict[str, Any]]:
        """Fetch approved purchase requests from 1C."""
        params = {
            "$filter": f"Статус eq '{status}'",
            "$top": top,
            "$orderby": "Date desc",
            "$format": "json",
        }
        async with self._client() as client:
            resp = await client.get("/Document_ЗаявкаНаЗакупку", params=params)
            resp.raise_for_status()
            return resp.json().get("value", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_tmc_catalog(self, top: int = 1000) -> list[dict[str, Any]]:
        """Fetch TMC (inventory items) catalog."""
        params = {"$top": top, "$format": "json"}
        async with self._client() as client:
            resp = await client.get("/Catalog_Номенклатура", params=params)
            resp.raise_for_status()
            return resp.json().get("value", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_suppliers(self, top: int = 1000) -> list[dict[str, Any]]:
        """Fetch suppliers (counterparties) catalog."""
        params = {
            "$filter": "ЭтоГруппа eq false",
            "$top": top,
            "$format": "json",
        }
        async with self._client() as client:
            resp = await client.get("/Catalog_Контрагенты", params=params)
            resp.raise_for_status()
            return resp.json().get("value", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_purchase_history(self, supplier_ref: str) -> list[dict[str, Any]]:
        """Get purchase history for a supplier (ПТУ documents)."""
        params = {
            "$filter": f"Контрагент_Key eq guid'{supplier_ref}'",
            "$top": 100,
            "$orderby": "Date desc",
            "$format": "json",
        }
        async with self._client() as client:
            resp = await client.get("/Document_ПоступлениеТоваровУслуг", params=params)
            resp.raise_for_status()
            return resp.json().get("value", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def create_technical_request(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a technical request (Техническая заявка) in 1C."""
        async with self._client() as client:
            resp = await client.post("/Document_ТехническаяЗаявка", json=data)
            resp.raise_for_status()
            return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_request_approval_status(self, request_ref: str) -> str:
        """Check approval status of a document."""
        async with self._client() as client:
            resp = await client.get(
                f"/Document_ТехническаяЗаявка(guid'{request_ref}')",
                params={"$format": "json"},
            )
            resp.raise_for_status()
            return resp.json().get("СтатусСогласования", "unknown")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def create_supplier_order(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a supplier order (Заказ поставщику) in 1C."""
        async with self._client() as client:
            resp = await client.post("/Document_ЗаказПоставщику", json=data)
            resp.raise_for_status()
            return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def get_contracts(self, status: str | None = None) -> list[dict[str, Any]]:
        """Fetch contracts from 1C."""
        params: dict[str, Any] = {"$top": 50, "$format": "json", "$orderby": "Date desc"}
        if status:
            params["$filter"] = f"Статус eq '{status}'"
        async with self._client() as client:
            resp = await client.get("/Document_ДоговорКонтрагента", params=params)
            resp.raise_for_status()
            return resp.json().get("value", [])


one_c_client = OneCClient()
