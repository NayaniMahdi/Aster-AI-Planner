import React from "react";
import { cn } from "@/lib/utils";

export type PrimaryActionConfig = {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  onClick?: () => void;
  disabled?: boolean;
};

export interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  primaryAction?: React.ReactNode | PrimaryActionConfig;
  children?: React.ReactNode;
  className?: string;
  border?: boolean;
}

/**
 * Standardized Page Header primitive for all Aster pages.
 * Enforces unified typography:
 * - Eyebrow: Geist Mono uppercase category tracker
 * - Title: Outfit Display bold title
 * - Description: Plus Jakarta Sans muted body
 * - Actions & Switchers: Harmonized height and segmented controls
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  subtitle,
  badge,
  actions,
  primaryAction,
  children,
  className,
  border = true,
}: PageHeaderProps) {
  const finalDescription = description ?? subtitle;

  let renderedPrimaryAction: React.ReactNode = null;
  if (React.isValidElement(primaryAction)) {
    renderedPrimaryAction = primaryAction;
  } else if (primaryAction && typeof primaryAction === "object" && "label" in primaryAction) {
    const config = primaryAction as PrimaryActionConfig;
    const Icon = config.icon;
    renderedPrimaryAction = (
      <button
        type="button"
        onClick={config.onClick}
        disabled={config.disabled}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
      >
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        <span>{config.label}</span>
      </button>
    );
  } else if (primaryAction) {
    renderedPrimaryAction = primaryAction as React.ReactNode;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        border && "border-b border-border/60 pb-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Column: Eyebrow, Title & Context Description */}
        <div className="min-w-0">
          {eyebrow && (
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 block mb-1">
              {eyebrow}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          {finalDescription && (
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl font-normal leading-relaxed">
              {finalDescription}
            </p>
          )}
        </div>

        {/* Right Column: Segmented View Switchers, Search & Primary CTA */}
        {(actions || renderedPrimaryAction) && (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            {actions}
            {renderedPrimaryAction}
          </div>
        )}
      </div>

      {children && <div className="pt-1">{children}</div>}
    </div>
  );
}

export default PageHeader;
