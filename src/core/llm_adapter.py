"""Unified adapter for Ollama LLM with fallback support."""

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.core.config import settings

logger = logging.getLogger(__name__)


class OllamaAdapter:
    """Adapter for Ollama REST API with model fallback."""

    def __init__(
        self,
        base_url: str | None = None,
        primary_model: str | None = None,
        fast_model: str | None = None,
        embedding_model: str | None = None,
        vision_model: str | None = None,
        timeout: int | None = None,
    ):
        self.base_url = (base_url or settings.ollama.base_url).rstrip("/")
        self.primary_model = primary_model or settings.ollama.model_primary
        self.fast_model = fast_model or settings.ollama.model_fast
        self.embedding_model = embedding_model or settings.ollama.model_embedding
        self.vision_model = vision_model or settings.ollama.model_vision
        self.timeout = timeout or settings.ollama.timeout

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=30.0),
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.1,
        use_fallback: bool = True,
        **kwargs: Any,
    ) -> str:
        """Send a chat completion request to Ollama.

        Falls back to the fast model if the primary is unavailable.
        """
        target_model = model or self.primary_model
        payload = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, **kwargs},
        }

        async with self._client() as client:
            try:
                resp = await client.post("/api/chat", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["message"]["content"]
            except (httpx.HTTPStatusError, httpx.ConnectError) as exc:
                if use_fallback and target_model == self.primary_model:
                    logger.warning(
                        "Primary model %s unavailable, falling back to %s: %s",
                        target_model,
                        self.fast_model,
                        exc,
                    )
                    payload["model"] = self.fast_model
                    resp = await client.post("/api/chat", json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["message"]["content"]
                raise

    async def chat_fast(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
        **kwargs: Any,
    ) -> str:
        """Use the fast (small) model for classification and simple tasks."""
        return await self.chat(
            messages, model=self.fast_model, temperature=temperature,
            use_fallback=False, **kwargs,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def embed(self, text: str | list[str]) -> list[list[float]]:
        """Generate embeddings via Ollama."""
        if isinstance(text, str):
            text = [text]

        async with self._client() as client:
            resp = await client.post(
                "/api/embed",
                json={"model": self.embedding_model, "input": text},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["embeddings"]

    async def embed_single(self, text: str) -> list[float]:
        """Generate a single embedding vector."""
        embeddings = await self.embed(text)
        return embeddings[0]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout)),
    )
    async def vision_analyze(self, prompt: str, image_base64: str) -> str:
        """Analyze an image using the vision model."""
        payload = {
            "model": self.vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [image_base64],
                }
            ],
            "stream": False,
        }
        async with self._client() as client:
            resp = await client.post("/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def is_available(self, model: str | None = None) -> bool:
        """Check if Ollama server and specified model are available."""
        try:
            async with self._client() as client:
                resp = await client.get("/api/tags")
                if resp.status_code != 200:
                    return False
                if model:
                    models = [m["name"] for m in resp.json().get("models", [])]
                    return any(model in m for m in models)
                return True
        except Exception:
            return False


# Singleton
ollama = OllamaAdapter()
