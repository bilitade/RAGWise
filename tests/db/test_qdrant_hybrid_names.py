"""Hybrid collection vector name validation."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.db.qdrant import QdrantStore


def _store_with_collection_vectors(
    *,
    dense_keys: list[str],
    sparse_keys: list[str],
    vectors_is_dict: bool = True,
) -> QdrantStore:
    from app.db.qdrant import QdrantConnectionConfig

    store = QdrantStore.__new__(QdrantStore)
    store.config = QdrantConnectionConfig(collection_name="kb_test")
    mock_client = MagicMock()
    info = MagicMock()
    if vectors_is_dict:
        info.config.params.vectors = {k: MagicMock(size=1536) for k in dense_keys}
    else:
        info.config.params.vectors = MagicMock(size=1536)
    info.config.params.sparse_vectors = {k: MagicMock() for k in sparse_keys}
    mock_client.get_collection.return_value = info
    store._client = mock_client  # noqa: SLF001
    return store


def test_assert_hybrid_vector_names_match_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.db.qdrant.DENSE_VECTOR_NAME", "dense-vector")
    monkeypatch.setattr("app.db.qdrant.SPARSE_VECTOR_NAME", "sparse-vector")
    store = _store_with_collection_vectors(
        dense_keys=["dense-vector"],
        sparse_keys=["sparse-vector"],
    )
    store._assert_hybrid_vector_names_match()  # noqa: SLF001


def test_assert_hybrid_vector_names_match_dense_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.db.qdrant.DENSE_VECTOR_NAME", "dense-vector")
    monkeypatch.setattr("app.db.qdrant.SPARSE_VECTOR_NAME", "sparse-vector")
    store = _store_with_collection_vectors(
        dense_keys=["text-dense"],
        sparse_keys=["sparse-vector"],
    )
    with pytest.raises(ValueError, match="no dense vector named"):
        store._assert_hybrid_vector_names_match()  # noqa: SLF001


def test_assert_hybrid_vector_names_match_sparse_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.db.qdrant.DENSE_VECTOR_NAME", "dense-vector")
    monkeypatch.setattr("app.db.qdrant.SPARSE_VECTOR_NAME", "sparse-vector")
    store = _store_with_collection_vectors(
        dense_keys=["dense-vector"],
        sparse_keys=["text-sparse-new"],
    )
    with pytest.raises(ValueError, match="no sparse vector named"):
        store._assert_hybrid_vector_names_match()  # noqa: SLF001
