"""Qdrant vector database client with collection management."""

import logging
import uuid
from typing import Any

from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from src.core.config import settings

logger = logging.getLogger(__name__)

# Collection definitions per the specification
COLLECTIONS = {
    "tmc_catalog": {
        "vector_size": 768,
        "distance": models.Distance.COSINE,
        "description": "TMC item embeddings with category metadata",
    },
    "suppliers": {
        "vector_size": 768,
        "distance": models.Distance.COSINE,
        "description": "Supplier embeddings with purchase history",
    },
    "legal_standards": {
        "vector_size": 768,
        "distance": models.Distance.COSINE,
        "description": "Reference contracts, regulations, legal acts (chunks)",
    },
    "legal_precedents": {
        "vector_size": 768,
        "distance": models.Distance.COSINE,
        "description": "Contract review history, precedents, lawyer comments",
    },
    "travel_templates": {
        "vector_size": 768,
        "distance": models.Distance.COSINE,
        "description": "Receipt templates for document type recognition",
    },
}


class QdrantManager:
    """Manages Qdrant collections and vector operations."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        grpc_port: int | None = None,
    ):
        self.host = host or settings.qdrant.host
        self.port = port or settings.qdrant.port
        self.grpc_port = grpc_port or settings.qdrant.grpc_port
        self._client: QdrantClient | None = None

    @property
    def client(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(
                host=self.host,
                port=self.port,
                grpc_port=self.grpc_port,
                prefer_grpc=True,
            )
        return self._client

    def init_collections(self) -> None:
        """Create all required collections if they don't exist."""
        for name, cfg in COLLECTIONS.items():
            try:
                self.client.get_collection(name)
                logger.info("Collection '%s' already exists", name)
            except (UnexpectedResponse, Exception):
                self.client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=cfg["vector_size"],
                        distance=cfg["distance"],
                    ),
                )
                logger.info("Created collection '%s'", name)

    def upsert_points(
        self,
        collection: str,
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
        ids: list[str] | None = None,
    ) -> None:
        """Upsert vectors with payloads into a collection."""
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in vectors]

        points = [
            models.PointStruct(id=pid, vector=vec, payload=pay)
            for pid, vec, pay in zip(ids, vectors, payloads)
        ]

        self.client.upsert(collection_name=collection, points=points)
        logger.info("Upserted %d points into '%s'", len(points), collection)

    def search(
        self,
        collection: str,
        query_vector: list[float],
        top_k: int = 5,
        score_threshold: float | None = None,
        payload_filter: dict[str, Any] | None = None,
    ) -> list[models.ScoredPoint]:
        """Search for similar vectors with optional payload filtering."""
        qdrant_filter = None
        if payload_filter:
            conditions = []
            for key, value in payload_filter.items():
                if isinstance(value, list):
                    conditions.append(
                        models.FieldCondition(
                            key=key, match=models.MatchAny(any=value)
                        )
                    )
                else:
                    conditions.append(
                        models.FieldCondition(
                            key=key, match=models.MatchValue(value=value)
                        )
                    )
            qdrant_filter = models.Filter(must=conditions)

        return self.client.query_points(
            collection_name=collection,
            query=query_vector,
            limit=top_k,
            score_threshold=score_threshold,
            query_filter=qdrant_filter,
        ).points

    def delete_points(self, collection: str, ids: list[str]) -> None:
        """Delete points by IDs."""
        self.client.delete(
            collection_name=collection,
            points_selector=models.PointIdsList(points=ids),
        )

    def get_collection_info(self, collection: str) -> dict[str, Any]:
        """Get collection statistics."""
        info = self.client.get_collection(collection)
        return {
            "name": collection,
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "status": info.status.value,
        }

    def health_check(self) -> bool:
        """Check Qdrant availability."""
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False


# Singleton
qdrant_manager = QdrantManager()
