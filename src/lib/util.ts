export const SIG_COLORS = {
  blue: "hsl(217 91% 60%)",
  mint: "hsl(156 68% 46%)",
  amber: "hsl(36 92% 54%)",
  red: "hsl(0 74% 58%)",
  magenta: "hsl(265 65% 64%)",
  cyan: "hsl(198 88% 52%)",
  gray: "hsl(240 5% 55%)",
} as const;

export type SigColor = keyof typeof SIG_COLORS;

export const COLOR_OPTIONS: SigColor[] = ["blue", "mint", "amber", "red", "magenta", "cyan", "gray"];

export const sig = (c: string | null | undefined): string =>
  SIG_COLORS[(c as SigColor) in SIG_COLORS ? (c as SigColor) : "blue"];

export const sigBg = (c: string | null | undefined, a = 0.12): string =>
  `${sig(c)}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function relDay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(date) - day(now)) / 86400000);
  if (diff < 0) return `${-diff}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `in ${diff}d`;
}

export function dueTone(d: Date | string | null | undefined): "red" | "amber" | "muted" {
  if (!d) return "muted";
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "red";
  if (diff < 48 * 3600 * 1000) return "amber";
  return "muted";
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Night shift";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late session";
}

export const PRIORITY_META = {
  urgent: { label: "URGENT", color: "red" },
  high: { label: "HIGH", color: "amber" },
  medium: { label: "MED", color: "cyan" },
  low: { label: "LOW", color: "muted" },
} as const;

export const ENERGY_META = {
  high: { label: "⚡⚡⚡", hint: "deep work" },
  medium: { label: "⚡⚡", hint: "standard" },
  low: { label: "⚡", hint: "light" },
} as const;

/** Minimal markdown → html (bold, italic, code, lists, headings, links) */
export function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inPre = false;
  let preBuf: string[] = [];
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-sig-cyan underline">$1</a>');
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inPre) { out.push(`<pre>${esc(preBuf.join("\n"))}</pre>`); preBuf = []; inPre = false; }
      else { closeLists(); inPre = true; }
      continue;
    }
    if (inPre) { preBuf.push(line); continue; }
    const t = line.trim();
    if (/^#{1,4}\s/.test(t)) {
      closeLists();
      out.push(`<h3>${inline(t.replace(/^#+\s*/, ""))}</h3>`);
    } else if (/^[-*•]\s+/.test(t)) {
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(t.replace(/^[-*•]\s+/, ""))}</li>`);
    } else if (/^\d+[.)]\s+/.test(t)) {
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(t.replace(/^\d+[.)]\s+/, ""))}</li>`);
    } else if (t === "") {
      closeLists();
    } else {
      closeLists();
      out.push(`<p>${inline(t)}</p>`);
    }
  }
  if (inPre) out.push(`<pre>${esc(preBuf.join("\n"))}</pre>`);
  closeLists();
  return out.join("");
}

/** Parse the ```actions block from a copilot reply */
export type CopilotActionType =
  | "create_task"
  | "update_task"
  | "complete_task"
  | "delete_task"
  | "create_client"
  | "update_client"
  | "delete_client"
  | "create_project"
  | "update_project"
  | "delete_project"
  | "create_event"
  | "update_event"
  | "delete_event"
  | "create_idea"
  | "update_idea"
  | "delete_idea"
  | "create_study_track"
  | "log_study_session"
  | "log_focus_session";

export interface CopilotAction {
  type: CopilotActionType;
  [k: string]: unknown;
}
export function parseActions(text: string): { clean: string; actions: CopilotAction[] } {
  // 1. Try ```actions ... ``` or ```action ... ```
  let m = text.match(/```(?:actions?)\s*([\s\S]*?)```/i);
  if (m) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const actions = (Array.isArray(parsed) ? parsed : [parsed]) as CopilotAction[];
      return { clean: text.replace(m[0], "").trim(), actions };
    } catch {
      // Fall through
    }
  }

  // 2. Try ```json ... ``` containing array of actions
  m = text.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i);
  if (m) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed) && parsed.some((p) => p && typeof p === "object" && "type" in p)) {
        return { clean: text.replace(m[0], "").trim(), actions: parsed as CopilotAction[] };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Fallback: Search for raw JSON array of action objects
  const rawMatch = text.match(/\[\s*\{\s*"type"\s*:\s*"(?:create|update|delete|complete|log)_[^"]+"[\s\S]*?\}\s*\]/);
  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { clean: text.replace(rawMatch[0], "").trim(), actions: parsed as CopilotAction[] };
      }
    } catch {
      // No match
    }
  }

  return { clean: text, actions: [] };
}
