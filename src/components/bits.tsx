import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { sig } from "@/lib/util";
import { Check } from "lucide-react";

/** Studio surface panel with subtle hairline border */
export function Panel({
  children,
  className,
  glow: _glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card transition-colors duration-150",
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  right,
  className,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border/80 px-4 py-2.5 sm:px-5",
        className
      )}
    >
      <span className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </span>
      {right}
    </div>
  );
}

/** Precision micro status dot */
export function StatusDot({
  color = "blue",
  size = 6,
  pulse = false,
  className,
}: {
  color?: string;
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  const c = sig(color);
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", pulse && "anim-pulse-dot", className)}
      style={{ width: size, height: size, background: c }}
    />
  );
}

/** Refined studio pill badge */
export function Pill({
  children,
  color = "blue",
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  const c = sig(color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium tracking-tight",
        "border border-current/15",
        className
      )}
      style={{ color: c, background: `${c}12` }}
    >
      {children}
    </span>
  );
}

/** Linear-style priority indicator with miniature bars */
export function PriorityBar({
  priority,
  showLabel = false,
  className,
}: {
  priority: "low" | "medium" | "high" | "urgent" | string;
  showLabel?: boolean;
  className?: string;
}) {
  const count =
    priority === "urgent" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  const colorClass =
    priority === "urgent"
      ? "bg-rose-500"
      : priority === "high"
      ? "bg-amber-500"
      : priority === "medium"
      ? "bg-blue-500"
      : "bg-muted-foreground/35";

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} title={`Priority: ${priority}`}>
      <div className="flex items-end gap-[2px] h-3">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-[2px] rounded-[1px] transition-all",
              bar <= count ? colorClass : "bg-border/70"
            )}
            style={{ height: `${bar * 25 + 15}%` }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-[11px] font-medium capitalize text-muted-foreground">
          {priority}
        </span>
      )}
    </div>
  );
}

/** Hardware check button with tactile feedback */
export function RadarCheck({
  checked,
  onChange,
  color = "blue",
  size = 16,
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
  size?: number;
}) {
  const c = sig(color);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      aria-pressed={checked}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-120",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        checked
          ? "border-transparent text-white"
          : "border border-border/90 bg-card hover:border-muted-foreground/50 hover:bg-secondary/60"
      )}
      style={{
        width: size,
        height: size,
        background: checked ? c : undefined,
      }}
    >
      {checked && <Check size={size * 0.65} strokeWidth={2.8} className="text-white" />}
    </button>
  );
}

/** Segmented gauge bar */
export function GaugeBars({
  value,
  max,
  segments = 10,
  color = "blue",
  className,
}: {
  value: number;
  max: number;
  segments?: number;
  color?: string;
  className?: string;
}) {
  const lit = Math.round((Math.min(value, max) / Math.max(max, 1)) * segments);
  return (
    <div className={cn("flex items-center gap-[2.5px]", className)}>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-[5px] rounded-[1px] transition-all duration-200"
          style={{
            background: i < lit ? sig(color) : "hsl(var(--muted-foreground) / 0.15)",
          }}
        />
      ))}
    </div>
  );
}

/** Studio empty state with minimal graphic cues */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-secondary/20 px-6 py-10 text-center">
      {icon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-foreground tracking-tight">{title}</p>
      {hint && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

/** Large numerical readout */
export function Readout({
  value,
  label,
  color,
  sub,
}: {
  value: string | number;
  label: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div>
      <div
        className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums"
        style={color ? { color: sig(color) } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

/** Restrained Stat Card (Replaces oversized AI card with clean typography & tabular numerals) */
export function AppleStatCard({
  label,
  value,
  sub,
  icon,
  iconBg: _iconBg,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  iconBg?: string;
  valueColor?: string;
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3.5 transition-colors duration-150 hover:bg-secondary/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className="text-muted-foreground/75 transition-colors group-hover:text-foreground">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums",
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   V2 Foundation Primitives
   ───────────────────────────────────────────────────────────────────────────── */

/** Standardized V2 Page Header */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-4", className)}>
      <div>
        {eyebrow && (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground leading-normal max-w-xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Clean Section Header */
export function SectionHeader({
  title,
  right,
  className,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-border/80 pb-2 mb-3", className)}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      {right}
    </div>
  );
}

/** High-Density Metric Strip */
export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x rounded-lg border border-border bg-card", className)}>
      {children}
    </div>
  );
}

export function MetricItem({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("p-3.5 sm:p-4", className)}>
      <div className="font-mono text-xl sm:text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-muted-foreground tracking-tight">
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/75 truncate">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Unified Tactile Checkbox */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none text-xs text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border/90 bg-card hover:border-muted-foreground/60"
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

/** Clean Status Badge */
export function StatusBadge({
  label,
  color = "blue",
  dot = true,
  className,
}: {
  label: string;
  color?: string;
  dot?: boolean;
  className?: string;
}) {
  const c = sig(color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground bg-secondary/50",
        className
      )}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: c }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
