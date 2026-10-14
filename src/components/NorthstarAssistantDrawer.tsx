import { useState, useEffect } from "react";
import { AsterMark, AsterChatMark } from "./AsterLogo";
import { CopilotChat } from "./Copilot";
import { AiSettingsModal } from "./AiSettingsModal";
import { trpc } from "@/providers/trpc";
import { X, SlidersHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NorthstarAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NorthstarAssistantDrawer({
  open,
  onOpenChange,
}: NorthstarAssistantDrawerProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const utils = trpc.useUtils();
  const clear = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      utils.ai.history.invalidate();
    },
  });

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      {/* ── Slide-over Backdrop ── */}
      <div
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 bg-background/60 backdrop-blur-xs z-50 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* ── Right-Side Slide-Over Panel ── */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 w-full sm:w-[440px] md:w-[480px] z-50 bg-background border-l border-border/80 shadow-2xl flex flex-col transform transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
      >
        {/* Drawer Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-card px-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
              <AsterChatMark size={16} className="text-background" />
            </div>
            <h3 className="text-[14px] font-semibold text-foreground font-display">
              Aster Assistant
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => clear.mutate()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer shadow-2xs active:scale-95"
              title="New thread"
            >
              <Plus size={14} strokeWidth={2.2} />
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer shadow-2xs active:scale-95"
              title="AI Settings"
            >
              <SlidersHorizontal size={13} />
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer shadow-2xs active:scale-95 ml-0.5"
              title="Close (Esc)"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Drawer Chat Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CopilotChat
            fullPage={false}
            compact={false}
            onOpenSettings={() => setSettingsOpen(true)}
            onClearHistory={() => clear.mutate()}
          />
        </div>
      </div>

      <AiSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

/**
 * Clean floating button in bottom right to open Assistant.
 * Minimalist, elegant circular design with the Northstar mark.
 */
export function NorthstarFloatingChatButton({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen?: boolean;
}) {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("aster_show_floating_assistant") !== "false";
  });

  useEffect(() => {
    const checkPref = () => {
      setShow(localStorage.getItem("aster_show_floating_assistant") !== "false");
    };
    window.addEventListener("storage", checkPref);
    return () => window.removeEventListener("storage", checkPref);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={onClick}
        aria-label={isOpen ? "Close Aster Assistant" : "Open Aster Assistant"}
        className="group relative flex items-center justify-center p-1 cursor-pointer bg-transparent border-0 outline-none focus:outline-none transition-transform"
      >
        {isOpen ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/10 dark:bg-white/10 backdrop-blur-md text-foreground transition-transform hover:scale-105 active:scale-95 shadow-sm">
            <X size={20} strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-2xl bg-white hover:bg-slate-50 dark:bg-white dark:hover:bg-slate-100 shadow-xl border border-slate-200/90 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
            <img
              src="/assets/aster_logo.png"
              srcSet="/assets/aster_logo_64.png 64w, /assets/aster_logo_128.png 128w, /assets/aster_logo_256.png 256w, /assets/aster_logo.png 632w"
              sizes="28px"
              alt="Aster Assistant"
              width={28}
              height={28}
              className="h-7 w-7 select-none object-contain pointer-events-none drop-shadow-sm transition-transform duration-300 ease-out group-hover:rotate-[20deg]"
              loading="eager"
            />
          </div>
        )}

        {/* Executive Tooltip on Hover */}
        <div className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-popover border border-border text-popover-foreground px-2.5 py-1 text-xs font-medium opacity-0 shadow-md transition-all duration-150 group-hover:opacity-100 font-sans">
          <span className="font-semibold">{isOpen ? "Close" : "Aster Assistant"}</span>
          <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">⌘/</span>
        </div>
      </button>
    </div>
  );
}

export { NorthstarFloatingChatButton as FloatingAssistantLauncher };
