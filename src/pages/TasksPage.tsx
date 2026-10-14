import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { PriorityBar, RadarCheck, Checkbox } from "@/components/bits";
import { cn } from "@/lib/utils";
import { relDay, dueTone, sig } from "@/lib/util";
import { toast } from "sonner";
import {
  Inbox,
  ListTodo,
  CalendarClock,
  CheckCheck,
  Plus,
  Trash2,
  X,
  Play,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  CheckSquare,
} from "lucide-react";
import { FocusTimerModal } from "@/components/FocusTimerModal";
import { PageContainer, PageHeader } from "@/components/layout";

type Task = {
  id: number;
  title: string;
  notes: string | null;
  status: "inbox" | "next" | "scheduled" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  energy: "low" | "medium" | "high";
  dueDate: Date | null;
  projectId: number | null;
  clientId: number | null;
  estimateMin: number | null;
  tags: string;
  checklist?: string | null;
  completedAt: Date | null;
};

const COLUMNS = [
  { key: "next", label: "To Do", color: "cyan", icon: ListTodo, hint: "Active sprint priorities" },
  { key: "inbox", label: "Inbox", color: "blue", icon: Inbox, hint: "Backlog & captured items" },
  { key: "scheduled", label: "Scheduled", color: "magenta", icon: CalendarClock, hint: "Anchored to timeline" },
  { key: "done", label: "Resolved", color: "mint", icon: CheckCheck, hint: "Shipped & closed" },
] as const;

export default function TasksPage() {
  const utils = trpc.useUtils();
  const tasksQuery = trpc.tasks.list.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();

  const update = trpc.tasks.update.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]),
  });

  const remove = trpc.tasks.remove.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]),
  });

  const create = trpc.tasks.create.useMutation({
    onSuccess: () =>
      Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]),
  });

  const batchUpdate = trpc.tasks.batchUpdate.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]);
      toast.success("Batch updated successfully");
    },
  });

  const batchDelete = trpc.tasks.batchDelete.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      Promise.all([
        utils.tasks.list.invalidate(),
        utils.tasks.overview.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]);
      toast.success("Selected tasks deleted");
    },
  });

  const aiBreakdown = trpc.tasks.breakdown.useMutation({
    onSuccess: (res) => {
      utils.tasks.list.invalidate();
      toast.success(`Generated ${res.checklist.length} actionable subtasks`);
    },
    onError: (err) => toast.error(err.message || "Failed to break down task"),
  });

  // Default view is high-density Linear-style List view per V2 spec
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [energyFilter, setEnergyFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Collapsed sections in list view
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    done: false,
  });

  const [editing, setEditing] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [newChecklistText, setNewChecklistText] = useState("");

  const allProjects = projectsQuery.data ?? [];
  const allClients = clientsQuery.data ?? [];
  const allTasks = (tasksQuery.data ?? []) as Task[];

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q);
        const matchesTags = t.tags?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesTags) return false;
      }
      if (energyFilter && t.energy !== energyFilter && t.status !== "done") return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (projectFilter !== null && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [allTasks, statusFilter, searchQuery, energyFilter, priorityFilter, projectFilter]);

  const hasActiveFilters = Boolean(
    statusFilter || projectFilter !== null || priorityFilter || energyFilter || searchQuery.trim()
  );

  const byStatus = useMemo(() => {
    return {
      next: filteredTasks.filter((t) => t.status === "next"),
      inbox: filteredTasks.filter((t) => t.status === "inbox"),
      scheduled: filteredTasks
        .filter((t) => t.status === "scheduled")
        .sort(
          (a, b) =>
            (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
            (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
        ),
      done: filteredTasks.filter((t) => t.status === "done").slice(0, 40),
    };
  }, [filteredTasks]);

  const activeCount = useMemo(() => allTasks.filter((t) => t.status !== "done").length, [allTasks]);
  const doneCount = useMemo(() => allTasks.filter((t) => t.status === "done").length, [allTasks]);

  const move = (t: Task, dir: 1 | -1) => {
    const order = ["inbox", "next", "scheduled", "done"] as const;
    const i = order.indexOf(t.status);
    const to = order[Math.max(0, Math.min(3, i + dir))];
    if (to === t.status) return;
    update.mutate({ id: t.id, patch: { status: to } });
    if (to === "done") toast.success("Task resolved");
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const allVisibleSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));
  const someVisibleSelected =
    filteredTasks.some((t) => selectedIds.has(t.id)) && !allVisibleSelected;

  const handleQuickAdd = async (status: Task["status"]) => {
    if (!newTitle.trim()) return;
    await create.mutateAsync({
      title: newTitle.trim(),
      status,
      priority: "medium",
      energy: "medium",
      projectId: projectFilter || undefined,
    });
    setNewTitle("");
    setAddingColumn(null);
    toast.success("Task created");
  };

  const activeChecklist: Array<{ id: string; text: string; done: boolean }> = useMemo(() => {
    if (!editing?.checklist) return [];
    try {
      return JSON.parse(editing.checklist);
    } catch {
      return [];
    }
  }, [editing?.checklist]);

  const handleToggleCheckItem = (itemId: string) => {
    if (!editing) return;
    const updated = activeChecklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    const serialized = JSON.stringify(updated);
    setEditing({ ...editing, checklist: serialized });
    update.mutate({ id: editing.id, patch: { checklist: serialized } });
  };

  const handleAddCheckItem = () => {
    if (!editing || !newChecklistText.trim()) return;
    const updated = [
      ...activeChecklist,
      { id: `${Date.now()}`, text: newChecklistText.trim(), done: false },
    ];
    const serialized = JSON.stringify(updated);
    setEditing({ ...editing, checklist: serialized });
    update.mutate({ id: editing.id, patch: { checklist: serialized } });
    setNewChecklistText("");
  };

  const handleDeleteCheckItem = (itemId: string) => {
    if (!editing) return;
    const updated = activeChecklist.filter((c) => c.id !== itemId);
    const serialized = JSON.stringify(updated);
    setEditing({ ...editing, checklist: serialized });
    update.mutate({ id: editing.id, patch: { checklist: serialized } });
  };

  return (
    <PageContainer variant="contained">
      {/* ── Page Header & Top Toolbar ── */}
      <PageHeader
        eyebrow="HIGH-VELOCITY EXECUTION BOARD"
        title="Tasks & Deliverables"
        description="Unified execution queue, milestone deliverables, and delivery ledger"
        badge={
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card px-3.5 py-1 text-xs font-sans tracking-tight shadow-2xs">
            <span className="font-semibold text-foreground tabular-nums">{activeCount}</span>
            <span className="text-muted-foreground font-medium text-[11.5px]">active</span>
            <span className="text-border">·</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{doneCount}</span>
            <span className="text-muted-foreground font-medium text-[11.5px]">shipped</span>
          </div>
        }
        actions={
          <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all cursor-pointer",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Table list view"
            >
              <List size={13} strokeWidth={2} />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all cursor-pointer",
                viewMode === "board"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Kanban board view"
            >
              <LayoutGrid size={13} strokeWidth={2} />
              <span>Board</span>
            </button>
          </div>
        }
        primaryAction={
          <button
            type="button"
            onClick={() => {
              setEditing({
                id: 0,
                title: "",
                notes: "",
                status: "next",
                priority: "medium",
                energy: "medium",
                dueDate: null,
                projectId: projectFilter || null,
                clientId: null,
                estimateMin: 30,
                tags: "",
                completedAt: null,
              });
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>New Task</span>
          </button>
        }
      />

        {/* ── Modern Filter Toolbar Card ── */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks by title, tags, or notes…"
              className="h-9 w-full rounded-xl border border-border/80 bg-secondary/30 pl-10 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all focus:bg-card focus:border-border"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Quick Filter */}
          <select
            value={statusFilter ?? ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="h-9 rounded-xl border border-border/80 bg-secondary/30 px-3 text-xs text-foreground font-medium outline-none cursor-pointer focus:bg-card focus:border-border transition-all"
          >
            <option value="">All Statuses</option>
            <option value="next">To Do</option>
            <option value="inbox">Inbox</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Resolved</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter ?? ""}
            onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-xl border border-border/80 bg-secondary/30 px-3 text-xs text-foreground font-medium outline-none cursor-pointer focus:bg-card focus:border-border transition-all"
          >
            <option value="">All Projects</option>
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter ?? ""}
            onChange={(e) => setPriorityFilter(e.target.value || null)}
            className="h-9 rounded-xl border border-border/80 bg-secondary/30 px-3 text-xs text-foreground font-medium outline-none cursor-pointer focus:bg-card focus:border-border transition-all"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Energy Filter */}
          <div className="hidden sm:flex items-center rounded-xl border border-border/80 bg-secondary/30 p-0.5">
            {[null, "low", "medium", "high"].map((e) => (
              <button
                type="button"
                key={String(e)}
                onClick={() => setEnergyFilter(e)}
                className={cn(
                  "h-7 rounded-lg px-2.5 text-[11px] font-medium transition-all cursor-pointer",
                  energyFilter === e
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {e === null ? "Any Energy" : e === "high" ? "Deep Work" : e.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

      {/* ── Floating Batch Action Pill ── */}
      {selectedIds.size > 0 && (
        <div className="anim-rise sticky top-3 z-30 mb-4 flex items-center justify-between rounded-xl border border-border/90 bg-card/95 px-4 py-2 shadow-xl backdrop-blur-xl dark:border-white/[0.12]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground font-mono text-[10px] font-bold text-background">
              {selectedIds.size}
            </span>
            <span className="text-xs font-medium text-foreground">items selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                batchUpdate.mutate({ ids: Array.from(selectedIds), patch: { status: "done" } })
              }
              className="flex h-7 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white transition-all hover:bg-emerald-500 active:scale-95 shadow-xs"
            >
              <CheckCheck size={12} />
              <span>Mark Resolved</span>
            </button>
            <button
              type="button"
              onClick={() =>
                batchUpdate.mutate({ ids: Array.from(selectedIds), patch: { status: "next" } })
              }
              className="flex h-7 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-medium text-foreground transition-all hover:bg-secondary/80 active:scale-95"
            >
              <span>Move to To Do</span>
            </button>
            <button
              type="button"
              onClick={() => batchDelete.mutate({ ids: Array.from(selectedIds) })}
              className="flex h-7 items-center gap-1.5 rounded-md bg-rose-500/10 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Clear selection"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Viewport ── */}
      {viewMode === "list" ? (
        /* ── Linear-Style Issue Table Ledger (Primary) ── */
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border/80 bg-card shadow-xs">
          {/* Table Header Row */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-secondary/35 px-4 py-2.5 text-[11px] font-mono font-semibold text-muted-foreground backdrop-blur-xs">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex items-center justify-center w-5">
                <Checkbox
                  checked={allVisibleSelected}
                  onChange={handleSelectAll}
                  className={cn(someVisibleSelected && "opacity-70")}
                />
              </div>
              <span className="w-8 shrink-0 text-center">Status</span>
              <span className="w-12 shrink-0 font-mono">ID</span>
              <span className="min-w-0 flex-1">Title & Deliverable Scope</span>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-right pr-2">
              <span className="hidden md:inline-block w-28 text-left">Project</span>
              <span className="w-16 text-center">Priority</span>
              <span className="hidden sm:inline-block w-24 text-right font-mono">Due Date</span>
              <span className="w-14 text-right">Actions</span>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <ListTodo size={22} />
              </div>
              <p className="mt-3 text-sm font-bold text-foreground">No tasks found</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                {hasActiveFilters
                  ? "No tasks match your current search and filter criteria."
                  : "Your execution queue is clear. Create a new task to get started."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {COLUMNS.map((col) => {
                const list = byStatus[col.key];
                if (list.length === 0) return null;
                const isCollapsed = Boolean(collapsedSections[col.key]);

                return (
                  <div key={col.key} className="space-y-0">
                    {/* Collapsible Section Header Row */}
                    <div
                      onClick={() =>
                        setCollapsedSections((prev) => ({ ...prev, [col.key]: !prev[col.key] }))
                      }
                      className="group flex items-center justify-between border-b border-border/50 bg-secondary/20 px-4 py-2 cursor-pointer hover:bg-secondary/35 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight size={13} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={13} className="text-muted-foreground" />
                        )}
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: sig(col.color) }}
                        />
                        <span className="text-xs font-bold tracking-tight text-foreground">
                          {col.label}
                        </span>
                        <span className="rounded-full bg-secondary/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-muted-foreground tabular-nums">
                          {list.length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingColumn(col.key);
                          setNewTitle("");
                        }}
                        className="opacity-0 group-hover:opacity-100 flex h-6 items-center gap-1 rounded-lg px-2 text-[10.5px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition-all shadow-2xs"
                        title={`Add task to ${col.label}`}
                      >
                        <Plus size={11} strokeWidth={2.5} />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Inline Quick Add inside section if active */}
                    {addingColumn === col.key && (
                      <div className="flex items-center gap-2 border-b border-border/60 bg-secondary/20 p-3 px-4">
                        <input
                          type="text"
                          autoFocus
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleQuickAdd(col.key as Task["status"]);
                            if (e.key === "Escape") setAddingColumn(null);
                          }}
                          placeholder={`Add issue to ${col.label}… (Enter to save, Esc to cancel)`}
                          className="h-8 flex-1 rounded-xl border border-border/80 bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(col.key as Task["status"])}
                          className="h-8 rounded-xl bg-foreground px-3 text-[11.5px] font-semibold text-background hover:opacity-90 transition-all shadow-2xs cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingColumn(null)}
                          className="h-8 rounded-xl px-2.5 text-[11.5px] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Rows */}
                    {!isCollapsed && (
                      <div className="divide-y divide-border/40">
                        {list.map((task) => {
                          const isDone = task.status === "done";
                          const isSelected = selectedIds.has(task.id);
                          const project = allProjects.find((p) => p.id === task.projectId);

                          // Checklist counter
                          let checklistMeta: { total: number; done: number } | null = null;
                          if (task.checklist) {
                            try {
                              const items = JSON.parse(task.checklist);
                              checklistMeta = {
                                total: items.length,
                                done: items.filter((i: { done: boolean }) => i.done).length,
                              };
                            } catch {
                              checklistMeta = null;
                            }
                          }

                          return (
                            <div
                              key={task.id}
                              onClick={() => setEditing(task)}
                              className={cn(
                                "group flex items-center justify-between gap-3 px-4 py-3 text-xs transition-colors cursor-pointer",
                                isSelected ? "bg-secondary/40" : "hover:bg-secondary/20",
                                isDone && "opacity-60"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Batch selection checkbox */}
                                <div
                                  className="flex items-center justify-center w-5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleToggleSelect(task.id)}
                                    className={cn(
                                      !isSelected &&
                                        "opacity-0 group-hover:opacity-100 transition-opacity"
                                    )}
                                  />
                                </div>

                                {/* Tactile completion circle */}
                                <div
                                  className="flex items-center justify-center w-8 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <RadarCheck
                                    checked={isDone}
                                    onChange={() =>
                                      update.mutate({
                                        id: task.id,
                                        patch: { status: isDone ? "next" : "done" },
                                      })
                                    }
                                    size={16}
                                  />
                                </div>

                                {/* Task ID */}
                                <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground/75">
                                  #{task.id}
                                </span>

                                {/* Title, Subtasks, Notes */}
                                <div className="min-w-0 flex-1 flex items-center gap-2 truncate">
                                  <span
                                    className={cn(
                                      "font-semibold tracking-tight truncate text-[13px]",
                                      isDone ? "line-through text-muted-foreground" : "text-foreground"
                                    )}
                                  >
                                    {task.title}
                                  </span>

                                  {checklistMeta && checklistMeta.total > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary border border-border/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                                      <CheckSquare size={10} />
                                      <span>
                                        {checklistMeta.done}/{checklistMeta.total}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Columns: Project, Priority, Due Date, Focus Actions */}
                              <div className="flex items-center gap-4 shrink-0 text-right pr-2">
                                <div className="hidden md:block w-28 text-left truncate">
                                  {project ? (
                                    <span className="inline-block truncate rounded-md border border-border/80 bg-secondary/50 px-2 py-0.5 text-[10.5px] font-mono font-medium text-muted-foreground max-w-full">
                                      {project.name}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/40 font-mono">—</span>
                                  )}
                                </div>

                                <div className="w-16 flex items-center justify-center">
                                  <PriorityBar priority={task.priority} showLabel={false} />
                                </div>

                                <div className="hidden sm:block w-24 text-right font-mono text-[11px] tabular-nums">
                                  {task.dueDate ? (
                                    <span
                                      className={cn(
                                        dueTone(task.dueDate) === "red"
                                          ? "text-rose-500 font-semibold"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {relDay(task.dueDate)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/40 font-mono">—</span>
                                  )}
                                </div>

                                <div className="w-14 flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFocusTask(task);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex h-6.5 items-center gap-1 rounded-lg border border-border/80 bg-card px-2 text-[10px] font-semibold text-foreground hover:bg-foreground hover:text-background transition-all shadow-2xs"
                                    title="Start focus chamber with this task"
                                  >
                                    <Play size={9} className="fill-current text-sky-500" />
                                    <span>Focus</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : (
        /* ── Kanban Board View ── */
        <div className="grid min-h-0 flex-1 snap-x snap-mandatory auto-cols-[84vw] grid-flow-col gap-4 overflow-x-auto pb-4 sm:auto-cols-[300px] xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-4 xl:overflow-x-visible">
          {COLUMNS.map((col) => {
            const list = byStatus[col.key];
            return (
              <div
                key={col.key}
                className="flex snap-center flex-col overflow-hidden rounded-2xl border border-border/70 bg-secondary/20 p-3 space-y-2.5"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1.5 py-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: sig(col.color) }}
                    />
                    <span className="text-xs font-bold tracking-tight text-foreground">
                      {col.label}
                    </span>
                    <span className="rounded-full bg-secondary/80 px-2 py-0.2 font-mono text-[10.5px] font-bold text-muted-foreground shadow-2xs tabular-nums">
                      {list.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAddingColumn(col.key);
                      setNewTitle("");
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground transition-colors shadow-2xs"
                    title={`Add task to ${col.label}`}
                  >
                    <Plus size={13} strokeWidth={2.2} />
                  </button>
                </div>

                {/* Inline Quick Add Input */}
                {addingColumn === col.key && (
                  <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-xs space-y-2">
                    <input
                      type="text"
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleQuickAdd(col.key as Task["status"]);
                        if (e.key === "Escape") setAddingColumn(null);
                      }}
                      placeholder="Issue summary…"
                      className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border focus:bg-card"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddingColumn(null)}
                        className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(col.key as Task["status"])}
                        className="rounded-lg bg-foreground px-3 py-1 text-[11px] font-semibold text-background hover:opacity-90 transition-opacity"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards Container */}
                <div className="flex-1 space-y-2.5 overflow-y-auto p-0.5">
                  {list.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <col.icon size={22} strokeWidth={1.4} />
                      <p className="mt-1 text-[11px] font-medium">{col.hint}</p>
                    </div>
                  )}

                  {list.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedIds.has(task.id)}
                      onToggleSelect={() => handleToggleSelect(task.id)}
                      onCompleteToggle={() =>
                        update.mutate({
                          id: task.id,
                          patch: { status: task.status === "done" ? "next" : "done" },
                        })
                      }
                      onClick={() => setEditing(task)}
                      onMove={(dir) => move(task, dir)}
                      onFocus={() => setFocusTask(task)}
                      allProjects={allProjects}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Task Detail Inspector (Slide-over Drawer) ── */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setEditing(null)}
        >
          <div
            className="anim-rise flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Topbar */}
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {editing.id > 0 ? `TASK #${editing.id}` : "NEW TASK"}
                </span>
                <PriorityBar priority={editing.priority} showLabel />
              </div>

              <div className="flex items-center gap-2">
                {editing.id > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFocusTask(editing);
                      setEditing(null);
                    }}
                    className="flex h-7 items-center gap-1.5 rounded-md bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Play size={10} className="fill-current" />
                    <span>Focus HUD</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title input */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Title
                </label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="What needs to be delivered?"
                  className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3.5 py-2.5 text-base font-semibold tracking-tight text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Properties Grid: Status, Priority, Energy */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Status
                  </label>
                  <select
                    value={editing.status}
                    onChange={(e) =>
                      setEditing({ ...editing, status: e.target.value as Task["status"] })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="next">To Do</option>
                    <option value="inbox">Inbox</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="done">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Priority
                  </label>
                  <select
                    value={editing.priority}
                    onChange={(e) =>
                      setEditing({ ...editing, priority: e.target.value as Task["priority"] })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Energy
                  </label>
                  <select
                    value={editing.energy}
                    onChange={(e) =>
                      setEditing({ ...editing, energy: e.target.value as Task["energy"] })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="high">High (Deep)</option>
                    <option value="medium">Standard</option>
                    <option value="low">Light</option>
                  </select>
                </div>
              </div>

              {/* Project & Client */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Workspace Project
                  </label>
                  <select
                    value={editing.projectId ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        projectId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">No Project</option>
                    {allProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Associated Client
                  </label>
                  <select
                    value={editing.clientId ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        clientId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">No Client</option>
                    {allClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date & Estimate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <CalendarIcon size={11} />
                    <span>Due Date</span>
                  </label>
                  <input
                    type="date"
                    value={
                      editing.dueDate
                        ? new Date(editing.dueDate).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setEditing({ ...editing, dueDate: null });
                      } else {
                        const [y, m, d] = val.split("-").map(Number);
                        setEditing({ ...editing, dueDate: new Date(y, m - 1, d, 12, 0, 0) });
                      }
                    }}
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Clock size={11} />
                    <span>Estimate (Mins)</span>
                  </label>
                  <select
                    value={editing.estimateMin ?? 30}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        estimateMin: Number(e.target.value) || null,
                      })
                    }
                    className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="15">15 min (Quick sprint)</option>
                    <option value="30">30 min (Standard)</option>
                    <option value="45">45 min (Block)</option>
                    <option value="60">60 min (Deep Session)</option>
                    <option value="90">90 min (Extended)</option>
                    <option value="120">120 min (Flow)</option>
                  </select>
                </div>
              </div>

              {/* Notes Context */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Notes & Context
                </label>
                <textarea
                  rows={4}
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Specifications, links, or execution notes…"
                  className="w-full rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs leading-relaxed text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Interactive Subtask Checklist with AI Breakdown */}
              <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-tight text-foreground">
                      Subtasks Checklist
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {activeChecklist.filter((c) => c.done).length}/{activeChecklist.length}
                    </span>
                  </div>

                  {editing.id > 0 && (
                    <button
                      type="button"
                      disabled={aiBreakdown.isPending}
                      onClick={async () => {
                        const res = await aiBreakdown.mutateAsync({ taskId: editing.id });
                        setEditing({ ...editing, checklist: JSON.stringify(res.checklist) });
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-all hover:opacity-90 active:scale-95"
                    >
                      <Sparkles size={11} className={aiBreakdown.isPending ? "animate-spin" : ""} />
                      <span>{aiBreakdown.isPending ? "Analyzing Task…" : "AI Breakdown"}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {activeChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between gap-2.5 rounded-lg border border-border/70 bg-card p-2 text-xs transition-colors hover:border-border"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCheckItem(item.id)}
                        className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                      >
                        <RadarCheck
                          checked={item.done}
                          onChange={() => handleToggleCheckItem(item.id)}
                          size={14}
                        />
                        <span
                          className={cn(
                            "truncate transition-colors",
                            item.done && "line-through text-muted-foreground/60"
                          )}
                        >
                          {item.text}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCheckItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCheckItem();
                      }
                    }}
                    placeholder="Add actionable step…"
                    className="h-8 flex-1 rounded-md border border-border/70 bg-card px-2.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddCheckItem}
                    className="flex h-8 items-center gap-1 rounded-md bg-secondary px-3 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inspector Footer */}
            <div className="flex items-center justify-between border-t border-border/70 px-6 py-4">
              {editing.id > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    remove.mutate({ id: editing.id });
                    setEditing(null);
                    toast.success("Task deleted");
                  }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Delete Task</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editing.title.trim()) {
                      toast.error("Title is required");
                      return;
                    }
                    if (editing.id > 0) {
                      await update.mutateAsync({
                        id: editing.id,
                        patch: {
                          title: editing.title,
                          notes: editing.notes || undefined,
                          status: editing.status,
                          priority: editing.priority,
                          energy: editing.energy,
                          dueDate: editing.dueDate || null,
                          estimateMin: editing.estimateMin || undefined,
                          projectId: editing.projectId || undefined,
                          clientId: editing.clientId || undefined,
                          checklist: editing.checklist || undefined,
                        },
                      });
                      toast.success("Task updated");
                    } else {
                      await create.mutateAsync({
                        title: editing.title,
                        notes: editing.notes || undefined,
                        status: editing.status,
                        priority: editing.priority,
                        energy: editing.energy,
                        dueDate: editing.dueDate || null,
                        estimateMin: editing.estimateMin || undefined,
                        projectId: editing.projectId || undefined,
                        clientId: editing.clientId || undefined,
                        checklist: editing.checklist || undefined,
                      });
                      toast.success("Task created");
                    }
                    setEditing(null);
                  }}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm"
                >
                  {editing.id > 0 ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus Timer Chamber */}
      <FocusTimerModal
        open={!!focusTask}
        onOpenChange={(open) => {
          if (!open) setFocusTask(null);
        }}
        initialTask={focusTask}
      />
    </PageContainer>
  );
}

/** Kanban Task Card */
function TaskCard({
  task,
  isSelected,
  onToggleSelect,
  onCompleteToggle,
  onClick,
  onMove,
  onFocus,
  allProjects,
}: {
  task: Task;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCompleteToggle: () => void;
  onClick: () => void;
  onMove: (dir: 1 | -1) => void;
  onFocus: () => void;
  allProjects: Array<{ id: number; name: string; color: string }>;
}) {
  const project = allProjects.find((p) => p.id === task.projectId);
  const checklistCount: { total: number; done: number } = useMemo(() => {
    if (!task.checklist) return { total: 0, done: 0 };
    try {
      const items = JSON.parse(task.checklist);
      return { total: items.length, done: items.filter((i: { done: boolean }) => i.done).length };
    } catch {
      return { total: 0, done: 0 };
    }
  }, [task.checklist]);

  const isDone = task.status === "done";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border border-border/80 bg-card p-3.5 transition-all duration-150 cursor-pointer shadow-2xs",
        "hover:border-border hover:shadow-xs",
        isSelected && "ring-2 ring-primary border-primary",
        isDone && "opacity-60 bg-secondary/15"
      )}
    >
      {/* Card Header: Completion Circle + Priority + Selection Checkbox */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div onClick={(e) => e.stopPropagation()}>
            <RadarCheck checked={isDone} onChange={onCompleteToggle} size={15} />
          </div>
          <PriorityBar priority={task.priority} />
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            className="opacity-0 group-hover:opacity-100 flex h-5.5 items-center gap-1 rounded-lg border border-border/80 bg-secondary/40 px-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-foreground hover:text-background transition-all shadow-2xs"
            title="Launch Focus Session"
          >
            <Play size={8} className="fill-current text-sky-500" />
            <span>Focus</span>
          </button>

          <Checkbox
            checked={isSelected}
            onChange={onToggleSelect}
            className={cn(!isSelected && "opacity-0 group-hover:opacity-100 transition-opacity")}
          />
        </div>
      </div>

      <h4
        className={cn(
          "mt-2 text-[13px] font-semibold leading-snug tracking-tight transition-colors",
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        )}
      >
        {task.title}
      </h4>

      {task.notes && (
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {task.notes}
        </p>
      )}

      {/* Subtasks progress bar */}
      {checklistCount.total > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {checklistCount.done}/{checklistCount.total}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(checklistCount.done / checklistCount.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Project Tag, Due Date, Move Column Controls */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          {project && (
            <span className="truncate rounded-md border border-border/80 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              {project.name}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                dueTone(task.dueDate) === "red"
                  ? "text-rose-500 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {relDay(task.dueDate)}
            </span>
          )}
        </div>

        {/* Move arrows */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status !== "inbox" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Move backward"
            >
              <ArrowLeft size={11} />
            </button>
          )}
          {task.status !== "done" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Move forward"
            >
              <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
