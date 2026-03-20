import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.diadoc_status import DiadocStatus
from app.schemas.diadoc import (
    DiadocCheckRequest, DiadocCheckResponse,
    DiadocSendRequest, DiadocSendResponse,
    DiadocStatusResponse, DiadocQueueItem,
)
from app.services.diadoc_checker import check_document_for_diadoc
from app.services.diadoc_client import diadoc_client

router = APIRouter(prefix="/api/diadoc", tags=["diadoc"])


@router.post("/check", response_model=DiadocCheckResponse)
async def check_document(
    body: DiadocCheckRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.id == body.document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    check_result = await check_document_for_diadoc({**doc.input_data, **doc.ai_data})
    return check_result


@router.post("/send", response_model=DiadocSendResponse)
async def send_document(
    body: DiadocSendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.id == body.document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    # Create status record
    diadoc_status = DiadocStatus(
        document_id=doc.id,
        status="ai_checked",
        counterparty_inn=body.counterparty_inn,
        ai_check_result={"status": "checked"},
    )
    db.add(diadoc_status)
    await db.commit()
    await db.refresh(diadoc_status)

    return DiadocSendResponse(
        message_id=diadoc_status.message_id or str(diadoc_status.id),
        entity_id=diadoc_status.entity_id or "",
        status=diadoc_status.status,
    )


@router.get("/status/{message_id}", response_model=DiadocStatusResponse)
async def get_status(message_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DiadocStatus).where(DiadocStatus.message_id == message_id))
    status_record = result.scalar_one_or_none()
    if not status_record:
        raise HTTPException(status_code=404, detail="Статус не найден")
    return status_record


@router.get("/queue", response_model=list[DiadocQueueItem])
async def get_queue(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DiadocStatus).order_by(desc(DiadocStatus.created_at)).limit(50))
    return result.scalars().all()
