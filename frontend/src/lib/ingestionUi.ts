import type { IngestionJob, ManagedDocument, Stage } from "../types";

export const INGESTION_STEPS = [
    { name: "queued", label: "Queued" },
    { name: "upload_received", label: "Upload received" },
    { name: "discovering_files", label: "Discovering files" },
    { name: "loading_documents", label: "Loading documents" },
    { name: "chunking_documents", label: "Chunking documents" },
    { name: "preparing_vector_store", label: "Preparing vector store" },
    { name: "embedding_and_indexing", label: "Embedding and indexing" },
    {
        name: "indexing_sparse_vectors",
        label: "Indexing sparse vectors (Qdrant hybrid)",
    },
    { name: "completed", label: "Completed" },
] as const;

export function getStepLabel(stepName: string | null | undefined): string {
    return (
        INGESTION_STEPS.find((step) => step.name === stepName)?.label ?? "Idle"
    );
}

export function getJobSummary(job: IngestionJob | null): {
    title: string;
    detail: string;
    status: string;
    progress: number;
    nextLabel: string;
} {
    if (!job) {
        return {
            title: "No active ingestion job",
            detail: "Queue an ingestion job to start processing documents.",
            status: "idle",
            progress: 0,
            nextLabel: "Waiting to start",
        };
    }

    if (job.failed) {
        return {
            title: "Ingestion failed",
            detail: job.error ?? job.stage?.message ?? "The ingestion job failed.",
            status: "failed",
            progress: 100,
            nextLabel: "Review the error and retry",
        };
    }

    if (job.successful) {
        return {
            title: "Ingestion completed",
            detail:
                job.stage?.message ??
                "The ingestion workflow completed successfully.",
            status: "completed",
            progress: 100,
            nextLabel: "Knowledge base is up to date",
        };
    }

    if (job.stage) {
        const stepIndex = INGESTION_STEPS.findIndex(
            (step) => step.name === job.stage?.name,
        );
        return {
            title: getStepLabel(job.stage.name),
            detail: job.stage.message,
            status: job.stage.status,
            progress: job.stage.progress,
            nextLabel:
                stepIndex >= 0 && stepIndex < INGESTION_STEPS.length - 1
                    ? `Next: ${INGESTION_STEPS[stepIndex + 1].label}`
                    : "Processing",
        };
    }

    return {
        title: "Ingestion queued",
        detail: "The job is waiting for a worker to start processing.",
        status: "pending",
        progress: 0,
        nextLabel: "Next: Queued",
    };
}

export function getDocumentBadge(document: ManagedDocument): string {
    if (document.needs_reindex) return "status-warning";
    if (document.indexed) return "status-success";
    return "status-data";
}
