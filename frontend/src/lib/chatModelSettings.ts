/**
 * Admin chat model UI: PATCH body shape, dirty fingerprint, GET → provider control.
 * Contract: `GET/PATCH /api/settings/config` — fields `model_provider`, `default_chat_model`,
 * `chat_model_aliases`. Server: `app/services/chat_model_settings.py`.
 *
 * `CHAT_PROVIDER_IDS` must match `MODEL_PROVIDER_OPTIONS` in `app/services/openai_catalog.py`.
 */
export const CHAT_PROVIDER_IDS = ["openai", "groq", "openrouter", "huggingface", "nvidia", "tenstorrent"] as const;
export type ChatProviderId = (typeof CHAT_PROVIDER_IDS)[number];

export type ChatModelAliasRow = { alias: string; provider: string; model_id: string };

export type ChatModelConfigSource = {
  model_provider: string;
  default_chat_model: string;
  chat_model_aliases?: ChatModelAliasRow[];
};

export function isChatProviderId(v: string): v is ChatProviderId {
  return (CHAT_PROVIDER_IDS as readonly string[]).includes(v);
}

export function sanitizeChatAliasesForApi(rows: ChatModelAliasRow[]): ChatModelAliasRow[] {
  return rows
    .map((a) => ({
      alias: (a.alias ?? "").trim(),
      provider: (a.provider ?? "").trim().toLowerCase(),
      model_id: (a.model_id ?? "").trim(),
    }))
    .filter((a) => a.alias && a.model_id && isChatProviderId(a.provider))
    .sort((a, b) => a.alias.localeCompare(b.alias));
}

export function chatModelSettingsFingerprint(
  provider: string,
  defaultChatModel: string,
  rows: ChatModelAliasRow[],
): string {
  const p = (provider ?? "").trim().toLowerCase();
  const prov: ChatProviderId = isChatProviderId(p) ? p : "openai";
  const norm = sanitizeChatAliasesForApi(rows);
  return JSON.stringify({ p: prov, m: (defaultChatModel ?? "").trim(), a: norm });
}

export function adminUiChatProvider(c: ChatModelConfigSource): ChatProviderId {
  const rawDm = (c.default_chat_model ?? "").trim();
  const rows = c.chat_model_aliases ?? [];
  const aliasHit = rows.find((a) => a.alias === rawDm);
  const rawProv = (c.model_provider ?? "").trim().toLowerCase();
  if (aliasHit && isChatProviderId((aliasHit.provider ?? "").trim().toLowerCase())) {
    return (aliasHit.provider ?? "").trim().toLowerCase() as ChatProviderId;
  }
  if (rawProv === "grok" || rawProv === "xai") return "groq";
  if (isChatProviderId(rawProv)) return rawProv;
  return "openai";
}

export function buildChatModelSettingsPatchBody(args: {
  provider: ChatProviderId;
  defaultModelId: string;
  aliases: ChatModelAliasRow[];
}): Record<string, unknown> {
  const dm = (args.defaultModelId ?? "").trim();
  return {
    model_provider: args.provider,
    default_chat_model: dm,
    chat_model_aliases: sanitizeChatAliasesForApi(args.aliases),
  };
}
