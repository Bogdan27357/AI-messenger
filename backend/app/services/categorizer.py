from app.services.document_generator import categorize_document


async def categorize(data: dict, model: str = "llama3.1:8b") -> str:
    return await categorize_document(data, model)
