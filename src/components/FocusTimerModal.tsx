import { useState, useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Check,
  Radio,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FocusTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: {
    id: number;
    title: string;
    notes?: string | null;
    checklist?: string | null;
  } | null;
}

export function FocusTimerModal({
  open,
  onOpenChange,
  initialTask,
}: FocusTimerModalProps) {
  const utils = trpc.useUtils();
  const logFocus = trpc.focus.log.useMutation({
    onSuccess: () => {
      utils.focus.stats.invalidate();
      utils.tasks.overview.invalidate();
    },
  });
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.overview.invalidate();
    },
  });

  const [mode, setMode] = useState<"pomodoro" | "deep" | "shortBreak">("pomodoro");
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; done: boolean }>>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync initial task checklist
  useEffect(() => {
    if (initialTask?.checklist) {
      try {
        setChecklist(JSON.parse(initialTask.checklist));
      } catch {
        setChecklist([]);
      }
    } else {
      setChecklist([]);
    }
  }, [initialTask]);

  // Mode change
  useEffect(() => {
    let secs = 25 * 60;
    if (mode === "deep") secs = 50 * 60;
    if (mode === "shortBreak") secs = 5 * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
    setIsRunning(false);
  }, [mode]);

  // Countdown loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && remaining > 0) {
      timer = setInterval(() => {
        setRemaining((r) => r - 1);
      }, 1000);
    } else if (remaining === 0 && isRunning) {
      setIsRunning(false);
      handleCompleteSession();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, remaining]);

  // Web Audio ambient sound (soothing brown noise for deep focus)
  const toggleAmbientSound = () => {
    if (isSoundOn) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      setIsSoundOn(false);
    } else {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 0.14;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 400;

        noise.connect(filter);
        filter.connect(ctx.destination);
        noise.start();

        audioCtxRef.current = ctx;
        setIsSoundOn(true);
      } catch (err) {
        console.warn("Ambient audio initialization failed:", err);
      }
    }
  };

  // Cleanup audio when modal closes
  useEffect(() => {
    if (!open && audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      setIsSoundOn(false);
    }
  }, [open]);

  const handleCompleteSession = async () => {
    const elapsedMinutes = Math.max(1, Math.round((totalSeconds - remaining) / 60));
    await logFocus.mutateAsync({
      minutes: elapsedMinutes,
      taskId: initialTask?.id,
      label: initialTask ? initialTask.title : "Deep Work Focus Chamber",
    });
    toast.success(`Completed ${elapsedMinutes} min focus session.`);
  };

  const handleToggleCheckItem = (itemId: string) => {
    const updated = checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    setChecklist(updated);
    if (initialTask) {
      updateTask.mutate({
        id: initialTask.id,
        patch: { checklist: JSON.stringify(updated) },
      });
    }
  };

  const progress = Math.max(0, Math.min(1, 1 - remaining / totalSeconds));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card p-0 shadow-2xl transition-all duration-300",
          isFullscreen ? "max-w-[95vw] h-[90vh]" : "max-w-md"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Focus Chamber</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center p-6 md:p-8">
          {/* Hardware Header Strip */}
          <div className="flex w-full items-center justify-between border-b border-border/60 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-foreground/80 border border-border/60">
                <Radio size={12} className={isRunning ? "text-primary animate-pulse" : "text-muted-foreground"} />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-tight text-foreground">
                  Focus Chamber
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  v2.4
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleAmbientSound}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all border",
                  isSoundOn
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground hover:bg-secondary border-transparent"
                )}
                title="Toggle brown noise generator"
              >
                {isSoundOn ? <Volume2 size={13} className="animate-pulse" /> : <VolumeX size={13} />}
                <span className="text-[11px] font-mono">Analog Noise</span>
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                title="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          </div>

          {/* Mechanical Mode Switcher */}
          <div className="mt-6 flex items-center rounded-xl bg-secondary/60 p-1 border border-border/60">
            <button
              onClick={() => setMode("pomodoro")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                mode === "pomodoro"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              25m Interval
            </button>
            <button
              onClick={() => setMode("deep")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                mode === "deep"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              50m Deep Flow
            </button>
            <button
              onClick={() => setMode("shortBreak")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                mode === "shortBreak"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              5m Recovery
            </button>
          </div>

          {/* Chronograph Gauge */}
          <div className="relative my-7 flex items-center justify-center">
            {/* Ambient subtle glow when running */}
            {isRunning && (
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-2xl -z-10" />
            )}

            <svg width="250" height="250" className="-rotate-90">
              {/* Outer tick marks */}
              <circle
                cx="125"
                cy="125"
                r={radius + 10}
                className="stroke-border/40"
                strokeWidth="1"
                strokeDasharray="2 6"
                fill="transparent"
              />
              {/* Track */}
              <circle
                cx="125"
                cy="125"
                r={radius}
                className="stroke-secondary"
                strokeWidth="5"
                fill="transparent"
              />
              {/* Indicator */}
              <circle
                cx="125"
                cy="125"
                r={radius}
                stroke={mode === "shortBreak" ? "hsl(var(--primary))" : "hsl(var(--primary))"}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-light tracking-tight tabular-nums text-foreground">
                {timeFormatted}
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isRunning ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                  )}
                />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {isRunning ? "Session Active" : "Chamber Idle"}
                </span>
              </div>
            </div>
          </div>

          {/* Hardware Tactile Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRemaining(totalSeconds);
                setIsRunning(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-secondary/50 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-95"
              title="Reset Timer"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "flex h-11 px-7 items-center justify-center gap-2 rounded-xl font-medium text-xs shadow-sm transition-all active:scale-98",
                isRunning
                  ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                  : "bg-primary text-primary-foreground hover:brightness-105"
              )}
            >
              {isRunning ? (
                <>
                  <Pause size={14} /> Pause Flow
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current" /> Engage Focus
                </>
              )}
            </button>

            <button
              onClick={handleCompleteSession}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-secondary/50 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-95"
              title="Complete & Log Session"
            >
              <CheckCircle2 size={16} />
            </button>
          </div>

          {/* Connected Task Dossier */}
          {initialTask && (
            <div className="mt-6 w-full rounded-xl border border-border/80 bg-secondary/30 p-4 space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame size={12} className="text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Target Objective
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  TASK #{initialTask.id}
                </span>
              </div>
              <h3 className="text-xs font-semibold text-foreground leading-snug">
                {initialTask.title}
              </h3>
              {initialTask.notes && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground font-normal leading-relaxed">
                  {initialTask.notes}
                </p>
              )}

              {/* Subtask Checkpoints */}
              {checklist.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    <span>Checkpoints</span>
                    <span>
                      {checklist.filter((c) => c.done).length} / {checklist.length}
                    </span>
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {checklist.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleToggleCheckItem(item.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-secondary"
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                            item.done
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border/80 bg-card hover:border-primary/50"
                          )}
                        >
                          {item.done && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span
                          className={cn(
                            "text-xs truncate font-medium",
                            item.done
                              ? "line-through text-muted-foreground font-normal"
                              : "text-foreground"
                          )}
                        >
                          {item.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
