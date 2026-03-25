"""Celery tasks for the Categorizer agent."""

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


@celery_app.task(name="src.agents.categorizer.tasks.bulk_categorize", bind=True, max_retries=2)
def bulk_categorize(self, data_source: str = "1c", **kwargs: Any) -> dict[str, Any]:
    """Bulk categorize TMC catalog and suppliers."""
    from src.agents.categorizer.agent import categorizer_agent
    try:
        return _run_async(categorizer_agent.bulk_categorize(data_source))
    except Exception as exc:
        logger.error("Bulk categorization failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="src.agents.categorizer.tasks.process_purchase_request", bind=True, max_retries=3)
def process_purchase_request(self, request_id: str, **kwargs: Any) -> dict[str, Any]:
    """Process a single purchase request."""
    from src.agents.categorizer.agent import categorizer_agent
    try:
        return _run_async(categorizer_agent.process_purchase_request(request_id))
    except Exception as exc:
        logger.error("Processing request %s failed: %s", request_id, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="src.agents.categorizer.tasks.process_kp_response", bind=True, max_retries=3)
def process_kp_response(self, email_data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Process an incoming KP response email."""
    from src.agents.categorizer.agent import categorizer_agent
    try:
        return _run_async(categorizer_agent.process_kp_response(email_data))
    except Exception as exc:
        logger.error("Processing KP response failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="src.agents.categorizer.tasks.initiate_rebid", bind=True, max_retries=2)
def initiate_rebid(self, request_id: str, **kwargs: Any) -> dict[str, Any]:
    """Initiate rebid for a purchase request."""
    from src.agents.categorizer.agent import categorizer_agent
    try:
        return _run_async(categorizer_agent.initiate_rebid(request_id))
    except Exception as exc:
        logger.error("Rebid for %s failed: %s", request_id, exc, exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="src.agents.categorizer.tasks.poll_purchase_requests")
def poll_purchase_requests() -> dict[str, Any]:
    """Periodic task: poll 1C for new approved purchase requests."""
    from src.agents.categorizer.agent import categorizer_agent
    from src.integrations.one_c_client import one_c_client

    async def _poll():
        requests = await one_c_client.get_purchase_requests(status="Согласована")
        results = []
        for req in requests:
            req_id = req.get("Ref_Key", "")
            if req_id:
                result = await categorizer_agent.process_purchase_request(req_id)
                results.append(result)
        return {"polled": len(requests), "processed": results}

    try:
        return _run_async(_poll())
    except Exception as exc:
        logger.error("Polling purchase requests failed: %s", exc, exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="src.agents.categorizer.tasks.check_rebid_deadlines")
def check_rebid_deadlines() -> dict[str, Any]:
    """Periodic task: check if any requests need rebid (5 days passed or 3+ KPs)."""
    logger.info("Checking rebid deadlines...")
    # This would query the database for requests that:
    # 1. Were sent more than 5 days ago
    # 2. Have received >= 3 KP responses
    # For now, return placeholder
    return {"status": "checked", "rebids_initiated": 0}
