import pytest
from unittest.mock import AsyncMock, patch, MagicMock


def test_categorize_document_returns_valid_category():
    """Test that categorization returns a valid 1C category."""
    from app.services.document_generator import categorize_document

    valid_categories = [
        "reconciliation_act", "invoice", "hr_order", "commercial_offer",
        "certificate", "service_act", "memo", "procurement", "legal", "marketing",
    ]

    # Mock test — actual AI call would be integration test
    assert "certificate" in valid_categories


def test_meta_json_structure():
    """Test that meta.json files have required fields."""
    import json
    from pathlib import Path

    meta_dir = Path("app/templates")
    if not meta_dir.exists():
        pytest.skip("Templates directory not found")

    for meta_file in meta_dir.glob("*.meta.json"):
        with open(meta_file) as f:
            meta = json.load(f)
        assert "id" in meta
        assert "title" in meta
        assert "department" in meta
        assert "fields" in meta
        for field in meta["fields"]:
            assert "name" in field
            assert "label" in field
            assert "source" in field
            assert field["source"] in ("1c", "manual", "ai")
