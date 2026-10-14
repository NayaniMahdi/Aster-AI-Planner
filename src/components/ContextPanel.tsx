import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X, Sparkles, SlidersHorizontal, ChevronRight } from "lucide-react";

interface ContextPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  badge?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * ContextPanel
 * Studio Edition right-side contextual surface / inspector.
 * Appears contextually without permanently consuming central workspace width.
 */
export function ContextPanel({
  open,
  onClose,
  title = "Context & Intelligence",
  badge,
  icon,
  children,
  className,
}: ContextPanelProps) {
  if (!open) return null;

  return (
    <aside
      className={cn(
        "hidden xl:flex w-[320px] 2xl:w-[350px] shrink-0 flex-col border-l border-border bg-card/60 backdrop-blur-sm select-none transition-all duration-200",
        className
      )}
    >
      {/* Panel Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 px-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon ?? <Sparkles size={14} className="text-primary shrink-0" />}
          <span className="truncate text-xs font-semibold tracking-tight text-foreground">
            {title}
          </span>
          {badge && (
            <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Collapse context panel (⌘.)"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {children}
      </div>
    </aside>
  );
}
