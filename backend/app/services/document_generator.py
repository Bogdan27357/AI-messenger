import json
import os
import uuid
from pathlib import Path

from docxtpl import DocxTemplate

from app.config import settings
from app.services.ollama import ollama_client


GENERATED_DIR = Path("generated_documents")
GENERATED_DIR.mkdir(exist_ok=True)


async def fill_ai_fields(fields: list[dict], provided_data: dict, model: str = "llama3.1:8b") -> dict:
    """Use Ollama to fill fields with source='ai' that are not provided."""
    ai_fields = [f for f in fields if f.get("source") == "ai" and f["name"] not in provided_data]
    if not ai_fields:
        return {}

    field_descriptions = "\n".join(
        f'- "{f["name"]}": {f.get("label", f["name"])}' for f in ai_fields
    )
    context_str = json.dumps(provided_data, ensure_ascii=False, indent=2)

    prompt = f"""Ты — ИИ-помощник для генерации документов аэропорта Пулково.
На основе контекста документа заполни следующие поля.
Контекст (уже заполненные поля):
{context_str}

Заполни эти поля (в формате JSON):
{field_descriptions}

Ответь ТОЛЬКО валидным JSON с ключами-именами полей и строковыми значениями."""

    response = await ollama_client.generate(prompt, model=model, format_json=True)
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return {}


async def categorize_document(data: dict, model: str = "llama3.1:8b") -> str:
    """Use AI to determine the 1C category for a document."""
    categories = [
        "reconciliation_act", "invoice", "hr_order", "commercial_offer",
        "certificate", "service_act", "memo", "procurement", "legal", "marketing",
    ]
    prompt = f"""Определи категорию документа для учётной системы 1С.
Данные документа: {json.dumps(data, ensure_ascii=False)}

Допустимые категории: {', '.join(categories)}

Ответь JSON: {{"category": "..."}}"""

    response = await ollama_client.generate(prompt, model=model, format_json=True)
    try:
        result = json.loads(response)
        cat = result.get("category", "certificate")
        return cat if cat in categories else "certificate"
    except json.JSONDecodeError:
        return "certificate"


def render_docx(template_path: str, context: dict) -> str:
    """Render a .docx template with the given context. Returns the output file path."""
    tpl = DocxTemplate(template_path)
    tpl.render(context)

    filename = f"{uuid.uuid4().hex}.docx"
    output_path = str(GENERATED_DIR / filename)
    tpl.save(output_path)
    return output_path
