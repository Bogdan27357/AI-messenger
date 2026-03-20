from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.sync_log import SyncLog
from app.services.ollama import ollama_client

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    # Documents today
    today_count = await db.execute(
        select(func.count(Document.id)).where(Document.created_at >= today_start)
    )
    docs_today = today_count.scalar() or 0

    yesterday_count = await db.execute(
        select(func.count(Document.id)).where(
            Document.created_at >= yesterday_start,
            Document.created_at < today_start,
        )
    )
    docs_yesterday = yesterday_count.scalar() or 0
    docs_change = ((docs_today - docs_yesterday) / max(docs_yesterday, 1)) * 100

    # Department stats
    dept_result = await db.execute(
        select(Document.department, func.count(Document.id))
        .group_by(Document.department)
    )
    dept_stats = [{"department": row[0], "count": row[1]} for row in dept_result.all()]

    # Recent documents
    recent_result = await db.execute(
        select(Document).order_by(Document.created_at.desc()).limit(10)
    )
    recent_docs = [
        {
            "id": str(d.id),
            "title": d.title,
            "department": d.department,
            "category": d.category,
            "onec_status": d.onec_status,
            "created_at": d.created_at.isoformat() if d.created_at else "",
        }
        for d in recent_result.scalars().all()
    ]

    # GPU info from Ollama
    gpu_info = await ollama_client.ps()

    return {
        "docs_today": docs_today,
        "docs_change_percent": round(docs_change, 1),
        "department_stats": dept_stats,
        "recent_documents": recent_docs,
        "gpu_info": gpu_info,
    }
