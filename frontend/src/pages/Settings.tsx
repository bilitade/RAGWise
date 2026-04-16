import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiBriefcase,
  FiCpu,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiGlobe,
  FiHardDrive,
  FiKey,
  FiLink,
  FiMail,
  FiLayers,
  FiMessageSquare,
  FiSettings,
  FiShield,
  FiTerminal,
  FiUsers,
} from "react-icons/fi";
import { SiHuggingface, SiNvidia, SiOpenai } from "react-icons/si";

import {
  CHAT_PROVIDER_IDS as CHAT_PROVIDERS,
  adminUiChatProvider,
  buildChatModelSettingsPatchBody,
  chatModelSettingsFingerprint,
  type ChatModelAliasRow,
  type ChatProviderId,
  isChatProviderId,
} from "../lib/chatModelSettings";
import type { SettingsTab } from "../types";
import { API_BASE_URL, fetchJson, readSidebarPreference, SETTINGS_SIDEBAR_KEY, writeSidebarPreference } from "../utils";
import { SidebarToggleButton, WorkspaceMainColumn, WorkspaceSidebarRail } from "../components/WorkspaceChrome";

function safeStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function trimInput(value: unknown): string {
  return safeStr(value).trim();
}

type NavGroup = {
  id: string;
  label: string;
  items: {
    id: SettingsTab;
    title: string;
    icon: React.ReactNode;
  }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "platform",
    label: "Configuration",
    items: [
      {
        id: "api",
        title: "Providers",
        icon: <FiLink className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "chat_models",
        title: "Models",
        icon: <FiMessageSquare className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "retrieval",
        title: "Embeddings",
        icon: <FiLayers className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "email",
        title: "Email",
        icon: <FiMail className="size-[1.1rem]" strokeWidth={2.25} />,
      },
    ],
  },
  {
    id: "access",
    label: "Workspace",
    items: [
      {
        id: "users",
        title: "Users",
        icon: <FiUsers className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "agents",
        title: "Agent",
        icon: <FiCpu className="size-[1.1rem]" strokeWidth={2.25} />,
      },
    ],
  },
  {
    id: "ops",
    label: "Monitoring",
    items: [
      {
        id: "jobs",
        title: "Jobs",
        icon: <FiActivity className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "usage",
        title: "Usage",
        icon: <FiBarChart2 className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "logs",
        title: "Logs",
        icon: <FiTerminal className="size-[1.1rem]" strokeWidth={2.25} />,
      },
    ],
  },
];

function flatNavMeta(activeTab: SettingsTab) {
  for (const g of NAV_GROUPS) {
    const item = g.items.find((i) => i.id === activeTab);
    if (item) return { group: g.label, ...item };
  }
  return {
    group: "Admin",
    title: "Settings",
    icon: <FiSettings className="size-[1.1rem]" strokeWidth={2.25} />,
  };
}

export default function SettingsPage({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(() => readSidebarPreference(SETTINGS_SIDEBAR_KEY));

  const meta = useMemo(() => flatNavMeta(activeTab), [activeTab]);

  useEffect(() => {
    writeSidebarPreference(SETTINGS_SIDEBAR_KEY, settingsSidebarOpen);
  }, [settingsSidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSettingsSidebarOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function notify(m: string | null, e: string | null) {
    setMessage(m);
    setError(e);
  }

  return (
    <div className="settings-shell relative flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-x-hidden lg:flex-row lg:items-stretch lg:gap-6 lg:overflow-hidden">
      <WorkspaceSidebarRail
        sidebarId="settings-sidebar"
        open={settingsSidebarOpen}
        onOverlayDismiss={() => setSettingsSidebarOpen(false)}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 min-w-0">
            <div className="flex items-center gap-2.5 text-[var(--data)]">
              <FiSettings className="size-5 shrink-0" strokeWidth={2.25} />
              <span className="text-xs font-semibold uppercase tracking-wide">Admin</span>
            </div>
          </div>

          <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain" aria-label="Settings sections">
            {NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="text-muted mb-2 text-[10px] font-semibold uppercase tracking-wide">{group.label}</p>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.id)}
                          className={`settings-nav-btn group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                            active
                              ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--text-primary)]"
                              : "text-secondary hover:bg-[color-mix(in_srgb,var(--elevated)_75%,transparent)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <span className={`shrink-0 ${active ? "text-[var(--primary)]" : "text-secondary opacity-90"}`}>{item.icon}</span>
                          <span className="min-w-0">{item.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-[var(--border)] pt-3">
            <p className="text-muted truncate font-mono text-[9px]" title={API_BASE_URL}>
              {API_BASE_URL}
            </p>
          </div>
        </div>
      </WorkspaceSidebarRail>

      <WorkspaceMainColumn>
        <header className="mb-3">
          <div className="flex items-center gap-2">
            <SidebarToggleButton
              open={settingsSidebarOpen}
              onToggle={() => setSettingsSidebarOpen((o) => !o)}
              sidebarId="settings-sidebar"
              labelOpen="Hide sidebar (Ctrl+\\)"
              labelClosed="Show sidebar (Ctrl+\\)"
            />
            <div className="min-w-0">
              <nav className="text-secondary text-xs font-medium" aria-label="Location">
                Settings
              </nav>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{meta.title}</h1>
            </div>
          </div>
        </header>

        {(message || error) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                : "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]"
            }`}
            role="status"
          >
            {error ? <span className="status-error">{error}</span> : <span className="status-success">{message}</span>}
          </div>
        )}

        <div className="settings-content space-y-4">
          {activeTab === "api" || activeTab === "chat_models" || activeTab === "retrieval" || activeTab === "email" ? (
            <ConfigPanel section={activeTab} onNotify={notify} />
          ) : null}
          {activeTab === "users" ? <UsersPanel onNotify={notify} /> : null}
          {activeTab === "agents" ? <AgentsPanel onNotify={notify} /> : null}
          {activeTab === "jobs" ? <JobsPanel /> : null}
          {activeTab === "usage" ? <UsagePanel /> : null}
          {activeTab === "logs" ? <LogsPanel /> : null}
        </div>
      </WorkspaceMainColumn>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="brand-card rounded-2xl p-3 sm:p-4">
      <div className="border-b border-[var(--border)] pb-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-secondary mt-1 max-w-2xl text-xs leading-relaxed">{description}</p> : null}
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

/** OpenAI glyph tinted with app primary (matches sidebar active states and buttons). */
function OpenAIBrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] ${className}`}
      aria-hidden
    >
      <SiOpenai className="size-[1.05rem] text-[var(--primary)]" />
    </span>
  );
}

/** Groq mark: lightning (speed / LPU branding). */
function GroqBrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13 1.5 3.5 14.5H11l-1.2 8 10.7-13H12.4L13 1.5z"
      />
    </svg>
  );
}

/** OpenRouter-style mark; simplified node motif. */
function OpenRouterBrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="6" cy="12" r="3.2" fill="currentColor" />
      <circle cx="18" cy="7" r="3.2" fill="currentColor" />
      <circle cx="18" cy="17" r="3.2" fill="currentColor" />
      <path
        d="M9.2 11.2 14.5 8.6M9.2 12.8 14.5 15.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function ProviderBrandMark({ id, className = "size-6" }: { id: ChatProviderId; className?: string }) {
  switch (id) {
    case "openai":
      return <SiOpenai className={`${className} text-[#10A37F]`} aria-hidden />;
    case "groq":
      return <GroqBrandMark className={`${className} text-[#f55036]`} />;
    case "openrouter":
      return <OpenRouterBrandMark className={`${className} text-[#6366f1]`} />;
    case "huggingface":
      return <SiHuggingface className={`${className} text-[#ffd21e]`} aria-hidden />;
    case "nvidia":
      return <SiNvidia className={`${className} text-[#76b900]`} aria-hidden />;
    default:
      return null;
  }
}

type SettingsConfigPayload = {
  model_provider: string;
  default_chat_model: string;
  default_embed_model: string;
  openai_api_key_configured: boolean;
  openai_api_key_last4: string | null;
  groq_api_key_configured: boolean;
  groq_api_key_last4: string | null;
  openrouter_api_key_configured: boolean;
  openrouter_api_key_last4: string | null;
  huggingface_api_key_configured: boolean;
  huggingface_api_key_last4: string | null;
  nvidia_api_key_configured: boolean;
  nvidia_api_key_last4: string | null;
  groq_openai_base_url: string;
  openrouter_openai_base_url: string;
  huggingface_openai_base_url: string;
  nvidia_openai_base_url: string;
  openai_chat_base_url: string;
  qdrant_url: string;
  qdrant_collection: string;
  ingest_chunk_size: number;
  ingest_chunk_overlap: number;
  model_provider_options: string[];
  chat_model_options: string[];
  openai_chat_model_options: string[];
  groq_chat_model_options: string[];
  openrouter_chat_model_options: string[];
  huggingface_chat_model_options: string[];
  nvidia_chat_model_options: string[];
  openai_embed_model_options: string[];
  chat_model_aliases: ChatModelAliasRow[];
  smtp: {
    host: string;
    port: number;
    username: string;
    from_email: string;
    use_tls: boolean;
    password_configured: boolean;
    password_last4: string | null;
  };
};

function providerLabel(p: string): string {
  const x = p.trim().toLowerCase();
  if (x === "openai") return "OpenAI";
  if (x === "groq") return "Groq";
  if (x === "openrouter") return "OpenRouter";
  if (x === "huggingface") return "Hugging Face";
  if (x === "nvidia") return "NVIDIA NIM";
  return p;
}

function catalogArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function chatCatalogForProvider(provider: string, c: SettingsConfigPayload): string[] {
  const p = provider.trim().toLowerCase();
  if (p === "groq") return catalogArray(c.groq_chat_model_options);
  if (p === "openrouter") return catalogArray(c.openrouter_chat_model_options);
  if (p === "huggingface") return catalogArray(c.huggingface_chat_model_options);
  if (p === "nvidia") return catalogArray(c.nvidia_chat_model_options);
  return catalogArray(c.openai_chat_model_options);
}

function mergeOptionList(catalog: string[] | null | undefined, current: string): string[] {
  const base = catalogArray(catalog);
  const t = current.trim();
  if (!t || base.includes(t)) return base;
  return [t, ...base];
}

type ConfigSection = "api" | "chat_models" | "retrieval" | "email";

function ConfigPanel({
  section,
  onNotify,
}: {
  section: ConfigSection;
  onNotify: (m: string | null, e: string | null) => void;
}) {
  const [configReady, setConfigReady] = useState(false);
  const [loadedConfig, setLoadedConfig] = useState<SettingsConfigPayload | null>(null);
  const [modelProvider, setModelProvider] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [modelKeyEditor, setModelKeyEditor] = useState<ChatProviderId | null>(null);
  const [embedModelOptions, setEmbedModelOptions] = useState<string[]>([]);
  const [openaiChatUrl, setOpenaiChatUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [hfKey, setHfKey] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [groqBaseUrl, setGroqBaseUrl] = useState("");
  const [openrouterBaseUrl, setOpenrouterBaseUrl] = useState("");
  const [hfBaseUrl, setHfBaseUrl] = useState("");
  const [nvidiaBaseUrl, setNvidiaBaseUrl] = useState("");
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [openaiLast4, setOpenaiLast4] = useState<string | null>(null);
  const [groqConfigured, setGroqConfigured] = useState(false);
  const [groqLast4, setGroqLast4] = useState<string | null>(null);
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);
  const [openrouterLast4, setOpenrouterLast4] = useState<string | null>(null);
  const [hfConfigured, setHfConfigured] = useState(false);
  const [hfLast4, setHfLast4] = useState<string | null>(null);
  const [nvidiaConfigured, setNvidiaConfigured] = useState(false);
  const [nvidiaLast4, setNvidiaLast4] = useState<string | null>(null);
  const [qdrantUrl, setQdrantUrl] = useState("");
  const [qdrantCollection, setQdrantCollection] = useState("");
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTls, setSmtpTls] = useState(true);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpPwConfigured, setSmtpPwConfigured] = useState(false);
  const [smtpPwLast4, setSmtpPwLast4] = useState<string | null>(null);
  const [aliasesDraft, setAliasesDraft] = useState<ChatModelAliasRow[]>([]);
  const [newAliasName, setNewAliasName] = useState("");
  const [newAliasProvider, setNewAliasProvider] = useState<ChatProviderId>("openai");
  const [newAliasModelId, setNewAliasModelId] = useState("");
  const [chatModelsSavedFingerprint, setChatModelsSavedFingerprint] = useState<string | null>(null);

  const effectiveProviderForChat: ChatProviderId = useMemo(
    () => (isChatProviderId(modelProvider) ? modelProvider : "openai"),
    [modelProvider],
  );

  const chatModelSuggestions = useMemo(() => {
    if (!loadedConfig) return [];
    return mergeOptionList(chatCatalogForProvider(effectiveProviderForChat, loadedConfig), chatModel);
  }, [loadedConfig, effectiveProviderForChat, chatModel]);

  function applyConfigPayload(c: SettingsConfigPayload) {
    setLoadedConfig(c);
    setEmbedModel(safeStr(c.default_embed_model));
    setOpenaiConfigured(c.openai_api_key_configured);
    setOpenaiLast4(c.openai_api_key_last4);
    setGroqConfigured(c.groq_api_key_configured);
    setGroqLast4(c.groq_api_key_last4);
    setOpenrouterConfigured(c.openrouter_api_key_configured);
    setOpenrouterLast4(c.openrouter_api_key_last4);
    setHfConfigured(c.huggingface_api_key_configured);
    setHfLast4(c.huggingface_api_key_last4);
    setNvidiaConfigured(c.nvidia_api_key_configured);
    setNvidiaLast4(c.nvidia_api_key_last4);
    setOpenaiChatUrl(safeStr(c.openai_chat_base_url));
    setGroqBaseUrl(safeStr(c.groq_openai_base_url));
    setOpenrouterBaseUrl(safeStr(c.openrouter_openai_base_url));
    setHfBaseUrl(safeStr(c.huggingface_openai_base_url));
    setNvidiaBaseUrl(safeStr(c.nvidia_openai_base_url));
    setQdrantUrl(safeStr(c.qdrant_url));
    setQdrantCollection(safeStr(c.qdrant_collection));
    setChunkSize(c.ingest_chunk_size);
    setChunkOverlap(c.ingest_chunk_overlap);
    setSmtpHost(safeStr(c.smtp.host));
    setSmtpPort(c.smtp.port);
    setSmtpUser(safeStr(c.smtp.username));
    setSmtpFrom(safeStr(c.smtp.from_email));
    setSmtpTls(c.smtp.use_tls);
    setSmtpPwConfigured(c.smtp.password_configured);
    setSmtpPwLast4(c.smtp.password_last4);
    setAliasesDraft(
      (c.chat_model_aliases ?? []).map((a) => ({
        alias: safeStr(a.alias),
        provider: safeStr(a.provider),
        model_id: safeStr(a.model_id),
      })),
    );
    const normProv = adminUiChatProvider(c);
    setModelProvider(normProv);
    setChatModel(safeStr(c.default_chat_model));
    setEmbedModelOptions(mergeOptionList(c.openai_embed_model_options, safeStr(c.default_embed_model)));
    setChatModelsSavedFingerprint(
      chatModelSettingsFingerprint(
        normProv,
        safeStr(c.default_chat_model),
        (c.chat_model_aliases ?? []).map((a) => ({
          alias: safeStr(a.alias),
          provider: safeStr(a.provider),
          model_id: safeStr(a.model_id),
        })),
      ),
    );
  }

  useEffect(() => {
    void (async () => {
      onNotify(null, null);
      setConfigReady(false);
      try {
        const c = await fetchJson<SettingsConfigPayload>(`${API_BASE_URL}/api/settings/config`);
        applyConfigPayload(c);
        setConfigReady(true);
      } catch (err) {
        onNotify(null, err instanceof Error ? err.message : "Failed to load config");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, []);

  async function reloadConfig() {
    const c = await fetchJson<SettingsConfigPayload>(`${API_BASE_URL}/api/settings/config`);
    applyConfigPayload(c);
  }

  async function saveApiSettings() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openai_api_key: trimInput(openaiKey) || undefined,
          groq_api_key: trimInput(groqKey) || undefined,
          openrouter_api_key: trimInput(openrouterKey) || undefined,
          huggingface_api_key: trimInput(hfKey) || undefined,
          nvidia_api_key: trimInput(nvidiaKey) || undefined,
          openai_chat_base_url: trimInput(openaiChatUrl),
          groq_openai_base_url: trimInput(groqBaseUrl),
          openrouter_openai_base_url: trimInput(openrouterBaseUrl),
          huggingface_openai_base_url: trimInput(hfBaseUrl),
          nvidia_openai_base_url: trimInput(nvidiaBaseUrl),
        }),
      });
      setOpenaiKey("");
      setGroqKey("");
      setOpenrouterKey("");
      setHfKey("");
      setNvidiaKey("");
      setModelKeyEditor(null);
      onNotify("API & endpoints saved.", null);
      await reloadConfig();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  const chatModelsFingerprintCurrent = useMemo(
    () => chatModelSettingsFingerprint(effectiveProviderForChat, chatModel, aliasesDraft),
    [effectiveProviderForChat, chatModel, aliasesDraft],
  );

  const isChatModelsDirty =
    section === "chat_models" &&
    configReady &&
    chatModelsSavedFingerprint !== null &&
    chatModelsFingerprintCurrent !== chatModelsSavedFingerprint;

  function discardChatModelDraft() {
    if (!loadedConfig) return;
    const c = loadedConfig;
    setAliasesDraft(
      (c.chat_model_aliases ?? []).map((a) => ({
        alias: safeStr(a.alias),
        provider: safeStr(a.provider),
        model_id: safeStr(a.model_id),
      })),
    );
    setModelProvider(adminUiChatProvider(c));
    setChatModel(safeStr(c.default_chat_model));
    setChatModelsSavedFingerprint(
      chatModelSettingsFingerprint(
        adminUiChatProvider(c),
        safeStr(c.default_chat_model),
        (c.chat_model_aliases ?? []).map((a) => ({
          alias: safeStr(a.alias),
          provider: safeStr(a.provider),
          model_id: safeStr(a.model_id),
        })),
      ),
    );
  }

  async function saveChatSettings() {
    onNotify(null, null);
    try {
      const dm = trimInput(chatModel);
      if (!dm) {
        onNotify(null, "Choose a default chat model or enter a custom id.");
        return;
      }
      const updated = await fetchJson<SettingsConfigPayload>(`${API_BASE_URL}/api/settings/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildChatModelSettingsPatchBody({
            provider: effectiveProviderForChat,
            defaultModelId: dm,
            aliases: aliasesDraft,
          }),
        ),
      });
      applyConfigPayload(updated);
      onNotify("Chat models saved.", null);
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  async function saveRetrievalTab() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_embed_model: trimInput(embedModel) || undefined,
          qdrant_url: trimInput(qdrantUrl) || undefined,
          qdrant_collection: trimInput(qdrantCollection) || undefined,
          ingest_chunk_size: chunkSize,
          ingest_chunk_overlap: chunkOverlap,
        }),
      });
      onNotify("Embeddings & Qdrant saved.", null);
      await reloadConfig();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  async function saveSmtp() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: {
            host: trimInput(smtpHost) || undefined,
            port: smtpPort,
            username: trimInput(smtpUser) || undefined,
            from_email: trimInput(smtpFrom) || undefined,
            use_tls: smtpTls,
            password: trimInput(smtpPassword) || undefined,
          },
        }),
      });
      setSmtpPassword("");
      onNotify("SMTP settings saved.", null);
      await reloadConfig();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!configReady || !loadedConfig) {
    const loadingTitle =
      section === "api"
        ? "API & Endpoints"
        : section === "chat_models"
          ? "Chat models"
          : section === "retrieval"
            ? "Embeddings & Qdrant"
            : "Email (SMTP)";
    return (
      <SectionCard title={loadingTitle}>
        <p className="text-secondary text-sm">Loading…</p>
      </SectionCard>
    );
  }

  function clearDraftForProvider(pid: ChatProviderId) {
    const cfg = loadedConfig;
    switch (pid) {
      case "openai":
        setOpenaiKey("");
        if (cfg) setOpenaiChatUrl(safeStr(cfg.openai_chat_base_url));
        return;
      case "groq":
        setGroqKey("");
        if (cfg) setGroqBaseUrl(cfg.groq_openai_base_url);
        return;
      case "openrouter":
        setOpenrouterKey("");
        if (cfg) setOpenrouterBaseUrl(cfg.openrouter_openai_base_url);
        return;
      case "huggingface":
        setHfKey("");
        if (cfg) setHfBaseUrl(cfg.huggingface_openai_base_url);
        return;
      case "nvidia":
        setNvidiaKey("");
        if (cfg) setNvidiaBaseUrl(cfg.nvidia_openai_base_url);
        return;
    }
  }

  function providerKeyRow(pid: ChatProviderId): { configured: boolean; last4: string | null } {
    switch (pid) {
      case "openai":
        return { configured: openaiConfigured, last4: openaiLast4 };
      case "groq":
        return { configured: groqConfigured, last4: groqLast4 };
      case "openrouter":
        return { configured: openrouterConfigured, last4: openrouterLast4 };
      case "huggingface":
        return { configured: hfConfigured, last4: hfLast4 };
      case "nvidia":
        return { configured: nvidiaConfigured, last4: nvidiaLast4 };
    }
  }

    if (section === "api") {
    return (
      <SectionCard title="Providers">
        <div className="space-y-3">
          {CHAT_PROVIDERS.map((pid) => {
            const { configured, last4 } = providerKeyRow(pid);
            const editing = modelKeyEditor === pid;
            return (
              <div key={pid} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_55%,transparent)]">
                      <ProviderBrandMark id={pid} className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{providerLabel(pid)}</p>
                      <p className="text-secondary mt-1 text-sm">
                        API key:{" "}
                        {configured ? (
                          <>
                            <span className="status-success font-medium">Set</span>
                            {last4 ? (
                              <>
                                {" "}
                                · last 4: <span className="font-mono text-[var(--text-primary)]">{last4}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <span className="status-warning font-medium">Not set</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (editing) {
                          setModelKeyEditor(null);
                          clearDraftForProvider(pid);
                        } else {
                          setModelKeyEditor(pid);
                        }
                      }}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
                    >
                      {editing ? "Cancel" : "Update API key"}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearDraftForProvider(pid)}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] hover:text-[var(--text-primary)]"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {editing ? (
                  <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                    <label className="flex min-w-0 flex-col gap-1 text-sm">
                      <span className="text-secondary font-medium">New API key</span>
                      {pid === "openai" ? (
                        <input
                          type="password"
                          className="brand-input rounded-xl px-3 py-2"
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          autoComplete="new-password"
                        />
                      ) : null}
                      {pid === "openai" ? (
                        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                          <span className="text-secondary font-medium">API base URL (optional)</span>
                          <input
                            className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                            value={openaiChatUrl}
                            onChange={(e) => setOpenaiChatUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1"
                            spellCheck={false}
                          />
                          <span className="text-muted text-xs leading-snug">
                            Leave blank for the default endpoint. Set for Azure OpenAI or compatible gateways.
                          </span>
                        </label>
                      ) : null}
                      {pid === "groq" ? (
                        <input
                          type="password"
                          className="brand-input rounded-xl px-3 py-2"
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value)}
                          autoComplete="new-password"
                        />
                      ) : null}
                      {pid === "groq" ? (
                        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                          <span className="text-secondary font-medium">OpenAI-compatible API base URL</span>
                          <input
                            className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                            value={groqBaseUrl}
                            onChange={(e) => setGroqBaseUrl(e.target.value)}
                            spellCheck={false}
                          />
                        </label>
                      ) : null}
                      {pid === "openrouter" ? (
                        <input
                          type="password"
                          className="brand-input rounded-xl px-3 py-2"
                          value={openrouterKey}
                          onChange={(e) => setOpenrouterKey(e.target.value)}
                          autoComplete="new-password"
                        />
                      ) : null}
                      {pid === "openrouter" ? (
                        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                          <span className="text-secondary font-medium">OpenAI-compatible API base URL</span>
                          <input
                            className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                            value={openrouterBaseUrl}
                            onChange={(e) => setOpenrouterBaseUrl(e.target.value)}
                            spellCheck={false}
                          />
                        </label>
                      ) : null}
                      {pid === "huggingface" ? (
                        <input
                          type="password"
                          className="brand-input rounded-xl px-3 py-2"
                          value={hfKey}
                          onChange={(e) => setHfKey(e.target.value)}
                          autoComplete="new-password"
                        />
                      ) : null}
                      {pid === "nvidia" ? (
                        <input
                          type="password"
                          className="brand-input rounded-xl px-3 py-2"
                          value={nvidiaKey}
                          onChange={(e) => setNvidiaKey(e.target.value)}
                          autoComplete="new-password"
                        />
                      ) : null}
                    </label>
                    {pid === "huggingface" ? (
                      <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                        <span className="text-secondary font-medium">OpenAI-compatible base URL</span>
                        <input
                          className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                          value={hfBaseUrl}
                          onChange={(e) => setHfBaseUrl(e.target.value)}
                          spellCheck={false}
                        />
                      </label>
                    ) : null}
                    {pid === "nvidia" ? (
                      <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                        <span className="text-secondary font-medium">OpenAI-compatible base URL</span>
                        <input
                          className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                          value={nvidiaBaseUrl}
                          onChange={(e) => setNvidiaBaseUrl(e.target.value)}
                          spellCheck={false}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <button type="button" onClick={() => void saveApiSettings()} className="brand-pill-active rounded-xl px-5 py-2 text-sm font-medium">
            Save
          </button>
        </div>
      </SectionCard>
    );
  }

  if (section === "chat_models") {
    const selectProviderValue: ChatProviderId = effectiveProviderForChat;
    const catalogIds = chatModelSuggestions;
    const aliasSlugSet = new Set(aliasesDraft.map((a) => trimInput(a.alias)).filter(Boolean));
    const cmTrim = trimInput(chatModel);
    const inCatalog = catalogIds.includes(cmTrim);
    const isAliasDefault = aliasSlugSet.has(cmTrim);
    const selectModelValue = inCatalog || isAliasDefault ? chatModel : "__custom__";
    const aliasRowForDefault = isAliasDefault ? aliasesDraft.find((a) => a.alias === cmTrim) : undefined;
    const catalogOptgroupLabel = `Suggested models (${providerLabel(selectProviderValue)})`;
    const defaultChatSummary = aliasRowForDefault
      ? `After save: default is alias “${aliasRowForDefault.alias}” → ${providerLabel(aliasRowForDefault.provider)} · ${aliasRowForDefault.model_id}.`
      : cmTrim
        ? `After save: default is ${providerLabel(selectProviderValue)} with model id ${cmTrim}.`
        : "Choose a suggested model, an alias, or enter a custom model id, then save.";

    return (
      <div className="space-y-4">
        {isChatModelsDirty ? (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">You have unsaved chat model changes.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveChatSettings()}
                className="brand-pill-active rounded-xl px-5 py-2 text-sm font-medium"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={discardChatModelDraft}
                className="rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-medium hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
        <SectionCard title="Default model">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-secondary font-medium">Chat provider</span>
              <select
                className="brand-input rounded-xl px-3 py-2"
                value={selectProviderValue}
                onChange={(e) => {
                  const next = e.target.value as ChatProviderId;
                  setModelProvider(next);
                  const cat = chatCatalogForProvider(next, loadedConfig);
                  const cur = trimInput(chatModel);
                  if (!cur || !cat.includes(cur)) {
                    setChatModel(cat[0] ?? "");
                  }
                }}
                aria-label="Chat provider"
              >
                {CHAT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {providerLabel(p)}
                  </option>
                ))}
              </select>
              <span className="text-muted text-xs leading-snug">Configure API keys under Providers.</span>
            </label>
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-secondary font-medium">Default (saved model id)</span>
              <select
                className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
                value={selectModelValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    setChatModel("");
                    return;
                  }
                  const hit = aliasesDraft.find((a) => a.alias === v);
                  if (hit && isChatProviderId(hit.provider.trim().toLowerCase())) {
                    setModelProvider(hit.provider.trim().toLowerCase() as ChatProviderId);
                    setChatModel(hit.alias);
                    return;
                  }
                  setChatModel(v);
                }}
                aria-label="Default chat model id"
              >
                <optgroup label={catalogOptgroupLabel}>
                  {catalogIds.length > 0 ? (
                    catalogIds.map((m, i) => (
                      <option key={`cat-${selectProviderValue}-${i}-${m}`} value={m}>
                        {m}
                      </option>
                    ))
                  ) : (
                    <option value="__catalog_empty__" disabled>
                      No curated list — use “Other” or an alias below
                    </option>
                  )}
                </optgroup>
                {aliasesDraft.length > 0 ? (
                  <optgroup label="Your aliases (short names → real model id)">
                    {aliasesDraft.map((a, i) => (
                      <option key={`alias-${i}-${a.alias}`} value={a.alias}>
                        {a.alias} → {a.model_id}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <option value="__custom__">Other — type any model id</option>
              </select>
              {selectModelValue === "__custom__" ? (
                <input
                  className="brand-input mt-2 rounded-xl px-4 py-2.5 font-mono text-xs"
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  spellCheck={false}
                  placeholder="e.g. gpt-4.1 or a provider-specific id"
                  aria-label="Custom chat model id"
                />
              ) : null}
            </div>
          </div>
          <p className="text-secondary mt-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_40%,transparent)] px-3 py-2.5 text-xs leading-relaxed">
            {defaultChatSummary}
          </p>
        </SectionCard>

        <SectionCard title="Model aliases">
          <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] text-secondary text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">Alias</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Model id</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aliasesDraft.map((row, idx) => (
                  <tr key={`alias-row-${idx}-${row.alias}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{row.alias}</td>
                    <td className="px-3 py-2">{providerLabel(row.provider)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.model_id}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                        onClick={() => {
                          if (isChatProviderId(row.provider.trim().toLowerCase())) {
                            setModelProvider(row.provider.trim().toLowerCase() as ChatProviderId);
                          }
                          setChatModel(row.alias);
                        }}
                      >
                        Use as default
                      </button>
                      <span className="text-muted mx-2">·</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-secondary hover:text-[var(--error)]"
                        onClick={() => setAliasesDraft((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_35%,transparent)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-secondary">
              Alias
              <input
                className="brand-input rounded-lg px-3 py-2 font-mono text-sm"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                placeholder="e.g. team-fast"
              />
            </label>
            <label className="flex min-w-[8rem] flex-col gap-1 text-xs font-medium text-secondary">
              Provider
              <select
                className="brand-input rounded-lg px-3 py-2 text-sm"
                value={newAliasProvider}
                onChange={(e) => setNewAliasProvider(e.target.value as ChatProviderId)}
              >
                {CHAT_PROVIDERS.map((p) => (
                  <option key={`new-alias-prov-${p}`} value={p}>
                    {providerLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-[2] flex-col gap-1 text-xs font-medium text-secondary sm:flex-[2]">
              Model id
              <input
                className="brand-input rounded-lg px-3 py-2 font-mono text-sm"
                value={newAliasModelId}
                onChange={(e) => setNewAliasModelId(e.target.value)}
                placeholder="Provider-specific model id"
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
              onClick={() => {
                const al = newAliasName.trim();
                const mid = newAliasModelId.trim();
                if (!al || !mid) return;
                if (aliasesDraft.some((x) => x.alias.toLowerCase() === al.toLowerCase())) return;
                setAliasesDraft((prev) => [...prev, { alias: al, provider: newAliasProvider, model_id: mid }]);
                setNewAliasName("");
                setNewAliasModelId("");
              }}
            >
              Add alias
            </button>
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            disabled={!isChatModelsDirty}
            onClick={() => void saveChatSettings()}
            className="brand-pill-active rounded-xl px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (section === "retrieval") {
    return (
      <SectionCard title="Embeddings">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex gap-3 sm:items-start lg:col-span-2">
            <OpenAIBrandMark className="mt-0.5" />
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              <span className="text-secondary font-medium">Embedding model</span>
              <select
                className="brand-input rounded-xl px-3 py-2"
                value={embedModel}
                onChange={(e) => setEmbedModel(e.target.value)}
                aria-label="Default embedding model"
              >
                {embedModelOptions.map((m, i) => (
                  <option key={`embed-opt-${i}-${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">Chunk size</span>
            <input
              type="number"
              className="brand-input rounded-xl px-3 py-2"
              value={chunkSize}
              min={128}
              max={4096}
              onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">Chunk overlap</span>
            <input
              type="number"
              className="brand-input rounded-xl px-3 py-2"
              value={chunkOverlap}
              min={0}
              max={4096}
              onChange={(e) => setChunkOverlap(parseInt(e.target.value, 10) || 0)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
            <span className="text-secondary font-medium">Qdrant URL</span>
            <input
              className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
              value={qdrantUrl}
              onChange={(e) => setQdrantUrl(e.target.value)}
              placeholder="https://qdrant.example.com:6333"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
            <span className="text-secondary font-medium">Collection name</span>
            <input
              className="brand-input rounded-xl px-3 py-2 font-mono text-xs"
              value={qdrantCollection}
              onChange={(e) => setQdrantCollection(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <button type="button" onClick={() => void saveRetrievalTab()} className="brand-pill-active rounded-xl px-5 py-2 text-sm font-medium">
            Save
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
      <SectionCard title="Email">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs">
          <FiMail className="size-3.5 text-[var(--primary)]" aria-hidden />
          <span className="text-secondary">SMTP password</span>
          <span className={smtpPwConfigured ? "status-success font-medium" : "status-warning font-medium"}>
            {smtpPwConfigured ? `set (${smtpPwLast4 ?? "••••"})` : "not set"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-secondary font-medium">SMTP host</span>
            <input className="brand-input rounded-xl px-3 py-2" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">Port</span>
            <input
              type="number"
              className="brand-input rounded-xl px-3 py-2"
              value={smtpPort}
              min={1}
              max={65535}
              onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary font-medium">TLS (STARTTLS)</span>
            <select className="brand-input rounded-xl px-3 py-2" value={smtpTls ? "yes" : "no"} onChange={(e) => setSmtpTls(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-secondary font-medium">Username</span>
            <input className="brand-input rounded-xl px-3 py-2" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-secondary font-medium">From address</span>
            <input className="brand-input rounded-xl px-3 py-2" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} type="email" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-secondary font-medium">Password</span>
            <input
              type="password"
              className="brand-input rounded-xl px-3 py-2"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <button type="button" onClick={() => void saveSmtp()} className="brand-pill-active rounded-xl px-5 py-2 text-sm font-medium">
            Save
          </button>
        </div>
      </SectionCard>
  );
}

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  monthly_request_limit: number | null;
  requests_this_period: number;
};

function UsersPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("normal");
  const [newUserLimit, setNewUserLimit] = useState("");

  async function load() {
    try {
      const list = await fetchJson<UserRow[]>(`${API_BASE_URL}/api/settings/users`);
      setUsers(list);
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Failed to load users");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          role,
          monthly_request_limit: newUserLimit.trim() === "" ? null : parseInt(newUserLimit, 10),
        }),
      });
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setNewUserLimit("");
      onNotify("User created.", null);
      await load();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Create failed");
    }
  }

  async function patchUser(id: string, patch: Record<string, unknown>) {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onNotify("User updated.", null);
      await load();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-8">
      <SectionCard title="Invite or provision a user">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-secondary">Work email</span>
            <input
              className="brand-input rounded-2xl px-4 py-2.5"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">First name</span>
            <input
              className="brand-input rounded-2xl px-4 py-2.5"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">Last name</span>
            <input
              className="brand-input rounded-2xl px-4 py-2.5"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">Temporary password</span>
            <input
              type="password"
              className="brand-input rounded-2xl px-4 py-2.5"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">Role</span>
            <select className="brand-input rounded-2xl px-4 py-2.5" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="pro">Pro</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-secondary">Monthly request cap</span>
            <input
              className="brand-input rounded-xl px-3 py-2"
              placeholder="e.g. 500"
              value={newUserLimit}
              onChange={(e) => setNewUserLimit(e.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => void createUser()}
            className="brand-pill-active rounded-2xl px-6 py-2.5 text-sm font-medium"
          >
            Create user
          </button>
        </div>
      </SectionCard>

      <SectionCard title="All users">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="text-secondary border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <th className="pb-3 pr-4 font-semibold">User</th>
                <th className="pb-3 pr-4 font-semibold">Name</th>
                <th className="pb-3 pr-4 font-semibold">Role</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 pr-4 font-semibold">Quota</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <span className="font-medium">{u.email}</span>
                    <div className="text-muted font-mono mt-1 text-[11px]">{u.id.slice(0, 8)}…</div>
                  </td>
                  <td className="py-3 pr-4 align-top text-sm">
                    <div className="text-secondary">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <select
                      className="brand-input max-w-[140px] rounded-xl px-2 py-1.5 text-xs"
                      value={u.role}
                      onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                    >
                      <option value="normal">Normal</option>
                      <option value="pro">Pro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.is_active ? "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]" : "bg-[color-mix(in_srgb,var(--error)_15%,transparent)] text-[var(--error)]"
                      }`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="text-secondary py-3 pr-4 align-top text-xs">
                    <div>
                      Used: <span className="text-[var(--text-primary)] font-medium">{u.requests_this_period}</span>
                    </div>
                    <div className="mt-1">
                      Cap:{" "}
                      <span className="text-[var(--text-primary)] font-medium">{u.monthly_request_limit ?? "∞"}</span>
                    </div>
                  </td>
                  <td className="py-3 align-top">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        className="brand-secondary rounded-xl px-3 py-1.5 text-xs"
                        onClick={() => void patchUser(u.id, { is_active: !u.is_active })}
                      >
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted text-[10px] uppercase tracking-wide">New password</span>
                        <div className="flex flex-wrap items-center gap-1">
                          <input
                            type="password"
                            className="brand-input max-w-[140px] rounded-lg px-2 py-1 text-xs"
                            placeholder="Min. 8"
                            id={`pwd-${u.id}`}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="brand-pill rounded-lg px-2 py-1 text-xs"
                            onClick={() => {
                              const el = document.getElementById(`pwd-${u.id}`) as HTMLInputElement | null;
                              const p = el?.value?.trim() ?? "";
                              if (p.length < 8) {
                                onNotify(null, "Password must be at least 8 characters.");
                                return;
                              }
                              void patchUser(u.id, { password: p }).finally(() => {
                                if (el) el.value = "";
                              });
                            }}
                          >
                            Set
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          key={`${u.id}-${String(u.monthly_request_limit)}`}
                          type="number"
                          min={0}
                          className="brand-input w-20 rounded-lg px-2 py-1 text-xs"
                          placeholder="Cap"
                          defaultValue={u.monthly_request_limit ?? ""}
                          id={`monthly-limit-${u.id}`}
                        />
                        <button
                          type="button"
                          className="brand-pill rounded-lg px-2 py-1 text-xs"
                          onClick={() => {
                            const el = document.getElementById(`monthly-limit-${u.id}`) as HTMLInputElement | null;
                            const raw = el?.value?.trim() ?? "";
                            const parsed = raw === "" ? null : parseInt(raw, 10);
                            const limit = parsed !== null && Number.isNaN(parsed) ? null : parsed;
                            void patchUser(u.id, { monthly_request_limit: limit });
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

type AgentConfig = {
  version: number;
  company_display_name: string;
  guardrails_text: string;
  guidelines_text: string;
  base_system_prompt: string;
  tool_knowledge_base: boolean;
  tool_internet: boolean;
};

type AgentBehaviorPayload = {
  agent_config: AgentConfig;
  base_system_prompt_effective_preview: string;
};

function AgentsPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [behaviorReady, setBehaviorReady] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [effectivePreview, setEffectivePreview] = useState("");

  async function loadBehavior() {
    try {
      const b = await fetchJson<AgentBehaviorPayload>(`${API_BASE_URL}/api/settings/agent-behavior`);
      setAgentConfig(b.agent_config);
      setEffectivePreview(b.base_system_prompt_effective_preview);
      setBehaviorReady(true);
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Failed to load agent settings");
    }
  }

  useEffect(() => {
    void loadBehavior();
  }, []);

  async function saveBehavior() {
    if (!agentConfig) return;
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/agent-behavior`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_config: agentConfig }),
      });
      onNotify("Saved.", null);
      await loadBehavior();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  const c = agentConfig;

  return (
    <SectionCard title="Agent">
      {!behaviorReady || !c ? (
        <p className="text-secondary text-sm">Loading…</p>
      ) : (
        <div className="max-w-2xl divide-y divide-[var(--border)]">
          <div className="flex gap-3 pb-3">
            <FiBriefcase className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Identity</h3>
                <p className="text-muted text-[12px] leading-snug">Displayed in responses and documents.</p>
              </div>
              <input
                className="brand-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Your company name"
                value={c.company_display_name}
                onChange={(e) => setAgentConfig({ ...c, company_display_name: e.target.value })}
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="flex gap-3 py-3">
            <FiLayers className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Capabilities</h3>
                <p className="text-muted text-[12px] leading-snug">Tools available during a chat session.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer gap-2.5 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_45%,transparent)] px-3 py-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] has-[:checked]:border-[color-mix(in_srgb,var(--primary)_38%,var(--border))] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-[var(--border)]"
                    checked={c.tool_knowledge_base}
                    onChange={(e) => setAgentConfig({ ...c, tool_knowledge_base: e.target.checked })}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                      <FiHardDrive className="size-3.5 shrink-0 opacity-80" aria-hidden />
                      Internal docs
                    </span>
                    <span className="text-muted mt-0.5 block text-[11px] leading-snug">Knowledge base search</span>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-2.5 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_45%,transparent)] px-3 py-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] has-[:checked]:border-[color-mix(in_srgb,var(--primary)_38%,var(--border))] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-[var(--border)]"
                    checked={c.tool_internet}
                    onChange={(e) => setAgentConfig({ ...c, tool_internet: e.target.checked })}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                      <FiGlobe className="size-3.5 shrink-0 opacity-80" aria-hidden />
                      Web
                    </span>
                    <span className="text-muted mt-0.5 block text-[11px] leading-snug">Public sources when relevant</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 py-3">
            <FiShield className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Guardrails</h3>
                <p className="text-muted text-[12px] leading-snug">Must-refuse rules, compliance, and safety limits.</p>
              </div>
              <textarea
                className="brand-input min-h-[72px] w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Optional — defaults apply if empty"
                value={c.guardrails_text}
                onChange={(e) => setAgentConfig({ ...c, guardrails_text: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 py-3">
            <FiBookOpen className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Guidelines</h3>
                <p className="text-muted text-[12px] leading-snug">Tone, citations, and day-to-day expectations.</p>
              </div>
              <textarea
                className="brand-input min-h-[72px] w-full rounded-lg px-3 py-2 text-sm"
                placeholder="Optional — defaults apply if empty"
                value={c.guidelines_text}
                onChange={(e) => setAgentConfig({ ...c, guidelines_text: e.target.value })}
              />
            </div>
          </div>

          <details className="group py-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FiEdit3 className="size-4 shrink-0 text-[var(--primary)]" aria-hidden />
              <span>
                Custom instructions <span className="text-muted font-normal">(optional)</span>
              </span>
            </summary>
            <p className="text-muted mt-2 pl-6 text-[12px] leading-snug">
              Replaces the built-in role prompt. Leave blank to use the default.
            </p>
            <textarea
              className="brand-input mt-3 min-h-[100px] w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Leave blank to use default instructions"
              value={c.base_system_prompt}
              onChange={(e) => setAgentConfig({ ...c, base_system_prompt: e.target.value })}
            />
            <details className="mt-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_35%,transparent)] px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-secondary">Effective prompt preview</summary>
              <pre className="text-muted mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_50%,transparent)] p-2 font-mono text-[10px] leading-relaxed">
                {effectivePreview}
              </pre>
            </details>
          </details>

          <div className="flex items-center gap-3 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={() => void saveBehavior()}
              className="brand-pill-active w-fit rounded-lg px-5 py-2 text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

type JobRow = {
  id: string;
  celery_task_id: string;
  job_type: string;
  celery_status: string | null;
  created_at: string;
};

function JobsPanel() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchJson<JobRow[]>(`${API_BASE_URL}/api/settings/jobs?limit=100`);
        setJobs(list);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  if (err) {
    return (
      <SectionCard title="Could not load jobs">
        <p className="status-error text-sm">{err}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Background Jobs">
      {jobs.length === 0 ? (
        <p className="text-secondary text-sm">No jobs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-secondary border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Task ID</th>
                <th className="pb-3 font-semibold">Worker state</th>
                <th className="pb-3 font-semibold">Queued</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 font-medium capitalize">{j.job_type}</td>
                  <td className="py-3 font-mono text-xs">{j.celery_task_id}</td>
                  <td className="py-3">{j.celery_status ?? "—"}</td>
                  <td className="text-secondary py-3 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function UsagePanel() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchJson<{ langsmith: Record<string, unknown> }>(`${API_BASE_URL}/api/settings/usage/summary`);
        setData(res as unknown as Record<string, unknown>);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  if (err) {
    return (
      <SectionCard title="Usage unavailable">
        <p className="status-error text-sm">{err}</p>
      </SectionCard>
    );
  }
  if (!data) {
    return (
      <div className="text-secondary flex items-center gap-2 text-sm">
        <FiLayers className="animate-pulse" />
        Loading usage…
      </div>
    );
  }

  const langsmith = data.langsmith as {
    tracing_enabled?: boolean;
    project?: string;
    api_key_configured?: boolean;
    endpoint?: string;
    dashboard_url?: string;
    workspace_id?: string | null;
    metrics?: {
      ok: boolean;
      error?: string;
      fetched_at?: string;
      project_name?: string;
      run_count?: number | null;
      total_cost_usd?: number | null;
      prompt_cost_usd?: number | null;
      completion_cost_usd?: number | null;
      total_tokens?: number | null;
      prompt_tokens?: number | null;
      completion_tokens?: number | null;
    };
  };

  const tracingOn = Boolean(langsmith.tracing_enabled);
  const keyOk = Boolean(langsmith.api_key_configured);
  const dashboardUrl = typeof langsmith.dashboard_url === "string" ? langsmith.dashboard_url : "https://smith.langchain.com";
  const metrics = langsmith.metrics;
  const fmtUsd = (n: number | null | undefined) =>
    n == null || Number.isNaN(n) ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const fmtInt = (n: number | null | undefined) => (n == null ? "—" : String(n));

  return (
    <SectionCard title="Usage">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            tracingOn
              ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]"
              : "text-muted bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
          }`}
        >
          Tracing {tracingOn ? "on" : "off"}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            keyOk
              ? "bg-[color-mix(in_srgb,var(--data)_12%,transparent)] text-[var(--data)]"
              : "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]"
          }`}
        >
          API key {keyOk ? "set" : "missing"}
        </span>
        {metrics?.ok && (metrics.project_name ?? langsmith.project) ? (
          <span className="text-muted font-mono text-xs">{metrics.project_name ?? String(langsmith.project)}</span>
        ) : null}
        <span className="text-muted ml-auto text-xs">Last 7 days</span>
      </div>

      {metrics?.ok ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="brand-elevated rounded-xl p-3">
            <div className="text-muted text-[11px] uppercase tracking-wide">Est. cost</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">${fmtUsd(metrics.total_cost_usd ?? undefined)}</div>
          </div>
          <div className="brand-elevated rounded-xl p-3">
            <div className="text-muted text-[11px] uppercase tracking-wide">Runs</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{fmtInt(metrics.run_count ?? undefined)}</div>
          </div>
          <div className="brand-elevated rounded-xl p-3">
            <div className="text-muted text-[11px] uppercase tracking-wide">Tokens</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{fmtInt(metrics.total_tokens ?? undefined)}</div>
          </div>
          <div className="brand-elevated rounded-xl p-3">
            <div className="text-muted text-[11px] uppercase tracking-wide">Prompt / Completion</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">
              ${fmtUsd(metrics.prompt_cost_usd ?? undefined)}{" "}
              <span className="text-muted font-normal">/</span>{" "}
              ${fmtUsd(metrics.completion_cost_usd ?? undefined)}
            </div>
          </div>
        </div>
      ) : metrics && !metrics.ok ? (
        <p className="status-error text-sm">{metrics.error ?? "Could not load metrics."}</p>
      ) : (
        <p className="text-secondary text-sm">No metrics available.</p>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-[var(--border)] pt-3">
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className="brand-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          Open LangSmith
          <FiExternalLink className="size-3.5" strokeWidth={2.25} />
        </a>
      </div>
    </SectionCard>
  );
}

function LogsPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [path, setPath] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchJson<{ path: string; lines: string[] }>(`${API_BASE_URL}/api/settings/logs?lines=300`);
        setPath(res.path);
        setLines(res.lines);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  if (err) {
    return (
      <SectionCard title="Logs unavailable">
        <p className="status-error text-sm">{err}</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Log tail">
      <p className="text-muted mb-4 font-mono text-xs break-all">{path}</p>
      <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_65%,transparent)] p-4">
        <pre className="text-muted max-h-[min(60vh,520px)] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
          {lines.length ? lines.join("\n") : "— No lines returned (file empty or missing)."}
        </pre>
      </div>
    </SectionCard>
  );
}
