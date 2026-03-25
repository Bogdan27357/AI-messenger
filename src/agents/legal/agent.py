"""Legal expertise agent for contract analysis and compliance checking.

Provides:
- Indexing of legal standard documents into Qdrant
- Full contract analysis pipeline with RAG-based comparison to standards
- Counterparty verification through external legal reference APIs
"""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from src.core.llm_adapter import ollama
from src.core.rag_pipeline import rag_pipeline, chunk_text
from src.core.qdrant_client import qdrant_manager
from src.integrations.legal_references import legal_references
from src.utils.document_parser import detect_and_parse, extract_text_with_structure
from src.utils.ocr import ocr_processor

logger = logging.getLogger(__name__)

LEGAL_STANDARDS_COLLECTION = "legal_standards"
LEGAL_PRECEDENTS_COLLECTION = "legal_precedents"

CONTRACT_SECTIONS = [
    "ответственность",
    "разрешение споров",
    "гарантийные обязательства",
    "порядок приёмки",
    "технические требования",
]

SECTION_EXTRACTION_PROMPT = """\
Ты — опытный юрист-аналитик. Проанализируй текст договора и извлеки ключевые разделы.

Для каждого из следующих разделов извлеки соответствующий текст из договора:
1. ответственность — пункты об ответственности сторон, ограничениях ответственности, штрафах и неустойках
2. разрешение споров — порядок урегулирования разногласий, арбитражная оговорка, претензионный порядок
3. гарантийные обязательства — гарантийные сроки, объём гарантий, порядок гарантийного обслуживания
4. порядок приёмки — процедура приёмки работ/товаров, сроки, документы приёмки
5. технические требования — спецификации, стандарты качества, технические условия

Также извлеки:
- ИНН контрагента (если указан)
- Общая сумма договора
- Сроки исполнения
- Предмет договора

Верни результат строго в формате JSON:
{
  "предмет_договора": "...",
  "сумма": "...",
  "сроки": "...",
  "инн_контрагента": "...",
  "разделы": {
    "ответственность": "текст раздела или null если не найден",
    "разрешение_споров": "текст раздела или null если не найден",
    "гарантийные_обязательства": "текст раздела или null если не найден",
    "порядок_приёмки": "текст раздела или null если не найден",
    "технические_требования": "текст раздела или null если не найден"
  }
}

Отвечай ТОЛЬКО валидным JSON, без дополнительных комментариев.
"""

DEEP_ANALYSIS_PROMPT = """\
Ты — старший юрист с 20-летним опытом анализа коммерческих договоров. \
Проведи глубокий юридический анализ следующих разделов договора.

Для каждого раздела оцени:
1. Лимиты ответственности — есть ли ограничение суммы ответственности, соразмерность неустоек
2. Штрафные санкции — размеры штрафов и пеней, баланс между сторонами
3. Арбитражная оговорка — в каком суде будут рассматриваться споры, есть ли обязательный претензионный порядок
4. Гарантийные обязательства — достаточность гарантийных сроков, объём покрытия
5. Риски для нашей компании — какие положения могут привести к убыткам

Верни результат строго в формате JSON:
{
  "анализ": {
    "лимиты_ответственности": {"описание": "...", "риск": "low/medium/high/critical", "замечания": ["..."]},
    "штрафные_санкции": {"описание": "...", "риск": "low/medium/high/critical", "замечания": ["..."]},
    "арбитражная_оговорка": {"описание": "...", "риск": "low/medium/high/critical", "замечания": ["..."]},
    "гарантии": {"описание": "...", "риск": "low/medium/high/critical", "замечания": ["..."]},
    "общие_риски": ["..."]
  }
}

Отвечай ТОЛЬКО валидным JSON.
"""

RISK_ASSESSMENT_PROMPT = """\
Ты — руководитель юридического отдела. На основании результатов анализа договора \
сформируй итоговую оценку рисков и рекомендации.

Учитывай:
- Результаты сравнения с эталонными стандартами
- Результаты глубокого анализа ключевых разделов
- Результаты проверки контрагента

Определи итоговый статус:
- "approved" — договор можно подписывать, критических замечаний нет
- "needs_revision" — требуются правки, есть существенные замечания
- "blocked" — подписание невозможно, есть критические проблемы

Верни результат строго в формате JSON:
{
  "overall_status": "approved/needs_revision/blocked",
  "overall_risk": "low/medium/high/critical",
  "critical_errors": ["список критических ошибок"],
  "recommended_edits": ["список рекомендуемых правок"],
  "summary": "краткое резюме для руководства"
}

Отвечай ТОЛЬКО валидным JSON.
"""

STANDARD_COMPARISON_PROMPT = """\
Ты — юрист-эксперт по комплаенсу. Сравни текст раздела договора с эталонным стандартом.

Определи:
1. Соответствует ли раздел договора эталону
2. Какие расхождения имеются
3. Насколько критичны расхождения

Верни результат строго в формате JSON:
{
  "compliant": true/false,
  "discrepancies": [
    {
      "type": "missing/modified/extra",
      "description": "описание расхождения",
      "severity": "low/medium/high/critical",
      "standard_text": "текст из стандарта",
      "current_text": "текст из договора"
    }
  ],
  "risk_level": "low/medium/high/critical"
}

Отвечай ТОЛЬКО валидным JSON.
"""


def _safe_parse_json(text: str) -> dict[str, Any]:
    """Parse JSON from LLM response, handling markdown code blocks."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Drop first line (```json) and last line (```)
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        cleaned = "\n".join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM JSON response: %s", text[:500])
        return {}


class LegalAgent:
    """Agent for legal expertise: contract analysis, standards compliance, counterparty checks."""

    def __init__(self) -> None:
        self.llm = ollama
        self.rag = rag_pipeline
        self.qdrant = qdrant_manager
        self.legal_refs = legal_references

    # ------------------------------------------------------------------
    # 1. Index legal standards
    # ------------------------------------------------------------------

    async def index_legal_standards(self, directory: str) -> dict[str, Any]:
        """Scan a directory for legal standard documents and index them in Qdrant.

        Supports DOCX and PDF files. Each document is chunked and stored in the
        ``legal_standards`` collection with metadata including document type,
        section information, version, and effective date.

        Args:
            directory: Path to the directory containing legal standard files.

        Returns:
            Summary dict with counts of indexed and failed documents.
        """
        dir_path = Path(directory)
        if not dir_path.is_dir():
            raise ValueError(f"Directory not found: {directory}")

        supported_extensions = {".docx", ".pdf"}
        files = [
            f for f in dir_path.iterdir()
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]

        if not files:
            logger.warning("No supported documents found in %s", directory)
            return {"indexed": 0, "failed": 0, "total_chunks": 0, "files": []}

        indexed_count = 0
        failed_count = 0
        total_chunks = 0
        indexed_files: list[dict[str, Any]] = []

        for file_path in files:
            try:
                logger.info("Indexing legal standard: %s", file_path.name)

                structured = extract_text_with_structure(str(file_path))
                text = structured["text"]
                if not text.strip():
                    logger.warning("Empty text extracted from %s, skipping", file_path.name)
                    failed_count += 1
                    continue

                # Derive metadata from file name and content
                doc_id = str(uuid.uuid4())
                metadata = {
                    "doc_type": "legal_standard",
                    "file_name": file_path.name,
                    "file_type": file_path.suffix.lower(),
                    "section": self._detect_standard_section(file_path.name, text),
                    "version": self._extract_version(text),
                    "effective_date": self._extract_effective_date(text),
                    "indexed_at": datetime.utcnow().isoformat(),
                }

                point_ids = await self.rag.index_document(
                    collection=LEGAL_STANDARDS_COLLECTION,
                    text=text,
                    metadata=metadata,
                    doc_id=doc_id,
                )

                indexed_count += 1
                total_chunks += len(point_ids)
                indexed_files.append({
                    "file": file_path.name,
                    "doc_id": doc_id,
                    "chunks": len(point_ids),
                })

                logger.info(
                    "Indexed %s: %d chunks, doc_id=%s",
                    file_path.name, len(point_ids), doc_id,
                )

            except Exception:
                logger.exception("Failed to index %s", file_path.name)
                failed_count += 1

        result = {
            "indexed": indexed_count,
            "failed": failed_count,
            "total_chunks": total_chunks,
            "files": indexed_files,
        }
        logger.info("Legal standards indexing complete: %s", result)
        return result

    # ------------------------------------------------------------------
    # 2. Analyze contract
    # ------------------------------------------------------------------

    async def analyze_contract(self, contract_id: str, file_path: str) -> dict[str, Any]:
        """Run the full contract analysis pipeline.

        Steps:
            a) OCR / parse the contract document
            b) Extract key sections via LLM
            c) RAG comparison with legal_standards for each section
            d) Deep analysis of key clauses via LLM
            e) Counterparty check via legal reference APIs
            f) Risk assessment per section and overall
            g) Store review in legal_precedents for knowledge accumulation

        Args:
            contract_id: Unique identifier for the contract.
            file_path: Local path to the contract file.

        Returns:
            Structured report dict.
        """
        logger.info("Starting contract analysis: contract_id=%s, file=%s", contract_id, file_path)

        # --- (a) Parse / OCR the document ---
        contract_text = await self._extract_contract_text(file_path)
        if not contract_text:
            return {
                "contract_id": contract_id,
                "overall_status": "blocked",
                "critical_errors": ["Не удалось извлечь текст из документа"],
                "recommended_edits": [],
                "discrepancies": [],
                "risk_assessment": {"overall": "critical", "sections": {}},
                "counterparty_check": {},
            }

        # --- (b) Extract key sections ---
        sections = await self._extract_sections(contract_text)
        if not sections:
            return {
                "contract_id": contract_id,
                "overall_status": "blocked",
                "critical_errors": ["Не удалось разобрать структуру договора"],
                "recommended_edits": [],
                "discrepancies": [],
                "risk_assessment": {"overall": "critical", "sections": {}},
                "counterparty_check": {},
            }

        extracted_sections = sections.get("разделы", {})
        counterparty_inn = sections.get("инн_контрагента")

        # --- (c) RAG comparison with standards ---
        discrepancies = await self._compare_with_standards(extracted_sections)

        # --- (d) Deep analysis ---
        deep_analysis = await self._deep_analysis(extracted_sections)

        # --- (e) Counterparty check ---
        counterparty_check: dict[str, Any] = {}
        if counterparty_inn and counterparty_inn != "null":
            try:
                counterparty_check = await self.legal_refs.full_check(counterparty_inn)
            except Exception:
                logger.exception("Counterparty check failed for INN=%s", counterparty_inn)
                counterparty_check = {"error": "Проверка контрагента завершилась ошибкой"}

        # --- (f) Risk assessment ---
        risk_assessment = await self._assess_risks(
            sections=extracted_sections,
            discrepancies=discrepancies,
            deep_analysis=deep_analysis,
            counterparty_check=counterparty_check,
        )

        # Build the final report
        report = {
            "contract_id": contract_id,
            "overall_status": risk_assessment.get("overall_status", "needs_revision"),
            "critical_errors": risk_assessment.get("critical_errors", []),
            "recommended_edits": risk_assessment.get("recommended_edits", []),
            "discrepancies": discrepancies,
            "risk_assessment": {
                "overall": risk_assessment.get("overall_risk", "medium"),
                "sections": deep_analysis.get("анализ", {}),
            },
            "counterparty_check": counterparty_check,
            "contract_summary": {
                "subject": sections.get("предмет_договора"),
                "amount": sections.get("сумма"),
                "deadlines": sections.get("сроки"),
                "counterparty_inn": counterparty_inn,
            },
            "analyzed_at": datetime.utcnow().isoformat(),
        }

        # --- (g) Store review in legal_precedents ---
        await self._store_precedent(contract_id, report)

        logger.info(
            "Contract analysis complete: contract_id=%s, status=%s, risk=%s",
            contract_id, report["overall_status"], report["risk_assessment"]["overall"],
        )
        return report

    # ------------------------------------------------------------------
    # 3. Check counterparty
    # ------------------------------------------------------------------

    async def check_counterparty(self, inn: str) -> dict[str, Any]:
        """Run a full counterparty check via legal reference APIs.

        Args:
            inn: Taxpayer Identification Number (INN) of the counterparty.

        Returns:
            Combined check results from EGRUL, KAD, bankruptcy registry, and FNS.
        """
        logger.info("Checking counterparty: INN=%s", inn)
        try:
            result = await self.legal_refs.full_check(inn)
            logger.info("Counterparty check complete for INN=%s, risk=%s", inn, result.get("overall_risk"))
            return result
        except Exception:
            logger.exception("Counterparty check failed for INN=%s", inn)
            return {
                "inn": inn,
                "error": "Ошибка при проверке контрагента",
                "overall_risk": "unknown",
            }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _extract_contract_text(self, file_path: str) -> str:
        """Extract text from a contract file using document parser or OCR fallback."""
        path = Path(file_path)
        ext = path.suffix.lower()

        try:
            # For DOCX and text-based PDFs, use the document parser first
            if ext in (".docx", ".pdf", ".txt"):
                text = detect_and_parse(file_path)
                if text and len(text.strip()) > 100:
                    return text

            # Fallback: OCR with vision model
            logger.info("Falling back to OCR for %s", file_path)
            ocr_result = await ocr_processor.extract_with_vision_fallback(file_path)
            return ocr_result.get("text", "")

        except Exception:
            logger.exception("Failed to extract text from %s", file_path)
            return ""

    async def _extract_sections(self, contract_text: str) -> dict[str, Any]:
        """Use LLM to extract key contract sections."""
        try:
            # Truncate very long contracts to fit model context
            truncated = contract_text[:15000] if len(contract_text) > 15000 else contract_text

            response = await self.llm.chat(
                messages=[
                    {"role": "system", "content": SECTION_EXTRACTION_PROMPT},
                    {"role": "user", "content": f"Текст договора:\n\n{truncated}"},
                ],
                temperature=0.05,
            )
            return _safe_parse_json(response)
        except Exception:
            logger.exception("Section extraction failed")
            return {}

    async def _compare_with_standards(
        self,
        sections: dict[str, str | None],
    ) -> list[dict[str, Any]]:
        """Compare each extracted section against the legal standards collection via RAG."""
        all_discrepancies: list[dict[str, Any]] = []

        section_key_map = {
            "ответственность": "ответственность",
            "разрешение_споров": "разрешение споров",
            "гарантийные_обязательства": "гарантийные обязательства",
            "порядок_приёмки": "порядок приёмки",
            "технические_требования": "технические требования",
        }

        for section_key, section_label in section_key_map.items():
            section_text = sections.get(section_key)
            if not section_text or section_text == "null":
                all_discrepancies.append({
                    "section": section_label,
                    "current_text": None,
                    "standard_text": None,
                    "type": "missing",
                    "severity": "high",
                    "description": f"Раздел '{section_label}' отсутствует в договоре",
                })
                continue

            try:
                # Search for matching standards
                search_results = await self.rag.search(
                    collection=LEGAL_STANDARDS_COLLECTION,
                    query=f"{section_label}: {section_text[:500]}",
                    top_k=3,
                    score_threshold=0.5,
                )

                if not search_results:
                    logger.info("No matching standard found for section '%s'", section_label)
                    continue

                # Build context from matching standards
                standard_texts = "\n\n".join(
                    f"[Стандарт, релевантность {r['score']:.2f}]:\n{r['text']}"
                    for r in search_results
                )

                # Ask LLM to compare
                response = await self.llm.chat(
                    messages=[
                        {"role": "system", "content": STANDARD_COMPARISON_PROMPT},
                        {
                            "role": "user",
                            "content": (
                                f"Раздел договора — «{section_label}»:\n{section_text}\n\n"
                                f"---\n\nЭталонные стандарты:\n{standard_texts}"
                            ),
                        },
                    ],
                    temperature=0.05,
                )

                comparison = _safe_parse_json(response)
                for disc in comparison.get("discrepancies", []):
                    all_discrepancies.append({
                        "section": section_label,
                        "current_text": disc.get("current_text", ""),
                        "standard_text": disc.get("standard_text", ""),
                        "type": disc.get("type", "modified"),
                        "severity": disc.get("severity", "medium"),
                        "description": disc.get("description", ""),
                    })

            except Exception:
                logger.exception("Standard comparison failed for section '%s'", section_label)

        return all_discrepancies

    async def _deep_analysis(self, sections: dict[str, str | None]) -> dict[str, Any]:
        """Run deep LLM analysis of key contract clauses."""
        try:
            # Build a combined text of all available sections
            sections_text_parts: list[str] = []
            for key, value in sections.items():
                if value and value != "null":
                    sections_text_parts.append(f"### {key}\n{value}")

            if not sections_text_parts:
                return {"анализ": {}}

            combined = "\n\n".join(sections_text_parts)

            response = await self.llm.chat(
                messages=[
                    {"role": "system", "content": DEEP_ANALYSIS_PROMPT},
                    {"role": "user", "content": f"Разделы договора для анализа:\n\n{combined}"},
                ],
                temperature=0.05,
            )
            return _safe_parse_json(response)
        except Exception:
            logger.exception("Deep analysis failed")
            return {"анализ": {}}

    async def _assess_risks(
        self,
        sections: dict[str, str | None],
        discrepancies: list[dict[str, Any]],
        deep_analysis: dict[str, Any],
        counterparty_check: dict[str, Any],
    ) -> dict[str, Any]:
        """Produce final risk assessment by combining all analysis results."""
        try:
            context = json.dumps(
                {
                    "discrepancies_count": len(discrepancies),
                    "critical_discrepancies": [
                        d for d in discrepancies if d.get("severity") == "critical"
                    ],
                    "high_discrepancies": [
                        d for d in discrepancies if d.get("severity") == "high"
                    ],
                    "deep_analysis": deep_analysis.get("анализ", {}),
                    "counterparty_risk": counterparty_check.get("overall_risk", "unknown"),
                    "counterparty_bankrupt": (
                        counterparty_check.get("bankruptcy", {}).get("is_bankrupt", False)
                        if isinstance(counterparty_check.get("bankruptcy"), dict) else False
                    ),
                    "missing_sections": [
                        d["section"] for d in discrepancies if d.get("type") == "missing"
                    ],
                },
                ensure_ascii=False,
                default=str,
            )

            response = await self.llm.chat(
                messages=[
                    {"role": "system", "content": RISK_ASSESSMENT_PROMPT},
                    {
                        "role": "user",
                        "content": f"Результаты анализа договора:\n\n{context}",
                    },
                ],
                temperature=0.05,
            )
            return _safe_parse_json(response)
        except Exception:
            logger.exception("Risk assessment failed")
            # Fallback: derive status from raw counts
            critical_count = sum(1 for d in discrepancies if d.get("severity") == "critical")
            high_count = sum(1 for d in discrepancies if d.get("severity") == "high")

            if critical_count > 0 or counterparty_check.get("overall_risk") == "critical":
                status = "blocked"
                risk = "critical"
            elif high_count > 2 or counterparty_check.get("overall_risk") == "high":
                status = "needs_revision"
                risk = "high"
            elif high_count > 0:
                status = "needs_revision"
                risk = "medium"
            else:
                status = "approved"
                risk = "low"

            return {
                "overall_status": status,
                "overall_risk": risk,
                "critical_errors": [
                    d["description"] for d in discrepancies if d.get("severity") == "critical"
                ],
                "recommended_edits": [
                    d["description"] for d in discrepancies if d.get("severity") in ("high", "medium")
                ],
            }

    async def _store_precedent(self, contract_id: str, report: dict[str, Any]) -> None:
        """Store the review results in the legal_precedents collection for future reference."""
        try:
            summary = json.dumps(
                {
                    "contract_id": contract_id,
                    "status": report["overall_status"],
                    "risk": report["risk_assessment"]["overall"],
                    "critical_errors": report["critical_errors"],
                    "discrepancy_count": len(report["discrepancies"]),
                },
                ensure_ascii=False,
                default=str,
            )

            await self.rag.index_document(
                collection=LEGAL_PRECEDENTS_COLLECTION,
                text=summary,
                metadata={
                    "doc_type": "contract_review",
                    "contract_id": contract_id,
                    "overall_status": report["overall_status"],
                    "overall_risk": report["risk_assessment"]["overall"],
                    "reviewed_at": report.get("analyzed_at", datetime.utcnow().isoformat()),
                },
                doc_id=f"review_{contract_id}",
            )
            logger.info("Stored review precedent for contract %s", contract_id)
        except Exception:
            logger.exception("Failed to store precedent for contract %s", contract_id)

    # ------------------------------------------------------------------
    # Metadata extraction helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_standard_section(file_name: str, text: str) -> str:
        """Detect the legal standard section/category from file name and content."""
        name_lower = file_name.lower()
        text_lower = text[:2000].lower()

        mapping = {
            "ответственность": ["ответственност", "штраф", "неустойк", "пеня"],
            "споры": ["спор", "арбитраж", "претензи", "суд"],
            "гарантии": ["гарант", "warranty", "обеспечен"],
            "приёмка": ["приёмк", "приемк", "акт выполнен"],
            "технические_требования": ["техническ", "спецификац", "стандарт", "гост", "ту"],
            "общие_условия": ["общие условия", "типовой договор", "рамочный"],
        }

        for section, keywords in mapping.items():
            for kw in keywords:
                if kw in name_lower or kw in text_lower:
                    return section
        return "общие"

    @staticmethod
    def _extract_version(text: str) -> str:
        """Try to extract a version number from the document text."""
        import re
        patterns = [
            r"[Вв]ерсия\s+(\d+[\.\d]*)",
            r"[Рр]едакция\s+(?:от\s+)?(\d{2}[\.\-]\d{2}[\.\-]\d{4})",
            r"v\.?\s*(\d+[\.\d]*)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text[:3000])
            if match:
                return match.group(1)
        return "1.0"

    @staticmethod
    def _extract_effective_date(text: str) -> str:
        """Try to extract an effective / approval date from the document."""
        import re
        patterns = [
            r"[Уу]твержд[её]н[оа]?\s+(\d{2}[\.\-]\d{2}[\.\-]\d{4})",
            r"[Вв]ступает\s+в\s+силу\s+(?:с\s+)?(\d{2}[\.\-]\d{2}[\.\-]\d{4})",
            r"от\s+(\d{2}[\.\-]\d{2}[\.\-]\d{4})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text[:3000])
            if match:
                return match.group(1)
        return ""


# Singleton
legal_agent = LegalAgent()
