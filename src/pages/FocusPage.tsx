import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useFocus, type FocusMode } from "@/providers/FocusContext";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Minimize2,
  Sparkles,
  Flame,
  Plus,
  Trash2,
  ArrowRight,
  Target,
  ListTodo,
  Check,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FocusPage() {
  const navigate = useNavigate();
  const tasksQuery = trpc.tasks.list.useQuery();
  const focusStats = trpc.focus.stats.useQuery();

  const {
    isActive,
    isRunning,
    mode,
    totalSeconds,
    remainingSeconds,
    taskTitle,
    taskId,
    objectiveNotes,
    checklist,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    completeFocus,
    minimizeFocus,
    setMode,
    setDurationMinutes,
    setObjectiveNotes,
    setTaskTitle,
    toggleCheckItem,
    addCheckItem,
    deleteCheckItem,
  } = useFocus();

  const [customMinInput, setCustomMinInput] = useState("25");
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [selectedTaskDropdown, setSelectedTaskDropdown] = useState<string>(
    taskId ? String(taskId) : "custom"
  );

  const activeTasks = useMemo(
    () => (tasksQuery.data ?? []).filter((t) => t.status !== "done"),
    [tasksQuery.data]
  );

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const progressPercent =
    totalSeconds > 0
      ? Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)
      : 0;

  const circumference = 2 * Math.PI * 130; // radius = 130
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  const handleSelectTask = (val: string) => {
    setSelectedTaskDropdown(val);
    if (val === "custom") {
      setTaskTitle("Strategic Deep Work");
    } else {
      const found = activeTasks.find((t) => t.id === Number(val));
      if (found) {
        setTaskTitle(found.title);
        if (found.notes) setObjectiveNotes(found.notes);
      }
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    addCheckItem(newSubtaskText.trim());
    setNewSubtaskText("");
  };

  const handleMinimizeAndNavigate = () => {
    minimizeFocus();
    toast.info("Focus timer minimized to top right", {
      description: "Feel free to work across your dashboard during focus time.",
    });
    navigate("/");
  };

  const handleStartOrToggle = () => {
    if (!isActive) {
      startFocus({
        taskTitle,
        taskId: selectedTaskDropdown !== "custom" ? Number(selectedTaskDropdown) : null,
        objectiveNotes,
      });
    } else if (isRunning) {
      pauseFocus();
    } else {
      resumeFocus();
    }
  };

  return (
    <PageContainer variant="contained" className="space-y-6 pb-12">
      {/* ── Studio Page Header ── */}
      <PageHeader
        eyebrow="HIGH-LEVERAGE COGNITIVE PERFORMANCE"
        title="Focus Chamber"
        description="Distraction-free sprint chamber. Single-task intention, milestone calibration, and timeboxing."
        actions={
          <button
            type="button"
            onClick={handleMinimizeAndNavigate}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary transition-all shadow-2xs cursor-pointer"
            title="Minimize clock to top right below avatar and return to dashboard"
          >
            <Minimize2 size={13} />
            <span>Minimize to Dashboard</span>
          </button>
        }
      />

      {/* ── Main Chamber Canvas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Big Radial Clock & Controls (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0B0E17] p-8 md:p-12 shadow-sm space-y-8 relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 pointer-events-none bg-radial from-sky-500/5 via-transparent to-transparent opacity-80" />

          {/* Mode Selector Segmented Bar */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.04] p-1 shadow-2xs">
            {(
              [
                { key: "pomodoro", label: "Pomodoro (25m)" },
                { key: "deep", label: "Deep Work (50m)" },
                { key: "flow", label: "Flow State (90m)" },
                { key: "sprint", label: "Sprint (15m)" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  mode === m.key
                    ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Large Radial SVG Timer */}
          <div className="relative flex h-72 w-72 md:h-80 md:w-80 items-center justify-center z-10">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 300 300">
              {/* Background Ring */}
              <circle
                cx="150"
                cy="150"
                r="130"
                fill="none"
                className="stroke-slate-100 dark:stroke-white/[0.06]"
                strokeWidth="8"
              />
              {/* Active Progress Ring */}
              <circle
                cx="150"
                cy="150"
                r="130"
                fill="none"
                className={cn(
                  "transition-all duration-700 ease-out",
                  isRunning
                    ? "stroke-sky-500 dark:stroke-sky-400"
                    : "stroke-slate-400 dark:stroke-slate-600"
                )}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Central Typography Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-2 select-none">
              <div className="flex items-center gap-2">
                <Flame
                  size={18}
                  className={cn(
                    "transition-colors",
                    isRunning
                      ? "text-sky-500 dark:text-sky-400 animate-pulse"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {mode.toUpperCase()}
                </span>
              </div>

              <div className="font-mono text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums drop-shadow-xs">
                {timeFormatted}
              </div>

              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[220px] truncate px-2">
                {taskTitle || "Select intention"}
              </p>
            </div>
          </div>

          {/* Primary Action Button Ribbon */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleStartOrToggle}
              className={cn(
                "flex h-11 items-center gap-2 rounded-xl px-7 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer",
                isRunning
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90"
                  : "bg-sky-600 hover:bg-sky-500 text-white"
              )}
            >
              {isRunning ? (
                <>
                  <Pause size={15} strokeWidth={2.5} />
                  <span>Pause Session</span>
                </>
              ) : (
                <>
                  <Play size={15} strokeWidth={2.5} className="fill-current" />
                  <span>{isActive ? "Resume Focus" : "Begin Focus"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetFocus}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Reset Timer"
              aria-label="Reset Timer"
            >
              <RotateCcw size={15} />
            </button>

            <button
              type="button"
              onClick={completeFocus}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Log and Complete Focus Block"
            >
              <CheckCircle2 size={15} />
              <span>Complete</span>
            </button>

            <button
              type="button"
              onClick={handleMinimizeAndNavigate}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 px-4 text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Minimize clock to top right below avatar and return to dashboard"
            >
              <Minimize2 size={14} />
              <span>Minimize & Dashboard</span>
            </button>
          </div>
        </div>

        {/* Right Column: Intention, Meaningful Outcome & Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Meaningful Session Intention Card */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0B0E17] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-sky-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Session Intention & Outcome
                </h3>
              </div>
              <span className="font-mono text-[10.5px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                Anchored Focus
              </span>
            </div>

            {/* Link to Workspace Task */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
                Anchor to Active Workspace Task
              </label>
              <select
                value={selectedTaskDropdown}
                onChange={(e) => handleSelectTask(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none cursor-pointer focus:border-sky-500 transition-all"
              >
                <option value="custom">Custom Objective...</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.priority})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Title Input */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
                Focus Title / Goal
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Architect Billing Webhooks"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] px-3 py-2 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 transition-all"
              />
            </div>

            {/* Key Outcome / Meaningful Notes */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
                Meaningful Definition of Done
              </label>
              <textarea
                rows={3}
                value={objectiveNotes}
                onChange={(e) => setObjectiveNotes(e.target.value)}
                placeholder="What concrete result will be shipped by the end of this sprint?"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] p-3 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* 2. Micro-Checklist for Session */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0B0E17] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ListTodo size={14} className="text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  Sprint Subtasks & Milestones
                </h4>
              </div>
              <span className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500 font-semibold">
                {checklist.filter((c) => c.done).length}/{checklist.length}
              </span>
            </div>

            {/* Subtasks List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {checklist.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 py-3 text-center">
                  Add 2-3 atomic steps to keep your mind locked in flow.
                </p>
              ) : (
                checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] p-2 text-xs"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      onClick={() => toggleCheckItem(item.id)}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          item.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 dark:border-white/20 hover:border-emerald-500"
                        )}
                      >
                        {item.done && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span
                        className={cn(
                          "truncate text-[12px]",
                          item.done
                            ? "text-slate-400 dark:text-slate-500 line-through"
                            : "text-slate-800 dark:text-slate-200 font-medium"
                        )}
                      >
                        {item.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteCheckItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                      title="Remove subtask"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Subtask Input Form */}
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                placeholder="Add subtask..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121622] px-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={!newSubtaskText.trim()}
                className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <Plus size={12} />
              </button>
            </form>
          </div>

          {/* 3. Daily Velocity Snapshot Tile */}
          <div className="rounded-2xl border border-black/[0.08] dark:border-white/10 bg-slate-900/95 dark:bg-[#0E121B] p-4 text-white shadow-md flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-mono text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">
                Today's Output
              </span>
              <div className="text-xl font-bold font-mono text-sky-400">
                {focusStats.data?.todayMin ?? 0}m logged
              </div>
              <p className="text-[11px] text-slate-400">
                {focusStats.data?.totalSessions ?? 0} total sessions recorded this week
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
              <Clock size={18} />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
