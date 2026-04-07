import BrandWordmark from "../components/BrandWordmark";
import { navigateTo } from "../utils";

export default function Landing() {
  return (
    <div className="flex flex-col gap-6">
      <section className="brand-card brand-hero rounded-[32px] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-4xl">
            <div className="heading-kicker text-xs font-medium uppercase">Agentic RAG System</div>
            <div className="mt-4">
              <BrandWordmark />
            </div>
            <h1 className="brand-title mt-5 max-w-3xl text-4xl font-medium leading-tight sm:text-6xl">
              Turn company knowledge into grounded answers.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-secondary">
              Ingest documents, retrieve context, and chat with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Qdrant-backed retrieval</div>
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Streaming responses</div>
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Document-level control</div>
            </div>
          </div>

          <div className="brand-elevated rounded-[28px] p-5 sm:p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Get started</div>
            <div className="mt-3 text-2xl font-medium">Move from raw files to grounded answers.</div>
            <p className="mt-3 text-sm leading-7 text-secondary">
              Start with documents or jump straight into chat.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => navigateTo("/documents")}
                className="brand-gradient rounded-2xl px-5 py-3.5 text-sm font-medium"
              >
                Open documents
              </button>
              <button
                onClick={() => navigateTo("/chat")}
                className="brand-secondary rounded-2xl px-5 py-3.5 text-sm font-medium"
              >
                Start chat
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-elevated rounded-[32px] p-5 sm:p-6 lg:p-8">
        <div className="mb-6 max-w-2xl">
          <div className="heading-kicker text-xs font-medium uppercase">What It Provides</div>
          <h2 className="brand-title mt-3 text-2xl font-medium sm:text-3xl">Core features for operational knowledge systems</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            RAGenius is designed to keep the workflow direct: ingest, retrieve, monitor, and answer.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Documents</div>
            <div className="mt-3 text-xl font-medium">Upload, reindex, and control source files</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Manage single-file ingestion, full reloads, and document deletion with clear operational control.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Retrieval</div>
            <div className="mt-3 text-xl font-medium">Dense, BM25, and advanced search</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Switch between similarity, lexical search, and fused retrieval to improve grounded responses.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Ingestion</div>
            <div className="mt-3 text-xl font-medium">Tracked background processing</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Follow chunking, embedding, and indexing progress through a clean asynchronous job timeline.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Agent</div>
            <div className="mt-3 text-xl font-medium">Streaming answers over company knowledge</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Run a compact chat workflow that can use local retrieval or web search based on the question.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
