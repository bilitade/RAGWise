import { useEffect, useState } from "react";
import {
  FiActivity,
  FiCpu,
  FiFileText,
  FiLayers,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import type { SettingsTab } from "../types";
import {
  API_BASE_URL,
  fetchJson,
  navigateTo,
  setAccessToken,
} from "../utils";
import BrandWordmark from "../components/BrandWordmark";

export default function SettingsPage({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "config", label: "Config", icon: <FiSettings /> },
    { id: "users", label: "Users", icon: <FiUsers /> },
    { id: "agents", label: "Agents", icon: <FiCpu /> },
    { id: "jobs", label: "Jobs", icon: <FiActivity /> },
    { id: "usage", label: "AI usage", icon: <FiLayers /> },
    { id: "logs", label: "Logs", icon: <FiFileText /> },
  ];

  function logout() {
    setAccessToken(null);
    navigateTo("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="brand-card rounded-[28px] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <BrandWordmark />
            <p className="text-secondary mt-1 text-sm">Admin settings (requires admin role)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigateTo("/documents")} className="brand-pill rounded-2xl px-4 py-2 text-sm">
              Workspace
            </button>
            <button type="button" onClick={logout} className="brand-secondary rounded-2xl px-4 py-2 text-sm">
              Log out
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                activeTab === t.id ? "brand-pill-active" : "brand-pill"
              }`}
            >
              <span className="flex items-center gap-2">
                {t.icon}
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      {message ? <p className="status-success text-sm">{message}</p> : null}
      {error ? <p className="status-error text-sm">{error}</p> : null}

      {activeTab === "config" ? (
        <ConfigPanel onNotify={(m, e) => (setMessage(m), setError(e))} />
      ) : null}
      {activeTab === "users" ? (
        <UsersPanel onNotify={(m, e) => (setMessage(m), setError(e))} />
      ) : null}
      {activeTab === "agents" ? (
        <AgentsPanel onNotify={(m, e) => (setMessage(m), setError(e))} />
      ) : null}
      {activeTab === "jobs" ? <JobsPanel /> : null}
      {activeTab === "usage" ? <UsagePanel /> : null}
      {activeTab === "logs" ? <LogsPanel /> : null}
    </div>
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
    <div className="brand-card rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">Model provider and API</h2>
      <p className="text-secondary mt-1 text-sm">
        API keys are stored encrypted. OpenAI key last four: {configured ? last4 ?? "—" : "not set"}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <label className="text-sm">
          <span className="text-secondary">Model provider</span>
          <input
            className="brand-input mt-1 w-full rounded-2xl px-4 py-2"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-secondary">Default chat model</span>
          <input
            className="brand-input mt-1 w-full rounded-2xl px-4 py-2"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-secondary">Default embedding model</span>
          <input
            className="brand-input mt-1 w-full rounded-2xl px-4 py-2"
            value={embedModel}
            onChange={(e) => setEmbedModel(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-secondary">New OpenAI API key (leave blank to keep)</span>
          <input
            type="password"
            className="brand-input mt-1 w-full rounded-2xl px-4 py-2"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="button" onClick={() => void save()} className="brand-pill-active mt-2 w-fit rounded-2xl px-6 py-2 text-sm">
          Save
        </button>
      </div>
    </div>
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
          monthly_request_limit:
            newUserLimit.trim() === "" ? null : parseInt(newUserLimit, 10),
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
    <div className="flex flex-col gap-6">
      <div className="brand-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">Create user</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className="brand-input rounded-2xl px-4 py-2"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="brand-input rounded-2xl px-4 py-2"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="brand-input rounded-2xl px-4 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="normal">normal</option>
            <option value="pro">pro</option>
            <option value="admin">admin</option>
          </select>
          <input
            className="brand-input rounded-2xl px-4 py-2"
            placeholder="Monthly limit (empty = unlimited)"
            value={newUserLimit}
            onChange={(e) => setNewUserLimit(e.target.value)}
            inputMode="numeric"
          />
          <button type="button" onClick={() => void createUser()} className="brand-pill-active rounded-2xl px-4 py-2 text-sm">
            Create
          </button>
        </div>
      </div>
      <div className="brand-card overflow-x-auto rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">Users</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-secondary border-b border-[var(--border)]">
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Active</th>
              <th className="py-2">Limit / used</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)]">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.is_active ? "yes" : "no"}</td>
                <td className="py-2">
                  {u.monthly_request_limit ?? "∞"} / {u.requests_this_period}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    className="brand-pill mr-2 rounded-xl px-2 py-1 text-xs"
                    onClick={() => void patchUser(u.id, { is_active: !u.is_active })}
                  >
                    Toggle
                  </button>
                  <select
                    className="brand-input rounded-xl px-2 py-1 text-xs"
                    value={u.role}
                    onChange={(e) => void patchUser(u.id, { role: e.target.value })}
                  >
                    <option value="normal">normal</option>
                    <option value="pro">pro</option>
                    <option value="admin">admin</option>
                  </select>
                  <input
                    key={`${u.id}-${String(u.monthly_request_limit)}`}
                    type="number"
                    min={0}
                    className="brand-input ml-2 w-20 rounded-xl px-2 py-1 text-xs"
                    placeholder="limit"
                    defaultValue={u.monthly_request_limit ?? ""}
                    id={`monthly-limit-${u.id}`}
                  />
                  <button
                    type="button"
                    className="brand-secondary ml-1 rounded-xl px-2 py-1 text-xs"
                    onClick={() => {
                      const el = document.getElementById(
                        `monthly-limit-${u.id}`,
                      ) as HTMLInputElement | null;
                      const raw = el?.value?.trim() ?? "";
                      const parsed = raw === "" ? null : parseInt(raw, 10);
                      const limit = parsed !== null && Number.isNaN(parsed) ? null : parsed;
                      void patchUser(u.id, { monthly_request_limit: limit });
                    }}
                  >
                    Set limit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    if (!confirm("Delete this persona?")) return;
    try {
      await fetchJson(`${API_BASE_URL}/api/settings/agents/${id}`, { method: "DELETE" });
      onNotify("Deleted.", null);
      await load();
    } catch (err) {
      onNotify(null, err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="brand-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">New agent persona</h2>
        <div className="mt-4 flex flex-col gap-3">
          <input
            className="brand-input rounded-2xl px-4 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="brand-input rounded-2xl px-4 py-2"
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <textarea
            className="brand-input min-h-[160px] rounded-2xl px-4 py-2"
            placeholder="System prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="button" onClick={() => void create()} className="brand-pill-active w-fit rounded-2xl px-6 py-2 text-sm">
            Create persona
          </button>
        </div>
      </div>
      <div className="brand-card rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">Existing personas</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {agents.map((a) => (
            <li key={a.id} className="border-b border-[var(--border)] pb-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-secondary text-sm">{a.description}</div>
                </div>
                <button type="button" className="brand-secondary rounded-xl px-3 py-1 text-xs" onClick={() => void remove(a.id)}>
                  Delete
                </button>
              </div>
              <pre className="text-muted mt-2 max-h-32 overflow-auto text-xs">{a.system_prompt.slice(0, 400)}…</pre>
            </li>
          ))}
        </ul>
      </div>
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

  if (err) return <p className="status-error">{err}</p>;

  return (
    <div className="brand-card overflow-x-auto rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">Background jobs</h2>
      <table className="mt-4 w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-secondary border-b border-[var(--border)]">
            <th className="py-2">Type</th>
            <th className="py-2">Task ID</th>
            <th className="py-2">Celery</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-[var(--border)]">
              <td className="py-2">{j.job_type}</td>
              <td className="py-2 font-mono text-xs">{j.celery_task_id}</td>
              <td className="py-2">{j.celery_status ?? "—"}</td>
              <td className="py-2">{new Date(j.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

  if (err) return <p className="status-error">{err}</p>;
  if (!data) return <p className="text-secondary text-sm">Loading…</p>;

  const summary = data.summary as Record<string, unknown>;
  const langsmith = data.langsmith as Record<string, unknown>;

  return (
    <div className="brand-card rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">Usage (30 days)</h2>
      <pre className="text-muted mt-4 overflow-auto text-xs">{JSON.stringify(summary, null, 2)}</pre>
      <h3 className="mt-6 font-medium">LangSmith</h3>
      <pre className="text-muted mt-2 overflow-auto text-xs">{JSON.stringify(langsmith, null, 2)}</pre>
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
        const res = await fetchJson<{ path: string; lines: string[] }>(
          `${API_BASE_URL}/api/settings/logs?lines=300`,
        );
        setPath(res.path);
        setLines(res.lines);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  if (err) return <p className="status-error">{err}</p>;

  return (
    <div className="brand-card rounded-[28px] p-6">
      <h2 className="text-lg font-semibold">Application logs</h2>
      <p className="text-secondary mt-1 text-sm font-mono">{path}</p>
      <pre className="text-muted mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap text-xs">{lines.join("\n") || "(empty)"}</pre>
    </div>
  );
}
