import {
  FiArrowRight,
  FiCpu,
  FiDatabase,
  FiGlobe,
  FiLayers,
  FiMessageSquare,
  FiMic,
  FiSearch,
  FiUploadCloud,
  FiZap,
} from "react-icons/fi";

import { canAccessDocuments, useAuth } from "../auth";
import { navigateTo } from "../utils";

const pillars = [
  {
    icon: <FiUploadCloud className="size-5" strokeWidth={2.25} />,
    title: "Document ingestion",
    body: "Upload files and run indexing in the background. Track progress and manage your knowledge base from one place.",
  },
  {
    icon: <FiSearch className="size-5" strokeWidth={2.25} />,
    title: "Precision search",
    body: "Dense and sparse search work together to surface the most relevant passages from your documents every time.",
  },
  {
    icon: <FiMessageSquare className="size-5" strokeWidth={2.25} />,
    title: "Cited answers",
    body: "Every response is grounded in your documents. Sources are visible and traceable — no guesswork.",
  },
  {
    icon: <FiCpu className="size-5" strokeWidth={2.25} />,
    title: "Governed AI",
    body: "Set the identity, tools, and guardrails that apply to every user. Consistent, policy-driven behavior at scale.",
  },
];

const pipeline = [
  { step: "01", label: "Upload", detail: "Add your documents — PDFs, reports, policies, or any text files." },
  { step: "02", label: "Index", detail: "Documents are chunked, embedded, and stored for fast, accurate search." },
  { step: "03", label: "Search", detail: "Every query finds the most relevant passages from your knowledge base." },
  { step: "04", label: "Answer", detail: "The AI responds with cited, grounded answers drawn from your content." },
];

const ctaAgentFeatures = [
  { label: "Knowledge base", Icon: FiDatabase },
  { label: "Web search", Icon: FiGlobe },
  { label: "Source citations", Icon: FiLayers },
  { label: "Research tools", Icon: FiZap },
  { label: "Multi-step reasoning", Icon: FiCpu },
] as const;

/** One “screen” below the app header (approx.). */
const landingScreen = "min-h-[calc(100dvh-5.5rem)] py-10 sm:py-14 lg:py-16";

export default function Landing() {
  const { user, authLoading } = useAuth();
  const showDocs = user ? canAccessDocuments(user.role) : false;

  return (
    <div className="landing-page w-full">
      <div className="mx-auto w-full max-w-7xl px-1 sm:px-2">
        <section id="landing-home" className={`${landingScreen} flex flex-col gap-8`}>
            <div className="landing-hero-shell relative flex min-h-0 flex-1 flex-col overflow-visible py-2 sm:py-4">
              <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden />
              <div
                className="pointer-events-none absolute -right-16 top-0 size-[20rem] rounded-full opacity-28 blur-3xl landing-hero-blob-a"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-10 size-[16rem] rounded-full opacity-22 blur-3xl landing-hero-blob-b"
                aria-hidden
              />

              <div className="relative my-auto grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,580px)] lg:items-center lg:gap-14 xl:gap-16">
                <div className="min-w-0 max-w-xl lg:pt-1">
                  <h1 className="brand-title text-[clamp(1.85rem,4.2vw,3rem)] font-semibold leading-[1.1] tracking-tight">
                    Answers from <span className="text-[var(--data)]">your</span> documents. Always cited. Always controlled.
                  </h1>

                  <p className="text-secondary mt-5 max-w-lg text-base leading-relaxed sm:text-[17px]">
                    Upload your documents, ask anything, and get precise cited answers — with full control over what the AI knows and how it responds.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-2.5">
                    {!authLoading && user ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigateTo("/chat")}
                          className="landing-cta-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
                        >
                          Chat
                          <FiArrowRight className="size-4" strokeWidth={2.25} />
                        </button>
                        {showDocs ? (
                          <button
                            type="button"
                            onClick={() => navigateTo("/documents")}
                            className="brand-secondary rounded-xl px-5 py-3 text-sm font-medium"
                          >
                            Documents
                          </button>
                        ) : null}
                      </>
                    ) : !authLoading ? (
                      <button
                        type="button"
                        onClick={() => navigateTo("/login")}
                        className="landing-cta-primary group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
                      >
                        Log in
                        <FiArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                      </button>
                    ) : (
                      <span className="text-muted text-sm">Loading…</span>
                    )}
                  </div>
                </div>

                <div className="min-w-0 w-full pr-2 sm:pr-3 lg:justify-self-end lg:pr-8">
                  <ArtifactBrowserPreview />
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-6 border-t border-[var(--border)] pt-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <p className="text-secondary max-w-2xl text-center text-base leading-relaxed lg:text-left">
                    Cited answers from your documents, with admin-controlled policies. Built for enterprise use, not generic chat.
                  </p>
                  <ul
                    className="flex flex-wrap justify-center gap-2 lg:justify-start"
                    aria-label="Agent capabilities"
                  >
                    {ctaAgentFeatures.map(({ label, Icon }) => (
                      <li
                        key={label}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_85%,transparent)] px-3 py-2 text-xs font-medium text-secondary sm:text-[13px]"
                      >
                        <Icon className="size-3.5 shrink-0 text-[var(--primary)]" strokeWidth={2.25} aria-hidden />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo(user ? "/chat" : "/login")}
                  className="landing-cta-primary mx-auto w-fit shrink-0 rounded-xl px-7 py-3 text-sm font-semibold lg:mx-0"
                >
                  {user ? "Open chat" : "Get started"}
                </button>
              </div>
            </div>
        </section>

        <section id="landing-features" className={`${landingScreen} flex flex-col justify-center`}>
            <div className="landing-section-surface flex w-full flex-col p-8 sm:p-10 lg:p-12">
              <div className="mb-8 max-w-3xl sm:mb-10 lg:mb-12">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2rem]">Built for real work</h2>
                <p className="text-secondary mt-3 max-w-2xl text-base leading-relaxed sm:text-lg">
                  Everything you need to deploy a reliable, document-grounded AI assistant — in a single platform.
                </p>
              </div>
              <ul className="grid flex-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-7">
                {pillars.map((f) => (
                  <li
                    key={f.title}
                    className="landing-pillar-card group flex min-h-[220px] flex-col p-6 sm:min-h-[240px] sm:p-7"
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--primary)_16%,var(--surface))] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
                      <span className="[&>svg]:size-6">{f.icon}</span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="text-secondary mt-3 flex-1 text-[15px] leading-relaxed sm:text-base">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
        </section>

        <section id="landing-flow" className={`${landingScreen} flex flex-col justify-center`}>
            <div className="landing-section-surface w-full overflow-hidden p-8 sm:p-10 lg:p-12">
              <div className="mb-8 max-w-2xl sm:mb-10">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2rem]">How it works</h2>
                <p className="text-secondary mt-3 text-base leading-relaxed sm:text-lg">
                  From document to answer in four steps.
                </p>
              </div>
              <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {pipeline.map((p, idx) => (
                  <li key={p.step} className="relative">
                    {idx < pipeline.length - 1 ? (
                      <div
                        className="absolute left-[calc(50%+2.25rem)] top-10 hidden h-px w-[calc(100%-1rem)] bg-[color-mix(in_srgb,var(--primary)_28%,var(--border))] lg:block"
                        aria-hidden
                      />
                    ) : null}
                    <div className="landing-stat relative flex min-h-[180px] flex-col justify-center rounded-2xl p-6 sm:min-h-[200px] sm:p-7">
                      <span className="font-mono text-2xl font-bold tabular-nums text-[var(--primary)] sm:text-[1.65rem]">{p.step}</span>
                      <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{p.label}</p>
                      <p className="text-secondary mt-2 text-[15px] leading-snug sm:text-base">{p.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
        </section>

        <footer className="mt-12 border-t border-[var(--border)] pt-8 pb-6 text-center">
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 text-sm font-bold tracking-tight">
            <span className="text-muted font-normal tabular-nums">© 2026</span>
            <span className="inline-flex items-baseline">
              <span className="brand-mark-core">RAG</span>
              <span className="brand-mark-accent">Wise</span>
            </span>
          </p>
        </footer>
      </div>
    </div>
  );
}

function ArtifactBrowserPreview() {
  return (
    <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] shadow-[0_16px_48px_-12px_color-mix(in_srgb,var(--primary)_28%,transparent),0_8px_24px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_56px_-16px_color-mix(in_srgb,var(--primary)_35%,transparent),0_8px_28px_-10px_rgba(0,0,0,0.45)] lg:mx-0 lg:w-full">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_88%,transparent)] px-4 py-3">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-[color-mix(in_srgb,var(--error)_65%,#555)]" />
          <span className="size-3 rounded-full bg-[color-mix(in_srgb,var(--warning)_70%,#555)]" />
          <span className="size-3 rounded-full bg-[color-mix(in_srgb,var(--success)_55%,#555)]" />
        </div>
        <span className="text-muted truncate font-mono text-[11px] tracking-wide">app.example.com / chat</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_75%,transparent)] px-3 py-2.5">
          <p className="text-muted text-[10px] font-semibold uppercase tracking-wider">Sources</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md border border-[color-mix(in_srgb,var(--data)_30%,var(--border))] bg-[color-mix(in_srgb,var(--data)_10%,transparent)] px-2 py-0.5 font-mono text-[10px] text-[var(--data)]">
              policy.pdf · §4.2
            </span>
            <span className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_55%,transparent)] px-2 py-0.5 font-mono text-[10px] text-secondary">
              faq.md
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">
            What are the eligibility rules for the premium tier this quarter?
          </div>
          <div className="rounded-2xl rounded-tr-sm border border-[color-mix(in_srgb,var(--primary)_18%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] px-3.5 py-2.5 text-[13px] leading-relaxed">
            <span className="text-[var(--text-primary)]">
              Based on <span className="font-medium text-[var(--data)]">policy.pdf</span>, premium eligibility requires…
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <div className="text-muted flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-2 font-mono text-[11px]">
            <FiSearch className="size-3.5 shrink-0 opacity-60" strokeWidth={2.25} />
            <span className="truncate">Message…</span>
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_80%,transparent)] text-secondary"
            aria-hidden
          >
            <FiMic className="size-4" strokeWidth={2.25} />
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
            <FiArrowRight className="size-4" strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </div>
  );
}
