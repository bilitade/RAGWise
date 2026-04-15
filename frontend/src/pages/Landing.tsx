import { FiCpu, FiMessageSquare, FiSearch, FiUploadCloud } from "react-icons/fi";

import BrandWordmark from "../components/BrandWordmark";
import { navigateTo } from "../utils";

const features = [
  {
    icon: <FiUploadCloud className="size-5" strokeWidth={2.25} />,
    title: "Ingest & chunk",
    body: "Bring PDFs and text into a managed index with background jobs you can monitor.",
  },
  {
    icon: <FiSearch className="size-5" strokeWidth={2.25} />,
    title: "Hybrid retrieval",
    body: "Similarity, keyword, or hybrid search—scoped to what you uploaded.",
  },
  {
    icon: <FiMessageSquare className="size-5" strokeWidth={2.25} />,
    title: "Grounded chat",
    body: "Ask questions and get answers tied to your corpus, not generic web fluff.",
  },
  {
    icon: <FiCpu className="size-5" strokeWidth={2.25} />,
    title: "Workspace agent",
    body: "Admins set organization, guardrails, and guidelines in one place—everyone gets the same agent behavior in chat.",
  },
];

export default function Landing() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section className="brand-card brand-hero relative overflow-hidden rounded-2xl p-6 sm:rounded-3xl sm:p-10">
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <p className="heading-kicker text-[11px] font-semibold uppercase">Knowledge workspace</p>
            <div className="mt-4">
              <BrandWordmark />
            </div>
            <h1 className="brand-title mt-5 max-w-xl text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.65rem]">
              Grounded answers from <span className="text-[var(--data)]">your</span> documents.
            </h1>
            <p className="text-secondary mt-4 max-w-lg text-base leading-relaxed">
              Upload sources, run ingestion, search the index, and chat with an assistant that cites what you own—not the open web by default.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo("/login")}
                className="brand-primary rounded-xl px-5 py-3 text-sm font-semibold shadow-[0_1px_0_0_color-mix(in_srgb,var(--primary)_40%,transparent)]"
              >
                Log in to workspace
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/documents")}
                className="brand-secondary rounded-xl px-5 py-3 text-sm font-medium"
              >
                Browse documents
              </button>
            </div>
          </div>

          <div className="brand-elevated relative rounded-2xl border border-[color-mix(in_srgb,var(--border)_90%,transparent)] p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-50 blur-2xl"
              style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.35), transparent 70%)" }}
              aria-hidden
            />
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wide">Quick start</p>
            <ol className="mt-5 space-y-4 text-sm leading-relaxed">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-xs font-bold text-[var(--primary)]">
                  1
                </span>
                <span className="text-secondary pt-0.5">Sign in and open the Documents workspace.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--data)_14%,transparent)] text-xs font-bold text-[var(--data)]">
                  2
                </span>
                <span className="text-secondary pt-0.5">Upload files and run ingestion when you are ready.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-xs font-bold text-[var(--success)]">
                  3
                </span>
                <span className="text-secondary pt-0.5">Open Chat and ask with retrieval-backed context.</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => navigateTo("/chat")}
              className="mt-6 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--elevated)_80%,transparent)]"
            >
              Go to chat
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Built for serious RAG</h2>
            <p className="text-secondary mt-1 text-sm">Everything in one place—from files to answers.</p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4">
          {features.map((f) => (
            <li
              key={f.title}
              className="brand-card group flex gap-4 rounded-2xl p-4 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_22%,transparent)] sm:p-5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--elevated)_85%,transparent)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--border)_80%,transparent)] transition-colors group-hover:text-[var(--data)]">
                {f.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold tracking-tight">{f.title}</h3>
                <p className="text-secondary mt-1.5 text-sm leading-relaxed">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
