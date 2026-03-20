import base64
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.sync_log import SyncLog
from app.models.template import Template
from app.schemas.document import GenerateRequest, GenerateResponse, DocumentListItem
from app.services.document_generator import fill_ai_fields, categorize_document, render_docx
from app.services.onec_client import onec_client
from app.config import settings

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/generate", response_model=GenerateResponse)
async def generate_document(
    body: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Template).where(Template.slug == body.template_slug))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if user.role != "admin" and tpl.department != user.department:
        raise HTTPException(status_code=403, detail="Нет доступа к этому шаблону")

    # Fill AI fields
    ai_data = await fill_ai_fields(tpl.fields, body.fields, model=tpl.model_name)

    # Merge all data
    all_data = {**body.fields, **ai_data}

    # Render docx
    template_path = tpl.file_path
    if not Path(template_path).exists():
        template_path = str(Path(settings.TEMPLATES_DIR) / f"{body.template_slug}.docx")
    if not Path(template_path).exists():
        raise HTTPException(status_code=404, detail="Файл шаблона не найден на диске")

    output_path = render_docx(template_path, all_data)

    # AI categorization
    category = await categorize_document(all_data, model=tpl.model_name)

    # Save to 1C
    onec_status = "pending"
    onec_doc_id = ""
    try:
        with open(output_path, "rb") as f:
            file_b64 = base64.b64encode(f.read()).decode()
        onec_result = await onec_client.save_document(
            category=category,
            data=all_data,
            file_base64=file_b64,
            filename=f"{body.template_slug}_{category}.docx",
            user=user.username,
        )
        if onec_result.get("status") == "saved":
            onec_status = "saved"
            onec_doc_id = onec_result.get("doc_id", "")
        else:
            onec_status = "error"
    except Exception:
        onec_status = "error"

    # Save document record
    doc = Document(
        template_slug=body.template_slug,
        title=tpl.title,
        category=category,
        department=tpl.department,
        user_id=user.id,
        input_data=body.fields,
        ai_data=ai_data,
        file_path=output_path,
        onec_doc_id=onec_doc_id,
        onec_status=onec_status,
    )
    db.add(doc)

    # Sync log
    sync_log = SyncLog(
        template_slug=body.template_slug,
        document_id=str(doc.id),
        category=category,
        department=tpl.department,
        status=onec_status,
        message=f"Документ '{tpl.title}' — категория: {category}",
        user_id=str(user.id),
    )
    db.add(sync_log)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/", response_model=list[DocumentListItem])
async def list_documents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    query = select(Document).order_by(desc(Document.created_at)).limit(limit)
    if user.role != "admin":
        query = query.where(Document.department == user.department)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{doc_id}", response_model=GenerateResponse)
async def get_document(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    import uuid
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return doc


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    import uuid
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if not Path(doc.file_path).exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(doc.file_path, filename=f"{doc.title}.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
