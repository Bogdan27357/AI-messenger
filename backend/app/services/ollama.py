import httpx
from typing import AsyncGenerator

from app.config import settings

TIMEOUT = 120.0


class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_URL

    async def generate(self, prompt: str, model: str = "llama3.1:8b", format_json: bool = True) -> dict | str:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
            }
            if format_json:
                payload["format"] = "json"
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def chat(self, messages: list[dict], model: str = "llama3.1:8b", stream: bool = False) -> str | AsyncGenerator:
        if stream:
            return self._chat_stream(messages, model)

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json={
                "model": model,
                "messages": messages,
                "stream": False,
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")

    async def _chat_stream(self, messages: list[dict], model: str) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", f"{self.base_url}/api/chat", json={
                "model": model,
                "messages": messages,
                "stream": True,
            }) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        import json
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content

    async def embed(self, text: str, model: str = "nomic-embed-text") -> list[float]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{self.base_url}/api/embeddings", json={
                "model": model,
                "prompt": text,
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("embedding", [])

    async def list_models(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return data.get("models", [])

    async def ps(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/ps")
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return {"models": []}


ollama_client = OllamaClient()
