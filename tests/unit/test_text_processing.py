"""Unit tests for text processing utilities."""

import pytest
from src.utils.text_processing import (
    normalize_tmc_name,
    remove_stop_words,
    prepare_for_embedding,
    extract_amount,
    extract_inn,
)


class TestNormalizeTmcName:
    def test_basic_normalization(self):
        result = normalize_tmc_name("  Болт   М8×20  ")
        assert result == "болт м8×20"

    def test_removes_quotes(self):
        result = normalize_tmc_name('Труба «стальная» (Ду50)')
        assert "«" not in result
        assert "»" not in result

    def test_empty_string(self):
        assert normalize_tmc_name("") == ""
        assert normalize_tmc_name("   ") == ""

    def test_abbreviation_expansion(self):
        result = normalize_tmc_name("10 шт. болтов")
        assert "штука" in result

    def test_removes_article_numbers(self):
        result = normalize_tmc_name("Подшипник SKF-6205-2RS")
        assert "SKF-6205-2RS" not in result


class TestRemoveStopWords:
    def test_removes_stop_words(self):
        result = remove_stop_words("труба для водоснабжения")
        assert "для" not in result
        assert "труба" in result


class TestPrepareForEmbedding:
    def test_combines_fields(self):
        result = prepare_for_embedding("Болт М8", "крепёж", "Метизы")
        assert "болт" in result
        assert "группа: метизы" in result
        assert "крепёж" in result

    def test_only_name(self):
        result = prepare_for_embedding("Труба стальная")
        assert "труба" in result


class TestExtractAmount:
    def test_rub_format(self):
        result = extract_amount("Итого: 15 000,50 руб.")
        assert result == 15000.50

    def test_simple_amount(self):
        result = extract_amount("сумма: 1234,56")
        assert result == 1234.56

    def test_no_amount(self):
        result = extract_amount("нет суммы здесь")
        assert result is None


class TestExtractInn:
    def test_inn_with_label(self):
        result = extract_inn("ИНН: 7707083893")
        assert result == "7707083893"

    def test_inn_12_digits(self):
        result = extract_inn("ИНН 123456789012")
        assert result == "123456789012"

    def test_no_inn(self):
        result = extract_inn("обычный текст")
        assert result is None
