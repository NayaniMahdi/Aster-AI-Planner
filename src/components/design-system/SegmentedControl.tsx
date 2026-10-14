import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * SegmentedControl
 * Studio Edition tactile view & filter switcher.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-secondary/50 p-0.5 select-none",
        size === "sm" ? "h-7 text-xs" : "h-8 text-[13px]",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-[4px] font-medium transition-all duration-120 whitespace-nowrap",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              isActive
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  "font-mono text-[9.5px] tabular-nums rounded px-1 py-0.5 leading-none",
                  isActive
                    ? "bg-secondary text-foreground font-bold"
                    : "bg-border/60 text-muted-foreground"
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
