import type { Stage } from "../types";

export function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatStageName(name: string): string {
    return name.replace(/_/g, " ");
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return "Not indexed";
    return new Date(value).toLocaleString();
}

export function getStatusClass(stage?: Stage | null): string {
    if (!stage) return "text-muted";
    if (stage.status === "failed") return "status-error";
    if (stage.status === "completed") return "status-success";
    if (stage.status === "running") return "status-data";
    return "text-muted";
}
