import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { mdToHtml, parseActions } from "@/lib/util";
import { cn } from "@/lib/utils";
import { AsterMark, AsterChatMark } from "./AsterLogo";
import {
  ArrowUp,
  RotateCcw,
  AlertTriangle,
  CalendarDays,
  UserPlus,
  FolderPlus,
  Lightbulb,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  Mail,
} from "lucide-react";

const QUICK_PROMPTS = [
  {
    icon: <CalendarDays size={16} className="text-slate-800" />,
    title: "Plan my schedule",
    desc: "Analyze my tasks, meetings, and upcoming deadlines for today",
    prompt: "What are my priorities today and how should I sequence my schedule?",
  },
  {
    icon: <Mail size={16} className="text-slate-800" />,
    title: "Check inbox & emails",
    desc: "Review live Gmail inbox and draft or send email responses with full rights",
    prompt: "Check my recent inbox emails and tell me what needs attention.",
  },
  {
    icon: <UserPlus size={16} className="text-slate-800" />,
    title: "Add a new client",
    desc: "Create a client profile with deal value, stage, and contact info",
    prompt: "Add a new client: Nexus Capital with $45,000 deal value as lead",
  },
  {
    icon: <FolderPlus size={16} className="text-slate-800" />,
    title: "Create a project",
    desc: "Set up a new project with initial milestone deliverables",
    prompt: "Create project: Mobile App Redesign with 3 initial deliverable tasks",
  },
  {
    icon: <Lightbulb size={16} className="text-slate-800" />,
    title: "Review notes & ideas",
    desc: "Synthesize notes and recommend the next high-leverage initiative",
    prompt: "Review my workspace notes and recommend the most actionable next step",
  },
];

const MINI_SUGGESTIONS = [
  "What should I focus on next?",
  "Add task: Review Q3 financials tomorrow",
  "Plan my morning schedule",
  "Show my active clients",
];

export function CopilotChat({
  fullPage = false,
  compact = false,
  onOpenSettings,
  onClearHistory,
}: {
  fullPage?: boolean;
  compact?: boolean;
  onOpenSettings?: () => void;
  onClearHistory?: () => void;
}) {
  const [input, setInput] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const [liveReply, setLiveReply] = useState<{
    text: string;
    isStreaming: boolean;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userScrolledUpRef = useRef(false);

  const utils = trpc.useUtils();
  const historyQuery = trpc.ai.history.useQuery(undefined, {
    refetchInterval: false,
  });

  const chat = trpc.ai.chat.useMutation();

  const messages = historyQuery.data ?? [];

  // Reliable instant bottom pinning
  const pinToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  // Keep pinned to bottom on message update, prompt send, or streaming text
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      pinToBottom();
    }
  }, [messages.length, liveReply?.text, pendingPrompt]);

  // Handle wheel input to detect deliberate user scroll-up
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    if (e.deltaY < -3) {
      userScrolledUpRef.current = true;
    } else if (e.deltaY > 3) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight - scrollTop - clientHeight < 50) {
        userScrolledUpRef.current = false;
      }
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      userScrolledUpRef.current = false;
    }
  };

  const send = async (explicitText?: string) => {
    const msg = (explicitText ?? input).trim();
    if (!msg || chat.isPending) return;

    userScrolledUpRef.current = false;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);
    setLastMsg(msg);
    setPendingPrompt(msg);

    // Pin immediately so user's message is in view
    setTimeout(pinToBottom, 10);

    try {
      const res = await chat.mutateAsync({ message: msg });
      const rawReply = res.reply;
      const parsed = parseActions(rawReply);
      const clean = parsed.clean;

      // Invalidate relevant queries when actions were executed
      const executed = res.executedCount ?? parsed.actions.length;
      if (executed > 0) {
        await Promise.all([
          utils.tasks.list.invalidate(),
          utils.tasks.overview.invalidate(),
          utils.clients.list.invalidate(),
          utils.projects.list.invalidate(),
          utils.events.list.invalidate(),
          utils.ideas.list.invalidate(),
          utils.study.list.invalidate(),
          utils.focus.stats.invalidate(),
        ]);
      }

      // Smooth simulated typing stream with active pinning
      if (timerRef.current) clearInterval(timerRef.current);
      let i = 0;
      const step = Math.max(6, Math.ceil(clean.length / 32));
      setLiveReply({ text: "", isStreaming: true });

      timerRef.current = setInterval(() => {
        i += step;
        if (i >= clean.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setLiveReply(null);
          setPendingPrompt(null);
          utils.ai.history.invalidate();
          if (!userScrolledUpRef.current) {
            pinToBottom();
          }
        } else {
          setLiveReply({ text: clean.slice(0, i), isStreaming: true });
          if (!userScrolledUpRef.current) {
            pinToBottom();
          }
        }
      }, 16);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setPendingPrompt(null);
      setLiveReply(null);
      setError(err as Error);
      utils.ai.history.invalidate();
      if (!userScrolledUpRef.current) {
        pinToBottom();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, fullPage ? 180 : 120)}px`;
  };

  const isEmpty = messages.length === 0 && !pendingPrompt && !liveReply;

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col bg-background", fullPage ? "w-full" : "")}>
      {/* ── Scrollable Chat Messages Canvas ── */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onScroll={handleScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          fullPage ? "px-6 md:px-12 py-8" : "px-4 sm:px-5 py-5",
          compact && "px-3.5 py-4"
        )}
      >
        <div className={cn(fullPage ? "mx-auto max-w-3xl space-y-6" : "space-y-4 w-full min-w-0")}>
          {/* Empty State */}
          {isEmpty && (
            <div className={cn("flex flex-col items-center justify-center text-center", fullPage ? "min-h-[55vh] py-8" : "py-8")}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
                <AsterChatMark size={24} className="text-background" />
              </div>

              <div className="mt-4 space-y-1">
                <h2 className="text-lg sm:text-xl font-bold font-display text-foreground tracking-tight">
                  How can I assist you today?
                </h2>
                <p className="mx-auto max-w-md text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
                  Ask questions, organize your day, or direct immediate changes to tasks, projects, clients, and calendar.
                </p>
              </div>

              {/* Suggestions */}
              {fullPage ? (
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                  {QUICK_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => send(item.prompt)}
                      className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:border-border hover:bg-secondary/40 hover:shadow-xs active:scale-[0.99] cursor-pointer shadow-2xs dark:border-white/[0.08]"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                            {item.icon}
                          </span>
                          <ArrowRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <h4 className="mt-3 text-[13.5px] font-semibold text-foreground">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex max-w-sm flex-wrap items-center justify-center gap-1.5">
                  {MINI_SUGGESTIONS.slice(0, compact ? 2 : 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => (s.endsWith(" ") ? setInput(s) : send(s))}
                      className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary hover:text-foreground shadow-2xs cursor-pointer active:scale-[0.98] dark:border-white/[0.08]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Existing History Messages */}
          {messages.map((m) => {
            const { clean } = m.role === "assistant" ? parseActions(m.content) : { clean: m.content };
            return (
              <Bubble
                key={m.id}
                role={m.role}
                rawText={m.role === "user" ? clean : undefined}
                html={m.role === "assistant" ? mdToHtml(clean) : undefined}
                fullPage={fullPage}
              />
            );
          })}

          {/* Optimistic Pending User Bubble */}
          {pendingPrompt && (
            <Bubble
              role="user"
              rawText={pendingPrompt}
              fullPage={fullPage}
              isOptimistic
            />
          )}

          {/* Alive Animated Thinking State */}
          {pendingPrompt && !liveReply && (
            <ThinkingIndicator />
          )}

          {/* Live Streaming Reply Bubble */}
          {liveReply && (
            <Bubble
              role="assistant"
              html={mdToHtml(liveReply.text)}
              live={liveReply.isStreaming}
              fullPage={fullPage}
            />
          )}

          {/* Error Diagnostic */}
          {error && <AiErrorCard error={error} onRetry={() => send(lastMsg)} />}
        </div>
      </div>

      {/* ── Docked Command Input Box ── */}
      <div className={cn("shrink-0 border-t border-border/80 bg-card", fullPage ? "px-6 pb-6 pt-3.5" : "p-3 sm:p-4")}>
        <div className={cn(fullPage ? "mx-auto max-w-3xl" : "w-full")}>
          <div className="relative flex flex-col rounded-2xl border border-border/80 bg-secondary/30 p-2.5 focus-within:bg-card focus-within:border-border focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-2xs">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask questions or direct changes (tasks, clients, projects, events)..."
              rows={1}
              className="max-h-40 min-h-[38px] w-full resize-none bg-transparent px-2.5 py-1 text-xs md:text-sm outline-none placeholder:text-muted-foreground leading-relaxed text-foreground"
            />

            <div className="mt-1 flex items-center justify-between pt-1.5 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-normal pl-1 hidden sm:inline">
                  Return to send · Shift + Return for new line
                </span>
                {onClearHistory && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                    title="Start fresh conversation"
                  >
                    <RotateCcw size={11} />
                    <span>New Thread</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                    title="AI Settings & Model Selection"
                  >
                    <SlidersHorizontal size={11} />
                    <span>Settings</span>
                  </button>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!input.trim() || chat.isPending}
                  className={cn(
                    "flex h-7.5 w-7.5 items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95",
                    input.trim()
                      ? "bg-foreground text-background shadow-xs hover:opacity-90"
                      : "bg-secondary text-muted-foreground/50 cursor-not-allowed"
                  )}
                  aria-label="Send message"
                >
                  <ArrowUp size={14} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Alive, dynamic thinking indicator with animated equalizer frequency bars,
 * pulsing Aster emblem, and shimmering status typography.
 */
function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 w-full max-w-[85%] anim-rise py-1">
      {/* Aster Emblem with glowing pulse ring */}
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
        <AsterChatMark size={16} className="text-background" />
        <span className="absolute -inset-1 rounded-2xl border border-primary/20 animate-ping opacity-25 pointer-events-none" />
      </div>

      {/* Alive Thinking Card */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-2xs dark:border-white/[0.08]">
        {/* Animated soundwave / neural frequency wave bars */}
        <div className="flex items-end gap-1 h-4">
          <span className="w-1 rounded-full bg-foreground anim-wave-1 h-3.5" />
          <span className="w-1 rounded-full bg-foreground/80 anim-wave-2 h-4.5" />
          <span className="w-1 rounded-full bg-foreground anim-wave-3 h-2.5" />
          <span className="w-1 rounded-full bg-foreground/60 anim-wave-4 h-4" />
        </div>

        {/* Shimmering status text */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium anim-shimmer text-foreground">
            Thinking and synthesizing
          </span>
          <span className="flex items-center gap-0.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  rawText,
  html,
  live,
  fullPage,
  isOptimistic,
}: {
  role: "user" | "assistant";
  rawText?: string;
  html?: string;
  live?: boolean;
  fullPage?: boolean;
  isOptimistic?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end w-full pl-10 pr-3 sm:pr-4 anim-rise">
        <div
          className={cn(
            "max-w-[80%] rounded-2xl rounded-tr-xs bg-foreground text-background px-5 py-3 text-[13.5px] leading-relaxed shadow-xs break-words whitespace-pre-wrap font-sans",
            isOptimistic && "opacity-90"
          )}
        >
          {rawText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 w-full min-w-0 pl-1 pr-3 sm:pr-4 anim-rise">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
        <AsterChatMark size={16} className="text-background" />
      </div>

      <div className="flex-1 min-w-0 max-w-[90%] sm:max-w-[85%]">
        <div className="flex items-center gap-2 mb-1.5 pl-0.5">
          <span className="text-[12px] font-semibold text-foreground tracking-tight">
            Aster
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Assistant
          </span>
        </div>

        <div
          className="rich-text text-[13.5px] text-foreground leading-relaxed font-sans rounded-2xl border border-border/80 bg-card p-5 shadow-2xs break-words dark:border-white/[0.08]"
          dangerouslySetInnerHTML={{ __html: html ?? "" }}
        />
        {live && (
          <span className="inline-block h-3.5 w-1 rounded-full bg-foreground animate-pulse ml-1 align-middle" />
        )}
      </div>
    </div>
  );
}

export function AiErrorCard({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-2xs anim-rise">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
      <div className="flex-1">
        <p className="text-xs font-semibold text-rose-900">
          Unable to complete request
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
          {error.message || "Something went wrong while processing your request. Please try again."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-50 cursor-pointer shadow-2xs active:scale-95"
          >
            <RotateCcw size={11} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
