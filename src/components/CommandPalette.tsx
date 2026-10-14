import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  CheckCircle2,
  Calendar,
  FolderKanban,
  Users,
  Lightbulb,
  Sparkles,
  Play,
  Plus,
  Sun,
  Moon,
  ArrowRight,
  Clock,
  Compass,
  FileText,
  Inbox,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBar } from "./bits";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunchFocus?: () => void;
  onOpenDailyPlanner?: () => void;
  onOpenCapture?: () => void;
}

type Category = "all" | "actions" | "tasks" | "projects" | "clients" | "navigation";

export function CommandPalette({
  open,
  onOpenChange,
  onLaunchFocus,
  onOpenDailyPlanner,
  onOpenCapture,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Queries for live real database search
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { enabled: open });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: open });
  const clientsQuery = trpc.clients.list.useQuery(undefined, { enabled: open });
  const eventsQuery = trpc.events.list.useQuery(undefined, { enabled: open });
  const ideasQuery = trpc.ideas.list.useQuery(undefined, { enabled: open });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      utils.events.calendarFeed.invalidate();
      toast.success("Task created");
      onOpenChange(false);
    },
  });

  // Reset query and selected index on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setCategory("all");
    }
  }, [open]);

  // Actions list
  const systemActions = useMemo(() => {
    return [
      {
        id: "act-plan-day",
        title: "Plan My Day with AI",
        sub: "Sunsama-inspired guided daily planning & timeboxing",
        category: "actions" as const,
        icon: Sparkles,
        iconColor: "text-primary",
        run: () => {
          onOpenChange(false);
          onOpenDailyPlanner?.();
        },
      },
      {
        id: "act-quick-capture",
        title: "Quick Capture Task / Event / Idea",
        sub: "Capture anything with natural language parsing",
        category: "actions" as const,
        icon: Plus,
        iconColor: "text-foreground",
        run: () => {
          onOpenChange(false);
          onOpenCapture?.();
        },
      },
      {
        id: "act-start-focus",
        title: "Start Focus Session",
        sub: "Enter distraction-free deep work chamber",
        category: "actions" as const,
        icon: Play,
        iconColor: "text-emerald-500",
        run: () => {
          onOpenChange(false);
          onLaunchFocus?.();
        },
      },
      {
        id: "act-toggle-theme",
        title: "Toggle Light / Dark Theme",
        sub: "Switch between Alabaster & Void Obsidian",
        category: "actions" as const,
        icon: Sun,
        iconColor: "text-amber-500",
        run: () => {
          const isDark = document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", !isDark);
          localStorage.setItem("northstar-theme", !isDark ? "dark" : "light");
          toast.success(!isDark ? "Obsidian mode active" : "Alabaster mode active");
          onOpenChange(false);
        },
      },
      // Navigation
      {
        id: "nav-today",
        title: "Go to Today (Overview)",
        sub: "Daily operational command center",
        category: "navigation" as const,
        icon: Compass,
        run: () => {
          navigate("/");
          onOpenChange(false);
        },
      },
      {
        id: "nav-inbox",
        title: "Go to Inbox",
        sub: "Unified communications & email triage",
        category: "navigation" as const,
        icon: Inbox,
        run: () => {
          navigate("/inbox");
          onOpenChange(false);
        },
      },
      {
        id: "nav-tasks",
        title: "Go to Tasks Workspace",
        sub: "Lists, Kanban, Backlog & Scheduling",
        category: "navigation" as const,
        icon: CheckCircle2,
        run: () => {
          navigate("/tasks");
          onOpenChange(false);
        },
      },
      {
        id: "nav-calendar",
        title: "Go to Calendar",
        sub: "Timeboxing & schedule planning",
        category: "navigation" as const,
        icon: Calendar,
        run: () => {
          navigate("/calendar");
          onOpenChange(false);
        },
      },
      {
        id: "nav-projects",
        title: "Go to Projects",
        sub: "Active workspaces & project milestones",
        category: "navigation" as const,
        icon: FolderKanban,
        run: () => {
          navigate("/projects");
          onOpenChange(false);
        },
      },
      {
        id: "nav-clients",
        title: "Go to Clients CRM",
        sub: "Client dossiers & relationship pipeline",
        category: "navigation" as const,
        icon: Users,
        run: () => {
          navigate("/clients");
          onOpenChange(false);
        },
      },
      {
        id: "nav-notes",
        title: "Go to Notes",
        sub: "Structured documents & knowledge",
        category: "navigation" as const,
        icon: FileText,
        run: () => {
          navigate("/notes");
          onOpenChange(false);
        },
      },
      {
        id: "nav-study",
        title: "Go to Study",
        sub: "Deep work tracks & learning progress",
        category: "navigation" as const,
        icon: GraduationCap,
        run: () => {
          navigate("/study");
          onOpenChange(false);
        },
      },
      {
        id: "nav-ideas",
        title: "Go to Ideas",
        sub: "Brainstorming & AI strategy expansion",
        category: "navigation" as const,
        icon: Lightbulb,
        run: () => {
          navigate("/ideas");
          onOpenChange(false);
        },
      },
      {
        id: "nav-assistant",
        title: "Go to AI Assistant",
        sub: "Operational AI workspace copilot",
        category: "navigation" as const,
        icon: Sparkles,
        run: () => {
          navigate("/assistant");
          onOpenChange(false);
        },
      },
    ];
  }, [navigate, onOpenChange, onLaunchFocus, onOpenDailyPlanner, onOpenCapture]);

  // Aggregate and filter results
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: Array<{
      id: string;
      title: string;
      sub?: string;
      category: Category;
      icon: typeof CheckCircle2;
      iconColor?: string;
      priority?: string;
      badge?: string;
      run: () => void;
    }> = [];

    // 1. Actions & Navigation
    if (category === "all" || category === "actions" || category === "navigation") {
      for (const item of systemActions) {
        if (category !== "all" && item.category !== category) continue;
        if (!q || item.title.toLowerCase().includes(q) || item.sub?.toLowerCase().includes(q)) {
          results.push(item);
        }
      }
    }

    // 2. Real Tasks
    if (category === "all" || category === "tasks") {
      const tasks = tasksQuery.data ?? [];
      for (const t of tasks) {
        if (!q || t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)) {
          results.push({
            id: `task-${t.id}`,
            title: t.title,
            sub: t.status === "done" ? "Completed task" : `Task · ${t.status}`,
            category: "tasks",
            icon: CheckCircle2,
            iconColor: t.status === "done" ? "text-emerald-500" : "text-primary",
            priority: t.priority ?? "medium",
            badge: t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : undefined,
            run: () => {
              navigate("/tasks");
              onOpenChange(false);
            },
          });
        }
      }
    }

    // 3. Real Projects
    if (category === "all" || category === "projects") {
      const projects = projectsQuery.data ?? [];
      for (const p of projects) {
        if (!q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) {
          results.push({
            id: `proj-${p.id}`,
            title: p.name,
            sub: `Project · ${p.progress}% completed · ${p.taskCount} tasks`,
            category: "projects",
            icon: FolderKanban,
            badge: p.status,
            run: () => {
              navigate("/projects");
              onOpenChange(false);
            },
          });
        }
      }
    }

    // 4. Real Clients
    if (category === "all" || category === "clients") {
      const clients = clientsQuery.data ?? [];
      for (const c of clients) {
        if (!q || c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)) {
          results.push({
            id: `client-${c.id}`,
            title: c.name,
            sub: `${c.company ? `${c.company} · ` : ""}Client dossier (${c.status})`,
            category: "clients",
            icon: Users,
            badge: c.health,
            run: () => {
              navigate("/clients");
              onOpenChange(false);
            },
          });
        }
      }
    }

    // 5. Quick inline creation if user typed something not matching
    if (q && (category === "all" || category === "tasks")) {
      results.unshift({
        id: "inline-create-task",
        title: `Create task: "${query.trim()}"`,
        sub: "Press Enter to create immediately in Inbox",
        category: "actions",
        icon: Plus,
        iconColor: "text-foreground font-bold",
        run: () => {
          createTask.mutate({ title: query.trim(), status: "inbox", priority: "medium" });
        },
      });
    }

    return results;
  }, [
    query,
    category,
    systemActions,
    tasksQuery.data,
    projectsQuery.data,
    clientsQuery.data,
    navigate,
    onOpenChange,
    createTask,
  ]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) current.run();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Global Command Center</DialogTitle>
        <DialogDescription className="sr-only">
          Search tasks, projects, clients, notes, or run workspace actions
        </DialogDescription>

        <div className="flex flex-col h-[520px]" onKeyDown={handleKeyDown}>
          {/* Top Search Input Box */}
          <div className="flex h-13 items-center gap-3 border-b border-border px-4">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, projects, clients, or type a command…"
              className="flex-1 bg-transparent text-[14px] font-normal text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                Clear
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Filter Categories Ribbon */}
          <div className="flex items-center gap-1 border-b border-border/70 bg-secondary/30 px-3 py-1.5 overflow-x-auto text-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "actions", label: "Actions" },
                { id: "tasks", label: "Tasks" },
                { id: "projects", label: "Projects" },
                { id: "clients", label: "Clients" },
                { id: "navigation", label: "Navigation" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  category === cat.id
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-muted-foreground">
                <Search size={24} className="mb-2 opacity-40" />
                <p className="text-xs font-medium text-foreground">No matching items found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try searching for another keyword or press ESC to dismiss.
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => item.run()}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left cursor-pointer transition-colors duration-100",
                      isSelected
                        ? "bg-secondary text-foreground font-medium"
                        : "text-foreground/80 hover:bg-secondary/60"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card",
                          item.iconColor
                        )}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {item.title}
                          </span>
                          {item.priority && (
                            <PriorityBar priority={item.priority} className="shrink-0" />
                          )}
                          {item.badge && (
                            <span className="font-mono text-[9px] uppercase tracking-wider rounded border border-border px-1 text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.sub && (
                          <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {item.sub}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && (
                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                          <span>Select</span>
                          <kbd className="rounded border border-border bg-card px-1 py-0.5">↵</kbd>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Raycast-style tactile footer */}
          <div className="flex h-10 items-center justify-between border-t border-border bg-card px-4 text-[11px] text-muted-foreground select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9.5px]">↑</kbd>
                <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9.5px]">↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9.5px]">↵</kbd>
                <span>open</span>
              </span>
            </div>

            <div className="flex items-center gap-1 text-[10.5px]">
              <Compass size={11} className="text-primary" />
              <span>Aster Command</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
