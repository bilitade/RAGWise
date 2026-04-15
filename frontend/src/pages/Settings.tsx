import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiCpu,
  FiExternalLink,
  FiFileText,
  FiKey,
  FiLayers,
  FiSettings,
  FiTerminal,
  FiUsers,
} from "react-icons/fi";

import type { SettingsTab } from "../types";
import {
  API_BASE_URL,
  fetchJson,
  readSidebarPreference,
  SETTINGS_SIDEBAR_KEY,
  writeSidebarPreference,
} from "../utils";
import { SidebarToggleButton, WorkspaceMainColumn, WorkspaceSidebarRail } from "../components/WorkspaceChrome";

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
    label: "Platform",
    items: [
      {
        id: "config",
        title: "Models & API",
        icon: <FiKey className="size-[1.1rem]" strokeWidth={2.25} />,
      },
    ],
  },
  {
    id: "access",
    label: "People & AI",
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
    label: "Operations",
    items: [
      {
        id: "jobs",
        title: "Jobs & queue",
        icon: <FiActivity className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "usage",
        title: "Usage & cost",
        icon: <FiBarChart2 className="size-[1.1rem]" strokeWidth={2.25} />,
      },
      {
        id: "logs",
        title: "System logs",
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
        <header className="mb-5">
          <div className="flex items-start gap-2">
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
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{meta.title}</h1>
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

        <div className="settings-content space-y-8">
          {activeTab === "config" ? <ConfigPanel onNotify={notify} /> : null}
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
    <section className="brand-card rounded-2xl p-4 sm:p-6">
      <div className="border-b border-[var(--border)] pb-3 sm:pb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-secondary mt-2 max-w-2xl text-sm leading-relaxed">{description}</p> : null}
      </div>
      <div className="pt-4 sm:pt-5">{children}</div>
    </section>
  );
}

type SettingsConfigPayload = {
  model_provider: string;
  default_chat_model: string;
  default_embed_model: string;
  openai_api_key_configured: boolean;
  openai_api_key_last4: string | null;
  model_provider_options: string[];
  openai_chat_model_options: string[];
  openai_embed_model_options: string[];
};

function mergeOptionList(catalog: string[], current: string): string[] {
  const t = current.trim();
  if (!t || catalog.includes(t)) return catalog;
  return [t, ...catalog];
}

function ConfigPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [configReady, setConfigReady] = useState(false);
  const [modelProvider, setModelProvider] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [chatModelOptions, setChatModelOptions] = useState<string[]>([]);
  const [embedModelOptions, setEmbedModelOptions] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [last4, setLast4] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      onNotify(null, null);
      setConfigReady(false);
      try {
        const c = await fetchJson<SettingsConfigPayload>(`${API_BASE_URL}/api/settings/config`);
        setModelProvider(c.model_provider);
        setChatModel(c.default_chat_model);
        setEmbedModel(c.default_embed_model);
        setConfigured(c.openai_api_key_configured);
        setLast4(c.openai_api_key_last4);
        setProviderOptions(mergeOptionList(c.model_provider_options, c.model_provider));
        setChatModelOptions(mergeOptionList(c.openai_chat_model_options, c.default_chat_model));
        setEmbedModelOptions(mergeOptionList(c.openai_embed_model_options, c.default_embed_model));
        setConfigReady(true);
      } catch (err) {
        onNotify(null, err instanceof Error ? err.message : "Failed to load config");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, []);

  async function save() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_provider: modelProvider || undefined,
          default_chat_model: chatModel || undefined,
          default_embed_model: embedModel || undefined,
          openai_api_key: apiKey.trim() || undefined,
        }),
      });
      setApiKey("");
      onNotify("Configuration saved.", null);
      const c = await fetchJson<SettingsConfigPayload>(`${API_BASE_URL}/api/settings/config`);
      setModelProvider(c.model_provider);
      setChatModel(c.default_chat_model);
      setEmbedModel(c.default_embed_model);
      setConfigured(c.openai_api_key_configured);
      setLast4(c.openai_api_key_last4);
      setProviderOptions(mergeOptionList(c.model_provider_options, c.model_provider));
      setChatModelOptions(mergeOptionList(c.openai_chat_model_options, c.default_chat_model));
      setEmbedModelOptions(mergeOptionList(c.openai_embed_model_options, c.default_embed_model));
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!configReady) {
    return (
      <SectionCard title="API credentials & defaults">
        <p className="text-secondary text-sm">Loading configuration…</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="API credentials & defaults">
      <p className="text-muted mb-4 max-w-2xl text-[13px] leading-snug">
        Values saved here are stored in the database and take priority. If a value is not in the database, the API falls back to the matching
        environment variable (for example <code className="font-mono text-[11px]">OPENAI_MODEL</code>,{" "}
        <code className="font-mono text-[11px]">MODEL_PROVIDER</code>, or <code className="font-mono text-[11px]">OPENAI_API_KEY</code>).
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 lg:col-span-2">
          <div className="brand-elevated flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="text-secondary">OpenAI key status:</span>
            <span className={configured ? "status-success font-medium" : "status-warning font-medium"}>
              {configured ? `Configured (${last4 ?? "••••"})` : "Not set"}
            </span>
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-secondary font-medium">Model provider</span>
          <select
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
            aria-label="Model provider"
          >
            {providerOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-secondary font-medium">Default chat model</span>
          <select
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            aria-label="Default chat model"
          >
            {chatModelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
          <span className="text-secondary font-medium">Default embedding model</span>
          <select
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={embedModel}
            onChange={(e) => setEmbedModel(e.target.value)}
            aria-label="Default embedding model"
          >
            {embedModelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
          <span className="text-secondary font-medium">OpenAI API key</span>
          <input
            type="password"
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="new-password"
            placeholder="sk-…"
          />
          <p className="text-muted max-w-xl text-[12px] leading-snug">
            A key saved here is stored in the database and used by chat, retrieval, and ingestion jobs. Paste a full key and click Save. If you
            only use environment variables instead, restart the API and worker after changing them.
          </p>
        </label>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
        <button type="button" onClick={() => void save()} className="brand-pill-active rounded-xl px-6 py-2.5 text-sm font-medium">
          Save
        </button>
      </div>
    </SectionCard>
  );
}

type UserRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  monthly_request_limit: number | null;
  requests_this_period: number;
};

function UsersPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          role,
          monthly_request_limit: newUserLimit.trim() === "" ? null : parseInt(newUserLimit, 10),
        }),
      });
      setEmail("");
      setPassword("");
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
              className="brand-input rounded-xl px-4 py-2.5"
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-secondary border-b border-[var(--border)] text-xs uppercase tracking-wide">
                <th className="pb-3 pr-4 font-semibold">User</th>
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
    <div className="space-y-8">
      <SectionCard
        title="Agent"
        description="Configure your organization’s agent in one place: identity, guardrails, guidelines, and optional custom instructions. How the agent selects and uses tools follows the product defaults and is not edited here. Everyone in the workspace uses these settings in chat."
      >
        {!behaviorReady || !c ? (
          <p className="text-secondary text-sm">Loading…</p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] p-5 sm:p-6">
              <p className="text-secondary text-sm leading-relaxed">Identity</p>
              <label className="mt-4 block">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">Organization name</span>
                <span className="text-muted mt-1 block text-[13px] leading-snug">
                  Optional. Helps responses stay aligned with your brand.
                </span>
                <input
                  className="brand-input mt-3 w-full rounded-xl px-4 py-3"
                  placeholder="e.g. Your company name"
                  value={c.company_display_name}
                  onChange={(e) => setAgentConfig({ ...c, company_display_name: e.target.value })}
                  autoComplete="organization"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] p-5 sm:p-6">
              <p className="text-secondary text-sm leading-relaxed">Capabilities</p>
              <p className="text-muted mt-1 text-[13px] leading-snug">Choose what the agent is allowed to use when answering.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_35%,transparent)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] has-[:checked]:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-[var(--border)]"
                    checked={c.tool_knowledge_base}
                    onChange={(e) => setAgentConfig({ ...c, tool_knowledge_base: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--text-primary)]">Internal documents</span>
                    <span className="text-muted mt-0.5 block text-[12px] leading-snug">Search your indexed knowledge base</span>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_35%,transparent)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] has-[:checked]:border-[color-mix(in_srgb,var(--primary)_40%,var(--border))] has-[:checked]:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-[var(--border)]"
                    checked={c.tool_internet}
                    onChange={(e) => setAgentConfig({ ...c, tool_internet: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--text-primary)]">Web</span>
                    <span className="text-muted mt-0.5 block text-[12px] leading-snug">Search public sources when relevant</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] p-5 sm:p-6">
              <p className="text-secondary text-sm leading-relaxed">Guardrails</p>
              <p className="text-muted mt-1 text-[13px] leading-snug">
                Non‑negotiable limits: what the agent must refuse, escalate, or never do (compliance, safety).
              </p>
              <textarea
                className="brand-input mt-4 min-h-[100px] w-full rounded-xl px-4 py-3"
                placeholder="Leave blank if you have nothing to add beyond the defaults"
                value={c.guardrails_text}
                onChange={(e) => setAgentConfig({ ...c, guardrails_text: e.target.value })}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] p-5 sm:p-6">
              <p className="text-secondary text-sm leading-relaxed">Guidelines</p>
              <p className="text-muted mt-1 text-[13px] leading-snug">
                Day‑to‑day expectations: tone, how to cite sources, and how you want it to work for your teams.
              </p>
              <textarea
                className="brand-input mt-4 min-h-[100px] w-full rounded-xl px-4 py-3"
                placeholder="Leave blank if the defaults are enough"
                value={c.guidelines_text}
                onChange={(e) => setAgentConfig({ ...c, guidelines_text: e.target.value })}
              />
            </div>

            <details className="group rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_25%,transparent)] px-5 py-4 sm:px-6 sm:py-5">
              <summary className="cursor-pointer list-none text-sm font-medium text-[var(--text-primary)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-2 group-open:no-underline">Custom instructions</span>
                <span className="text-muted ml-2 font-normal">— optional</span>
              </summary>
              <p className="text-muted mt-3 text-[13px] leading-relaxed">
                Replace the built‑in role and behavior text when you need a fully tailored agent. Most teams rely on guardrails and guidelines above instead.
              </p>
              <textarea
                className="brand-input mt-4 min-h-[120px] w-full rounded-xl px-4 py-3"
                placeholder="Leave blank to use the default instructions"
                value={c.base_system_prompt}
                onChange={(e) => setAgentConfig({ ...c, base_system_prompt: e.target.value })}
              />
              <details className="mt-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_50%,transparent)] px-4 py-3">
                <summary className="cursor-pointer text-[13px] font-medium text-[var(--text-secondary)]">Preview</summary>
                <p className="text-muted mt-2 text-[12px]">Shortened view of the full agent context (what users get in chat).</p>
                <pre className="text-muted mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_30%,transparent)] p-3 font-mono text-[11px] leading-relaxed">
                  {effectivePreview}
                </pre>
              </details>
            </details>

            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => void saveBehavior()}
                className="brand-pill-active w-fit rounded-xl px-6 py-2.5 text-sm font-medium"
              >
                Save changes
              </button>
              <p className="text-muted text-[13px] leading-snug">Saved settings apply to all users in this workspace.</p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
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
    <SectionCard title="Recent background jobs">
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
    <div className="space-y-8">
      <SectionCard title="LangSmith (live)">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              tracingOn ? "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]" : "text-muted bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
            }`}
          >
            Tracing {tracingOn ? "on" : "off"}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              keyOk ? "bg-[color-mix(in_srgb,var(--data)_14%,transparent)] text-[var(--data)]" : "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]"
            }`}
          >
            API key {keyOk ? "set" : "missing"}
          </span>
        </div>

        {metrics?.ok ? (
          <>
            <p className="text-muted mb-3 text-xs">
              Loaded from LangSmith for project <span className="font-mono text-[var(--text-secondary)]">{metrics.project_name ?? langsmith.project}</span>
              {metrics.fetched_at ? (
                <>
                  {" "}
                  · <span className="tabular-nums">{new Date(metrics.fetched_at).toLocaleString()}</span>
                </>
              ) : null}
            </p>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="brand-elevated rounded-2xl p-4">
                <div className="text-muted text-xs uppercase tracking-wide">Est. total cost (USD)</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtUsd(metrics.total_cost_usd ?? undefined)}</div>
                <p className="text-muted mt-1 text-[11px] leading-snug">
                  LangSmith estimate for this project (includes traced LLM calls; embeddings appear here if ingestion/chat tracing sends those runs to LangSmith).
                </p>
              </div>
              <div className="brand-elevated rounded-2xl p-4">
                <div className="text-muted text-xs uppercase tracking-wide">Runs</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtInt(metrics.run_count ?? undefined)}</div>
                <p className="text-muted mt-1 text-[11px] leading-snug">Traces/runs in the project (aggregate).</p>
              </div>
              <div className="brand-elevated rounded-2xl p-4">
                <div className="text-muted text-xs uppercase tracking-wide">Total tokens</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtInt(metrics.total_tokens ?? undefined)}</div>
              </div>
              <div className="brand-elevated rounded-2xl p-4">
                <div className="text-muted text-xs uppercase tracking-wide">Prompt / completion $</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {fmtUsd(metrics.prompt_cost_usd ?? undefined)} / {fmtUsd(metrics.completion_cost_usd ?? undefined)}
                </div>
              </div>
            </div>
          </>
        ) : metrics && !metrics.ok ? (
          <p className="status-error mb-4 text-sm">{metrics.error ?? "Could not load LangSmith metrics."}</p>
        ) : (
          <p className="text-secondary mb-4 text-sm">No metrics payload.</p>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="brand-elevated flex flex-col rounded-xl px-3 py-2.5">
            <dt className="text-muted text-xs uppercase tracking-wide">Project</dt>
            <dd className="mt-1 font-mono text-sm font-medium break-all">{String(langsmith.project ?? "—")}</dd>
          </div>
          <div className="brand-elevated flex flex-col rounded-xl px-3 py-2.5">
            <dt className="text-muted text-xs uppercase tracking-wide">API endpoint</dt>
            <dd className="mt-1 font-mono text-xs break-all">{String(langsmith.endpoint ?? "—")}</dd>
          </div>
          {langsmith.workspace_id ? (
            <div className="brand-elevated flex flex-col rounded-xl px-3 py-2.5 sm:col-span-2">
              <dt className="text-muted text-xs uppercase tracking-wide">Workspace ID</dt>
              <dd className="mt-1 font-mono text-xs break-all">{String(langsmith.workspace_id)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-secondary max-w-xl text-sm">
            Figures match the LangSmith project for this API key. Untraced work (e.g. embed-only ingestion) is not included—use your model provider’s usage/billing for that.
          </p>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="brand-secondary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            Open LangSmith
            <FiExternalLink className="size-4" strokeWidth={2.25} />
          </a>
        </div>
      </SectionCard>
    </div>
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
