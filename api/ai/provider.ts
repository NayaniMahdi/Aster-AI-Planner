import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getDb } from "../queries/connection";
import { settings } from "@db/schema";

export interface AiConfig {
  hasKey: boolean;
  provider: "custom" | "openai" | "kimi" | "builtin";
  model: string;
  baseUrl: string;
  apiKey: string;
  keysByProvider: {
    nvidia?: string;
    openrouter?: string;
    groq?: string;
    openai?: string;
  };
  source: "settings" | "env" | "builtin";
}

export interface CascadeCandidate {
  model: string;
  baseUrl: string;
  apiKey: string;
  providerName: "NVIDIA NIM" | "OpenRouter" | "Groq" | "OpenAI" | "Custom";
  label: string;
}

import { NVIDIA_FLAGSHIP_MODELS, OPENROUTER_FREE_MODELS } from "../../src/lib/ai-models";
export { NVIDIA_FLAGSHIP_MODELS, OPENROUTER_FREE_MODELS };

export function isValidApiKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 12) return false;
  if (/^(test|dummy|demo|none|placeholder|fake|sample|test123)/i.test(trimmed)) return false;
  return true;
}

export async function getAiConfig(): Promise<AiConfig> {
  const keysByProvider: AiConfig["keysByProvider"] = {};

  try {
    const db = getDb();
    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value || ""]));

    const dbKey = map.get("ai_api_key");
    const dbBaseUrl = map.get("ai_base_url");
    const dbModel = map.get("ai_model");
    const dbProvider = map.get("ai_provider");

    const validDbKey = isValidApiKey(dbKey) ? dbKey : undefined;

    keysByProvider.nvidia = isValidApiKey(map.get("api_key_nvidia"))
      ? map.get("api_key_nvidia")
      : (validDbKey?.startsWith("nvapi-") ? validDbKey : undefined);
    keysByProvider.openrouter = isValidApiKey(map.get("api_key_openrouter"))
      ? map.get("api_key_openrouter")
      : (validDbKey?.startsWith("sk-or-") ? validDbKey : undefined);
    keysByProvider.groq = isValidApiKey(map.get("api_key_groq"))
      ? map.get("api_key_groq")
      : (validDbKey?.startsWith("gsk_") ? validDbKey : undefined);
    keysByProvider.openai = isValidApiKey(map.get("api_key_openai"))
      ? map.get("api_key_openai")
      : (validDbKey?.startsWith("sk-") && !validDbKey?.startsWith("sk-or-") ? validDbKey : undefined);

    if (validDbKey) {
      return {
        hasKey: true,
        apiKey: validDbKey,
        provider: (dbProvider as AiConfig["provider"]) || "custom",
        model: dbModel || "meta/llama-3.3-70b-instruct",
        baseUrl: dbBaseUrl || "https://integrate.api.nvidia.com/v1",
        keysByProvider,
        source: "settings",
      };
    }
  } catch {
    // If DB read fails, fall through to env
  }

  // Check environment variables
  const rawEnvKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const envKey = isValidApiKey(rawEnvKey) ? rawEnvKey : undefined;
  const envBase = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const envModel = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (envKey) {
    return {
      hasKey: true,
      apiKey: envKey,
      provider: "openai",
      model: envModel,
      baseUrl: envBase,
      keysByProvider,
      source: "env",
    };
  }

  return {
    hasKey: false,
    apiKey: "",
    provider: "custom",
    model: "meta/llama-3.3-70b-instruct",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keysByProvider,
    source: "builtin",
  };
}

/** Assembles prioritized failover models so if one model fails or queues, another answers immediately */
export async function getCascadeModels(): Promise<CascadeCandidate[]> {
  const config = await getAiConfig();
  if (!config.hasKey || !isValidApiKey(config.apiKey)) return [];

  const candidates: CascadeCandidate[] = [];
  const seenModels = new Set<string>();

  const isNvidia = config.baseUrl.includes("nvidia");
  const isOpenRouter = config.baseUrl.includes("openrouter");

  const nvidiaKey =
    config.keysByProvider.nvidia || (config.apiKey.startsWith("nvapi-") ? config.apiKey : undefined);
  const openrouterKey =
    config.keysByProvider.openrouter || (config.apiKey.startsWith("sk-or-") ? config.apiKey : undefined);

  // 1. Primary candidate: The user's active choice if key matches
  if (isNvidia && nvidiaKey) {
    candidates.push({
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: nvidiaKey,
      providerName: "NVIDIA NIM",
      label: config.model,
    });
    seenModels.add(config.model);
  } else if (isOpenRouter && openrouterKey) {
    candidates.push({
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: openrouterKey,
      providerName: "OpenRouter",
      label: config.model,
    });
    seenModels.add(config.model);
  } else if (!isNvidia && !isOpenRouter && config.apiKey) {
    candidates.push({
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      providerName: "Custom",
      label: config.model,
    });
    seenModels.add(config.model);
  }

  // 2. Same-provider fallbacks using active provider's valid key
  if (nvidiaKey) {
    for (const m of NVIDIA_FLAGSHIP_MODELS) {
      if (!seenModels.has(m.id) && candidates.length < 5) {
        candidates.push({
          model: m.id,
          baseUrl: "https://integrate.api.nvidia.com/v1",
          apiKey: nvidiaKey,
          providerName: "NVIDIA NIM",
          label: m.label,
        });
        seenModels.add(m.id);
      }
    }
  }

  // 3. Cross-provider fallback to OpenRouter if openrouterKey exists
  if (openrouterKey) {
    for (const m of OPENROUTER_FREE_MODELS) {
      if (!seenModels.has(m.id) && candidates.length < 8) {
        candidates.push({
          model: m.id,
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: openrouterKey,
          providerName: "OpenRouter",
          label: m.label,
        });
        seenModels.add(m.id);
      }
    }
  }

  return candidates;
}

export async function getAiModel() {
  const config = await getAiConfig();
  if (!config.hasKey || !config.apiKey) return null;

  try {
    const provider = createOpenAICompatible({
      name: "northstar-ai",
      baseURL: config.baseUrl || "https://api.openai.com/v1",
      apiKey: config.apiKey,
      includeUsage: true,
      supportsStructuredOutputs: true,
    });

    return provider(config.model);
  } catch {
    return null;
  }
}
