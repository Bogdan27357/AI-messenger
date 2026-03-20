import json
from app.services.ollama import ollama_client


async def check_document_for_diadoc(document_data: dict, model: str = "llama3.1:8b") -> dict:
    """AI-powered document check before sending to Diadoc."""
    prompt = f"""Ты — эксперт по электронному документообороту (ЭДО).
Проверь документ перед отправкой в систему Контур.Диадок.

Данные документа:
{json.dumps(document_data, ensure_ascii=False, indent=2)}

Проверь:
1. Все обязательные поля заполнены (ИНН, КПП, наименование контрагента)
2. ИНН содержит 10 или 12 цифр
3. Суммы корректны (если есть)
4. Даты в правильном формате

Ответь JSON:
{{"ok": true/false, "errors": ["ошибка1", ...], "warnings": ["предупреждение1", ...]}}"""

    response = await ollama_client.generate(prompt, model=model, format_json=True)
    try:
        result = json.loads(response)
        return {
            "ok": result.get("ok", False),
            "errors": result.get("errors", []),
            "warnings": result.get("warnings", []),
        }
    except json.JSONDecodeError:
        return {"ok": False, "errors": ["Ошибка ИИ-проверки"], "warnings": []}
