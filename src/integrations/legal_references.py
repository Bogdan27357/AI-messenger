"""Legal reference APIs: EGRUL, KAD (arbitration), bankruptcy registry, FNS."""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.core.config import settings

logger = logging.getLogger(__name__)


class LegalReferencesClient:
    """Client for counterparty verification through legal reference APIs."""

    def __init__(self):
        self.egrul_url = getattr(settings, "app", None) and ""
        self.kad_url = ""
        self.bankruptcy_url = ""
        self.fns_url = ""

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def check_egrul(self, inn: str) -> dict[str, Any]:
        """Check counterparty in EGRUL (Unified State Register of Legal Entities)."""
        if not self.egrul_url:
            logger.warning("EGRUL API URL not configured")
            return {"status": "not_configured", "inn": inn}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.egrul_url}/search", params={"inn": inn})
            resp.raise_for_status()
            data = resp.json()
            return {
                "inn": inn,
                "name": data.get("name", ""),
                "status": data.get("status", ""),
                "registration_date": data.get("registration_date", ""),
                "address": data.get("address", ""),
                "director": data.get("director", ""),
                "is_active": data.get("is_active", False),
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def check_arbitration(self, inn: str) -> dict[str, Any]:
        """Check counterparty in KAD (Kartoteka Arbitrazhnykh Del)."""
        if not self.kad_url:
            logger.warning("KAD API URL not configured")
            return {"status": "not_configured", "inn": inn}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.kad_url}/search", params={"participant_inn": inn})
            resp.raise_for_status()
            data = resp.json()
            return {
                "inn": inn,
                "total_cases": data.get("total", 0),
                "as_defendant": data.get("as_defendant", 0),
                "as_plaintiff": data.get("as_plaintiff", 0),
                "active_cases": data.get("active", 0),
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def check_bankruptcy(self, inn: str) -> dict[str, Any]:
        """Check counterparty in the bankruptcy registry (EFRSB)."""
        if not self.bankruptcy_url:
            logger.warning("Bankruptcy API URL not configured")
            return {"status": "not_configured", "inn": inn}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.bankruptcy_url}/search", params={"inn": inn})
            resp.raise_for_status()
            data = resp.json()
            return {
                "inn": inn,
                "is_bankrupt": data.get("is_bankrupt", False),
                "proceedings": data.get("proceedings", []),
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def check_fns(self, inn: str) -> dict[str, Any]:
        """Check counterparty via FNS (Federal Tax Service)."""
        if not self.fns_url:
            logger.warning("FNS API URL not configured")
            return {"status": "not_configured", "inn": inn}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.fns_url}/check", params={"inn": inn})
            resp.raise_for_status()
            data = resp.json()
            return {
                "inn": inn,
                "tax_debts": data.get("has_debts", False),
                "tax_regime": data.get("tax_regime", ""),
                "last_report_date": data.get("last_report", ""),
            }

    async def full_check(self, inn: str) -> dict[str, Any]:
        """Run all available counterparty checks."""
        import asyncio

        results = await asyncio.gather(
            self.check_egrul(inn),
            self.check_arbitration(inn),
            self.check_bankruptcy(inn),
            self.check_fns(inn),
            return_exceptions=True,
        )

        check_results: dict[str, Any] = {"inn": inn}
        names = ["egrul", "arbitration", "bankruptcy", "fns"]
        for name, result in zip(names, results):
            if isinstance(result, Exception):
                check_results[name] = {"error": str(result)}
            else:
                check_results[name] = result

        # Compute risk
        risk_level = "low"
        if isinstance(results[2], dict) and results[2].get("is_bankrupt"):
            risk_level = "critical"
        elif isinstance(results[1], dict) and results[1].get("as_defendant", 0) > 10:
            risk_level = "high"
        elif isinstance(results[3], dict) and results[3].get("tax_debts"):
            risk_level = "medium"

        check_results["overall_risk"] = risk_level
        return check_results


legal_references = LegalReferencesClient()
