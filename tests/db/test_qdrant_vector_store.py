import uuid

from app.db.qdrant import _qdrant_rest_point_id, _sanitize_sparse_vector_for_upsert


def test_qdrant_rest_point_id_accepts_uuid() -> None:
    u = str(uuid.uuid4())
    assert _qdrant_rest_point_id(u) == u


def test_qdrant_rest_point_id_maps_arbitrary_string() -> None:
    a = _qdrant_rest_point_id("not-a-uuid-doc-key")
    b = _qdrant_rest_point_id("not-a-uuid-doc-key")
    assert a == b
    uuid.UUID(a)


def test_sanitize_sparse_dedupes_and_sorts() -> None:
    idx, val = _sanitize_sparse_vector_for_upsert([3, 1, 3], [0.5, 0.1, 0.8])
    assert idx == [1, 3]
    assert val == [0.1, 0.8]
