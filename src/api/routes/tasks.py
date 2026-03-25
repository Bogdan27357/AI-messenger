"""Task management endpoints – inspect and cancel dispatched tasks."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.core.orchestrator import orchestrator

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------
class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Any = None
    traceback: str | None = None


class ActiveTasksResponse(BaseModel):
    active: dict[str, Any] = {}
    reserved: dict[str, Any] = {}
    scheduled: dict[str, Any] = {}


class TaskCancelResponse(BaseModel):
    task_id: str
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/active", response_model=ActiveTasksResponse)
async def list_active_tasks():
    """List all active, reserved, and scheduled tasks across workers."""
    try:
        data = orchestrator.get_active_tasks()
        return ActiveTasksResponse(**data)
    except Exception as exc:
        logger.error("Failed to retrieve active tasks: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Could not query workers: {exc}",
        )


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """Get the current status and result of a task."""
    try:
        data = orchestrator.get_task_status(task_id)
        return TaskStatusResponse(**data)
    except Exception as exc:
        logger.error("Failed to get status for task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving task status: {exc}",
        )


@router.delete("/{task_id}", response_model=TaskCancelResponse)
async def cancel_task(task_id: str):
    """Cancel (revoke) a pending or running task."""
    try:
        orchestrator.revoke_task(task_id, terminate=True)
        return TaskCancelResponse(
            task_id=task_id,
            message="Task cancellation requested",
        )
    except Exception as exc:
        logger.error("Failed to cancel task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Error cancelling task: {exc}",
        )
