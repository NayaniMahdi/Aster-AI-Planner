/**
 * ai-client.ts — 网站大模型能力客户端（平台预置，拷进项目后请勿改契约）
 *
 * 覆盖：模型清单 + **LLM 调用的错误归类**。
 *
 * **对话本身不在这里** —— 对话直接用预装的 AI SDK（`ai` + `@ai-sdk/openai-compatible`）：
 * `streamText` / `generateText` / `generateObject`，见 skill `website-ai`。
 * 本文件只提供 AI SDK 之外的两件东西：
 *   1. `listModels()` —— 拿站点可用模型与 default_model_id（**不要硬编码模型 id**）
 *   2. `classifyAiError()` —— 把 SDK 抛出的错误映射成带语义的类型，调用方不必再解 HTTP 码
 *
 * 生图/生视频/生语音**不在本技能范围**（本批只有 LLM 接入）。
 *
 * 环境变量（平台按站点注入，不要向用户索要、不要硬编码）：
 *   KIMI_AGENTGW_API_KEY  — 平台网关鉴权 key（**仅服务端可用**，禁止下发浏览器）
 *   KIMI_AGENTGW_BASE_URL — 网关入口（含 /coding/v1 后缀）
 *
 * 这两个变量由平台写进项目根的 .env。网站运行时由后端加载；独立脚本
 * （npx tsx xxx.ts）不会自动加载 —— 本模块兜底调一次 process.loadEnvFile()
 * （Node >= 20.12，已存在的变量优先），仍读不到才报 AiMisconfigured。
 * 排查顺序：① .env 里有没有 KIMI_AGENTGW_ ② 有 → 是脚本没加载，别误报
 * ③ 没有 → 站点未供给，让用户「发布（或重新打开）一次站点」后重试。
 *
 * 运行环境适配：不声明 process / Buffer 等全局（会与 @types/node 打架），
 * 环境变量用 globalThis 收窄读取。
 */

interface NodeLikeProcess {
  env?: Record<string, string | undefined>;
  /** Node >= 20.12：把 .env 加载进 process.env（已存在的变量优先，不覆盖） */
  loadEnvFile?: (path?: string) => void;
}

let envFileLoaded = false;

function loadEnvFileOnce(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  const proc = (globalThis as { process?: NodeLikeProcess }).process;
  if (typeof proc?.loadEnvFile !== "function") return;
  try {
    proc.loadEnvFile();
  } catch {
    // 没有 .env / 运行时不支持 —— 保持原样，走正常的「未供给」报错
  }
}

function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: NodeLikeProcess }).process;
  const value = proc?.env?.[key];
  if (value !== undefined && value !== "") return value;
  loadEnvFileOnce();
  return proc?.env?.[key];
}

// ---------- 错误类型（调用方直接分支，不必再解 HTTP 码） ----------

/** 终态：额度耗尽 / 权益不可用。**不要重试** */
export class AiUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailable";
  }
}

/** 终态：内容/安全拒绝。提示用户改写输入 */
export class ContentRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentRejected";
  }
}

/** 终态：凭证无效/缺失 —— 配置问题，需重新部署 */
export class AiMisconfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiMisconfigured";
  }
}

/** 终态：入参非法。开发期错误，应上报日志 */
export class AiInvalidRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiInvalidRequest";
  }
}

/**
 * 可重试：429 / 408 / 424 / 5xx。
 *
 * **本模块自己不重试** —— 是否重试由调用方决定（见 skill `website-ai` 的错误一节）：
 * 计费型调用重试可能重复扣站长额度（5xx 或客户端超时都不能证明服务端没执行）。
 * `classifyAiError` 只是把这类错误标出来，不会替你重发请求。
 */
export class AiTransient extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiTransient";
  }
}

export interface ModelInfo {
  id: string;
  displayName?: string;
  contextLength?: number;
  supportsReasoning?: boolean;
  supportsImageIn?: boolean;
}

export interface ModelList {
  models: ModelInfo[];
  /** 站点应默认使用的模型 id —— 不要硬编码 */
  defaultModelId: string;
}

interface ErrorBody {
  error?: { type?: string; message?: string; code?: string };
  message?: string;
}

// ---------- 配置与错误映射 ----------

interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
}

function config(): GatewayConfig {
  const baseUrl = readEnv("KIMI_AGENTGW_BASE_URL");
  const apiKey = readEnv("KIMI_AGENTGW_API_KEY");
  if (!baseUrl || !apiKey) {
    throw new AiMisconfigured(
      "KIMI_AGENTGW_BASE_URL / KIMI_AGENTGW_API_KEY 未注入：站点可能尚未供给。" +
        "先确认 .env 里有这两个变量；没有则让用户发布（或重新打开）一次站点后重试。",
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

/**
 * 把网关的 HTTP 状态与 error.type 映射成带语义的类型。
 *
 * 注意：**非法枚举值网关不报错**（归一化后仍 200），所以枚举校验只能放在客户端。
 */
export function mapAiError(status: number, body: ErrorBody | undefined, raw: string): Error {
  const type = body?.error?.type ?? "";
  const detail = body?.error?.message ?? body?.message ?? raw.slice(0, 300);

  // 额度耗尽：PRD 写 402，现网实际是 403 + access_terminated_error
  if (type === "access_terminated_error") {
    return new AiUnavailable("额度耗尽，此功能不可用");
  }
  if (type.includes("content") || type.includes("moderation")) {
    return new ContentRejected(detail || "内容被拒绝");
  }
  switch (status) {
    case 401:
      return new AiMisconfigured("网关凭证无效或缺失，需重新部署站点");
    case 402:
      return new AiUnavailable("会员权益不可用");
    case 400:
      return type === "payment_required"
        ? new AiUnavailable("会员权益不可用")
        : new AiInvalidRequest(detail || "请求参数非法");
    case 403:
      return new ContentRejected(detail || "内容被拒绝");
    case 429:
      return new AiTransient("请求过于频繁，稍后重试");
    case 408:
    case 424:
      return new AiTransient(detail || "上游暂时不可用，稍后重试");
    default:
      if (status >= 500) return new AiTransient("服务繁忙，请稍后再试");
      return new AiInvalidRequest(detail || `请求失败（HTTP ${status}）`);
  }
}

/**
 * 把 AI SDK 抛出的错误归类成上面的类型。
 *
 * SDK 的错误里带着网关响应的状态与 body（不同版本字段名略有差异，这里都兜），
 * 拿不到结构化信息时按可重试处理 —— 网络层错误通常确实是瞬时的。
 *
 * 用法：
 * ```ts
 * try {
 *   return await streamText({ model, messages });
 * } catch (err) {
 *   throw classifyAiError(err);   // 调用方据此分支，不必再解 HTTP 码
 * }
 * ```
 *
 * 注意：本函数**不重试**。拿到 `AiTransient` 后要不要重发由调用方决定 ——
 * 计费型调用重试可能重复扣费，见 skill `website-ai` 的错误一节。
 */
export function classifyAiError(err: unknown): Error {
  if (
    err instanceof AiUnavailable ||
    err instanceof ContentRejected ||
    err instanceof AiMisconfigured ||
    err instanceof AiInvalidRequest ||
    err instanceof AiTransient
  ) {
    return err;
  }

  const anyErr = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number; body?: unknown };
    data?: unknown;
    error?: unknown;
    cause?: unknown;
    message?: string;
    responseBody?: unknown;
  };

  const status = anyErr?.status ?? anyErr?.statusCode ?? anyErr?.response?.status;
  let body: ErrorBody | undefined;
  // 提取优先级：结构化 data / response.body / error，最后兜 responseBody。
  // 兜底那一项是必要的：ai@6 的 APICallError 只在 body 能过 provider error
  // schema 时才带 `data`；body 不合 schema（如缺 error.message）时它停在
  // catch 分支，**只带 responseBody 裸 JSON 串**。少了这一项，403 +
  // access_terminated_error 会从「额度耗尽」静默降级成 ContentRejected。
  const rawBody =
    anyErr?.response?.body ?? anyErr?.data ?? anyErr?.error ?? anyErr?.responseBody;
  if (rawBody && typeof rawBody === "object") {
    body = rawBody as ErrorBody;
  } else if (typeof rawBody === "string") {
    try {
      body = JSON.parse(rawBody) as ErrorBody;
    } catch {
      body = undefined;
    }
  }

  if (typeof status === "number") {
    return mapAiError(status, body, typeof rawBody === "string" ? rawBody : "");
  }

  // 无结构化状态：HTTP 之外的错误（连接失败、超时、流中断）
  return new AiTransient(anyErr?.message || "AI 调用失败，请稍后重试");
}

/** 该错误是否值得重试（只有 AiTransient 是） */
export function isRetryableAiError(err: unknown): boolean {
  return err instanceof AiTransient;
}

// ---------- 对外方法 ----------

/**
 * 可用模型清单。**站点不要硬编码模型 id**：可用集合由该站点的 scope/权益决定，
 * 会不告而变。显式传一个过期 id 不会被网关拒绝（原样回显），因此硬编码是静默降级。
 */
export async function listModels(): Promise<ModelList> {
  const { baseUrl, apiKey } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AiTransient("无法连接网关读取模型清单，稍后重试");
  }

  const text = await res.text();
  // 先把非 2xx 判掉再解析：ingress / 网关代理返回的 HTML 错误页（401/403/502）
  // 不是 JSON，先解析会把它们误抛成可重试的 AiTransient。mapAiError 的 body
  // 允许 undefined，detail 会回退到 raw 前 300 字。
  if (!res.ok) {
    let errBody: {
      error?: { type?: string; message?: string };
      message?: string;
    } | undefined;
    try {
      errBody = text ? JSON.parse(text) : undefined;
    } catch {
      errBody = undefined;
    }
    throw mapAiError(res.status, errBody, text);
  }

  let body: {
    data?: Array<Record<string, unknown>>;
    default_model_id?: string;
    error?: { type?: string; message?: string };
    message?: string;
  };
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AiTransient("模型清单响应无法解析");
  }

  const models: ModelInfo[] = (body.data ?? []).map((m) => ({
    id: String(m.id ?? ""),
    displayName: m.display_name as string | undefined,
    contextLength: m.context_length as number | undefined,
    supportsReasoning: m.supports_reasoning as boolean | undefined,
    supportsImageIn: m.supports_image_in as boolean | undefined,
  }));
  const defaultModelId = body.default_model_id ?? models[0]?.id ?? "";
  if (!defaultModelId) throw new AiUnavailable("网关未下发可用模型");
  return { models, defaultModelId };
}
