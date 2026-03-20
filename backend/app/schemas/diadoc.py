from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class DiadocCheckRequest(BaseModel):
    document_id: uuid.UUID


class DiadocCheckResponse(BaseModel):
    ok: bool
    errors: list[str] = []
    warnings: list[str] = []


class DiadocSendRequest(BaseModel):
    document_id: uuid.UUID
    counterparty_inn: str


class DiadocSendResponse(BaseModel):
    message_id: str
    entity_id: str
    status: str


class DiadocStatusResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    message_id: str
    entity_id: str
    status: str
    ai_check_result: dict
    counterparty_inn: str
    error_message: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DiadocQueueItem(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    status: str
    counterparty_inn: str
    created_at: datetime

    model_config = {"from_attributes": True}
