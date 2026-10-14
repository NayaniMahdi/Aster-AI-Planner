import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatMetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

/**
 * Standardized KPI / Metric Card primitive.
 * Enforces unified typography:
 * - Label: Geist Mono micro-eyebrow
 * - Value: Outfit Display bold numeral
 * - Sub: Plus Jakarta Sans muted context
 */
export function StatMetricCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
  valueColor = "text-foreground",
  trend,
  className,
}: StatMetricCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:border-border hover:shadow-xs",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80 truncate">
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-transform duration-200 group-hover:scale-105 shrink-0",
              iconBg || (iconColor ? "bg-primary/10 text-primary" : "bg-secondary/60 text-muted-foreground")
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={cn(
              "font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums",
              valueColor
            )}
          >
            {value}
          </span>
          {sub && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {sub}
            </span>
          )}
        </div>

        {trend && (
          <span
            className={cn(
              "font-mono text-[11px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md",
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatMetricCard;
