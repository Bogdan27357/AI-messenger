"""Travel agent — full travel expense cycle.

Handles receipt download from Smartway, OCR + LLM parsing, 1C request
creation, approval monitoring, and Diadoc document linking.
"""

import json
import logging
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text

from src.core.database import async_session
from src.core.llm_adapter import ollama
from src.core.qdrant_client import qdrant_manager
from src.core.rag_pipeline import rag_pipeline
from src.integrations.diadoc_client import diadoc_client
from src.integrations.one_c_client import one_c_client
from src.integrations.smartway_client import smartway_client
from src.utils.ocr import ocr_processor
from src.utils.storage import storage_client
from src.utils.text_processing import extract_amount

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM system prompts (Russian)
# ---------------------------------------------------------------------------

RECEIPT_PARSE_SYSTEM_PROMPT = (
    "Ты — специалист по обработке командировочных документов. "
    "Проанализируй распознанный текст маршрутной квитанции / чека / счёта "
    "и извлеки структурированные данные в формате JSON.\n\n"
    "Обязательные поля:\n"
    "- route: маршрут (откуда — куда)\n"
    "- date: дата поездки (ISO 8601)\n"
    "- tariff: стоимость тарифа (перевозка), число\n"
    "- service_fee: сервисный сбор, число\n"
    "- fuel_surcharge: топливный сбор, число (0 если нет)\n"
    "- other_fees: прочие сборы, число (0 если нет)\n"
    "- total: итого, число\n"
    "- carrier: перевозчик / авиакомпания / отель\n"
    "- document_number: номер билета или документа\n\n"
    "Верни ТОЛЬКО валидный JSON без пояснений."
)

VAT_CALC_SYSTEM_PROMPT = (
    "Ты — бухгалтер. Рассчитай НДС для командировочных расходов.\n"
    "Правила:\n"
    "- Сервисный сбор, топливный сбор, прочие сборы: НДС 22%\n"
    "- Тариф (ж/д внутренний): НДС 22%\n"
    "- Тариф (авиа внутренний): НДС 22%\n"
    "- Тариф (международный): НДС 0%\n"
    "- Гостиница: НДС 22%\n\n"
    "Входные данные: тип документа, тариф, сборы.\n"
    "Верни JSON: {tariff_vat, fees_vat, total_vat, tariff_net, fees_net}"
)


class TravelAgent:
    """Implements the full travel expense cycle."""

    # ------------------------------------------------------------------
    # 1. Download receipts from Smartway
    # ------------------------------------------------------------------

    async def download_receipts(self) -> dict[str, Any]:
        """Authenticate with Smartway, download receipts for completed trips.

        Falls back to RPA (Playwright) when the API is unavailable.
        Returns summary dict with counts of processed trips / receipts.
        """
        logger.info("Starting receipt download from Smartway")

        await smartway_client.authenticate()
        trips = await smartway_client.get_trips(status="completed")
        logger.info("Fetched %d completed trips from Smartway", len(trips))

        downloaded_count = 0
        failed_trips: list[str] = []

        for trip in trips:
            trip_id = trip["id"]
            employee_id = trip.get("employee_id", "unknown")

            try:
                # Check if trip is already recorded
                if await self._trip_exists(trip_id):
                    logger.debug("Trip %s already recorded, skipping", trip_id)
                    continue

                # Try API first
                documents = await self._download_trip_documents_api(
                    trip_id, employee_id,
                )

                # Fallback to RPA if API returned nothing
                if not documents:
                    logger.warning(
                        "API returned no documents for trip %s, falling back to RPA",
                        trip_id,
                    )
                    documents = await self._download_trip_documents_rpa(
                        trip_id, employee_id,
                    )

                # Persist trip & receipt metadata
                await self._save_trip(trip_id, employee_id, trip)
                for doc in documents:
                    await self._save_receipt_record(
                        trip_id, employee_id, doc["filename"], doc["storage_path"],
                    )
                    downloaded_count += 1

            except Exception:
                logger.exception("Failed to process trip %s", trip_id)
                failed_trips.append(trip_id)

        result = {
            "status": "ok",
            "trips_total": len(trips),
            "receipts_downloaded": downloaded_count,
            "failed_trips": failed_trips,
        }
        logger.info("Receipt download finished: %s", result)
        return result

    # ------------------------------------------------------------------
    # 2. Process a single receipt (OCR + LLM)
    # ------------------------------------------------------------------

    async def process_receipt(self, receipt_id: str) -> dict[str, Any]:
        """OCR the receipt, parse via LLM, detect document type, calculate VAT.

        Updates the receipt record in DB with structured data.
        """
        logger.info("Processing receipt %s", receipt_id)

        # Load receipt metadata from DB
        receipt = await self._get_receipt(receipt_id)
        if not receipt:
            raise ValueError(f"Receipt {receipt_id} not found")

        storage_path = receipt["storage_path"]

        # Download file to a temp location for OCR
        with tempfile.NamedTemporaryFile(
            suffix=Path(storage_path).suffix or ".pdf", delete=False,
        ) as tmp:
            tmp.write(storage_client.get_bytes(storage_path))
            tmp_path = tmp.name

        try:
            # Step 1 — OCR with vision fallback
            ocr_result = await ocr_processor.extract_with_vision_fallback(tmp_path)
            raw_text = ocr_result["text"]
            logger.info(
                "OCR done for %s, method=%s, confidence=%.2f",
                receipt_id, ocr_result["method"], ocr_result["confidence"],
            )

            # Step 2 — Auto-detect document type via Qdrant templates
            doc_type = await self._detect_document_type(raw_text)
            logger.info("Detected document type: %s (receipt %s)", doc_type, receipt_id)

            # Step 3 — LLM structured extraction
            parsed = await self._parse_receipt_llm(raw_text)

            # Step 4 — VAT calculation
            vat_data = await self._calculate_vat(doc_type, parsed)

            # Merge results
            result = {
                "receipt_id": receipt_id,
                "document_type": doc_type,
                "ocr_method": ocr_result["method"],
                "ocr_confidence": ocr_result["confidence"],
                "parsed": parsed,
                "vat": vat_data,
            }

            # Step 5 — Update DB record
            await self._update_receipt(receipt_id, result)

            logger.info("Receipt %s processed successfully", receipt_id)
            return result

        finally:
            Path(tmp_path).unlink(missing_ok=True)

    # ------------------------------------------------------------------
    # 3. Create 1C technical request
    # ------------------------------------------------------------------

    async def create_1c_request(self, trip_id: str) -> dict[str, Any]:
        """Gather processed receipts and create a Technical Request in 1C.

        Lines:
          1 — tariff amount (transport)
          2 — service fee
          3 — other fees
        Attaches receipt files and submits for approval to Supply Director.
        """
        logger.info("Creating 1C request for trip %s", trip_id)

        receipts = await self._get_trip_receipts(trip_id)
        if not receipts:
            raise ValueError(f"No processed receipts for trip {trip_id}")

        # Aggregate amounts across all receipts
        total_tariff = 0.0
        total_service_fee = 0.0
        total_other_fees = 0.0
        attachments: list[dict[str, Any]] = []

        for r in receipts:
            parsed = r.get("parsed_data") or {}
            total_tariff += float(parsed.get("tariff", 0))
            total_service_fee += float(parsed.get("service_fee", 0))
            other = float(parsed.get("fuel_surcharge", 0)) + float(
                parsed.get("other_fees", 0)
            )
            total_other_fees += other

            # Prepare attachment bytes
            try:
                content = storage_client.get_bytes(r["storage_path"])
                attachments.append({
                    "filename": r["filename"],
                    "content": content,
                })
            except Exception:
                logger.warning(
                    "Could not load attachment %s for trip %s",
                    r["storage_path"], trip_id,
                )

        trip = await self._get_trip(trip_id)
        employee_id = trip["employee_id"] if trip else "unknown"

        # Build 1C request payload
        request_data: dict[str, Any] = {
            "Дата": datetime.now(tz=timezone.utc).isoformat(),
            "Организация_Key": trip.get("organization_key", "") if trip else "",
            "Сотрудник": employee_id,
            "Комментарий": f"Командировочные расходы по поездке {trip_id}",
            "Товары": [
                {
                    "НомерСтроки": 1,
                    "Номенклатура": "Тариф (перевозка)",
                    "Сумма": round(total_tariff, 2),
                    "СтавкаНДС": "22%",
                },
                {
                    "НомерСтроки": 2,
                    "Номенклатура": "Сервисный сбор",
                    "Сумма": round(total_service_fee, 2),
                    "СтавкаНДС": "22%",
                },
                {
                    "НомерСтроки": 3,
                    "Номенклатура": "Прочие сборы",
                    "Сумма": round(total_other_fees, 2),
                    "СтавкаНДС": "22%",
                },
            ],
            "СогласующийРуководитель": "Директор по снабжению",
        }

        # Create the request in 1C
        response_1c = await one_c_client.create_technical_request(request_data)
        request_ref = response_1c.get("Ref_Key", "")

        # Record in DB
        await self._save_1c_request(trip_id, request_ref, request_data, response_1c)

        result = {
            "status": "ok",
            "trip_id": trip_id,
            "request_ref": request_ref,
            "total_tariff": round(total_tariff, 2),
            "total_service_fee": round(total_service_fee, 2),
            "total_other_fees": round(total_other_fees, 2),
            "total": round(total_tariff + total_service_fee + total_other_fees, 2),
            "attachments_count": len(attachments),
        }
        logger.info("1C request created: %s", result)
        return result

    # ------------------------------------------------------------------
    # 4. Monitor approvals in 1C
    # ------------------------------------------------------------------

    async def monitor_approvals(self) -> dict[str, Any]:
        """Check approval status for pending 1C requests.

        For approved requests, automatically create a supplier order.
        """
        logger.info("Checking pending travel approval statuses")

        pending = await self._get_pending_1c_requests()
        approved_count = 0
        rejected_count = 0
        still_pending = 0

        for req in pending:
            request_ref = req["request_ref"]
            trip_id = req["trip_id"]

            try:
                status = await one_c_client.get_request_approval_status(request_ref)
                logger.info(
                    "Request %s (trip %s) status: %s",
                    request_ref, trip_id, status,
                )

                if status == "Согласована":
                    # Auto-create supplier order
                    order_data = {
                        "Дата": datetime.now(tz=timezone.utc).isoformat(),
                        "Основание_Key": request_ref,
                        "Комментарий": (
                            f"Заказ поставщику по командировке {trip_id}"
                        ),
                    }
                    order_resp = await one_c_client.create_supplier_order(order_data)
                    order_ref = order_resp.get("Ref_Key", "")

                    await self._update_1c_request_status(
                        request_ref, "approved", order_ref,
                    )
                    approved_count += 1

                elif status in ("Отклонена", "Отменена"):
                    await self._update_1c_request_status(request_ref, "rejected")
                    rejected_count += 1

                else:
                    still_pending += 1

            except Exception:
                logger.exception(
                    "Error checking approval for request %s", request_ref,
                )
                still_pending += 1

        result = {
            "status": "ok",
            "approved": approved_count,
            "rejected": rejected_count,
            "still_pending": still_pending,
        }
        logger.info("Approval monitoring finished: %s", result)
        return result

    # ------------------------------------------------------------------
    # 5. Link Diadoc documents
    # ------------------------------------------------------------------

    async def link_diadoc_documents(self, trip_id: str) -> dict[str, Any]:
        """Search for closing documents in Diadoc, link to supplier order.

        Creates reconciliation document, forms YUЗЭДО, sends for signing.
        """
        logger.info("Linking Diadoc documents for trip %s", trip_id)

        # Fetch trip + 1C request info
        trip = await self._get_trip(trip_id)
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")

        request_info = await self._get_1c_request_for_trip(trip_id)
        if not request_info or not request_info.get("order_ref"):
            raise ValueError(
                f"No approved 1C request / supplier order for trip {trip_id}"
            )

        order_ref = request_info["order_ref"]

        # Step 1 — Get organizations (boxes)
        orgs = await diadoc_client.get_organizations()
        if not orgs:
            raise RuntimeError("No Diadoc organizations found")
        box_id = orgs[0].get("Boxes", [{}])[0].get("BoxId", "")

        # Step 2 — Search for closing documents (UPD / Acts)
        documents = await diadoc_client.search_documents(
            box_id=box_id,
            doc_type="UniversalTransferDocument",
        )

        # Filter documents matching the trip (by date / amount heuristics)
        matched = self._match_diadoc_documents(documents, trip, request_info)
        if not matched:
            logger.warning("No matching Diadoc documents found for trip %s", trip_id)
            return {
                "status": "no_match",
                "trip_id": trip_id,
                "documents_searched": len(documents),
            }

        linked: list[dict[str, Any]] = []

        for doc in matched:
            try:
                # Step 3 — Create reconciliation document
                recon_data = {
                    "ToBoxId": doc.get("CounterpartyBoxId", ""),
                    "DocumentAttachments": [{
                        "TypeNamedId": "ReconciliationAct",
                        "Comment": f"Сверка по командировке {trip_id}, заказ {order_ref}",
                        "Metadata": {
                            "trip_id": trip_id,
                            "order_ref": order_ref,
                        },
                    }],
                }
                create_resp = await diadoc_client.create_document(box_id, recon_data)
                message_id = create_resp.get("MessageId", "")

                # Step 4 — Send for signing (YUЗЭДО)
                signer_info = {
                    "SignerType": "LegalEntity",
                    "SignerDetails": {
                        "Surname": trip.get("signer_surname", ""),
                        "FirstName": trip.get("signer_firstname", ""),
                        "Patronymic": trip.get("signer_patronymic", ""),
                        "Inn": trip.get("signer_inn", ""),
                        "Position": trip.get("signer_position", ""),
                    },
                }
                await diadoc_client.send_for_signing(box_id, message_id, signer_info)

                # Step 5 — Record in DB
                diadoc_record = {
                    "trip_id": trip_id,
                    "order_ref": order_ref,
                    "message_id": message_id,
                    "diadoc_doc_id": doc.get("DocumentId", ""),
                    "doc_type": doc.get("DocumentType", "UPD"),
                    "status": "sent_for_signing",
                }
                await self._save_diadoc_doc(diadoc_record)
                linked.append(diadoc_record)

            except Exception:
                logger.exception(
                    "Error linking Diadoc document %s for trip %s",
                    doc.get("DocumentId"), trip_id,
                )

        result = {
            "status": "ok",
            "trip_id": trip_id,
            "documents_searched": len(documents),
            "documents_linked": len(linked),
            "linked": linked,
        }
        logger.info("Diadoc linking finished: %s", result)
        return result

    # ==================================================================
    # Internal helpers — Smartway download
    # ==================================================================

    async def _download_trip_documents_api(
        self, trip_id: str, employee_id: str,
    ) -> list[dict[str, Any]]:
        """Download trip documents via Smartway API and upload to MinIO."""
        documents: list[dict[str, Any]] = []

        try:
            doc_list = await smartway_client.get_trip_documents(trip_id)
        except Exception:
            logger.warning("Smartway API failed for trip %s", trip_id, exc_info=True)
            return []

        for doc_meta in doc_list:
            doc_id = doc_meta.get("id", "")
            filename = doc_meta.get("filename", f"{doc_id}.pdf")

            try:
                content = await smartway_client.download_receipt(trip_id, doc_id)
                storage_path = f"travel/{employee_id}/{trip_id}/{filename}"
                storage_client.upload_bytes(
                    content, storage_path,
                    content_type=self._guess_content_type(filename),
                )
                documents.append({
                    "filename": filename,
                    "storage_path": storage_path,
                    "source": "api",
                })
            except Exception:
                logger.warning(
                    "Failed to download doc %s for trip %s via API",
                    doc_id, trip_id, exc_info=True,
                )

        return documents

    async def _download_trip_documents_rpa(
        self, trip_id: str, employee_id: str,
    ) -> list[dict[str, Any]]:
        """Fallback: download via Playwright RPA and upload to MinIO."""
        documents: list[dict[str, Any]] = []

        try:
            rpa_docs = await smartway_client.download_via_rpa(trip_id)
        except Exception:
            logger.exception("RPA fallback also failed for trip %s", trip_id)
            return []

        for rpa_doc in rpa_docs:
            filename = rpa_doc.get("filename", f"{uuid.uuid4().hex}.pdf")
            content = rpa_doc.get("content", b"")
            storage_path = f"travel/{employee_id}/{trip_id}/{filename}"

            storage_client.upload_bytes(
                content, storage_path,
                content_type=self._guess_content_type(filename),
            )
            documents.append({
                "filename": filename,
                "storage_path": storage_path,
                "source": "rpa",
            })

        return documents

    # ==================================================================
    # Internal helpers — LLM / Qdrant
    # ==================================================================

    async def _detect_document_type(self, text: str) -> str:
        """Use Qdrant travel_templates to classify the document type.

        Returns one of: avia, rail, hotel, other.
        """
        try:
            result = await rag_pipeline.classify_with_qdrant(
                collection="travel_templates",
                text=text,
                score_threshold=0.65,
                target_field="doc_type",
            )
            if result:
                return result["category"]
        except Exception:
            logger.warning("Qdrant classification failed, falling back to LLM")

        # Fallback — ask the fast LLM
        resp = await ollama.chat_fast([
            {
                "role": "system",
                "content": (
                    "Определи тип командировочного документа по тексту. "
                    "Ответь одним словом: avia, rail, hotel или other."
                ),
            },
            {"role": "user", "content": text[:2000]},
        ])
        detected = resp.strip().lower()
        if detected in ("avia", "rail", "hotel"):
            return detected
        return "other"

    async def _parse_receipt_llm(self, raw_text: str) -> dict[str, Any]:
        """Extract structured data from raw OCR text via LLM."""
        response = await ollama.chat(
            messages=[
                {"role": "system", "content": RECEIPT_PARSE_SYSTEM_PROMPT},
                {"role": "user", "content": raw_text[:4000]},
            ],
            temperature=0.05,
        )

        try:
            parsed = json.loads(response)
        except json.JSONDecodeError:
            logger.warning("LLM returned non-JSON, attempting extraction")
            # Try to find JSON inside the response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                parsed = json.loads(response[start:end])
            else:
                # Last resort: extract amounts from raw text
                amount = extract_amount(raw_text)
                parsed = {
                    "route": "",
                    "date": "",
                    "tariff": amount or 0,
                    "service_fee": 0,
                    "fuel_surcharge": 0,
                    "other_fees": 0,
                    "total": amount or 0,
                    "carrier": "",
                    "document_number": "",
                }

        return parsed

    async def _calculate_vat(
        self, doc_type: str, parsed: dict[str, Any],
    ) -> dict[str, Any]:
        """Calculate VAT split for tariff vs fees."""
        tariff = float(parsed.get("tariff", 0))
        service_fee = float(parsed.get("service_fee", 0))
        fuel_surcharge = float(parsed.get("fuel_surcharge", 0))
        other_fees = float(parsed.get("other_fees", 0))

        total_fees = service_fee + fuel_surcharge + other_fees

        # Fees always have 22% VAT
        fees_vat = round(total_fees * 22 / 122, 2)
        fees_net = round(total_fees - fees_vat, 2)

        # Tariff VAT depends on document type
        if doc_type in ("avia", "rail", "hotel"):
            # Domestic: 22% VAT
            tariff_vat = round(tariff * 22 / 122, 2)
            tariff_net = round(tariff - tariff_vat, 2)
        else:
            # International or unknown: 0% VAT
            tariff_vat = 0.0
            tariff_net = tariff

        return {
            "tariff_vat": tariff_vat,
            "tariff_net": tariff_net,
            "fees_vat": fees_vat,
            "fees_net": fees_net,
            "total_vat": round(tariff_vat + fees_vat, 2),
            "total_net": round(tariff_net + fees_net, 2),
        }

    # ==================================================================
    # Internal helpers — Diadoc matching
    # ==================================================================

    @staticmethod
    def _match_diadoc_documents(
        documents: list[dict[str, Any]],
        trip: dict[str, Any],
        request_info: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Filter Diadoc documents that likely correspond to the trip.

        Matching heuristic: amount within 5% tolerance.
        """
        target_amount = float(request_info.get("total_amount", 0))
        if target_amount <= 0:
            return documents[:1] if documents else []

        matched = []
        for doc in documents:
            doc_amount = float(doc.get("Amount", 0))
            if doc_amount <= 0:
                continue
            tolerance = target_amount * 0.05
            if abs(doc_amount - target_amount) <= tolerance:
                matched.append(doc)

        return matched

    # ==================================================================
    # Internal helpers — DB operations
    # ==================================================================

    async def _trip_exists(self, trip_id: str) -> bool:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT 1 FROM travel_trips WHERE trip_id = :tid LIMIT 1"),
                {"tid": trip_id},
            )
            return result.scalar() is not None

    async def _save_trip(
        self, trip_id: str, employee_id: str, trip_data: dict[str, Any],
    ) -> None:
        async with async_session() as session:
            await session.execute(
                text(
                    "INSERT INTO travel_trips (id, trip_id, employee_id, raw_data, status, created_at) "
                    "VALUES (:id, :tid, :eid, :raw, 'downloaded', NOW()) "
                    "ON CONFLICT (trip_id) DO NOTHING"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "tid": trip_id,
                    "eid": employee_id,
                    "raw": json.dumps(trip_data, ensure_ascii=False, default=str),
                },
            )
            await session.commit()

    async def _save_receipt_record(
        self,
        trip_id: str,
        employee_id: str,
        filename: str,
        storage_path: str,
    ) -> None:
        async with async_session() as session:
            await session.execute(
                text(
                    "INSERT INTO travel_receipts "
                    "(id, trip_id, employee_id, filename, storage_path, status, created_at) "
                    "VALUES (:id, :tid, :eid, :fn, :sp, 'downloaded', NOW())"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "tid": trip_id,
                    "eid": employee_id,
                    "fn": filename,
                    "sp": storage_path,
                },
            )
            await session.commit()

    async def _get_receipt(self, receipt_id: str) -> dict[str, Any] | None:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, trip_id, employee_id, filename, storage_path, "
                    "parsed_data, status FROM travel_receipts WHERE id = :rid"
                ),
                {"rid": receipt_id},
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def _update_receipt(
        self, receipt_id: str, data: dict[str, Any],
    ) -> None:
        async with async_session() as session:
            await session.execute(
                text(
                    "UPDATE travel_receipts "
                    "SET parsed_data = :pd, document_type = :dt, "
                    "    vat_data = :vd, status = 'processed', updated_at = NOW() "
                    "WHERE id = :rid"
                ),
                {
                    "rid": receipt_id,
                    "pd": json.dumps(
                        data.get("parsed"), ensure_ascii=False, default=str,
                    ),
                    "dt": data.get("document_type", ""),
                    "vd": json.dumps(
                        data.get("vat"), ensure_ascii=False, default=str,
                    ),
                },
            )
            await session.commit()

    async def _get_trip_receipts(self, trip_id: str) -> list[dict[str, Any]]:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, trip_id, employee_id, filename, storage_path, "
                    "parsed_data, document_type, vat_data, status "
                    "FROM travel_receipts "
                    "WHERE trip_id = :tid AND status = 'processed'"
                ),
                {"tid": trip_id},
            )
            rows = result.mappings().all()
            parsed_rows = []
            for row in rows:
                r = dict(row)
                if isinstance(r.get("parsed_data"), str):
                    try:
                        r["parsed_data"] = json.loads(r["parsed_data"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                parsed_rows.append(r)
            return parsed_rows

    async def _get_trip(self, trip_id: str) -> dict[str, Any] | None:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, trip_id, employee_id, raw_data, status "
                    "FROM travel_trips WHERE trip_id = :tid"
                ),
                {"tid": trip_id},
            )
            row = result.mappings().first()
            if not row:
                return None
            r = dict(row)
            if isinstance(r.get("raw_data"), str):
                try:
                    r.update(json.loads(r["raw_data"]))
                except (json.JSONDecodeError, TypeError):
                    pass
            return r

    async def _save_1c_request(
        self,
        trip_id: str,
        request_ref: str,
        request_data: dict[str, Any],
        response_1c: dict[str, Any],
    ) -> None:
        total_amount = sum(
            float(line.get("Сумма", 0))
            for line in request_data.get("Товары", [])
        )
        async with async_session() as session:
            await session.execute(
                text(
                    "INSERT INTO travel_1c_requests "
                    "(id, trip_id, request_ref, total_amount, request_data, "
                    " response_data, status, created_at) "
                    "VALUES (:id, :tid, :rref, :amt, :req, :resp, 'pending', NOW())"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "tid": trip_id,
                    "rref": request_ref,
                    "amt": total_amount,
                    "req": json.dumps(
                        request_data, ensure_ascii=False, default=str,
                    ),
                    "resp": json.dumps(
                        response_1c, ensure_ascii=False, default=str,
                    ),
                },
            )
            await session.commit()

    async def _get_pending_1c_requests(self) -> list[dict[str, Any]]:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, trip_id, request_ref, total_amount, status "
                    "FROM travel_1c_requests WHERE status = 'pending'"
                ),
            )
            return [dict(r) for r in result.mappings().all()]

    async def _get_1c_request_for_trip(
        self, trip_id: str,
    ) -> dict[str, Any] | None:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, trip_id, request_ref, order_ref, total_amount, status "
                    "FROM travel_1c_requests WHERE trip_id = :tid "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"tid": trip_id},
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def _update_1c_request_status(
        self,
        request_ref: str,
        status: str,
        order_ref: str | None = None,
    ) -> None:
        async with async_session() as session:
            if order_ref:
                await session.execute(
                    text(
                        "UPDATE travel_1c_requests "
                        "SET status = :st, order_ref = :oref, updated_at = NOW() "
                        "WHERE request_ref = :rref"
                    ),
                    {"st": status, "oref": order_ref, "rref": request_ref},
                )
            else:
                await session.execute(
                    text(
                        "UPDATE travel_1c_requests "
                        "SET status = :st, updated_at = NOW() "
                        "WHERE request_ref = :rref"
                    ),
                    {"st": status, "rref": request_ref},
                )
            await session.commit()

    async def _save_diadoc_doc(self, record: dict[str, Any]) -> None:
        async with async_session() as session:
            await session.execute(
                text(
                    "INSERT INTO travel_diadoc_docs "
                    "(id, trip_id, order_ref, message_id, diadoc_doc_id, "
                    " doc_type, status, created_at) "
                    "VALUES (:id, :tid, :oref, :mid, :did, :dtype, :st, NOW())"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "tid": record["trip_id"],
                    "oref": record["order_ref"],
                    "mid": record["message_id"],
                    "did": record["diadoc_doc_id"],
                    "dtype": record["doc_type"],
                    "st": record["status"],
                },
            )
            await session.commit()

    # ==================================================================
    # Misc helpers
    # ==================================================================

    @staticmethod
    def _guess_content_type(filename: str) -> str:
        suffix = Path(filename).suffix.lower()
        return {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".html": "text/html",
        }.get(suffix, "application/octet-stream")


# Singleton
travel_agent = TravelAgent()
