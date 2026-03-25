"""FastAPI application for the multi-agent AI messenger system."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import (
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.config import settings
from src.core.qdrant_client import qdrant_manager

from src.api.routes.health import router as health_router
from src.api.routes.agents import router as agents_router
from src.api.routes.tasks import router as tasks_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
registry = CollectorRegistry()

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
    registry=registry,
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    registry=registry,
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Collect per-request Prometheus metrics."""

    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = request.url.path

        with REQUEST_LATENCY.labels(method=method, endpoint=path).time():
            response = await call_next(request)

        REQUEST_COUNT.labels(
            method=method, endpoint=path, status=response.status_code
        ).inc()
        return response


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle handler."""
    logger.info("Initializing Qdrant collections...")
    try:
        qdrant_manager.init_collections()
        logger.info("Qdrant collections ready.")
    except Exception as exc:
        logger.error("Failed to initialize Qdrant collections: %s", exc)

    yield  # application runs

    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Messenger – Multi-Agent System",
    description="Orchestration API for categorizer, legal, and travel agents.",
    version="0.1.0",
    lifespan=lifespan,
)

# -- CORS ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Prometheus ------------------------------------------------------------
app.add_middleware(PrometheusMiddleware)

# -- Routers ---------------------------------------------------------------
app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(agents_router, prefix="/agents", tags=["agents"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])


# -- Root & metrics endpoints ----------------------------------------------
@app.get("/", tags=["system"])
async def root():
    """Return basic system information."""
    return {
        "service": "AI Messenger – Multi-Agent System",
        "version": "0.1.0",
        "environment": settings.app.environment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics", tags=["system"], include_in_schema=False)
async def metrics():
    """Expose Prometheus metrics."""
    return Response(
        content=generate_latest(registry),
        media_type=CONTENT_TYPE_LATEST,
    )
