import { cn } from "@/lib/utils";

interface CapacityGaugeProps {
  plannedMinutes: number;
  capacityMinutes?: number;
  className?: string;
  showDetails?: boolean;
}

/**
 * CapacityGauge
 * Sunsama-inspired realistic workload balance indicator.
 * Helps prevent planning an overloaded, unrealistic day.
 */
export function CapacityGauge({
  plannedMinutes,
  capacityMinutes = 360, // Default 6.0 hours realistic focus capacity
  className,
  showDetails = true,
}: CapacityGaugeProps) {
  const ratio = plannedMinutes / Math.max(capacityMinutes, 1);
  const percent = Math.min(Math.round(ratio * 100), 100);
  const plannedHours = (plannedMinutes / 60).toFixed(1);
  const capacityHours = (capacityMinutes / 60).toFixed(1);

  // Status color logic based on workload realism
  const isOverloaded = ratio > 1.05;
  const isBalanced = ratio >= 0.65 && ratio <= 1.05;
  const isLight = ratio < 0.65;

  const barColor = isOverloaded
    ? "bg-rose-500"
    : isBalanced
    ? "bg-primary"
    : "bg-amber-500";

  const statusLabel = isOverloaded
    ? "Overloaded (+realistic limit exceeded)"
    : isBalanced
    ? "Calibrated (optimal balance)"
    : "Light schedule (room for deep work)";

  return (
    <div className={cn("space-y-1.5", className)}>
      {showDetails && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-foreground font-mono tabular-nums">{plannedHours}h</span>
            <span className="text-muted-foreground font-normal">planned</span>
            <span className="text-border">/</span>
            <span className="text-muted-foreground font-mono tabular-nums">{capacityHours}h</span>
            <span className="text-muted-foreground font-normal">capacity</span>
          </div>
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums font-semibold",
              isOverloaded ? "text-rose-500" : isBalanced ? "text-primary" : "text-amber-500"
            )}
          >
            {percent}%
          </span>
        </div>
      )}

      {/* Progress track */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>

      {showDetails && (
        <p className="text-[10.5px] text-muted-foreground truncate leading-tight">
          {statusLabel}
        </p>
      )}
    </div>
  );
}
