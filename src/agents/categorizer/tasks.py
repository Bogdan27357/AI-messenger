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

    async def _check():
        from sqlalchemy import text
        from src.core.database import async_session
        from src.agents.categorizer.agent import categorizer_agent

        async with async_session() as session:
            # Find kp_mailings where status='sent' AND either:
            #   - 5 business days have elapsed since sent_at
            #   - OR the purchase request already has >= 3 KP responses
            query = text("""
                SELECT km.id,
                       km.purchase_request_id,
                       pr.request_number,
                       pr.external_id,
                       km.sent_at,
                       COALESCE(co_counts.response_count, 0) AS response_count
                FROM kp_mailings km
                JOIN purchase_requests pr ON pr.id = km.purchase_request_id
                LEFT JOIN (
                    SELECT purchase_request_id, COUNT(*) AS response_count
                    FROM commercial_offers
                    GROUP BY purchase_request_id
                ) co_counts ON co_counts.purchase_request_id = km.purchase_request_id
                WHERE km.status = 'sent'
                  AND (
                    -- 5 business days: add 7 calendar days (Mon-Fri sent),
                    -- or 9 if sent on Sat/Sun; use generate_series to count
                    -- only weekdays between sent_at and NOW().
                    (SELECT COUNT(*)
                     FROM generate_series(
                         (km.sent_at::date + 1),
                         NOW()::date,
                         '1 day'::interval
                     ) d
                     WHERE EXTRACT(ISODOW FROM d) < 6
                    ) >= 5
                    OR COALESCE(co_counts.response_count, 0) >= 3
                  )
            """)
            result = await session.execute(query)
            rows = result.mappings().all()

        rebid_results = []
        for row in rows:
            request_id = str(row["external_id"] or row["request_number"])
            try:
                res = await categorizer_agent.initiate_rebid(request_id)
                rebid_results.append(res)
                logger.info("Rebid initiated for request %s", request_id)
            except Exception as e:
                logger.error("Failed to initiate rebid for %s: %s", request_id, e, exc_info=True)
                rebid_results.append({"request_id": request_id, "status": "error", "error": str(e)})

        return {"status": "checked", "rebids_initiated": len(rebid_results), "results": rebid_results}

    try:
        return _run_async(_check())
    except Exception as exc:
        logger.error("check_rebid_deadlines failed: %s", exc, exc_info=True)
        return {"status": "error", "error": str(exc)}
