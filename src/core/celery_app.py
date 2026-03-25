"""Celery application configuration for task queue."""

import asyncio
import json
import logging

from celery import Celery
from celery.schedules import crontab
from celery.signals import task_failure
from kombu import Exchange, Queue

from src.core.config import settings

logger = logging.getLogger(__name__)

# Exchanges
default_exchange = Exchange("default", type="direct")
agents_exchange = Exchange("agents", type="direct")
dlx_exchange = Exchange("dlx", type="direct")

celery_app = Celery(
    "mas_agents",
    broker=settings.rabbitmq.url,
    backend=settings.redis.url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Moscow",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_default_queue="default",
    task_queues=(
        Queue("default", default_exchange, routing_key="default",
              queue_arguments={"x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": "dead_letter"}),
        Queue("categorizer", agents_exchange, routing_key="categorizer",
              queue_arguments={"x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": "dead_letter"}),
        Queue("legal", agents_exchange, routing_key="legal",
              queue_arguments={"x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": "dead_letter"}),
        Queue("travel", agents_exchange, routing_key="travel",
              queue_arguments={"x-dead-letter-exchange": "dlx", "x-dead-letter-routing-key": "dead_letter"}),
        Queue("dead_letter", dlx_exchange, routing_key="dead_letter"),
    ),
    task_routes={
        "src.agents.categorizer.tasks.*": {"queue": "categorizer"},
        "src.agents.legal.tasks.*": {"queue": "legal"},
        "src.agents.travel.tasks.*": {"queue": "travel"},
    },
    beat_schedule={
        "poll-1c-purchase-requests": {
            "task": "src.agents.categorizer.tasks.poll_purchase_requests",
            "schedule": settings.app.categorizer_poll_interval,
        },
        "poll-smartway-trips": {
            "task": "src.agents.travel.tasks.poll_smartway_trips",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        "check-kp-deadlines": {
            "task": "src.agents.categorizer.tasks.check_rebid_deadlines",
            "schedule": crontab(minute=0, hour=9),
        },
        "monitor-travel-approvals": {
            "task": "src.agents.travel.tasks.monitor_approvals",
            "schedule": crontab(minute="*/15"),
        },
    },
)

celery_app.autodiscover_tasks([
    "src.agents.categorizer",
    "src.agents.legal",
    "src.agents.travel",
])


# ---------------------------------------------------------------------------
# DLQ error handler: log failed tasks to audit_log table
# ---------------------------------------------------------------------------
@task_failure.connect
def _log_task_failure(sender=None, task_id=None, exception=None,
                      args=None, kwargs=None, traceback=None, einfo=None,
                      **kw):
    """Write a record to the audit_log table whenever a task fails permanently."""
    try:
        from sqlalchemy import text as sa_text
        from src.core.database import async_session

        task_name = sender.name if sender else "unknown"
        details = {
            "task_id": task_id,
            "task_name": task_name,
            "args": list(args) if args else [],
            "kwargs": kwargs or {},
            "exception": str(exception),
            "traceback": str(einfo) if einfo else None,
        }

        async def _insert():
            async with async_session() as session:
                await session.execute(
                    sa_text("""
                        INSERT INTO audit_log (agent_type, action, entity_type, entity_id, details)
                        VALUES (:agent_type, :action, :entity_type, :entity_id, :details)
                    """),
                    {
                        "agent_type": task_name.split(".")[2] if len(task_name.split(".")) > 2 else "unknown",
                        "action": "task_failure",
                        "entity_type": "celery_task",
                        "entity_id": task_id,
                        "details": json.dumps(details, default=str),
                    },
                )
                await session.commit()

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    pool.submit(asyncio.run, _insert()).result(timeout=10)
            else:
                loop.run_until_complete(_insert())
        except RuntimeError:
            asyncio.run(_insert())

    except Exception as log_exc:
        logger.error("Failed to log task failure to audit_log: %s", log_exc, exc_info=True)
