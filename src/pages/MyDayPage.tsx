import { useState, useMemo } from "react";
import { useNavigate, useOutletContext, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { useFocus } from "@/providers/FocusContext";
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Check,
  Sun,
  Video,
  MapPin,
  Target,
  X,
  Flame,
  ArrowRight,
  FolderKanban,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layout";
import { fmtTime } from "@/lib/util";
import { toast } from "sonner";

export default function MyDayPage() {
  const navigate = useNavigate();
  const { openDailyPlanner } = useOutletContext<{
    openCapture: () => void;
    openDailyPlanner: () => void;
  }>();

  const { startFocus } = useFocus();
  const utils = trpc.useUtils();
  const tasksQuery = trpc.tasks.list.useQuery();
  const feed = trpc.events.calendarFeed.useQuery();
  const projectsQuery = trpc.projects.list.useQuery();

  const allTasks = tasksQuery.data ?? [];
  const allProjects = projectsQuery.data ?? [];

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.overview.invalidate();
      utils.events.calendarFeed.invalidate();
    },
  });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.overview.invalidate();
      utils.events.calendarFeed.invalidate();
      setIsAddModalOpen(false);
      resetModalForm();
      toast.success("Meaningful commitment added to today's agenda");
    },
  });

  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.calendarFeed.invalidate();
      setIsAddModalOpen(false);
      resetModalForm();
      toast.success("Meeting slot added to today's schedule");
    },
  });

  // State
  const [filterType, setFilterType] = useState<"all" | "meetings" | "tasks">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for Meaningful Add Modal
  const [itemCategory, setItemCategory] = useState<"task" | "meeting" | "timeblock">("task");
  const [newTitle, setNewTitle] = useState("");
  const [newOutcome, setNewOutcome] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("high");
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newLocation, setNewLocation] = useState("");

  const resetModalForm = () => {
    setNewTitle("");
    setNewOutcome("");
    setNewDuration(30);
    setNewPriority("high");
    setNewProjectId(null);
    setNewStartTime("09:00");
    setNewLocation("");
  };

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const isSameDay = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const date = new Date(d);
    return (
      date.getFullYear() === todayYear &&
      date.getMonth() === todayMonth &&
      date.getDate() === todayDate
    );
  };

  // Today's Meetings & Calendar Events
  const todayMeetings = useMemo(() => {
    return (feed.data?.events ?? [])
      .filter((e) => isSameDay(e.startAt))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [feed.data?.events, todayYear, todayMonth, todayDate]);

  // Today's Scheduled Tasks & Active Deliverables
  const todayScheduledTasks = useMemo(() => {
    const scheduled = allTasks.filter((t) => t.dueDate && isSameDay(t.dueDate));
    if (scheduled.length > 0) return scheduled;
    // Fallback to active tasks so day view is never empty
    return allTasks.filter((t) => t.status === "next").slice(0, 8);
  }, [allTasks, todayYear, todayMonth, todayDate]);

  const pendingTasks = todayScheduledTasks.filter((t) => t.status !== "done");
  const doneTasks = todayScheduledTasks.filter((t) => t.status === "done");

  // Unified Chronological Schedule Items
  type UnifiedItem = {
    id: string;
    type: "meeting" | "task";
    title: string;
    timeText: string;
    timestamp: number;
    durationMin: number;
    locationOrProject?: string;
    priority?: string;
    isDone?: boolean;
    rawTask?: (typeof allTasks)[0];
    rawEvent?: (typeof todayMeetings)[0];
  };

  const unifiedDayTimeline = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    todayMeetings.forEach((m) => {
      const start = new Date(m.startAt);
      const end = new Date(m.endAt);
      const dur = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
      items.push({
        id: `meet-${m.id}`,
        type: "meeting",
        title: m.title,
        timeText: `${fmtTime(m.startAt)} – ${fmtTime(m.endAt)}`,
        timestamp: start.getTime(),
        durationMin: dur,
        locationOrProject: m.location || "Scheduled Meeting",
        rawEvent: m,
      });
    });

    todayScheduledTasks.forEach((t) => {
      const proj = allProjects.find((p) => p.id === t.projectId);
      const taskTime = t.dueDate ? new Date(t.dueDate) : new Date(todayYear, todayMonth, todayDate, 10, 0);
      items.push({
        id: `task-${t.id}`,
        type: "task",
        title: t.title,
        timeText: t.dueDate ? fmtTime(t.dueDate) : "Anytime Today",
        timestamp: taskTime.getTime(),
        durationMin: t.estimateMin || 30,
        locationOrProject: proj?.name || undefined,
        priority: t.priority,
        isDone: t.status === "done",
        rawTask: t,
      });
    });

    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [todayMeetings, todayScheduledTasks, allProjects, todayYear, todayMonth, todayDate]);

  const filteredUnifiedTimeline = useMemo(() => {
    if (filterType === "meetings") return unifiedDayTimeline.filter((i) => i.type === "meeting");
    if (filterType === "tasks") return unifiedDayTimeline.filter((i) => i.type === "task");
    return unifiedDayTimeline;
  }, [unifiedDayTimeline, filterType]);

  const handleLaunchFocus = (task?: { id: number; title: string; notes?: string | null }) => {
    startFocus({
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? "Strategic Deep Work",
      objectiveNotes: task?.notes ?? "",
      mode: "pomodoro",
    });
    navigate("/focus");
  };

  const handleCreateMeaningfulCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (itemCategory === "meeting") {
      const [h, m] = newStartTime.split(":").map(Number);
      const start = new Date(todayYear, todayMonth, todayDate, h, m, 0, 0);
      const end = new Date(start.getTime() + newDuration * 60000);

      await createEvent.mutateAsync({
        title: newTitle.trim(),
        startAt: start,
        endAt: end,
        location: newLocation.trim() || undefined,
        notes: newOutcome.trim() || undefined,
        color: "blue",
      });
    } else {
      const [h, m] = newStartTime.split(":").map(Number);
      const due = new Date(todayYear, todayMonth, todayDate, h, m, 0, 0);

      await createTask.mutateAsync({
        title: newTitle.trim(),
        notes: newOutcome.trim() || undefined,
        status: "next",
        priority: newPriority,
        estimateMin: newDuration,
        dueDate: due,
        projectId: newProjectId ?? undefined,
      });
    }
  };

  return (
    <PageContainer variant="contained" className="space-y-6">
      {/* ── Top Atmospheric Morning Banner ── */}
      <div className="relative rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden p-6 md:p-8 dark:border-white/[0.08]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 dark:opacity-15 pointer-events-none"
          style={{ backgroundImage: `url('/assets/mountain_panorama_hero.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Sun size={15} className="text-amber-500" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">
                {now.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              My Day · Unified Agenda
            </h1>

            <p className="text-xs md:text-sm text-muted-foreground font-normal">
              Unified day execution. Meetings, timeblocks, and priority deliverables integrated in one view.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Add to My Day</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunchFocus()}
                className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Play size={11} className="fill-current text-foreground" />
                <span>Launch Focus Session</span>
              </button>

              <button
                type="button"
                onClick={openDailyPlanner}
                className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles size={13} className="text-sky-400" />
                <span>Recalibrate</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Segment Bar & Quick Stats ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/30 p-1 shadow-2xs">
          {(
            [
              { key: "all", label: "Unified Day", count: unifiedDayTimeline.length },
              { key: "meetings", label: "Meetings", count: todayMeetings.length },
              { key: "tasks", label: "Tasks", count: todayScheduledTasks.length },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterType(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                filterType === key
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{label}</span>
              <span className="font-mono text-[10px] opacity-70">({count})</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
        >
          <Plus size={13} />
          <span>New Commitment / Outcome</span>
        </button>
      </div>

      {/* ── Unified Day Agenda Stream (Meetings + Tasks together) ── */}
      <div className="space-y-3">
        {filteredUnifiedTimeline.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-12 text-center shadow-xs space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Sparkles size={22} />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">
              Clear Runway for Today
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No meetings or tasks scheduled for today. Add a high-leverage deliverable or initiate deep work.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition-all cursor-pointer shadow-xs"
            >
              + Add Meaningful Commitment
            </button>
          </div>
        ) : (
          filteredUnifiedTimeline.map((item) => {
            if (item.type === "meeting") {
              return (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-foreground/30 hover:shadow-xs"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background font-bold text-xs shrink-0 shadow-2xs">
                      <Video size={16} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-foreground truncate">
                          {item.title}
                        </span>
                        <span className="rounded-full bg-secondary text-foreground px-2 py-0.2 font-mono text-[9.5px] font-medium border border-border/80">
                          Meeting
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                        <span className="font-mono text-foreground/80">{item.timeText}</span>
                        <span>·</span>
                        <span className="truncate flex items-center gap-1">
                          <MapPin size={11} /> {item.locationOrProject || "Scheduled Call"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-muted-foreground">{item.durationMin}m</span>
                    <Link
                      to="/calendar"
                      className="rounded-lg border border-border/80 bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-all"
                    >
                      Calendar
                    </Link>
                  </div>
                </div>
              );
            }

            // Task Item
            const task = item.rawTask!;
            return (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-xl border p-4 shadow-2xs transition-all hover:shadow-xs",
                  item.isDone
                    ? "border-border/50 bg-card/60 opacity-70"
                    : "border-border/80 bg-card hover:border-border dark:border-white/[0.08]"
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateTask.mutate({
                        id: task.id,
                        patch: { status: item.isDone ? "next" : "done" },
                      })
                    }
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all cursor-pointer",
                      item.isDone
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border hover:border-emerald-500 hover:bg-emerald-500/10"
                    )}
                  >
                    <Check size={11} className={item.isDone ? "opacity-100" : "opacity-0 group-hover:opacity-40 text-emerald-500"} />
                  </button>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[13.5px] font-semibold truncate",
                          item.isDone ? "line-through text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.priority === "high" || item.priority === "urgent" ? (
                        <span className="rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.2 font-mono text-[9.5px] font-bold">
                          {item.priority.toUpperCase()}
                        </span>
                      ) : null}
                      {item.locationOrProject && (
                        <span className="rounded-full bg-secondary text-muted-foreground px-2 py-0.2 text-[10px] font-medium truncate max-w-[140px]">
                          {item.locationOrProject}
                        </span>
                      )}
                    </div>

                    {task.notes && (
                      <p className="text-[11.5px] text-muted-foreground truncate">{task.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
                    <Clock size={12} />
                    <span>{item.durationMin}m</span>
                  </div>

                  {!item.isDone && (
                    <button
                      type="button"
                      onClick={() => handleLaunchFocus({ id: task.id, title: task.title, notes: task.notes })}
                      className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground hover:text-background transition-all cursor-pointer shadow-2xs"
                    >
                      <Play size={10} className="fill-current" />
                      <span>Focus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Meaningful Add Item Modal (Rich & Purposeful) ── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0D101A] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-sky-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Add Meaningful Commitment to My Day
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateMeaningfulCommitment} className="space-y-4">
              {/* Category Segmented Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
                  Commitment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "task", label: "Action Task" },
                      { key: "meeting", label: "Meeting / Sync" },
                      { key: "timeblock", label: "Deep Work Sprint" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setItemCategory(cat.key)}
                      className={cn(
                        "py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer",
                        itemCategory === cat.key
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-xs"
                          : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Title & Objective *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Finalize architectural blueprints for client review"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3.5 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500"
                />
              </div>

              {/* Meaningful Definition of Done / Outcome */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Meaningful Definition of Done / Key Outcome
                </label>
                <textarea
                  rows={2}
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  placeholder="What concrete result will be delivered once this is complete?"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Time, Duration & Project Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Allocated Minutes
                  </label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value={15}>15 mins (Sprint)</option>
                    <option value={30}>30 mins (Standard)</option>
                    <option value={45}>45 mins (Deep)</option>
                    <option value={60}>60 mins (Hour Block)</option>
                    <option value={90}>90 mins (Flow State)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Project Association or Meeting Location */}
              {itemCategory === "meeting" ? (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Meeting Location / URL
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Google Meet, Zoom, Boardroom..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3.5 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Associate with Project
                  </label>
                  <select
                    value={newProjectId ?? ""}
                    onChange={(e) => setNewProjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="">No Project (General Flow)</option>
                    {allProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTask.isPending || createEvent.isPending}
                  className="px-5 py-2 text-xs font-bold text-white dark:text-slate-950 bg-slate-900 dark:bg-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  Commit to Today
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
