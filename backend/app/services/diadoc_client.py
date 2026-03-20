import httpx
from app.config import settings

TIMEOUT = 30.0


class DiadocClient:
    def __init__(self):
        self.base_url = settings.DIADOC_API_URL
        self.api_key = settings.DIADOC_API_KEY

    def _headers(self) -> dict:
        return {
            "Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key}",
            "Content-Type": "application/json",
        }

    async def authenticate(self, login: str, password: str) -> str:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{self.base_url}/V3/Authenticate",
                json={"login": login, "password": password},
                headers={"Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key}"},
            )
            resp.raise_for_status()
            return resp.text

    async def send_document(self, box_id: str, to_box_id: str, file_content: bytes, filename: str, token: str) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {
                "Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key},ddauth_token={token}",
            }
            resp = await client.post(
                f"{self.base_url}/V3/PostMessage",
                headers=headers,
                json={
                    "FromBoxId": box_id,
                    "ToBoxId": to_box_id,
                    "DocumentAttachments": [{
                        "TypeNamedId": "UniversalTransferDocument",
                        "FileName": filename,
                    }],
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def get_status(self, message_id: str, entity_id: str, token: str) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {
                "Authorization": f"DiadocAuth ddauth_api_client_id={self.api_key},ddauth_token={token}",
            }
            resp = await client.get(
                f"{self.base_url}/V3/GetMessage",
                params={"messageId": message_id, "entityId": entity_id},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()


diadoc_client = DiadocClient()
