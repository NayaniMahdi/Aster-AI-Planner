import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "contained" | "studio" | "full-bleed";
  children: React.ReactNode;
}

/**
 * Standardized Page Container primitive across all Aster workspaces.
 * - 'contained': Clean standard boundary for Tasks, Projects, Clients, Calendar, Study, Ideas, My Day
 * - 'studio': Ultra-wide panoramic canvas for Command / Dashboard
 * - 'full-bleed': Zero margin flex viewport for Inbox, Notes, Copilot
 */
export function PageContainer({
  variant = "contained",
  className,
  children,
  ...props
}: PageContainerProps) {
  if (variant === "full-bleed") {
    return (
      <div
        className={cn(
          "flex-1 min-h-0 w-full overflow-hidden bg-background text-foreground select-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  const maxWidthClass =
    variant === "studio"
      ? "max-w-[1720px] p-4 lg:p-6 space-y-5"
      : "max-w-[1560px] p-4 sm:p-6 lg:p-8 space-y-6";

  return (
    <div
      className={cn(
        "w-full mx-auto select-none transition-colors",
        maxWidthClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default PageContainer;
