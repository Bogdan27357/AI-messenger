"""RAG (Retrieval-Augmented Generation) pipeline.

Implements the unified RAG pipeline:
1. Indexing: chunk documents, embed via Ollama, store in Qdrant
2. Search: embed query, search Qdrant for top-K relevant chunks
3. Generation: inject chunks into LLM prompt, generate answer
"""

import logging
import re
from typing import Any

from src.core.llm_adapter import OllamaAdapter, ollama
from src.core.qdrant_client import QdrantManager, qdrant_manager

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 750   # tokens (not characters)
DEFAULT_CHUNK_OVERLAP = 100  # tokens
DEFAULT_TOP_K = 5

# Heuristic: 1 token ≈ 4 chars for English (Latin), ≈ 2 chars for Russian (Cyrillic).
_CYRILLIC_RE = re.compile(r'[\u0400-\u04FF]')


def _estimate_tokens(text: str) -> int:
    """Estimate token count using a language-aware heuristic.

    For each word: if it contains Cyrillic characters, use 1 token per 2 chars;
    otherwise use 1 token per 4 chars.  Minimum 1 token per word.
    """
    words = text.split()
    tokens = 0
    for word in words:
        if _CYRILLIC_RE.search(word):
            tokens += max(1, (len(word) + 1) // 2)
        else:
            tokens += max(1, (len(word) + 3) // 4)
    return tokens


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Split text into overlapping chunks by approximate token count.

    Uses a language-aware heuristic (≈4 chars/token for English,
    ≈2 chars/token for Russian).  Attempts to split at sentence
    boundaries for cleaner chunks.
    """
    if not text.strip():
        return []

    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[str] = []
    current_chunk = ""
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = _estimate_tokens(sentence)
        if current_tokens + sentence_tokens > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Overlap: walk backwards through words to collect ~overlap tokens
            words = current_chunk.split()
            overlap_words: list[str] = []
            overlap_tokens = 0
            for w in reversed(words):
                w_tok = max(1, (len(w) + 1) // 2) if _CYRILLIC_RE.search(w) else max(1, (len(w) + 3) // 4)
                if overlap_tokens + w_tok > overlap:
                    break
                overlap_words.append(w)
                overlap_tokens += w_tok
            overlap_text = " ".join(reversed(overlap_words))
            current_chunk = (overlap_text + " " + sentence) if overlap_text else sentence
            current_tokens = overlap_tokens + sentence_tokens
        else:
            current_chunk += (" " if current_chunk else "") + sentence
            current_tokens += sentence_tokens

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


class RAGPipeline:
    """Retrieval-Augmented Generation pipeline using Qdrant + Ollama."""

    def __init__(
        self,
        llm: OllamaAdapter | None = None,
        vector_db: QdrantManager | None = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        top_k: int = DEFAULT_TOP_K,
    ):
        self.llm = llm or ollama
        self.vector_db = vector_db or qdrant_manager
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k = top_k

    async def index_document(
        self,
        collection: str,
        text: str,
        metadata: dict[str, Any],
        doc_id: str | None = None,
    ) -> list[str]:
        """Index a document: chunk → embed → store in Qdrant.

        Returns list of point IDs stored in Qdrant.
        """
        chunks = chunk_text(text, self.chunk_size, self.chunk_overlap)
        if not chunks:
            logger.warning("No chunks generated from document")
            return []

        embeddings = await self.llm.embed(chunks)

        payloads = []
        for i, chunk in enumerate(chunks):
            payload = {
                **metadata,
                "chunk_text": chunk,
                "chunk_index": i,
                "total_chunks": len(chunks),
            }
            if doc_id:
                payload["doc_id"] = doc_id
            payloads.append(payload)

        import uuid
        ids = [str(uuid.uuid4()) for _ in chunks]
        self.vector_db.upsert_points(
            collection=collection,
            vectors=embeddings,
            payloads=payloads,
            ids=ids,
        )

        logger.info(
            "Indexed %d chunks into '%s' for doc '%s'",
            len(chunks), collection, doc_id or "unknown",
        )
        return ids

    async def search(
        self,
        collection: str,
        query: str,
        top_k: int | None = None,
        score_threshold: float | None = None,
        payload_filter: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Search for relevant chunks in a collection.

        Returns list of dicts with 'text', 'score', and 'metadata'.
        """
        query_embedding = await self.llm.embed_single(query)
        results = self.vector_db.search(
            collection=collection,
            query_vector=query_embedding,
            top_k=top_k or self.top_k,
            score_threshold=score_threshold,
            payload_filter=payload_filter,
        )

        return [
            {
                "text": r.payload.get("chunk_text", ""),
                "score": r.score,
                "metadata": {
                    k: v for k, v in r.payload.items() if k != "chunk_text"
                },
            }
            for r in results
        ]

    async def generate_with_context(
        self,
        collection: str,
        query: str,
        system_prompt: str,
        top_k: int | None = None,
        score_threshold: float | None = None,
        payload_filter: dict[str, Any] | None = None,
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """Full RAG pipeline: search → build context → generate with LLM.

        Returns dict with 'answer', 'sources' (relevant chunks used).
        """
        search_results = await self.search(
            collection=collection,
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            payload_filter=payload_filter,
        )

        context_parts = []
        for i, r in enumerate(search_results, 1):
            context_parts.append(f"[Источник {i}] (релевантность: {r['score']:.2f}):\n{r['text']}")
        context = "\n\n".join(context_parts)

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Контекст из базы знаний:\n{context}\n\n"
                    f"---\n\nВопрос/задача: {query}"
                ),
            },
        ]

        answer = await self.llm.chat(messages, temperature=temperature)

        return {
            "answer": answer,
            "sources": search_results,
            "context_chunks_count": len(search_results),
        }

    async def classify_with_qdrant(
        self,
        collection: str,
        text: str,
        score_threshold: float = 0.75,
        target_field: str = "category",
    ) -> dict[str, Any] | None:
        """Classify text by finding the nearest match in Qdrant.

        Returns the payload of the best match if above threshold, else None.
        """
        query_embedding = await self.llm.embed_single(text)
        results = self.vector_db.search(
            collection=collection,
            query_vector=query_embedding,
            top_k=1,
            score_threshold=score_threshold,
        )

        if results:
            best = results[0]
            return {
                "category": best.payload.get(target_field, "unknown"),
                "score": best.score,
                "metadata": best.payload,
            }
        return None


# Singleton
rag_pipeline = RAGPipeline()
