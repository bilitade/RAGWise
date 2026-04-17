from __future__ import annotations

import threading

from app.config import QDRANT_SPARSE_MODEL

_lock = threading.Lock()
_sparse_model = None


def _get_sparse_model():
    global _sparse_model
    with _lock:
        if _sparse_model is None:
            from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding

            try:
                _sparse_model = SparseTextEmbedding(
                    QDRANT_SPARSE_MODEL,
                    providers=["CUDAExecutionProvider"],
                )
            except Exception:
                _sparse_model = SparseTextEmbedding(QDRANT_SPARSE_MODEL)
    return _sparse_model


def encode_sparse_texts(texts: list[str]) -> tuple[list[list[int]], list[list[float]]]:
    if not texts:
        return [], []
    model = _get_sparse_model()
    # Use larger batch size for faster processing (but respect GPU memory limits)
    batch_size = min(512, max(1, len(texts)))
    embeddings = list(model.embed(texts, batch_size=batch_size))
    indices: list[list[int]] = []
    values: list[list[float]] = []
    for emb in embeddings:
        indices.append(emb.indices.tolist())
        values.append(emb.values.tolist())
    return indices, values


def encode_sparse_query(text: str):
    from qdrant_client.http import models as qmodels

    idx, val = encode_sparse_texts([text])
    if not idx or not idx[0]:
        return qmodels.SparseVector(indices=[], values=[])
    return qmodels.SparseVector(indices=idx[0], values=val[0])
