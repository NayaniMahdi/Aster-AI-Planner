import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Pill } from "./bits";
import { AiErrorCard } from "./Copilot";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/util";
import {
  X,
  Plus,
  CalendarDays,
  Lightbulb,
  CheckCircle2,
  CornerDownLeft,
  Command as CommandIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Parsed {
  kind: "task" | "event" | "idea";
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "inbox" | "next" | "scheduled";
  dueDate: string | null;
  startAt: string | null;
  endAt: string | null;
  projectId: number | null;
  clientId: number | null;
  body: string | null;
}

function localParse(raw: string): Parsed {
  let text = raw;
  const lower = raw.toLowerCase();
  let priority: Parsed["priority"] = "medium";
  if (/!(urgent|asap)/i.test(raw)) priority = "urgent";
  else if (/!high/i.test(raw)) priority = "high";
  else if (/!low/i.test(raw)) priority = "low";
  text = text.replace(/!\w+/g, "").trim();

  const isIdea = /\b(idea|what if|brainstorm|concept)\b/i.test(lower);
  const timeMatch =
    lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || lower.match(/\b(\d{1,2}):(\d{2})\b/);

  const now = new Date();
  let date: Date | null = null;
  if (/\btoday\b/.test(lower)) date = now;
  else if (/\btomorrow\b/.test(lower)) date = new Date(now.getTime() + 86400000);
  else if (/\bnext week\b/.test(lower)) date = new Date(now.getTime() + 7 * 86400000);
  else {
    const inDays = lower.match(/\bin (\d+) days?\b/);
    if (inDays) date = new Date(now.getTime() + Number(inDays[1]) * 86400000);
    else {
      const wd = lower.match(/\bon (mon|tue|wed|thu|fri|sat|sun)/);
      if (wd) {
        const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const target = days.indexOf(wd[1]);
        const d = new Date(now);
        d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7 || 7));
        date = d;
      }
    }
  }

  const isEvent =
    !!date &&
    !!timeMatch &&
    /\b(meet|call|appointment|lunch|dinner|session|class|interview|demo|review with)\b/i.test(
      lower
    );
  if (date && timeMatch) {
    const h = Number(timeMatch[1]);
    const mins = timeMatch[2] ? Number(timeMatch[2]) : Number(timeMatch[3] ?? 0);
    const ampm = timeMatch[3] && /am|pm/.test(timeMatch[3]) ? timeMatch[3] : undefined;
    let hour = h;
    if (ampm === "pm" && h < 12) hour = h + 12;
    if (ampm === "am" && h === 12) hour = 0;
    date = new Date(date);
    date.setHours(hour, timeMatch[2] && timeMatch[3] ? Number(timeMatch[2]) : mins, 0, 0);
  } else if (date) {
    date = new Date(date);
    date.setHours(18, 0, 0, 0);
  }

  text = text
    .replace(
      /\b(today|tomorrow|next week|in \d+ days?|on (mon|tue|wed|thu|fri|sat|sun)(day)?(day)?)\b/gi,
      ""
    )
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    kind: isIdea ? "idea" : isEvent ? "event" : "task",
    title: text || raw,
    priority,
    status: "inbox",
    dueDate: date && !isEvent ? date.toISOString().slice(0, 10) : null,
    startAt: isEvent && date ? date.toISOString() : null,
    endAt: isEvent && date ? new Date(date.getTime() + 3600000).toISOString() : null,
    projectId: null,
    clientId: null,
    body: null,
  };
}

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const parse = trpc.ai.parseCapture.useMutation();
  const createTask = trpc.tasks.create.useMutation();
  const createEvent = trpc.events.create.useMutation();
  const createIdea = trpc.ideas.create.useMutation();
  const projects = trpc.projects.list.useQuery();
  const clients = trpc.clients.list.useQuery();

  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [aiFailed, setAiFailed] = useState<Error | null>(null);
  const [phase, setPhase] = useState<"input" | "decoding" | "preview">("input");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setParsed(null);
      setAiFailed(null);
      setPhase("input");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const decode = async () => {
    if (!text.trim()) return;
    setPhase("decoding");
    setAiFailed(null);
    try {
      const p = await parse.mutateAsync({ text: text.trim() });
      setParsed(p as Parsed);
      setPhase("preview");
    } catch (err) {
      setAiFailed(err as Error);
      setParsed(localParse(text.trim()));
      setPhase("preview");
    }
  };

  const commit = async () => {
    if (!parsed) return;
    try {
      if (parsed.kind === "task") {
        await createTask.mutateAsync({
          title: parsed.title,
          priority: parsed.priority,
          status: parsed.status,
          dueDate: parsed.dueDate ? new Date(parsed.dueDate + "T18:00:00") : null,
          projectId: parsed.projectId,
          clientId: parsed.clientId,
          notes: parsed.body ?? undefined,
        });
      } else if (parsed.kind === "event") {
        const start = parsed.startAt ? new Date(parsed.startAt) : new Date();
        await createEvent.mutateAsync({
          title: parsed.title,
          startAt: start,
          endAt: parsed.endAt ? new Date(parsed.endAt) : new Date(start.getTime() + 3600000),
        });
      } else {
        await createIdea.mutateAsync({ title: parsed.title, body: parsed.body ?? undefined });
      }
      await Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.list.invalidate(),
        utils.ideas.list.invalidate(),
      ]);
      toast.success(
        parsed.kind === "task"
          ? "Task added to sprint"
          : parsed.kind === "event"
          ? "Event scheduled"
          : "Idea saved to vault"
      );
      setText("");
      setParsed(null);
      setPhase("input");
      inputRef.current?.focus();
    } catch {
      toast.error("Failed to commit item");
    }
  };

  const KIND_META = {
    task: { icon: <CheckCircle2 size={13} />, label: "Task" },
    event: { icon: <CalendarDays size={13} />, label: "Event" },
    idea: { icon: <Lightbulb size={13} />, label: "Idea" },
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div
        className="anim-rise w-full max-w-xl rounded-2xl border border-border/80 bg-card p-0 shadow-2xl overflow-hidden dark:border-white/[0.12]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 bg-secondary/15">
          <div className="flex items-center gap-2">
            <CommandIcon size={14} className="text-primary" />
            <span className="text-xs font-semibold tracking-tight text-foreground">
              Studio Quick Omnibar
            </span>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline-block">
              (Natural Language Parser)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
              Esc
            </span>
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Input Field */}
        <div className="p-5">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-secondary/30 px-3.5 transition-colors",
              phase === "input" ? "border-primary/60 ring-1 ring-primary/20" : "border-border/80"
            )}
          >
            <Plus size={16} className="shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (phase !== "input") {
                  setPhase("input");
                  setParsed(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  decode();
                }
              }}
              placeholder="e.g. Client presentation tomorrow at 3pm !urgent #Acme"
              className="h-12 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            {phase === "input" && (
              <button
                onClick={decode}
                className="flex items-center gap-1 rounded bg-secondary px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <CornerDownLeft size={10} /> Enter
              </button>
            )}
          </div>

          {phase === "decoding" && (
            <div className="mt-4 flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full bg-primary anim-pulse-dot" />
              <span className="text-xs font-medium text-muted-foreground">
                Analyzing syntax and contextual parameters…
              </span>
            </div>
          )}

          {aiFailed && phase === "preview" && (
            <div className="mt-4">
              <AiErrorCard error={aiFailed} />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Synthesized via offline regex engine — review before saving.
              </p>
            </div>
          )}

          {phase === "preview" && parsed && (
            <div className="anim-rise mt-4 rounded-xl border border-border/80 bg-secondary/25 p-4 space-y-3.5">
              {/* Kind Tabs */}
              <div className="flex items-center gap-1.5">
                {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setParsed({ ...parsed, kind: k })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all",
                      parsed.kind === k
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {KIND_META[k].icon}
                    <span>{KIND_META[k].label}</span>
                  </button>
                ))}
              </div>

              {/* Title input */}
              <input
                value={parsed.title}
                onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
                className="w-full bg-transparent text-base font-semibold tracking-tight text-foreground outline-none border-b border-border/60 pb-1"
              />

              {/* Property pills */}
              <div className="flex flex-wrap items-center gap-2">
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setParsed({ ...parsed, priority: p })}
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[11px] uppercase font-medium transition-all border",
                      parsed.priority === p
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}

                <span className="mx-0.5 h-3.5 w-px bg-border/80" />

                <input
                  type="date"
                  value={parsed.dueDate ?? parsed.startAt?.slice(0, 10) ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    if (parsed.kind === "event")
                      setParsed({
                        ...parsed,
                        startAt: v ? v + "T" + (parsed.startAt?.slice(11) || "10:00") : null,
                      });
                    else setParsed({ ...parsed, dueDate: v });
                  }}
                  className="rounded border border-border/80 bg-card px-2 py-1 font-mono text-xs outline-none"
                />

                {parsed.kind === "event" && (
                  <input
                    type="time"
                    value={parsed.startAt?.slice(11, 16) ?? "10:00"}
                    onChange={(e) => {
                      const d =
                        parsed.startAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
                      setParsed({ ...parsed, startAt: `${d}T${e.target.value}`, endAt: null });
                    }}
                    className="rounded border border-border/80 bg-card px-2 py-1 font-mono text-xs outline-none"
                  />
                )}

                {parsed.kind !== "idea" && (projects.data?.length || clients.data?.length) ? (
                  <select
                    value={
                      parsed.projectId
                        ? `p:${parsed.projectId}`
                        : parsed.clientId
                        ? `c:${parsed.clientId}`
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith("p:"))
                        setParsed({ ...parsed, projectId: Number(v.slice(2)), clientId: null });
                      else if (v.startsWith("c:"))
                        setParsed({ ...parsed, clientId: Number(v.slice(2)), projectId: null });
                      else setParsed({ ...parsed, projectId: null, clientId: null });
                    }}
                    className="rounded border border-border/80 bg-card px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="">No link</option>
                    {projects.data?.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        Project: {p.name}
                      </option>
                    ))}
                    {clients.data?.map((c) => (
                      <option key={c.id} value={`c:${c.id}`}>
                        Client: {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {parsed.dueDate && parsed.kind === "task" && (
                    <Pill color="amber">Due {fmtDateTime(parsed.dueDate + "T18:00")}</Pill>
                  )}
                  {parsed.startAt && parsed.kind === "event" && (
                    <Pill color="magenta">{fmtDateTime(parsed.startAt)}</Pill>
                  )}
                </div>

                <button
                  onClick={commit}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-all hover:opacity-90 active:scale-95 shadow-sm"
                >
                  <Plus size={13} strokeWidth={2.2} />
                  <span>Commit to System</span>
                </button>
              </div>
            </div>
          )}

          {phase === "input" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                "Deliver wireframe specs tomorrow !urgent",
                "Client alignment sync Friday 2pm",
                "Idea: AI spatial audio engine",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
