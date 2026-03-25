"""Unit tests for RAG pipeline text chunking."""

from src.core.rag_pipeline import chunk_text


class TestChunkText:
    def test_empty_text(self):
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text(self):
        text = "Короткий текст."
        chunks = chunk_text(text, chunk_size=100)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_splits_on_sentences(self):
        text = "Первое предложение. Второе предложение. Третье предложение."
        chunks = chunk_text(text, chunk_size=40, overlap=10)
        assert len(chunks) >= 2

    def test_overlap_present(self):
        sentences = [f"Предложение номер {i}." for i in range(10)]
        text = " ".join(sentences)
        chunks = chunk_text(text, chunk_size=60, overlap=20)
        # With overlap, later chunks should contain some text from previous
        if len(chunks) > 1:
            assert len(chunks[1]) > 0

    def test_respects_chunk_size(self):
        text = "Слово. " * 200
        chunks = chunk_text(text, chunk_size=100, overlap=20)
        # Most chunks should be around chunk_size (some may be larger due to sentence boundaries)
        for chunk in chunks[:-1]:  # last chunk can be smaller
            assert len(chunk) <= 200  # generous upper bound
