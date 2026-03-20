from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.sync_log import SyncLog
from app.schemas.sync import SyncLogResponse, OneCStatsResponse
from app.services.onec_client import onec_client

router = APIRouter(prefix="/api/1c", tags=["1c"])


@router.get("/counterparties")
async def get_counterparties(q: str = "", user: User = Depends(get_current_user)):
    return await onec_client.get_counterparties(q)


@router.get("/flights")
async def get_flights(date: str = "", user: User = Depends(get_current_user)):
    return await onec_client.get_flights(date)


@router.get("/employees")
async def get_employees(dept: str = "", user: User = Depends(get_current_user)):
    return await onec_client.get_employees(dept)


@router.get("/stats", response_model=OneCStatsResponse)
async def get_stats(user: User = Depends(get_current_user)):
    stats = await onec_client.get_stats()
    return OneCStatsResponse(**stats)


@router.get("/sync-log", response_model=list[SyncLogResponse])
async def get_sync_log(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=100),
):
    query = select(SyncLog).order_by(desc(SyncLog.created_at)).limit(limit)
    if user.role != "admin":
        query = query.where(SyncLog.department == user.department)
    result = await db.execute(query)
    return result.scalars().all()
