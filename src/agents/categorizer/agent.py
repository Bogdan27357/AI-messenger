"""Agent 1: Purchase Categorization — bulk categorization & ongoing request processing."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from jinja2 import Environment, FileSystemLoader
from sklearn.cluster import KMeans

from src.core.config import settings
from src.core.llm_adapter import ollama
from src.core.qdrant_client import qdrant_manager
from src.core.rag_pipeline import rag_pipeline
from src.core.database import async_session
from src.integrations.one_c_client import one_c_client
from src.integrations.exchange_client import exchange_client
from src.utils.ocr import ocr_processor
from src.utils.text_processing import (
    normalize_tmc_name,
    prepare_for_embedding,
    extract_amount,
    extract_inn,
)
from src.utils.storage import storage_client

logger = logging.getLogger(__name__)

jinja_env = Environment(loader=FileSystemLoader("templates"))


class CategorizerAgent:
    """Agent for TMC categorization and KP request management."""

    def __init__(self):
        self.similarity_threshold = settings.app.categorizer_similarity_threshold
        self.min_categories = 50
        self.rebid_wait_days = 5
        self.min_kp_for_rebid = 3

    # ================================================================
    # Module A: Bulk Categorization
    # ================================================================

    async def bulk_categorize(self, data_source: str = "1c") -> dict[str, Any]:
        """One-time bulk categorization of TMC catalog and suppliers.

        1. Load TMC items and suppliers from 1C
        2. Normalize names, generate embeddings
        3. Cluster TMC items (KMeans, min 50 categories)
        4. Use LLM to name each cluster
        5. Index in Qdrant (tmc_catalog, suppliers)
        6. Build supplier-category mapping
        """
        logger.info("Starting bulk categorization from source: %s", data_source)

        # Step 1: Load data from 1C
        tmc_items = await one_c_client.get_tmc_catalog(top=5000)
        suppliers = await one_c_client.get_suppliers(top=2000)
        logger.info("Loaded %d TMC items and %d suppliers", len(tmc_items), len(suppliers))

        if not tmc_items:
            return {"status": "error", "message": "No TMC items found in 1C"}

        # Step 2: Normalize and prepare texts for embedding
        tmc_texts = []
        tmc_metadata = []
        for item in tmc_items:
            name = item.get("Description", item.get("Наименование", ""))
            article = item.get("Артикул", item.get("Code", ""))
            group = item.get("Parent", {}).get("Description", "") if isinstance(item.get("Parent"), dict) else ""

            text = prepare_for_embedding(name, "", group)
            if text.strip():
                tmc_texts.append(text)
                tmc_metadata.append({
                    "name": name,
                    "article": article,
                    "group": group,
                    "external_id": item.get("Ref_Key", ""),
                })

        logger.info("Prepared %d TMC items for embedding", len(tmc_texts))

        # Step 3: Generate embeddings
        batch_size = 50
        all_embeddings = []
        for i in range(0, len(tmc_texts), batch_size):
            batch = tmc_texts[i:i + batch_size]
            embeddings = await ollama.embed(batch)
            all_embeddings.extend(embeddings)
            logger.info("Embedded batch %d/%d", i // batch_size + 1, (len(tmc_texts) + batch_size - 1) // batch_size)

        # Step 4: Cluster
        n_clusters = max(self.min_categories, len(all_embeddings) // 20)
        n_clusters = min(n_clusters, len(all_embeddings))
        embedding_matrix = np.array(all_embeddings)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embedding_matrix)

        # Step 5: Name clusters using LLM
        clusters: dict[int, list[int]] = {}
        for idx, label in enumerate(labels):
            clusters.setdefault(int(label), []).append(idx)

        category_names = {}
        for cluster_id, indices in clusters.items():
            sample_names = [tmc_metadata[i]["name"] for i in indices[:10]]
            names_text = "\n".join(f"- {n}" for n in sample_names)

            response = await ollama.chat_fast([
                {
                    "role": "system",
                    "content": "Ты — эксперт по категоризации товарно-материальных ценностей. "
                               "Дай короткое название категории (2-4 слова) для группы ТМЦ.",
                },
                {
                    "role": "user",
                    "content": f"Примеры товаров в группе:\n{names_text}\n\n"
                               f"Название категории:",
                },
            ])
            category_name = response.strip().strip('"').strip("'")
            category_names[cluster_id] = category_name
            logger.info("Cluster %d (%d items): %s", cluster_id, len(indices), category_name)

        # Step 6: Index TMC in Qdrant
        payloads = []
        for idx, meta in enumerate(tmc_metadata):
            cluster_id = int(labels[idx])
            payloads.append({
                "name": meta["name"],
                "article": meta["article"],
                "group": meta["group"],
                "category": category_names[cluster_id],
                "cluster_id": cluster_id,
                "external_id": meta["external_id"],
            })

        point_ids = [str(uuid.uuid4()) for _ in all_embeddings]
        qdrant_manager.upsert_points(
            collection="tmc_catalog",
            vectors=all_embeddings,
            payloads=payloads,
            ids=point_ids,
        )

        # Step 7: Process suppliers
        supplier_embeddings = []
        supplier_payloads = []
        for supplier in suppliers:
            name = supplier.get("Description", supplier.get("Наименование", ""))
            inn = supplier.get("ИНН", "")
            email = supplier.get("КонтактнаяИнформация", {}).get("Email", "") if isinstance(supplier.get("КонтактнаяИнформация"), dict) else ""

            text = f"{name} ИНН {inn}" if inn else name
            if text.strip():
                embedding = await ollama.embed_single(text)
                supplier_embeddings.append(embedding)

                # Determine categories from purchase history
                try:
                    history = await one_c_client.get_purchase_history(supplier.get("Ref_Key", ""))
                    # Extract TMC names from history and find their categories
                    supplier_categories = set()
                    for doc in history[:20]:
                        for line in doc.get("Товары", [])[:5]:
                            tmc_name = line.get("Номенклатура", {}).get("Description", "")
                            if tmc_name:
                                result = await rag_pipeline.classify_with_qdrant(
                                    "tmc_catalog", tmc_name, score_threshold=0.6,
                                )
                                if result:
                                    supplier_categories.add(result["category"])
                except Exception as e:
                    logger.warning("Failed to get purchase history for %s: %s", name, e)
                    supplier_categories = set()

                supplier_payloads.append({
                    "name": name,
                    "inn": inn,
                    "email": email,
                    "category": list(supplier_categories) if supplier_categories else ["uncategorized"],
                    "external_id": supplier.get("Ref_Key", ""),
                    "region": supplier.get("Регион", ""),
                })

        if supplier_embeddings:
            qdrant_manager.upsert_points(
                collection="suppliers",
                vectors=supplier_embeddings,
                payloads=supplier_payloads,
                ids=[str(uuid.uuid4()) for _ in supplier_embeddings],
            )

        result = {
            "status": "completed",
            "tmc_indexed": len(all_embeddings),
            "suppliers_indexed": len(supplier_embeddings),
            "categories_count": len(category_names),
            "categories": category_names,
        }
        logger.info("Bulk categorization completed: %s", result)
        return result

    # ================================================================
    # Module B: Ongoing Request Processing
    # ================================================================

    async def process_purchase_request(self, request_id: str) -> dict[str, Any]:
        """Process a single purchase request:
        1. Get request data from 1C
        2. Classify TMC via Qdrant
        3. Find matching suppliers
        4. Send KP request email
        """
        logger.info("Processing purchase request: %s", request_id)

        # Step 1: Get request from 1C
        requests = await one_c_client.get_purchase_requests()
        request_data = None
        for req in requests:
            if req.get("Ref_Key") == request_id or req.get("Number") == request_id:
                request_data = req
                break

        if not request_data:
            return {"status": "error", "message": f"Request {request_id} not found"}

        tmc_name = request_data.get("Номенклатура", {}).get("Description", "")
        description = request_data.get("Описание", request_data.get("Комментарий", ""))
        request_number = request_data.get("Number", request_id)
        requester_email = request_data.get("Ответственный", {}).get("Email", "")

        # Step 2: Classify TMC
        search_text = prepare_for_embedding(tmc_name, description)
        classification = await rag_pipeline.classify_with_qdrant(
            "tmc_catalog",
            search_text,
            score_threshold=self.similarity_threshold,
        )

        if classification:
            category = classification["category"]
            logger.info("TMC classified as '%s' (score: %.2f)", category, classification["score"])
        else:
            # LLM classification fallback
            llm_response = await ollama.chat_fast([
                {
                    "role": "system",
                    "content": "Ты — эксперт по категоризации ТМЦ. Определи категорию товара. "
                               "Ответь только названием категории (2-4 слова).",
                },
                {"role": "user", "content": f"Товар: {tmc_name}\nОписание: {description}"},
            ])
            category = llm_response.strip().strip('"')
            logger.info("TMC classified by LLM as '%s'", category)

            # Save new classification to Qdrant
            embedding = await ollama.embed_single(search_text)
            qdrant_manager.upsert_points(
                collection="tmc_catalog",
                vectors=[embedding],
                payloads=[{
                    "name": tmc_name,
                    "category": category,
                    "external_id": request_data.get("Номенклатура", {}).get("Ref_Key", ""),
                    "source": "llm_onthefly",
                }],
            )

        # Step 3: Find suppliers by category
        query_text = f"поставщик {category} {tmc_name}"
        query_embedding = await ollama.embed_single(query_text)
        supplier_results = qdrant_manager.search(
            collection="suppliers",
            query_vector=query_embedding,
            top_k=20,
            payload_filter={"category": category} if category != "uncategorized" else None,
        )

        supplier_emails = []
        for s in supplier_results:
            email = s.payload.get("email", "")
            if email and "@" in email:
                supplier_emails.append(email)

        if not supplier_emails:
            logger.warning("No supplier emails found for category '%s'", category)
            return {
                "status": "no_suppliers",
                "request_number": request_number,
                "category": category,
            }

        # Step 4: Send KP request
        template = jinja_env.get_template("kp_request.html")
        deadline = datetime.now(timezone.utc) + timedelta(days=self.rebid_wait_days)
        body_html = template.render(
            request_number=request_number,
            tmc_name=tmc_name,
            description=description,
            company_name="Компания",
            deadline_date=deadline.strftime("%d.%m.%Y"),
            attachment_note=bool(description),
        )

        subject = f"Запрос КП — Заявка № {request_number}"
        send_result = await exchange_client.send_kp_request(
            to_emails=supplier_emails,
            subject=subject,
            body_html=body_html,
        )

        result = {
            "status": "kp_sent",
            "request_number": request_number,
            "category": category,
            "suppliers_contacted": len(supplier_emails),
            "deadline": deadline.isoformat(),
            "send_result": send_result,
        }
        logger.info("KP request sent: %s", result)
        return result

    async def process_kp_response(self, email_data: dict[str, Any]) -> dict[str, Any]:
        """Process incoming KP response from supplier.

        Extracts: supplier name, price, payment terms, delivery days.
        """
        logger.info("Processing KP response from: %s", email_data.get("sender", "unknown"))

        attachments = email_data.get("attachments", [])
        extracted_data = {
            "supplier_name": email_data.get("sender", ""),
            "subject": email_data.get("subject", ""),
            "received_at": email_data.get("received", ""),
        }

        # Process attachments (KP documents)
        for attachment in attachments:
            filename = attachment.get("name", "")
            content = attachment.get("content", b"")

            if not content:
                continue

            # Save to MinIO
            object_name = f"kp_responses/{uuid.uuid4()}/{filename}"
            storage_client.upload_bytes(content, object_name)

            # OCR if PDF/image
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=f"_{filename}", delete=True) as tmp:
                tmp.write(content)
                tmp.flush()
                ocr_result = await ocr_processor.extract_with_vision_fallback(tmp.name)

            text = ocr_result.get("text", "")
            if not text:
                continue

            # LLM extraction of KP data
            llm_response = await ollama.chat([
                {
                    "role": "system",
                    "content": (
                        "Ты — специалист по анализу коммерческих предложений. "
                        "Извлеки из текста КП следующие данные и верни JSON:\n"
                        '{"supplier_name": "...", "price": число, "total_amount": число, '
                        '"currency": "RUB", "payment_terms": "...", '
                        '"delivery_days": число, "validity_days": число, '
                        '"warranty": "..."}\n'
                        "Если данные не найдены, используй null."
                    ),
                },
                {"role": "user", "content": f"Текст КП:\n{text[:3000]}"},
            ])

            try:
                # Extract JSON from LLM response
                json_start = llm_response.find("{")
                json_end = llm_response.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    kp_data = json.loads(llm_response[json_start:json_end])
                    extracted_data.update(kp_data)
                    extracted_data["raw_text"] = text[:2000]
                    extracted_data["file_path"] = object_name
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning("Failed to parse LLM response as JSON: %s", e)
                # Fallback: extract amount manually
                amount = extract_amount(text)
                if amount:
                    extracted_data["total_amount"] = amount
                inn = extract_inn(text)
                if inn:
                    extracted_data["supplier_inn"] = inn

        extracted_data["status"] = "processed"
        logger.info("KP data extracted: %s", {k: v for k, v in extracted_data.items() if k != "raw_text"})
        return extracted_data

    async def initiate_rebid(self, request_id: str) -> dict[str, Any]:
        """Initiate rebid (переторжка) for a purchase request."""
        logger.info("Initiating rebid for request: %s", request_id)

        # Get original request info
        requests = await one_c_client.get_purchase_requests()
        request_data = None
        for req in requests:
            if req.get("Ref_Key") == request_id or req.get("Number") == request_id:
                request_data = req
                break

        if not request_data:
            return {"status": "error", "message": f"Request {request_id} not found"}

        tmc_name = request_data.get("Номенклатура", {}).get("Description", "")
        request_number = request_data.get("Number", request_id)
        description = request_data.get("Описание", "")

        # Find suppliers (same as original flow)
        search_text = prepare_for_embedding(tmc_name, description)
        query_embedding = await ollama.embed_single(search_text)
        supplier_results = qdrant_manager.search(
            collection="suppliers",
            query_vector=query_embedding,
            top_k=20,
        )

        supplier_emails = [
            s.payload.get("email", "")
            for s in supplier_results
            if s.payload.get("email") and "@" in s.payload.get("email", "")
        ]

        if not supplier_emails:
            return {"status": "no_suppliers", "request_number": request_number}

        # Send rebid email
        template = jinja_env.get_template("kp_rebid.html")
        deadline = datetime.now(timezone.utc) + timedelta(days=3)
        body_html = template.render(
            request_number=request_number,
            tmc_name=tmc_name,
            description=description,
            company_name="Компания",
            deadline_date=deadline.strftime("%d.%m.%Y"),
        )

        subject = f"Переторжка — Заявка № {request_number}"
        send_result = await exchange_client.send_kp_request(
            to_emails=supplier_emails,
            subject=subject,
            body_html=body_html,
        )

        return {
            "status": "rebid_sent",
            "request_number": request_number,
            "suppliers_contacted": len(supplier_emails),
            "deadline": deadline.isoformat(),
            "send_result": send_result,
        }

    async def poll_and_process_responses(self, request_number: str) -> list[dict[str, Any]]:
        """Poll for incoming KP responses for a specific request."""
        emails = await exchange_client.fetch_incoming_emails(
            subject_filter=request_number, since_days=14,
        )

        results = []
        for email in emails:
            result = await self.process_kp_response(email)
            results.append(result)

        return results


# Singleton
categorizer_agent = CategorizerAgent()
