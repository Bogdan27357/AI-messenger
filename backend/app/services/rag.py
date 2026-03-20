import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.config import settings
from app.services.ollama import ollama_client

COLLECTION_NAME = "knowledge_base"
VECTOR_SIZE = 768


def get_qdrant() -> QdrantClient:
    return QdrantClient(url=settings.QDRANT_URL)


async def ensure_collection():
    client = get_qdrant()
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


async def add_document(text: str, metadata: dict = None):
    embedding = await ollama_client.embed(text)
    client = get_qdrant()
    point_id = str(uuid.uuid4())
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(
            id=point_id,
            vector=embedding,
            payload={"text": text, **(metadata or {})},
        )],
    )
    return point_id


async def search(query: str, top_k: int = 5) -> list[dict]:
    embedding = await ollama_client.embed(query)
    client = get_qdrant()
    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=embedding,
        limit=top_k,
    )
    return [
        {"text": hit.payload.get("text", ""), "score": hit.score, "metadata": hit.payload}
        for hit in results
    ]


async def get_stats() -> dict:
    try:
        client = get_qdrant()
        info = client.get_collection(COLLECTION_NAME)
        return {"vectors_count": info.vectors_count, "status": info.status.value}
    except Exception:
        return {"vectors_count": 0, "status": "not_initialized"}
