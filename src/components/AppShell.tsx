import { useEffect, useState } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router";
import { trpc } from "@/providers/trpc";
import { QuickCapture } from "./QuickCapture";
import { CommandPalette } from "./CommandPalette";
import { DailyPlanningModal } from "./DailyPlanningModal";
import { FocusTimerModal } from "./FocusTimerModal";
import { FocusMiniHud } from "./FocusMiniHud";
import { AsterBrand } from "./AsterLogo";
import { NorthstarAssistantDrawer, NorthstarFloatingChatButton } from "./NorthstarAssistantDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  CheckCircle2,
  CalendarDays,
  FolderKanban,
  Users,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Plus,
  Search,
  Menu,
  ChevronsUpDown,
  Inbox,
  FileText,
  Calendar,
  X,
  Flame,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Calendar;
  badgeKey?: "inbox" | "tasks" | "events" | "projects" | "clients";
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: "TODAY",
    items: [
      { to: "/", label: "Today", icon: Sun },
      { to: "/my-day", label: "My Day", icon: Calendar },
      { to: "/focus", label: "Focus", icon: Flame },
    ],
  },
  {
    name: "WORK",
    items: [
      { to: "/inbox", label: "Inbox", icon: Inbox, badgeKey: "inbox" },
      { to: "/tasks", label: "Tasks", icon: CheckCircle2, badgeKey: "tasks" },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, badgeKey: "events" },
      { to: "/projects", label: "Projects", icon: FolderKanban, badgeKey: "projects" },
      { to: "/clients", label: "Clients", icon: Users, badgeKey: "clients" },
    ],
  },
  {
    name: "KNOWLEDGE",
    items: [
      { to: "/notes", label: "Notes", icon: FileText },
      { to: "/study", label: "Study", icon: GraduationCap },
      { to: "/ideas", label: "Ideas", icon: Lightbulb },
    ],
  },
  {
    name: "ASSISTANT",
    items: [
      { to: "/assistant", label: "AI Assistant", icon: Sparkles },
    ],
  },
];

const WORKSPACES = [
  { name: "Nexus Cloud", dotColor: "bg-blue-500" },
  { name: "Cyberdyne AI", dotColor: "bg-purple-500" },
  { name: "Acme Redesign", dotColor: "bg-emerald-500" },
  { name: "Portfolio v3", dotColor: "bg-amber-500" },
];

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("northstar-theme");
    if (saved) return saved === "dark";
    return true; // Default to luxury obsidian dark mode!
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("northstar-theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export default function AppShell() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [dailyPlannerOpen, setDailyPlannerOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [contextDockOpen, setContextDockOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useTheme();

  // Live badge queries
  const overview = trpc.tasks.overview.useQuery(undefined, { refetchInterval: 60000 });
  const events = trpc.events.list.useQuery(undefined, { refetchInterval: 60000 });
  const projects = trpc.projects.list.useQuery(undefined, { refetchInterval: 120000 });
  const clients = trpc.clients.list.useQuery(undefined, { refetchInterval: 120000 });

  const now = new Date();
  const todayStr = now.toDateString();
  const todayEventsCount = (events.data ?? []).filter(
    (e) => new Date(e.startAt).toDateString() === todayStr
  ).length;

  const badgeCounts: Record<string, number | string | undefined> = {
    inbox: 12,
    tasks: overview.data?.dueToday || undefined,
    events: todayEventsCount > 0 ? todayEventsCount : undefined,
    projects: (projects.data ?? []).filter((p) => p.status === "active").length || undefined,
    clients: clients.data?.length || undefined,
  };

  // Keyboard shortcut listener: ⌘K for Command, ⌘. for Context Dock, ⌘/ for Copilot
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setContextDockOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-[#F5F6FA] dark:bg-[#08090B] text-slate-900 antialiased selection:bg-sky-500/20">
      {/* ── 1. Attached Integrated Sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col text-slate-800 dark:text-slate-300 select-none transition-all duration-300 ease-out z-30 relative h-full border-r border-slate-200/90 dark:border-white/[0.08] bg-[#F1F3F7] dark:bg-[#0A0E18]",
          sidebarCollapsed ? "w-[68px]" : "w-[252px]"
        )}
      >
        {/* Rich Landscape Artwork Layer (Daylight alpine vista for light theme, aurora night for dark theme) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: dark
              ? "url('/assets/sidebar_bg.jpg')"
              : "url('/assets/sidebar_day_bg.jpg')",
          }}
        />
        {/* Ambient Contrast Scrim */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-all duration-300",
            dark
              ? "bg-gradient-to-b from-[#060913]/65 via-[#060913]/45 to-[#060913]/70"
              : "bg-gradient-to-b from-white/70 via-white/50 to-white/75 backdrop-blur-[1px]"
          )}
        />

        {/* Brand Header */}
        <div className={cn(
          "relative flex h-16 w-full items-center px-4 z-10 border-b border-slate-900/[0.07] dark:border-white/[0.08]",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          <AsterBrand
            collapsed={sidebarCollapsed}
            onClick={() => navigate("/")}
          />
        </div>

        {/* Scrollable Navigation Body (Scrollbar completely hidden) */}
        <div className={cn(
          "relative flex-1 w-full overflow-y-auto pt-3 pb-3 space-y-2.5 z-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          sidebarCollapsed ? "px-2" : "px-3"
        )}>
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.name} className="space-y-0.5">
              {!sidebarCollapsed ? (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-white/50">
                  {group.name}
                </div>
              ) : groupIdx > 0 ? (
                <div className="h-px w-8 bg-slate-900/10 dark:bg-white/[0.12] mx-auto my-2" />
              ) : null}

              {group.items.map(({ to, label, icon: Icon, badgeKey }) => {
                const badge = badgeKey ? badgeCounts[badgeKey] : undefined;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center transition-all duration-150 select-none",
                        sidebarCollapsed
                          ? cn(
                              "h-9 w-9 mx-auto justify-center rounded-[9px]",
                              isActive
                                ? "bg-slate-900/12 dark:bg-white/[0.14] backdrop-blur-md border border-slate-900/15 dark:border-white/15 text-slate-900 dark:text-white shadow-2xs font-semibold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.06] hover:backdrop-blur-xs dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.08] active:scale-95"
                            )
                          : cn(
                              "w-full h-[35px] justify-between px-3 rounded-[9px] text-[13px]",
                              isActive
                                ? "bg-slate-900/10 dark:bg-white/[0.14] backdrop-blur-md border border-slate-900/15 dark:border-white/15 text-slate-950 dark:text-white font-semibold shadow-2xs"
                                : "font-medium text-slate-700/90 hover:text-slate-950 hover:bg-slate-900/[0.06] hover:backdrop-blur-xs dark:text-slate-300/80 dark:hover:text-white dark:hover:bg-white/[0.08]"
                            )
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {sidebarCollapsed ? (
                          /* ── COLLAPSED SIDEBAR ITEM ── */
                          <div className="relative flex items-center justify-center w-full h-full">
                            <Icon
                              size={18}
                              strokeWidth={isActive ? 2.2 : 1.8}
                              className={cn(
                                "shrink-0 transition-transform duration-150",
                                isActive
                                  ? "text-slate-950 dark:text-white"
                                  : "text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white group-hover:scale-105"
                              )}
                            />

                            {/* Collapsed Notification Dot */}
                            {badgeKey === "inbox" && (
                              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0A0E18]" />
                            )}

                            {/* Collapsed Sleek Glass Hover Tooltip */}
                            <div className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 dark:bg-[#0A0E18]/95 px-3 py-1.5 text-xs font-semibold text-white shadow-2xl ring-1 ring-white/10 opacity-0 -translate-x-2 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap backdrop-blur-md">
                              <span>{label}</span>
                              {badge !== undefined && (
                                <span className="rounded-full bg-sky-500/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                                  {badge}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* ── EXPANDED SIDEBAR ITEM ── */
                          <>
                            {/* Left Content (Icon & Label) */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                size={16}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={cn(
                                  "shrink-0 transition-transform duration-150",
                                  isActive
                                    ? "text-slate-950 dark:text-white"
                                    : "text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white group-hover:scale-105"
                                )}
                              />
                              <span
                                className={cn(
                                  "truncate text-[13px] tracking-[-0.01em]",
                                  isActive
                                    ? "font-semibold text-slate-950 dark:text-white"
                                    : "text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white"
                                )}
                              >
                                {label}
                              </span>
                            </div>

                            {/* Right Content: Badge */}
                            {badge !== undefined && (
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums shrink-0 ml-2",
                                  isActive
                                    ? badgeKey === "inbox"
                                      ? "bg-rose-500 text-white"
                                      : "bg-slate-900/12 text-slate-900 border border-slate-900/15 dark:bg-white/20 dark:text-white dark:border-white/20"
                                    : badgeKey === "inbox"
                                    ? "bg-rose-500/90 text-white"
                                    : "bg-slate-900/[0.06] text-slate-600 border border-slate-900/[0.08] dark:bg-white/[0.08] dark:text-white/70 dark:border-white/[0.08]"
                                )}
                              >
                                {badge}
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Section: WORKSPACES */}
          {!sidebarCollapsed && (
            <div className="space-y-0.5 pt-2 border-t border-slate-900/[0.07] dark:border-white/[0.08]">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-white/50">
                Workspaces
              </div>

              {WORKSPACES.slice(0, 3).map((ws) => (
                <div
                  key={ws.name}
                  onClick={() => toast.info(`Switched to workspace: ${ws.name}`)}
                  className="flex items-center gap-2.5 px-3 py-1 text-[12px] text-slate-700 hover:text-slate-950 cursor-pointer rounded-[9px] hover:bg-slate-900/[0.06] hover:backdrop-blur-xs dark:text-white/75 dark:hover:text-white dark:hover:bg-white/[0.08] transition-all duration-150"
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0", ws.dotColor)} />
                  <span className="truncate">{ws.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: User Profile */}
        <div className="relative border-t border-slate-900/[0.07] dark:border-white/[0.08] p-3 w-full z-10 bg-white/40 dark:bg-black/10 backdrop-blur-xs">
          <div
            className={cn(
              "flex items-center rounded-xl p-1.5 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08] transition-all duration-150 cursor-pointer",
              sidebarCollapsed ? "justify-center" : "justify-between"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0" title={sidebarCollapsed ? "Abbas · Studio Workspace" : undefined}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-white/80 text-white dark:text-slate-900 font-bold text-xs shrink-0 shadow-sm ring-1 ring-black/10 dark:ring-white/20">
                A
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-white block truncate leading-none">
                    Abbas
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-white/45 truncate block mt-0.5">
                    Studio Workspace
                  </span>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={toggle}
                className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-900/[0.08] dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.1] transition-colors"
                title="Toggle Theme"
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── 2. Main Studio Workstation Area ── */}
      <div className="relative flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-[#F6F8FC] dark:bg-[#07090F] transition-colors">
        {/* Subtle Ambient Aurora Lighting */}
        <div className="pointer-events-none absolute -top-40 right-10 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-indigo-500/8 via-sky-500/5 to-transparent dark:from-indigo-500/12 dark:via-sky-500/8 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -left-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-sky-500/6 via-cyan-500/4 to-transparent dark:from-sky-500/10 dark:via-cyan-500/6 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-[380px] w-[380px] rounded-full bg-gradient-to-tl from-violet-500/5 via-indigo-500/4 to-transparent dark:from-violet-500/8 dark:via-indigo-500/6 blur-3xl" />

        {/* Top Global Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#090C12]/95 px-5 lg:px-7 backdrop-blur-xl select-none z-20 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors">
          {/* Left: 3-line Hamburger Sidebar Toggle + Clean Unified Search Bar */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileDrawerOpen((v) => !v);
                } else {
                  setSidebarCollapsed((v) => !v);
                }
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-2xs active:scale-95 cursor-pointer"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label="Toggle navigation sidebar"
            >
              <Menu size={16} strokeWidth={2.2} />
            </button>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="group flex h-9 w-60 sm:w-72 md:w-80 lg:w-96 items-center gap-2.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 px-3.5 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
            >
              <Search size={14} className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              <span className="truncate text-[12.5px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 font-normal">
                Search or type a command...
              </span>
              <kbd className="ml-auto flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-300 shadow-2xs group-hover:border-slate-300 dark:group-hover:border-white/20 group-hover:text-slate-600 dark:group-hover:text-white transition-colors shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Studio Quick Actions & Account Profile */}
          <div className="flex items-center gap-2.5 shrink-0">

            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-950 px-3.5 text-[12.5px] font-semibold text-white hover:bg-black dark:hover:bg-slate-200 active:scale-[0.97] transition-all shadow-xs cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>New</span>
              <ChevronsUpDown size={11} className="opacity-60" />
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => toast.info("No unread alerts")}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-white/[0.05] text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Notifications"
              >
                <Inbox size={15} />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-white/10 shrink-0 mx-0.5" />

            {/* Account Avatar */}
            <button
              type="button"
              onClick={() => toast.info("Signed in as Abbas · Studio Workspace")}
              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-800 dark:from-sky-500 dark:to-indigo-600 text-white font-semibold text-[13px] shadow-xs ring-2 ring-slate-200/90 dark:ring-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none"
              title="Abbas · Studio Workspace"
              aria-label="Account: Abbas"
            >
              <span>A</span>
            </button>
          </div>
        </header>

        {/* ── Persistent Floating Focus HUD (Appears top right below avatar on any dashboard page) ── */}
        <FocusMiniHud />

        {/* ── Content Viewport (Full Height, Edge-to-Edge with Smooth Horizon Page Reveal) ── */}
        <main
          key={location.pathname}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col animate-[page-reveal_240ms_cubic-bezier(0.16,1,0.3,1)]"
        >
          <Outlet
            context={{
              openCapture: () => setCaptureOpen(true),
              openCommandPalette: () => setCommandPaletteOpen(true),
              openDailyPlanner: () => setDailyPlannerOpen(true),
              openCopilot: () => setCopilotOpen(true),
              launchFocusHUD: () => navigate("/focus"),
              isContextDockOpen: contextDockOpen,
              toggleContextDock: () => setContextDockOpen((v) => !v),
            }}
          />
        </main>
      </div>

      {/* ── Mobile Navigation Drawer with Connected Active Tab Language ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative flex flex-col w-[260px] h-full bg-[#F1F3F7] dark:bg-[#0A0E18] text-slate-800 dark:text-slate-300 z-10 shadow-2xl overflow-hidden">
            {/* Rich Artwork Layer (Daylight alpine vista for light theme, aurora night for dark theme) */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-all duration-300"
              style={{
                backgroundImage: dark
                  ? "url('/assets/sidebar_bg.jpg')"
                  : "url('/assets/sidebar_day_bg.jpg')",
              }}
            />
            {/* Ambient Contrast Scrim */}
            <div
              className={cn(
                "absolute inset-0 pointer-events-none transition-all duration-300",
                dark
                  ? "bg-gradient-to-b from-[#060913]/65 via-[#060913]/45 to-[#060913]/70"
                  : "bg-gradient-to-b from-white/70 via-white/50 to-white/75 backdrop-blur-[1px]"
              )}
            />

            <div className="relative flex h-16 items-center justify-between px-4 border-b border-slate-900/[0.07] dark:border-white/[0.08] z-10">
              <AsterBrand
                onClick={() => {
                  navigate("/");
                  setMobileDrawerOpen(false);
                }}
              />
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto py-3 px-3 space-y-3 z-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {NAV_GROUPS.map((group) => (
                <div key={group.name} className="space-y-1">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-white/50">
                    {group.name}
                  </div>
                  {group.items.map(({ to, label, icon: Icon, badgeKey }) => {
                    const badge = badgeKey ? badgeCounts[badgeKey] : undefined;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center w-full h-[38px] justify-between px-3 rounded-[10px] text-[13px] transition-all duration-150 select-none",
                            isActive
                              ? "bg-slate-900/10 dark:bg-white/[0.14] backdrop-blur-md border border-slate-900/15 dark:border-white/15 text-slate-950 dark:text-white font-semibold"
                              : "font-medium text-slate-700/90 hover:text-slate-950 hover:bg-slate-900/[0.06] hover:backdrop-blur-xs dark:text-slate-300/80 dark:hover:text-white dark:hover:bg-white/[0.08]"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "text-white" : "text-slate-400"} />
                              <span className={cn("truncate text-[13px]", isActive ? "text-white font-semibold" : "text-slate-300")}>{label}</span>
                            </div>
                            {badge !== undefined && (
                              <span className={cn(
                                "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none shrink-0 ml-2",
                                isActive ? "bg-white/20 text-white border border-white/20" : "bg-white/[0.08] text-white/70 border border-white/[0.08]"
                              )}>
                                {badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals & Drawers ── */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onLaunchFocus={() => setFocusModalOpen(true)}
        onOpenDailyPlanner={() => setDailyPlannerOpen(true)}
        onOpenCapture={() => setCaptureOpen(true)}
      />

      <DailyPlanningModal
        open={dailyPlannerOpen}
        onOpenChange={setDailyPlannerOpen}
      />

      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
      />

      <FocusTimerModal
        open={focusModalOpen}
        onOpenChange={setFocusModalOpen}
      />

      {/* ── Floating Action Button: Chat with Northstar (Bottom Right) ── */}
      <NorthstarFloatingChatButton
        onClick={() => setCopilotOpen((v) => !v)}
        isOpen={copilotOpen}
      />

      {/* ── Slide-over Assistant Drawer (Right Edge) ── */}
      <NorthstarAssistantDrawer
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
      />
    </div>
  );
}
