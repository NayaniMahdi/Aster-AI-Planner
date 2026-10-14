import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Play,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CapacityGauge } from "./design-system/CapacityGauge";
import { PriorityBar } from "./bits";
import { fmtTime } from "@/lib/util";
import { toast } from "sonner";

interface DailyPlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanCommitted?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: "1. Review Carried-Over Work",
    subtitle: "Acknowledge recent progress and decide what to roll over or reschedule.",
  },
  2: {
    title: "2. Inspect Calendar Commitments",
    subtitle: "Notice fixed meetings today and identify your open deep-work blocks.",
  },
  3: {
    title: "3. Choose Today's Core Priorities",
    subtitle: "Select 2 to 4 vital tasks. Do not overload your plate.",
  },
  4: {
    title: "4. Estimate Workload & Timebox",
    subtitle: "Assign realistic minutes to each priority and check your capacity balance.",
  },
  5: {
    title: "5. Commit Plan & Start Day",
    subtitle: "Your focused daily workspace is calibrated and ready to execute.",
  },
};

export function DailyPlanningModal({
  open,
  onOpenChange,
  onPlanCommitted,
}: DailyPlanningModalProps) {
  const [step, setStep] = useState<Step>(1);
  const utils = trpc.useUtils();

  const overview = trpc.tasks.overview.useQuery(undefined, { enabled: open });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { enabled: open });
  const feedQuery = trpc.events.calendarFeed.useQuery(undefined, { enabled: open });

  const updateTask = trpc.tasks.update.useMutation();

  // State for selections across steps
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [taskEstimates, setTaskEstimates] = useState<Record<number, number>>({});

  const allTasks = tasksQuery.data ?? [];
  const openTasks = allTasks.filter((t) => t.status !== "done");
  const todayEvents = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (feedQuery.data?.events ?? []).filter(
      (e) => new Date(e.startAt).toDateString() === todayStr
    );
  }, [feedQuery.data?.events]);

  // Overdue or carried-over tasks
  const carriedOverTasks = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return openTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate).getTime() < startOfToday.getTime()
    );
  }, [openTasks]);

  // Total meeting minutes
  const totalMeetingMin = useMemo(() => {
    return todayEvents.reduce((acc, ev) => {
      const dur = (new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()) / 60000;
      return acc + Math.max(0, dur);
    }, 0);
  }, [todayEvents]);

  // Total planned task minutes
  const totalPlannedTaskMin = useMemo(() => {
    return selectedTaskIds.reduce((acc, id) => {
      const min = taskEstimates[id] ?? 45;
      return acc + min;
    }, 0);
  }, [selectedTaskIds, taskEstimates]);

  const totalCommittedMin = totalMeetingMin + totalPlannedTaskMin;

  const toggleSelectTask = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
    if (!taskEstimates[taskId]) {
      setTaskEstimates((prev) => ({ ...prev, [taskId]: 45 }));
    }
  };

  const handleSetEstimate = (taskId: number, minutes: number) => {
    setTaskEstimates((prev) => ({ ...prev, [taskId]: minutes }));
  };

  const handleFinishPlan = async () => {
    const today = new Date();
    const promises = selectedTaskIds.map((id) =>
      updateTask.mutateAsync({
        id,
        patch: {
          status: "next",
          dueDate: today,
          estimateMin: taskEstimates[id] ?? 45,
        },
      })
    );

    try {
      await Promise.all(promises);
      await Promise.all([
        utils.tasks.invalidate(),
        utils.events.calendarFeed.invalidate(),
      ]);
      toast.success("Daily plan committed! Let's build momentum.");
      onPlanCommitted?.();
      onOpenChange(false);
    } catch {
      toast.error("Failed to commit plan. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Guided Daily Planning</DialogTitle>
        <DialogDescription className="sr-only">
          Calibrate your workload, timebox priorities, and start your day
        </DialogDescription>

        <div className="flex flex-col h-[620px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-secondary/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
                <Sparkles size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Guided Daily Planning
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  Sunsama × ASTER Calibration
                </span>
              </div>
            </div>

            {/* Stepper Dots */}
            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4, 5] as Step[]).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    s === step
                      ? "w-6 bg-primary"
                      : s < step
                      ? "w-2.5 bg-foreground"
                      : "w-2.5 bg-border"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Step Subheader */}
          <div className="border-b border-border/80 px-6 py-3 bg-card">
            <h4 className="text-[13px] font-semibold text-foreground tracking-tight">
              {STEP_TITLES[step].title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {STEP_TITLES[step].subtitle}
            </p>
          </div>

          {/* Step Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* STEP 1: REVIEW YESTERDAY & OVERDUE */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-secondary/30 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        {overview.data?.doneToday ?? 0} tasks resolved recently
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Great work. Clear mental clutter before taking on today's tasks.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    Momentum +
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Carried-Over / Overdue Items ({carriedOverTasks.length})
                  </span>

                  {carriedOverTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No overdue tasks from yesterday. Your slate is completely clean!
                    </div>
                  ) : (
                    carriedOverTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground truncate">
                              {t.title}
                            </span>
                            <PriorityBar priority={t.priority} />
                          </div>
                          <span className="text-[11px] text-rose-500 font-mono">
                            Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "earlier"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              updateTask.mutate({
                                id: t.id,
                                patch: { dueDate: new Date(), status: "next" },
                              })
                            }
                            className="rounded border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-card transition-colors"
                          >
                            Pull to Today
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: INSPECT CALENDAR COMMITMENTS */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-2">
                    <span className="text-xs font-semibold text-foreground">
                      Fixed Calendar Blocks Today ({todayEvents.length} events)
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {totalMeetingMin} min committed
                    </span>
                  </div>

                  {todayEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Zero calendar meetings today. You have maximum open deep-work capacity!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {todayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {fmtTime(ev.startAt)} – {fmtTime(ev.endAt)}
                              </span>
                              <span className="rounded border border-border px-1 text-[9px] uppercase font-mono text-muted-foreground">
                                Meeting
                              </span>
                            </div>
                            <span className="text-xs font-medium text-foreground truncate block mt-0.5">
                              {ev.title}
                            </span>
                          </div>
                          {ev.location && (
                            <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[140px]">
                              {ev.location}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-secondary/30 p-3.5">
                  <span className="text-xs font-semibold text-foreground block mb-1">
                    Realistic Available Focus Window
                  </span>
                  <p className="text-xs text-muted-foreground">
                    After subtracting {Math.round(totalMeetingMin / 60 * 10) / 10} hours of meetings, you have approximately{" "}
                    <strong className="text-foreground">
                      {Math.max(0, Math.round((360 - totalMeetingMin) / 60 * 10) / 10)} hours
                    </strong>{" "}
                    of realistic execution time today.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3: SELECT PRIORITIES */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Available Tasks ({openTasks.length})
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {selectedTaskIds.length} priorities selected (ideal: 2–4)
                  </span>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {openTasks.map((t) => {
                    const isSelected = selectedTaskIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleSelectTask(t.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-120",
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground shadow-xs"
                            : "border-border bg-card text-foreground/90 hover:bg-secondary/40"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card"
                            )}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium block truncate">
                              {t.title}
                            </span>
                            {t.dueDate && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Due {new Date(t.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <PriorityBar priority={t.priority} className="shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: TIMEBOXING & WORKLOAD ESTIMATION */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <span className="text-xs font-semibold text-foreground block">
                    Daily Capacity Meter
                  </span>
                  <CapacityGauge plannedMinutes={totalCommittedMin} capacityMinutes={360} />
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assign Realistic Minutes to Selected Priorities
                  </span>

                  {selectedTaskIds.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No priorities selected. Go back to step 3 to choose tasks.
                    </p>
                  ) : (
                    selectedTaskIds.map((id) => {
                      const task = allTasks.find((t) => t.id === id);
                      if (!task) return null;
                      const currentEstimate = taskEstimates[id] ?? 45;
                      return (
                        <div
                          key={id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                        >
                          <span className="text-xs font-medium text-foreground truncate max-w-[260px]">
                            {task.title}
                          </span>

                          <div className="flex items-center gap-1.5 text-xs">
                            {[15, 30, 45, 60, 90].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => handleSetEstimate(id, mins)}
                                className={cn(
                                  "rounded px-2 py-0.5 font-mono text-[11px] font-medium transition-colors",
                                  currentEstimate === mins
                                    ? "bg-foreground text-background font-bold shadow-xs"
                                    : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: COMMIT & LAUNCH */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Today's Daily Target
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {Math.round(totalCommittedMin / 60 * 10) / 10} hours committed
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center pt-2 border-t border-border/80">
                    <div>
                      <span className="font-mono text-xl font-bold text-foreground">
                        {todayEvents.length}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">Meetings</span>
                    </div>
                    <div>
                      <span className="font-mono text-xl font-bold text-foreground">
                        {selectedTaskIds.length}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">Core Priorities</span>
                    </div>
                    <div>
                      <span className="font-mono text-xl font-bold text-foreground">
                        {totalPlannedTaskMin}m
                      </span>
                      <span className="block text-[11px] text-muted-foreground">Deep Work</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected Focus Agenda:
                  </span>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {selectedTaskIds.map((id) => {
                      const t = allTasks.find((task) => task.id === id);
                      if (!t) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs"
                        >
                          <span className="font-medium text-foreground truncate max-w-sm">
                            {t.title}
                          </span>
                          <span className="font-mono text-[11px] text-primary tabular-nums shrink-0">
                            {taskEstimates[id] ?? 45} min
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between border-t border-border bg-card px-6 py-3">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            )}

            {step < 5 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                className="flex items-center gap-1.5 rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-opacity active:scale-98"
              >
                <span>Continue</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={handleFinishPlan}
                disabled={updateTask.isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity active:scale-98 shadow-xs"
              >
                <Play size={11} className="fill-current" />
                <span>{updateTask.isPending ? "Calibrating Day…" : "Commit Plan & Start Day"}</span>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
