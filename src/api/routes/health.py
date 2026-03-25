"""Health-check endpoints for infrastructure dependencies."""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from src.core.database import async_session
from src.core.llm_adapter import ollama
from src.core.qdrant_client import qdrant_manager, COLLECTIONS

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------
class ComponentHealth(BaseModel):
    status: str
    detail: Any = None


class SystemHealthResponse(BaseModel):
    status: str
    ollama: ComponentHealth
    qdrant: ComponentHealth
    database: ComponentHealth


class OllamaHealthResponse(BaseModel):
    status: str
    available: bool
    models: list[str] = []


class QdrantCollectionInfo(BaseModel):
    name: str
    points_count: int | None = None
    vectors_count: int | None = None
    status: str | None = None


class QdrantHealthResponse(BaseModel):
    status: str
    collections: list[QdrantCollectionInfo] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _check_ollama() -> ComponentHealth:
    try:
        available = await ollama.is_available()
        return ComponentHealth(
            status="healthy" if available else "unavailable",
            detail={"available": available},
        )
    except Exception as exc:
        return ComponentHealth(status="unhealthy", detail=str(exc))


async def _check_qdrant() -> ComponentHealth:
    try:
        healthy = qdrant_manager.health_check()
        return ComponentHealth(
            status="healthy" if healthy else "unhealthy",
            detail={"connected": healthy},
        )
    except Exception as exc:
        return ComponentHealth(status="unhealthy", detail=str(exc))


async def _check_database() -> ComponentHealth:
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return ComponentHealth(status="healthy", detail={"connected": True})
    except Exception as exc:
        return ComponentHealth(status="unhealthy", detail=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=SystemHealthResponse)
async def overall_health():
    """Aggregate health check for Ollama, Qdrant, and PostgreSQL."""
    ollama_h = await _check_ollama()
    qdrant_h = await _check_qdrant()
    db_h = await _check_database()

    all_healthy = all(
        c.status == "healthy" for c in [ollama_h, qdrant_h, db_h]
    )
    return SystemHealthResponse(
        status="healthy" if all_healthy else "degraded",
        ollama=ollama_h,
        qdrant=qdrant_h,
        database=db_h,
    )


@router.get("/ollama", response_model=OllamaHealthResponse)
async def ollama_health():
    """Check Ollama availability and list loaded models."""
    try:
        import httpx

        async with httpx.AsyncClient(
            base_url=ollama.base_url, timeout=10.0
        ) as client:
            resp = await client.get("/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                model_names = [m["name"] for m in data.get("models", [])]
                return OllamaHealthResponse(
                    status="healthy", available=True, models=model_names
                )
            return OllamaHealthResponse(
                status="unavailable", available=False
            )
    except Exception:
        return OllamaHealthResponse(status="unhealthy", available=False)


@router.get("/qdrant", response_model=QdrantHealthResponse)
async def qdrant_health():
    """Return Qdrant status and per-collection information."""
    try:
        if not qdrant_manager.health_check():
            return QdrantHealthResponse(status="unhealthy")

        infos: list[QdrantCollectionInfo] = []
        for name in COLLECTIONS:
            try:
                raw = qdrant_manager.get_collection_info(name)
                infos.append(QdrantCollectionInfo(**raw))
            except Exception:
                infos.append(QdrantCollectionInfo(name=name, status="missing"))

        return QdrantHealthResponse(status="healthy", collections=infos)
    except Exception:
        return QdrantHealthResponse(status="unhealthy")
