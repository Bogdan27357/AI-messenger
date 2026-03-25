"""Agent management endpoints – dispatch tasks to the orchestrator."""

import logging
from typing import Any

from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel, Field

from src.core.orchestrator import orchestrator, AgentType

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared response model
# ---------------------------------------------------------------------------
class TaskDispatchResponse(BaseModel):
    task_id: str
    agent: str
    task_type: str
    message: str = "Task dispatched successfully"


# ---------------------------------------------------------------------------
# Categorizer request models
# ---------------------------------------------------------------------------
class BulkCategorizeRequest(BaseModel):
    filters: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional filters to narrow which items are categorized",
    )
    priority: int = Field(default=5, ge=1, le=10)


class ProcessPurchaseRequest(BaseModel):
    request_id: str = Field(..., description="Purchase-request identifier")
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=1, le=10)


class RebidRequest(BaseModel):
    reason: str = Field(default="", description="Reason for rebid")
    priority: int = Field(default=5, ge=1, le=10)


# ---------------------------------------------------------------------------
# Legal request models
# ---------------------------------------------------------------------------
class LegalAnalyzeRequest(BaseModel):
    instructions: str = Field(default="", description="Additional review instructions")
    priority: int = Field(default=5, ge=1, le=10)


class IndexStandardsRequest(BaseModel):
    directory_path: str = Field(
        ..., description="Server-side path to the standards directory"
    )
    priority: int = Field(default=5, ge=1, le=10)


class CheckCounterpartyRequest(BaseModel):
    inn: str = Field(..., description="Counterparty INN (tax identification number)")
    priority: int = Field(default=5, ge=1, le=10)


# ---------------------------------------------------------------------------
# Travel request models
# ---------------------------------------------------------------------------
class DownloadReceiptsRequest(BaseModel):
    date_from: str | None = Field(None, description="Start date (YYYY-MM-DD)")
    date_to: str | None = Field(None, description="End date (YYYY-MM-DD)")
    priority: int = Field(default=5, ge=1, le=10)


class ProcessReceiptRequest(BaseModel):
    priority: int = Field(default=5, ge=1, le=10)


class CreateRequestModel(BaseModel):
    priority: int = Field(default=5, ge=1, le=10)


class LinkDiadocRequest(BaseModel):
    priority: int = Field(default=5, ge=1, le=10)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _dispatch(agent: AgentType, task_type: str, payload: dict, priority: int) -> TaskDispatchResponse:
    task_id = orchestrator.dispatch(
        agent=agent,
        task_type=task_type,
        payload=payload,
        priority=priority,
    )
    return TaskDispatchResponse(
        task_id=task_id,
        agent=agent.value,
        task_type=task_type,
    )


# ---------------------------------------------------------------------------
# Categorizer endpoints
# ---------------------------------------------------------------------------
@router.post("/categorizer/bulk-categorize", response_model=TaskDispatchResponse)
async def bulk_categorize(body: BulkCategorizeRequest):
    """Trigger bulk categorization of uncategorized items."""
    return _dispatch(
        AgentType.CATEGORIZER,
        "bulk_categorize",
        {"filters": body.filters},
        body.priority,
    )


@router.post("/categorizer/process-request", response_model=TaskDispatchResponse)
async def process_purchase_request(body: ProcessPurchaseRequest):
    """Process a single purchase request through the categorizer."""
    return _dispatch(
        AgentType.CATEGORIZER,
        "process_request",
        {"request_id": body.request_id, **body.payload},
        body.priority,
    )


@router.post("/categorizer/rebid/{request_id}", response_model=TaskDispatchResponse)
async def trigger_rebid(request_id: str, body: RebidRequest | None = None):
    """Initiate a rebid for the given purchase request."""
    body = body or RebidRequest()
    return _dispatch(
        AgentType.CATEGORIZER,
        "rebid",
        {"request_id": request_id, "reason": body.reason},
        body.priority,
    )


# ---------------------------------------------------------------------------
# Legal endpoints
# ---------------------------------------------------------------------------
@router.post("/legal/analyze", response_model=TaskDispatchResponse)
async def analyze_contract(
    file: UploadFile = File(..., description="Contract document (PDF / DOCX)"),
    instructions: str = Form(default=""),
    priority: int = Form(default=5, ge=1, le=10),
):
    """Upload and analyze a contract document."""
    content = await file.read()

    import base64

    encoded = base64.b64encode(content).decode()

    return _dispatch(
        AgentType.LEGAL,
        "analyze_contract",
        {
            "filename": file.filename,
            "content_type": file.content_type,
            "file_b64": encoded,
            "instructions": instructions,
        },
        priority,
    )


@router.post("/legal/index-standards", response_model=TaskDispatchResponse)
async def index_legal_standards(body: IndexStandardsRequest):
    """Index a directory of legal standards into the vector store."""
    return _dispatch(
        AgentType.LEGAL,
        "index_standards",
        {"directory_path": body.directory_path},
        body.priority,
    )


@router.post("/legal/check-counterparty", response_model=TaskDispatchResponse)
async def check_counterparty(body: CheckCounterpartyRequest):
    """Run due-diligence checks on a counterparty by INN."""
    return _dispatch(
        AgentType.LEGAL,
        "check_counterparty",
        {"inn": body.inn},
        body.priority,
    )


# ---------------------------------------------------------------------------
# Travel endpoints
# ---------------------------------------------------------------------------
@router.post("/travel/download-receipts", response_model=TaskDispatchResponse)
async def download_receipts(body: DownloadReceiptsRequest | None = None):
    """Download receipts from Smartway for the given date range."""
    body = body or DownloadReceiptsRequest()
    return _dispatch(
        AgentType.TRAVEL,
        "download_receipts",
        {"date_from": body.date_from, "date_to": body.date_to},
        body.priority,
    )


@router.post("/travel/process-receipt/{receipt_id}", response_model=TaskDispatchResponse)
async def process_receipt(receipt_id: str, body: ProcessReceiptRequest | None = None):
    """OCR and process a single receipt."""
    body = body or ProcessReceiptRequest()
    return _dispatch(
        AgentType.TRAVEL,
        "process_receipt",
        {"receipt_id": receipt_id},
        body.priority,
    )


@router.post("/travel/create-request/{trip_id}", response_model=TaskDispatchResponse)
async def create_1c_request(trip_id: str, body: CreateRequestModel | None = None):
    """Create a 1C expense request for the given trip."""
    body = body or CreateRequestModel()
    return _dispatch(
        AgentType.TRAVEL,
        "create_1c_request",
        {"trip_id": trip_id},
        body.priority,
    )


@router.post("/travel/link-diadoc/{trip_id}", response_model=TaskDispatchResponse)
async def link_diadoc_documents(trip_id: str, body: LinkDiadocRequest | None = None):
    """Link Diadoc documents to the given trip."""
    body = body or LinkDiadocRequest()
    return _dispatch(
        AgentType.TRAVEL,
        "link_diadoc",
        {"trip_id": trip_id},
        body.priority,
    )
