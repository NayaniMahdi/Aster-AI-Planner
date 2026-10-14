import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { EmptyState } from "@/components/bits";
import { PageContainer, PageHeader } from "@/components/layout";
import { cn } from "@/lib/utils";
import { mdToHtml } from "@/lib/util";
import {
  Plus,
  X,
  Trash2,
  Lightbulb,
  Sparkles,
  Search,
  FolderPlus,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type Idea = {
  id: number;
  title: string;
  body: string | null;
  status: "seed" | "exploring" | "parked" | "shipped";
  aiExpansion: string | null;
  createdAt: Date;
};

const STATUS_META = {
  seed: { label: "Seed", dot: "bg-amber-500" },
  exploring: { label: "Exploring", dot: "bg-blue-500" },
  parked: { label: "Parked", dot: "bg-muted-foreground" },
  shipped: { label: "Shipped", dot: "bg-emerald-500" },
} as const;

export default function IdeasPage() {
  const utils = trpc.useUtils();
  const ideas = trpc.ideas.list.useQuery();
  const update = trpc.ideas.update.useMutation({
    onSuccess: () => utils.ideas.list.invalidate(),
  });
  const remove = trpc.ideas.remove.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      toast.success("Idea removed");
    },
  });
  const expand = trpc.ai.expandIdea.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      toast.success("Strategy expansion generated!");
    },
    onError: (err) => toast.error(err.message || "Failed to expand idea"),
  });
  const convertToProject = trpc.ideas.convertToProject.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      utils.projects.list.invalidate();
      utils.tasks.list.invalidate();
      toast.success("Idea converted to active project workspace!");
    },
  });
  const convertToTask = trpc.ideas.convertToTask.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      utils.tasks.list.invalidate();
      toast.success("Converted idea to active task!");
    },
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Idea | null>(null);

  const list = (ideas.data ?? []) as Idea[];

  const filtered = useMemo(() => {
    return list.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [list, statusFilter, searchQuery]);

  return (
    <PageContainer variant="contained" className="space-y-6">
      {/* ── Studio Header ── */}
      <PageHeader
        eyebrow="KNOWLEDGE VAULT & STRATEGIC INCUBATION"
        title="Idea Bank & Hypotheses"
        primaryAction={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>New Idea</span>
          </button>
        }
      />

      {/* ── Filter Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Segmented Stage Filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/30 p-1">
          {(["all", "seed", "exploring", "parked", "shipped"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                statusFilter === tab
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "all" ? `All (${list.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search idea bank by title or context…"
            className="h-8 w-full rounded-md border border-border/70 bg-card pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* ── Cards Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={24} strokeWidth={1.3} />}
          title="No Ideas Found"
          hint="Capture a rough insight or spark. You can then analyze strategy with AI."
          action={
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-all shadow-sm"
            >
              <Plus size={13} /> Capture Idea
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((idea, i) => {
            const meta = STATUS_META[idea.status];
            return (
              <div
                key={idea.id}
                onClick={() => setSelected(idea)}
                className="anim-rise group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-5 shadow-xs hover:border-border hover:shadow-sm transition-all cursor-pointer space-y-3 dark:border-white/[0.08] dark:hover:border-white/[0.14]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>

                    {idea.aiExpansion && (
                      <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-primary border border-primary/20 rounded px-1.5 py-0.5 bg-primary/5">
                        <Sparkles size={10} /> Strategy Ready
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground leading-snug group-hover:text-primary transition-colors">
                    {idea.title}
                  </h3>
                  {idea.body && (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground/80">
                      {idea.body}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {new Date(idea.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <span className="text-[11px] font-medium group-hover:text-foreground transition-colors flex items-center gap-0.5">
                    Review <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Idea Modal ── */}
      {creating && <CreateIdeaDialog onClose={() => setCreating(false)} />}

      {/* ── Idea Detail & Action Drawer ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setSelected(null)}
        >
          <div
            className="anim-rise flex h-full w-full max-w-xl flex-col border-l border-border/80 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  IDEA #{selected.id}
                </span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground border border-border/70 rounded px-1.5 py-0.5">
                  {STATUS_META[selected.status].label}
                </span>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">{selected.title}</h2>
                {selected.body && (
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {selected.body}
                  </p>
                )}
              </div>

              {/* Launch Actions Row */}
              <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
                <span className="label-eyebrow block">Incubate into Active Delivery</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    disabled={convertToProject.isPending}
                    onClick={async () => {
                      await convertToProject.mutateAsync({ ideaId: selected.id });
                      setSelected(null);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background shadow-sm disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
                  >
                    <FolderPlus size={13} />
                    <span>Convert to Project</span>
                  </button>
                  <button
                    disabled={convertToTask.isPending}
                    onClick={async () => {
                      await convertToTask.mutateAsync({ ideaId: selected.id });
                      setSelected(null);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-all active:scale-95"
                  >
                    <CheckSquare size={13} className="text-emerald-500" />
                    <span>Convert to Task</span>
                  </button>
                </div>
              </div>

              {/* Status Switcher */}
              <div>
                <label className="label-eyebrow mb-1.5 block">Incubation Stage</label>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-border/80 bg-secondary/30 p-1">
                  {(["seed", "exploring", "parked", "shipped"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        update.mutate({ id: selected.id, patch: { status: st } });
                        setSelected({ ...selected, status: st });
                      }}
                      className={cn(
                        "rounded-md py-1.5 text-xs font-medium text-center capitalize transition-all",
                        selected.status === st
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Strategy Expansion */}
              <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles size={14} className="text-primary" />
                    <span>Strategic AI Expansion</span>
                  </div>

                  <button
                    disabled={expand.isPending}
                    onClick={async () => {
                      const res = await expand.mutateAsync({ id: selected.id });
                      setSelected({ ...selected, aiExpansion: res.expansion });
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    <Sparkles size={12} className={expand.isPending ? "animate-spin" : ""} />
                    <span>
                      {expand.isPending
                        ? "Analyzing…"
                        : selected.aiExpansion
                        ? "Regenerate"
                        : "Expand Idea"}
                    </span>
                  </button>
                </div>

                {selected.aiExpansion ? (
                  <div
                    className="rich-text rounded-lg border border-border/70 bg-card p-4 text-xs leading-relaxed text-foreground"
                    dangerouslySetInnerHTML={{ __html: mdToHtml(selected.aiExpansion) }}
                  />
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Deep dives into commercial angles, technical architecture requirements, and milestone execution roadmaps.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/70 p-4">
              <button
                onClick={() => {
                  remove.mutate({ id: selected.id });
                  setSelected(null);
                }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete Idea</span>
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function CreateIdeaDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.ideas.create.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      toast.success("Idea captured!");
      onClose();
    },
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"seed" | "exploring">("seed");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="anim-rise w-full max-w-md rounded-xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 dark:border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Capture Idea Spark
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="label-eyebrow mb-1 block">Title</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Real-time collaboration canvas for architectural models"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Context & Hypothesis</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What sparked this insight? What is the core problem and differentiation?"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 p-2.5 text-xs leading-relaxed outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1.5 block">Initial Stage</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus("seed")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  status === "seed"
                    ? "bg-foreground text-background font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Seed
              </button>
              <button
                type="button"
                onClick={() => setStatus("exploring")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all",
                  status === "exploring"
                    ? "bg-foreground text-background font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Exploring
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!title.trim()) {
                toast.error("Please provide an idea title");
                return;
              }
              await create.mutateAsync({
                title: title.trim(),
                body: body.trim() || undefined,
                status,
              });
            }}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Save Idea
          </button>
        </div>
      </div>
    </div>
  );
}
