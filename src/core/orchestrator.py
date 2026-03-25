"""Orchestrator: manages agent lifecycle, task routing, and monitoring."""

import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from src.core.celery_app import celery_app

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    CATEGORIZER = "categorizer"
    LEGAL = "legal"
    TRAVEL = "travel"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class TaskResult:
    """Result of an agent task execution."""

    def __init__(
        self,
        task_id: str,
        agent: AgentType,
        status: TaskStatus,
        result: Any = None,
        error: str | None = None,
    ):
        self.task_id = task_id
        self.agent = agent
        self.status = status
        self.result = result
        self.error = error
        self.timestamp = datetime.now(timezone.utc)


class Orchestrator:
    """Central orchestrator for the multi-agent system."""

    # Task routing map: (agent, task_type) -> celery task name
    TASK_MAP: dict[tuple[AgentType, str], str] = {
        # Categorizer
        (AgentType.CATEGORIZER, "bulk_categorize"): "src.agents.categorizer.tasks.bulk_categorize",
        (AgentType.CATEGORIZER, "process_request"): "src.agents.categorizer.tasks.process_purchase_request",
        (AgentType.CATEGORIZER, "process_kp_response"): "src.agents.categorizer.tasks.process_kp_response",
        (AgentType.CATEGORIZER, "rebid"): "src.agents.categorizer.tasks.initiate_rebid",
        # Legal
        (AgentType.LEGAL, "analyze_contract"): "src.agents.legal.tasks.analyze_contract",
        (AgentType.LEGAL, "index_standards"): "src.agents.legal.tasks.index_legal_standards",
        (AgentType.LEGAL, "check_counterparty"): "src.agents.legal.tasks.check_counterparty",
        # Travel
        (AgentType.TRAVEL, "download_receipts"): "src.agents.travel.tasks.download_receipts",
        (AgentType.TRAVEL, "process_receipt"): "src.agents.travel.tasks.process_receipt",
        (AgentType.TRAVEL, "create_1c_request"): "src.agents.travel.tasks.create_1c_request",
        (AgentType.TRAVEL, "link_diadoc"): "src.agents.travel.tasks.link_diadoc_documents",
    }

    def dispatch(
        self,
        agent: AgentType,
        task_type: str,
        payload: dict[str, Any] | None = None,
        priority: int = 5,
    ) -> str:
        """Dispatch a task to the appropriate agent queue.

        Returns the Celery task ID.
        """
        key = (agent, task_type)
        task_name = self.TASK_MAP.get(key)
        if not task_name:
            raise ValueError(f"Unknown task: agent={agent.value}, type={task_type}")

        task_id = str(uuid.uuid4())
        logger.info(
            "Dispatching task %s -> %s (id=%s)", agent.value, task_type, task_id
        )

        celery_app.send_task(
            task_name,
            kwargs=payload or {},
            task_id=task_id,
            priority=priority,
        )

        return task_id

    def get_task_status(self, task_id: str) -> dict[str, Any]:
        """Get the status of a dispatched task."""
        result = celery_app.AsyncResult(task_id)
        return {
            "task_id": task_id,
            "status": result.status,
            "result": result.result if result.ready() else None,
            "traceback": str(result.traceback) if result.failed() else None,
        }

    def revoke_task(self, task_id: str, terminate: bool = False) -> None:
        """Cancel a pending or running task."""
        celery_app.control.revoke(task_id, terminate=terminate)
        logger.info("Revoked task %s (terminate=%s)", task_id, terminate)

    def get_active_tasks(self) -> dict[str, Any]:
        """Get currently active tasks across all workers."""
        inspector = celery_app.control.inspect()
        return {
            "active": inspector.active() or {},
            "reserved": inspector.reserved() or {},
            "scheduled": inspector.scheduled() or {},
        }


# Singleton
orchestrator = Orchestrator()
