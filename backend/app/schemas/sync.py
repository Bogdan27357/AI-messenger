from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class SyncLogResponse(BaseModel):
    id: uuid.UUID
    template_slug: str
    document_id: str
    category: str
    department: str
    status: str
    message: str
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OneCStatsResponse(BaseModel):
    counterparties: int = 0
    flights: int = 0
    employees: int = 0
    documents: int = 0
    connected: bool = False
