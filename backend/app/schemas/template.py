from pydantic import BaseModel
from typing import Optional
import uuid


class FieldSchema(BaseModel):
    name: str
    label: str
    type: str = "text"
    required: bool = False
    source: str = "manual"


class TemplateResponse(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    department: str
    model_name: str
    fields: list[FieldSchema]
    is_active: bool

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    slug: str
    title: str
    description: str = ""
    department: str
    model_name: str = "llama3.1:8b"
    fields: list[FieldSchema] = []
    file_path: str
