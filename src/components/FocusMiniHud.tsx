import { useNavigate, useLocation } from "react-router";
import { useFocus } from "@/providers/FocusContext";
import { Play, Pause, Maximize2, Check, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function FocusMiniHud() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isActive,
    isRunning,
    remainingSeconds,
    totalSeconds,
    taskTitle,
    isMinimized,
    pauseFocus,
    resumeFocus,
    completeFocus,
    maximizeFocus,
  } = useFocus();

  // If on /focus page and not minimized, don't show the floating mini pill
  if (!isActive) return null;
  if (location.pathname === "/focus" && !isMinimized) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;

  const handleExpand = () => {
    maximizeFocus();
    navigate("/focus");
  };

  return (
    <div
      role="region"
      aria-label="Active Focus Timer"
      className="fixed top-[72px] right-5 sm:right-7 z-40 flex items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-white/15 bg-white/95 dark:bg-[#0B0E17]/95 px-3.5 py-2 text-slate-800 dark:text-white shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5 dark:ring-white/5 select-none"
    >
      {/* Mini Progress Ring + Status Icon */}
      <div className="relative flex h-8 w-8 items-center justify-center shrink-0 cursor-pointer" onClick={handleExpand} title="Open Focus Chamber">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            className="stroke-slate-200 dark:stroke-white/10"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            className={cn(
              "transition-all duration-500",
              isRunning ? "stroke-sky-500 dark:stroke-sky-400" : "stroke-amber-500"
            )}
            strokeWidth="3"
            strokeDasharray="94.2"
            strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Flame
            size={13}
            className={cn(
              "transition-colors",
              isRunning
                ? "text-sky-500 dark:text-sky-400 animate-pulse"
                : "text-amber-500"
            )}
          />
        </div>
      </div>

      {/* Title & Countdown */}
      <div className="min-w-0 max-w-[140px] sm:max-w-[180px] cursor-pointer" onClick={handleExpand} title={taskTitle}>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs sm:text-[13px] font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {timeFormatted}
          </span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )}
          />
        </div>
        <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
          {taskTitle || "Focus Block"}
        </p>
      </div>

      {/* Mini Controls */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={isRunning ? pauseFocus : resumeFocus}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          title={isRunning ? "Pause Session" : "Resume Session"}
          aria-label={isRunning ? "Pause" : "Play"}
        >
          {isRunning ? <Pause size={12} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={handleExpand}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          title="Maximize to Focus Page"
          aria-label="Maximize"
        >
          <Maximize2 size={12} />
        </button>

        <button
          type="button"
          onClick={completeFocus}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          title="Complete Focus Block"
          aria-label="Complete"
        >
          <Check size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
