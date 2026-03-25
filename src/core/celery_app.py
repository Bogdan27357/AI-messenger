"""Celery application configuration for task queue."""

from celery import Celery
from celery.schedules import crontab

from src.core.config import settings

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
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_default_queue="default",
    task_queues={
        "default": {"exchange": "default", "routing_key": "default"},
        "categorizer": {"exchange": "agents", "routing_key": "categorizer"},
        "legal": {"exchange": "agents", "routing_key": "legal"},
        "travel": {"exchange": "agents", "routing_key": "travel"},
    },
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
