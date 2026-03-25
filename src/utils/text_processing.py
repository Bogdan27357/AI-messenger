"""NLP text processing utilities for TMC normalization and classification."""

import re
import logging

logger = logging.getLogger(__name__)

# Common Russian abbreviations in procurement
ABBREVIATIONS = {
    "шт": "штука",
    "м": "метр",
    "кг": "килограмм",
    "л": "литр",
    "компл": "комплект",
    "уп": "упаковка",
    "п/м": "погонный метр",
    "кв.м": "квадратный метр",
    "куб.м": "кубический метр",
    "т": "тонна",
}

# Stop words for TMC processing
STOP_WORDS = {
    "для", "при", "или", "на", "от", "до", "по", "из", "за", "об",
    "без", "под", "над", "про", "через", "между", "около", "вокруг",
    "артикул", "арт", "код", "номер", "ном", "каталожный",
}


def normalize_tmc_name(name: str) -> str:
    """Normalize a TMC item name for better classification.

    - Lowercase
    - Remove extra whitespace
    - Expand abbreviations
    - Remove special characters
    """
    if not name:
        return ""

    text = name.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[«»"\'()]', '', text)
    text = re.sub(r'\s*[/\\]\s*', ' ', text)

    # Expand abbreviations
    for abbr, full in ABBREVIATIONS.items():
        text = re.sub(rf'\b{re.escape(abbr)}\b\.?', full, text)

    # Remove article numbers (patterns like XXX-YYYY or XXXYYY)
    text = re.sub(r'\b[A-Za-z0-9]{2,}-[A-Za-z0-9]{2,}(-[A-Za-z0-9]+)*\b', '', text)

    text = re.sub(r'\s+', ' ', text).strip()
    return text


def remove_stop_words(text: str) -> str:
    """Remove stop words from text."""
    words = text.split()
    return " ".join(w for w in words if w.lower() not in STOP_WORDS)


def prepare_for_embedding(name: str, description: str = "", group: str = "") -> str:
    """Prepare TMC item text for embedding generation."""
    parts = []
    if name:
        parts.append(normalize_tmc_name(name))
    if group:
        parts.append(f"группа: {group.lower()}")
    if description:
        desc = description.lower().strip()[:500]
        parts.append(desc)
    return " ".join(parts)


def extract_amount(text: str) -> float | None:
    """Extract a monetary amount from text (Russian format)."""
    patterns = [
        r'(\d[\d\s]*[\d])[,.](\d{2})\s*(руб|₽|RUB)',
        r'итого[:\s]*(\d[\d\s]*[\d])[,.](\d{2})',
        r'сумма[:\s]*(\d[\d\s]*[\d])[,.](\d{2})',
        r'(\d[\d\s]*[\d])[,.](\d{2})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            integer_part = match.group(1).replace(" ", "")
            decimal_part = match.group(2)
            try:
                return float(f"{integer_part}.{decimal_part}")
            except ValueError:
                continue
    return None


def extract_inn(text: str) -> str | None:
    """Extract INN (10 or 12 digits) from text."""
    match = re.search(r'ИНН[:\s]*(\d{10,12})', text, re.IGNORECASE)
    if match:
        return match.group(1)
    # Standalone 10 or 12 digit number
    match = re.search(r'\b(\d{10}|\d{12})\b', text)
    if match:
        return match.group(1)
    return None
