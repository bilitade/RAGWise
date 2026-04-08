import time
import uuid
from pathlib import Path

import pytest
from celery.contrib.testing.worker import start_worker
from redis import Redis

from app.ingestion.loader import IngestionResult, IngestionStage
from app.ingestion.tasks import get_task_result, ingest_documents_task
from app.worker.celery_app import celery_app


TEST_REDIS_URL = "redis://localhost:6379/15"


def _redis_available() -> bool:
    try:
        client = Redis.from_url(TEST_REDIS_URL)
        client.ping()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _redis_available(),
    reason="Redis is required for Celery ingestion task integration tests.",
)


@pytest.fixture
def celery_test_app():
    queue_name = f"test-ingestion-{uuid.uuid4().hex}"
    original_conf = {
        "broker_url": celery_app.conf.broker_url,
        "result_backend": celery_app.conf.result_backend,
        "task_default_queue": celery_app.conf.task_default_queue,
    }
    celery_app.conf.broker_url = TEST_REDIS_URL
    celery_app.conf.result_backend = TEST_REDIS_URL
    celery_app.conf.task_default_queue = queue_name

    yield celery_app

    celery_app.conf.broker_url = original_conf["broker_url"]
    celery_app.conf.result_backend = original_conf["result_backend"]
    celery_app.conf.task_default_queue = original_conf["task_default_queue"]


@pytest.fixture
def redis_cleanup():
    client = Redis.from_url(TEST_REDIS_URL)
    client.flushdb()
    yield
    client.flushdb()


def test_ingestion_task_runs_in_background_and_reports_stage_status(
    monkeypatch: pytest.MonkeyPatch,
    celery_test_app,
    redis_cleanup,
    tmp_path: Path,
) -> None:
    source_dir = tmp_path / "upload"
    source_dir.mkdir()
    (source_dir / "faq.md").write_text("# FAQ\n\nBank policy content.\n", encoding="utf-8")

    def fake_ingest_documents(
        input_dir: Path | None = None,
        recreate_collection: bool = True,
        progress_callback=None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> IngestionResult:
        for stage in [
            IngestionStage(
                name="upload_received",
                status="running",
                progress=2,
                message="Ingestion request received.",
                details={"input_dir": str(input_dir)},
            ),
            IngestionStage(
                name="chunking_documents",
                status="running",
                progress=40,
                message="Splitting documents into retrieval chunks.",
                details={"documents_loaded": 1},
            ),
            IngestionStage(
                name="embedding_and_indexing",
                status="running",
                progress=80,
                message="Embedding chunks and storing vectors in Qdrant.",
                details={"nodes_generated": 3, "vector_size": 1536},
            ),
            IngestionStage(
                name="completed",
                status="completed",
                progress=100,
                message="Ingestion completed successfully.",
                details={"documents_indexed": 1, "nodes_indexed": 3},
            ),
        ]:
            if progress_callback is not None:
                progress_callback(stage)
            time.sleep(0.2)

        return IngestionResult(
            input_dir=str(input_dir),
            recreate_collection=recreate_collection,
            documents_indexed=1,
            nodes_indexed=3,
            collection_name="knowledge_base",
            qdrant_points=3,
            bm25_cache_path=str(tmp_path / "knowledge_base_nodes.jsonl"),
            stages=[
                IngestionStage(
                    name="completed",
                    status="completed",
                    progress=100,
                    message="Ingestion completed successfully.",
                    details={"documents_indexed": 1, "nodes_indexed": 3},
                )
            ],
        )

    monkeypatch.setattr("app.ingestion.tasks.ingest_documents", fake_ingest_documents)

    with start_worker(celery_test_app, perform_ping_check=False):
        async_result = ingest_documents_task.delay(
            input_dir=str(source_dir),
            recreate_collection=True,
        )

        observed_stages: list[str] = []
        deadline = time.time() + 10
        while time.time() < deadline:
            task = get_task_result(async_result.id)
            if isinstance(task.info, dict) and isinstance(task.info.get("stage_history"), list):
                observed_stages = [
                    stage["name"]
                    for stage in task.info["stage_history"]
                    if isinstance(stage, dict) and stage.get("name")
                ]
            if task.successful():
                break
            time.sleep(0.02)

        final_task = get_task_result(async_result.id)
        assert final_task.successful()
        assert "queued" in observed_stages
        assert "upload_received" in observed_stages
        assert "chunking_documents" in observed_stages
        assert "embedding_and_indexing" in observed_stages
        assert "completed" in observed_stages
        assert final_task.result["documents_indexed"] == 1
        assert final_task.result["nodes_indexed"] == 3
        assert final_task.result["collection_name"] == "knowledge_base"
