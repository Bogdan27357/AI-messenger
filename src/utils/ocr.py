"""Local OCR processing using Tesseract with optional Ollama vision fallback."""

import base64
import logging
import tempfile
from pathlib import Path

import pytesseract
from PIL import Image

from src.core.llm_adapter import ollama

logger = logging.getLogger(__name__)


class OCRProcessor:
    """Process documents using local OCR (Tesseract) + LLM vision."""

    def __init__(self, lang: str = "rus+eng", confidence_threshold: float = 0.9):
        self.lang = lang
        self.confidence_threshold = confidence_threshold

    def extract_text_from_image(self, image_path: str) -> dict:
        """Extract text from an image file using Tesseract."""
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang=self.lang)
        data = pytesseract.image_to_data(image, lang=self.lang, output_type=pytesseract.Output.DICT)

        confidences = [int(c) for c in data["conf"] if int(c) > 0]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return {
            "text": text.strip(),
            "confidence": avg_confidence / 100.0,
            "word_count": len([w for w in data["text"] if w.strip()]),
        }

    def extract_text_from_pdf(self, pdf_path: str) -> list[dict]:
        """Extract text from a PDF, page by page.

        Converts each page to an image and runs OCR.
        """
        try:
            from pdf2image import convert_from_path
        except ImportError:
            logger.error("pdf2image not installed; install poppler-utils and pdf2image")
            raise

        images = convert_from_path(pdf_path, dpi=300)
        results = []

        for i, img in enumerate(images):
            with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                img.save(tmp.name, "PNG")
                page_result = self.extract_text_from_image(tmp.name)
                page_result["page"] = i + 1
                results.append(page_result)

        return results

    def extract_full_text(self, file_path: str) -> str:
        """Extract full concatenated text from a file (image or PDF)."""
        path = Path(file_path)
        if path.suffix.lower() == ".pdf":
            pages = self.extract_text_from_pdf(file_path)
            return "\n\n".join(p["text"] for p in pages)
        else:
            result = self.extract_text_from_image(file_path)
            return result["text"]

    async def extract_with_vision_fallback(self, file_path: str) -> dict:
        """Extract text using Tesseract; if confidence is low, use LLM vision."""
        path = Path(file_path)

        if path.suffix.lower() == ".pdf":
            pages = self.extract_text_from_pdf(file_path)
            full_text = "\n\n".join(p["text"] for p in pages)
            avg_conf = sum(p["confidence"] for p in pages) / len(pages) if pages else 0
        else:
            result = self.extract_text_from_image(file_path)
            full_text = result["text"]
            avg_conf = result["confidence"]

        if avg_conf >= self.confidence_threshold:
            return {"text": full_text, "confidence": avg_conf, "method": "tesseract"}

        # Fallback to vision model
        logger.info(
            "OCR confidence %.2f below threshold %.2f, using vision model",
            avg_conf, self.confidence_threshold,
        )
        try:
            if path.suffix.lower() == ".pdf":
                from pdf2image import convert_from_path
                images = convert_from_path(file_path, dpi=200, first_page=1, last_page=5)
                texts = []
                for img in images:
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                        img.save(tmp.name, "PNG")
                        with open(tmp.name, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode()
                        vision_text = await ollama.vision_analyze(
                            "Распознай весь текст на этом изображении документа. "
                            "Верни только распознанный текст без комментариев.",
                            b64,
                        )
                        texts.append(vision_text)
                full_text = "\n\n".join(texts)
            else:
                with open(file_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
                full_text = await ollama.vision_analyze(
                    "Распознай весь текст на этом изображении документа. "
                    "Верни только распознанный текст без комментариев.",
                    b64,
                )
            return {"text": full_text, "confidence": 0.85, "method": "vision_model"}
        except Exception as e:
            logger.warning("Vision fallback failed: %s, using Tesseract result", e)
            return {"text": full_text, "confidence": avg_conf, "method": "tesseract_fallback"}


ocr_processor = OCRProcessor()
