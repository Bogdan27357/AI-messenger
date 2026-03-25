"""Celery tasks for the Travel agent."""

import asyncio
import logging
from typing import Any

from src.core.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@celery_app.task(name="src.agents.travel.tasks.poll_smartway_trips")
def poll_smartway_trips() -> dict[str, Any]:
    """Periodic: download new receipts from Smartway."""
    from src.agents.travel.agent import travel_agent
    try:
        return _run_async(travel_agent.download_receipts())
    except Exception as exc:
        logger.error("Smartway poll failed: %s", exc, exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="src.agents.travel.tasks.download_receipts", bind=True, max_retries=3)
def download_receipts(self, **kwargs: Any) -> dict[str, Any]:
    """Download receipts from Smartway."""
    from src.agents.travel.agent import travel_agent
    try:
        return _run_async(travel_agent.download_receipts())
    except Exception as exc:
        logger.error("Download receipts failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="src.agents.travel.tasks.process_receipt", bind=True, max_retries=3)
def process_receipt(self, receipt_file_path: str, **kwargs: Any) -> dict[str, Any]:
    """Process a single receipt (OCR + LLM extraction)."""
    from src.agents.travel.agent import travel_agent
    try:
        return _run_async(travel_agent.process_receipt(receipt_file_path))
    except Exception as exc:
        logger.error("Receipt processing failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="src.agents.travel.tasks.create_1c_request", bind=True, max_retries=2)
def create_1c_request(self, trip_id: str, receipts: list[dict] | None = None, **kwargs: Any) -> dict[str, Any]:
    """Create a 1C technical request for a trip."""
    from src.agents.travel.agent import travel_agent
    try:
        return _run_async(travel_agent.create_1c_request(trip_id, receipts or []))
    except Exception as exc:
        logger.error("1C request creation failed for trip %s: %s", trip_id, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="src.agents.travel.tasks.monitor_approvals")
def monitor_approvals(**kwargs: Any) -> dict[str, Any]:
    """Periodic: check approval status of pending requests."""
    from src.agents.travel.agent import travel_agent
    try:
        # In production, this would query DB for pending requests
        pending = kwargs.get("pending_requests", [])
        return _run_async(travel_agent.monitor_approvals(pending))
    except Exception as exc:
        logger.error("Approval monitoring failed: %s", exc, exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="src.agents.travel.tasks.link_diadoc_documents", bind=True, max_retries=2)
def link_diadoc_documents(self, trip_id: str, order_ref: str = "", **kwargs: Any) -> dict[str, Any]:
    """Link closing documents in Diadoc."""
    from src.agents.travel.agent import travel_agent
    try:
        return _run_async(travel_agent.link_diadoc_documents(trip_id, order_ref))
    except Exception as exc:
        logger.error("Diadoc linking failed for trip %s: %s", trip_id, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)
