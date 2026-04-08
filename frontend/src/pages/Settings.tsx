import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiCpu,
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
        title: "Agent personas",
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="brand-card rounded-2xl p-4 sm:p-6">
      <div className="border-b border-[var(--border)] pb-3 sm:pb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="pt-4 sm:pt-5">{children}</div>
    </section>
  );
}

function ConfigPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [modelProvider, setModelProvider] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embedModel, setEmbedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [last4, setLast4] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      onNotify(null, null);
      try {
        const c = await fetchJson<{
          model_provider: string;
          default_chat_model: string;
          default_embed_model: string;
          openai_api_key_configured: boolean;
          openai_api_key_last4: string | null;
        }>(`${API_BASE_URL}/api/settings/config`);
        setModelProvider(c.model_provider);
        setChatModel(c.default_chat_model);
        setEmbedModel(c.default_embed_model);
        setConfigured(c.openai_api_key_configured);
        setLast4(c.openai_api_key_last4);
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
      const c = await fetchJson<{
        openai_api_key_configured: boolean;
        openai_api_key_last4: string | null;
      }>(`${API_BASE_URL}/api/settings/config`);
      setConfigured(c.openai_api_key_configured);
      setLast4(c.openai_api_key_last4);
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <SectionCard title="API credentials & defaults">
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
          <input
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-secondary font-medium">Default chat model</span>
          <input
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
          <span className="text-secondary font-medium">Default embedding model</span>
          <input
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={embedModel}
            onChange={(e) => setEmbedModel(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm lg:col-span-2">
          <span className="text-secondary font-medium">OpenAI API key</span>
          <input
            type="password"
            className="brand-input mt-1 rounded-xl px-4 py-2.5"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
          />
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

type AgentRow = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
};

function AgentsPanel({ onNotify }: { onNotify: (m: string | null, e: string | null) => void }) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  async function load() {
    try {
      const list = await fetchJson<AgentRow[]>(`${API_BASE_URL}/api/settings/agents`);
      setAgents(list);
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Failed to load agents");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    onNotify(null, null);
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, system_prompt: prompt }),
      });
      setName("");
      setDescription("");
      setPrompt("");
      onNotify("Persona created.", null);
      await load();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Create failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this persona? Chat users will lose this option.")) return;
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/agents/${id}`, { method: "DELETE" });
      onNotify("Persona removed.", null);
      await load();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-8">
      <SectionCard title="Create a persona">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary font-medium">Display name</span>
            <input
              className="brand-input rounded-2xl px-4 py-2.5"
              placeholder="e.g. Policy analyst"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary font-medium">Description</span>
            <input
              className="brand-input rounded-xl px-4 py-2.5"
              placeholder="One line for users"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary font-medium">System prompt</span>
            <textarea
              className="brand-input min-h-[180px] rounded-xl px-4 py-3"
              placeholder="You are…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            className="brand-pill-active w-fit rounded-2xl px-6 py-2.5 text-sm font-medium"
          >
            Save persona
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Saved personas">
        {agents.length === 0 ? (
          <p className="text-secondary text-sm">No personas yet. Create one above.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {agents.map((a) => (
              <li key={a.id} className="brand-elevated rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{a.name}</h3>
                    <p className="text-secondary mt-1 text-sm">{a.description || "No description"}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-[color-mix(in_srgb,var(--error)_35%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                    onClick={() => void remove(a.id)}
                  >
                    Delete
                  </button>
                </div>
                <pre className="text-muted mt-3 max-h-36 overflow-auto rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_50%,transparent)] p-3 text-xs leading-relaxed">
                  {a.system_prompt.length > 500 ? `${a.system_prompt.slice(0, 500)}…` : a.system_prompt}
                </pre>
              </li>
            ))}
          </ul>
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
        const res = await fetchJson<{
          summary: Record<string, unknown>;
          by_user: unknown[];
          langsmith: Record<string, unknown>;
        }>(`${API_BASE_URL}/api/settings/usage/summary?days=30`);
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

  const summary = data.summary as Record<string, unknown>;
  const langsmith = data.langsmith as Record<string, unknown>;

  return (
    <div className="space-y-8">
      <SectionCard title="Aggregated usage (rolling window)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="brand-elevated rounded-2xl p-4">
            <div className="text-muted text-xs uppercase tracking-wide">Events</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{String(summary.event_count ?? "—")}</div>
          </div>
          <div className="brand-elevated rounded-2xl p-4">
            <div className="text-muted text-xs uppercase tracking-wide">Est. cost (USD)</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{String(summary.total_estimated_cost_usd ?? "0")}</div>
          </div>
          <div className="brand-elevated rounded-2xl p-4">
            <div className="text-muted text-xs uppercase tracking-wide">Tokens in</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{String(summary.total_tokens_in ?? "0")}</div>
          </div>
          <div className="brand-elevated rounded-2xl p-4">
            <div className="text-muted text-xs uppercase tracking-wide">Tokens out</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{String(summary.total_tokens_out ?? "0")}</div>
          </div>
        </div>
        <details className="mt-6">
          <summary className="text-secondary cursor-pointer text-sm font-medium">Raw JSON</summary>
          <pre className="text-muted mt-3 max-h-48 overflow-auto rounded-xl border border-[var(--border)] p-3 text-xs">{JSON.stringify(summary, null, 2)}</pre>
        </details>
      </SectionCard>

      <SectionCard title="LangSmith">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(langsmith).map(([k, v]) => (
            <div key={k} className="brand-elevated flex flex-col rounded-xl px-3 py-2">
              <dt className="text-muted text-xs capitalize">{k.replace(/_/g, " ")}</dt>
              <dd className="mt-0.5 font-mono text-xs break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
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
