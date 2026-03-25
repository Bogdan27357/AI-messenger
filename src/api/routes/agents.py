"""Agent management endpoints – dispatch tasks to the orchestrator."""

import logging
from typing import Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.core.orchestrator import orchestrator, AgentType
from src.core.database import async_session

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


# ===========================================================================
# Data-management endpoints (read / update) for the web UI
# ===========================================================================

# --- Categorizer data endpoints ---

@router.get("/categorizer/categories")
async def list_categories():
    """List all categories."""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, name, description, parent_id, created_at, updated_at FROM categories ORDER BY name")
        )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.put("/categorizer/categories/{category_id}")
async def update_category(category_id: str, body: dict[str, Any]):
    """Update a category name (and optionally description)."""
    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="'name' is required")
    description = body.get("description")
    async with async_session() as session:
        result = await session.execute(
            text("""
                UPDATE categories
                SET name = :name,
                    description = COALESCE(:description, description),
                    updated_at = NOW()
                WHERE id = :id::uuid
                RETURNING id, name, description, parent_id, updated_at
            """),
            {"name": name, "description": description, "id": category_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Category not found")
        await session.commit()
    return dict(row)


@router.get("/categorizer/suppliers")
async def list_suppliers():
    """List all suppliers with their categories."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT s.id, s.name, s.inn, s.email, s.phone, s.region, s.is_active,
                       s.created_at, s.updated_at,
                       COALESCE(
                           json_agg(json_build_object('category_id', c.id, 'category_name', c.name))
                           FILTER (WHERE c.id IS NOT NULL), '[]'
                       ) AS categories
                FROM suppliers s
                LEFT JOIN supplier_categories sc ON sc.supplier_id = s.id
                LEFT JOIN categories c ON c.id = sc.category_id
                GROUP BY s.id
                ORDER BY s.name
            """)
        )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/categorizer/requests")
async def list_purchase_requests(
    status: str | None = Query(None, description="Filter by status"),
):
    """List purchase requests with status."""
    async with async_session() as session:
        if status:
            result = await session.execute(
                text("""
                    SELECT pr.id, pr.request_number, pr.description, pr.requester_name,
                           pr.requester_email, pr.status, pr.external_id,
                           pr.created_at, pr.updated_at,
                           c.name AS category_name
                    FROM purchase_requests pr
                    LEFT JOIN categories c ON c.id = pr.category_id
                    WHERE pr.status = :status
                    ORDER BY pr.created_at DESC
                """),
                {"status": status},
            )
        else:
            result = await session.execute(
                text("""
                    SELECT pr.id, pr.request_number, pr.description, pr.requester_name,
                           pr.requester_email, pr.status, pr.external_id,
                           pr.created_at, pr.updated_at,
                           c.name AS category_name
                    FROM purchase_requests pr
                    LEFT JOIN categories c ON c.id = pr.category_id
                    ORDER BY pr.created_at DESC
                """)
            )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/categorizer/kp-responses")
async def list_kp_responses():
    """List commercial proposals (KP responses)."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT co.id, co.purchase_request_id, co.supplier_name, co.price,
                       co.total_amount, co.payment_terms, co.delivery_days,
                       co.currency, co.status, co.received_at, co.file_path,
                       pr.request_number
                FROM commercial_offers co
                LEFT JOIN purchase_requests pr ON pr.id = co.purchase_request_id
                ORDER BY co.received_at DESC
            """)
        )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


class SupplierCategoryBinding(BaseModel):
    supplier_id: str
    category_id: str


@router.post("/categorizer/supplier-category")
async def add_supplier_category(body: SupplierCategoryBinding):
    """Add a supplier-category binding."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                INSERT INTO supplier_categories (supplier_id, category_id, source)
                VALUES (:supplier_id::uuid, :category_id::uuid, 'manual')
                ON CONFLICT (supplier_id, category_id) DO NOTHING
                RETURNING id, supplier_id, category_id, source, created_at
            """),
            {"supplier_id": body.supplier_id, "category_id": body.category_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=409, detail="Binding already exists")
        await session.commit()
    return dict(row)


@router.delete("/categorizer/supplier-category")
async def remove_supplier_category(body: SupplierCategoryBinding):
    """Remove a supplier-category binding."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                DELETE FROM supplier_categories
                WHERE supplier_id = :supplier_id::uuid
                  AND category_id = :category_id::uuid
                RETURNING id
            """),
            {"supplier_id": body.supplier_id, "category_id": body.category_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Binding not found")
        await session.commit()
    return {"status": "deleted"}


# --- Legal data endpoints ---

@router.get("/legal/contracts")
async def list_contracts():
    """List analyzed contracts."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT c.id, c.contract_number, c.title, c.counterparty_name,
                       c.counterparty_inn, c.contract_type, c.file_path,
                       c.status, c.overall_risk, c.created_at, c.updated_at,
                       cr.review_status, cr.reviewed_at
                FROM contracts c
                LEFT JOIN LATERAL (
                    SELECT review_status, reviewed_at
                    FROM contract_reviews
                    WHERE contract_id = c.id
                    ORDER BY reviewed_at DESC
                    LIMIT 1
                ) cr ON TRUE
                ORDER BY c.created_at DESC
            """)
        )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/legal/contracts/{contract_id}/report")
async def get_contract_report(contract_id: str):
    """Get the latest contract analysis report."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT cr.id, cr.contract_id, cr.review_status,
                       cr.critical_errors, cr.recommended_edits,
                       cr.discrepancies, cr.risk_assessment,
                       cr.report_file_path, cr.reviewer_comment, cr.reviewed_at,
                       c.contract_number, c.title, c.counterparty_name
                FROM contract_reviews cr
                JOIN contracts c ON c.id = cr.contract_id
                WHERE cr.contract_id = :contract_id::uuid
                ORDER BY cr.reviewed_at DESC
                LIMIT 1
            """),
            {"contract_id": contract_id},
        )
        row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No review found for this contract")
    return dict(row)


# --- Travel data endpoints ---

@router.get("/travel/trips")
async def list_trips(
    status: str | None = Query(None, description="Filter by status"),
):
    """List trips with statuses."""
    async with async_session() as session:
        if status:
            result = await session.execute(
                text("""
                    SELECT id, employee_name, employee_id, trip_date_start,
                           trip_date_end, route, smartway_trip_id, status,
                           created_at, updated_at
                    FROM travel_trips
                    WHERE status = :status
                    ORDER BY trip_date_start DESC
                """),
                {"status": status},
            )
        else:
            result = await session.execute(
                text("""
                    SELECT id, employee_name, employee_id, trip_date_start,
                           trip_date_end, route, smartway_trip_id, status,
                           created_at, updated_at
                    FROM travel_trips
                    ORDER BY trip_date_start DESC
                """)
            )
        rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/travel/receipts/{trip_id}")
async def list_receipts(trip_id: str):
    """List receipts for a trip."""
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, trip_id, receipt_type, file_path, route, travel_date,
                       tariff_amount, service_fee, other_fees, total_amount,
                       vat_tariff, vat_fees, currency, ocr_confidence, status,
                       created_at
                FROM travel_receipts
                WHERE trip_id = :trip_id::uuid
                ORDER BY travel_date, created_at
            """),
            {"trip_id": trip_id},
        )
        rows = result.mappings().all()
    return [dict(r) for r in rows]
