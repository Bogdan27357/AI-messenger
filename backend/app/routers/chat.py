import json

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.ollama import ollama_client
from app.services import rag

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    message: str
    stream: bool = True


@router.post("/message")
async def chat_message(body: ChatMessage, user: User = Depends(get_current_user)):
    # RAG: search knowledge base
    sources = await rag.search(body.message, top_k=5)
    context_parts = [s["text"] for s in sources if s.get("text")]
    context_str = "\n---\n".join(context_parts) if context_parts else "Нет релевантных документов."

    messages = [
        {
            "role": "system",
            "content": f"""Ты — ИИ-помощник платформы Пулково. Отвечай на вопросы сотрудников аэропорта.
Используй следующий контекст из базы знаний:

{context_str}

Если в контексте нет ответа, скажи об этом честно. Отвечай на русском.""",
        },
        {"role": "user", "content": body.message},
    ]

    if body.stream:
        async def event_stream():
            source_data = [{"text": s["text"][:100], "score": s["score"]} for s in sources]
            yield f"data: {json.dumps({'type': 'sources', 'sources': source_data}, ensure_ascii=False)}\n\n"

            generator = await ollama_client.chat(messages, stream=True)
            async for chunk in generator:
                yield f"data: {json.dumps({'type': 'content', 'content': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    response = await ollama_client.chat(messages, stream=False)
    return {"response": response, "sources": [{"text": s["text"][:100], "score": s["score"]} for s in sources]}


@router.post("/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    # Split into chunks
    chunks = [text[i:i + 1000] for i in range(0, len(text), 800)]  # overlapping chunks

    await rag.ensure_collection()
    ids = []
    for chunk in chunks:
        point_id = await rag.add_document(chunk, {"filename": file.filename, "department": user.department})
        ids.append(point_id)

    return {"uploaded": len(ids), "filename": file.filename}


@router.get("/knowledge/stats")
async def knowledge_stats(user: User = Depends(get_current_user)):
    stats = await rag.get_stats()
    return stats
