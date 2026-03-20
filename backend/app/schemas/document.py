from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime


class GenerateRequest(BaseModel):
    template_slug: str
    fields: dict = {}


class GenerateResponse(BaseModel):
    id: uuid.UUID
    title: str
    template_slug: str
    category: str
    department: str
    input_data: dict
    ai_data: dict
    file_path: str
    onec_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListItem(BaseModel):
    id: uuid.UUID
    title: str
    template_slug: str
    category: str
    department: str
    onec_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
