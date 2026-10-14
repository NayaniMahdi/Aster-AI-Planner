import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { trpc } from "@/providers/trpc";
import { useFocus } from "@/providers/FocusContext";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Plus,
  Play,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  FolderKanban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Maximize2,
  Paperclip,
  Mic,
  Video,
  Headphones,
  Phone,
  Check,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { toast } from "sonner";

interface OutletContextType {
  openCapture: () => void;
  openCommandPalette: () => void;
  openDailyPlanner: () => void;
  openCopilot: () => void;
  launchFocusHUD: () => void;
  isContextDockOpen: boolean;
  toggleContextDock: () => void;
}

// Default schedule items matching the reference design image exactly
const DEFAULT_TIMELINE = [
  {
    hour: "08:00",
    event: null,
  },
  {
    hour: "09:00",
    event: {
      id: "ev-1",
      title: "Morning routine",
      category: "Personal",
      duration: "30m",
      type: "personal",
      bgClass: "bg-[#fff1f2] dark:bg-rose-950/30 border-l-[3.5px] border-[#fb7185]",
      titleClass: "text-slate-900 dark:text-slate-100",
      subClass: "text-slate-400 dark:text-slate-400",
    },
  },
  {
    hour: "10:00",
    event: {
      id: "ev-2",
      title: "Northwind intro call",
      category: "10:30 - 11:15   Zoom • Client Call",
      type: "call",
      icon: Video,
      bgClass: "bg-[#f0f9ff] dark:bg-sky-950/30 border-l-[3.5px] border-[#38bdf8]",
      titleClass: "text-slate-900 dark:text-slate-100",
      subClass: "text-[#0284c7] dark:text-sky-300",
    },
  },
  {
    hour: "11:00",
    event: {
      id: "ev-3",
      title: "QA testing and edge-case verification",
      category: "11:30 - 12:30   Nexus Cloud Architecture",
      avatar: "A",
      progress: "1/3",
      type: "project",
      bgClass: "bg-[#faf5ff] dark:bg-purple-950/30 border-l-[3.5px] border-[#c084fc]",
      titleClass: "text-slate-900 dark:text-slate-100",
      subClass: "text-[#9333ea] dark:text-purple-300",
    },
  },
  {
    hour: "12:00",
    event: null,
  },
  {
    hour: "13:00",
    event: {
      id: "ev-4",
      title: "Deep work session",
      category: "13:00 - 14:30",
      tag: "Focus time",
      icon: Headphones,
      type: "focus",
      bgClass: "bg-[#f0fdf4] dark:bg-emerald-950/30 border-l-[3.5px] border-[#34d399]",
      titleClass: "text-slate-900 dark:text-slate-100",
      subClass: "text-[#059669] dark:text-emerald-300",
    },
  },
  {
    hour: "14:00",
    event: null,
  },
  {
    hour: "15:00",
    event: {
      id: "ev-5",
      title: "Client follow-up",
      category: "15:00 - 15:30",
      tag: "Sarah Chen",
      icon: Phone,
      type: "client",
      bgClass: "bg-[#fffbeb] dark:bg-amber-950/30 border-l-[3.5px] border-[#f59e0b]",
      titleClass: "text-slate-900 dark:text-slate-100",
      subClass: "text-[#d97706] dark:text-amber-300",
    },
  },
];

// Default Tasks matching the reference design image exactly
const DEFAULT_INBOX_TASKS = [
  {
    id: 101,
    title: "Review client feedback on homepage",
    project: "Acme Redesign",
    projectColor: "#10b981",
    estimateMin: "28m",
    priority: "none",
  },
  {
    id: 102,
    title: "Draft project proposal for Marcus",
    priority: "low",
    estimateMin: "38m",
  },
  {
    id: 103,
    title: "Plan Q4 content strategy",
    project: "Ideas",
    projectColor: "#a855f7",
    estimateMin: "45m",
    priority: "none",
  },
];

const DEFAULT_IN_PROGRESS_TASKS = [
  {
    id: 201,
    title: "QA testing and edge-case verification",
    priority: "high",
    project: "Nexus Cloud",
    projectColor: "#0284c7",
  },
  {
    id: 202,
    title: "Prepare for Northwind intro call",
    priority: "high",
    avatar: "A",
  },
  {
    id: 203,
    title: "Review architecture document",
    priority: "medium",
    project: "Nexus Cloud",
    projectColor: "#0284c7",
  },
  {
    id: 204,
    title: "Update project roadmap",
    project: "Portfolio v3",
    projectColor: "#f97316",
    priority: "none",
  },
];

const DEFAULT_DONE_TASKS = [
  {
    id: 301,
    title: "Build initial protot...",
    project: "Nexus Cloud",
    projectColor: "#0284c7",
  },
  {
    id: 302,
    title: "Implement auth-fl...",
    project: "Infra",
  },
  {
    id: 303,
    title: "Fix deployment is...",
    project: "Infra",
  },
  {
    id: 304,
    title: "Design database ..",
    project: "Deep Work",
    projectColor: "#a855f7",
  },
  {
    id: 305,
    title: "Plan weekly study ..",
  },
];

export default function Command() {
  const navigate = useNavigate();
  const { openCapture, openDailyPlanner, launchFocusHUD, openCopilot } =
    useOutletContext<OutletContextType>();
  const { startFocus } = useFocus();

  const [activeTaskTab, setActiveTaskTab] = useState<"board" | "list" | "myday">("board");
  const [activeContextTab, setActiveContextTab] = useState<"notes" | "links" | "files">("notes");
  const [inputPrompt, setInputPrompt] = useState("");

  const userName =
    (typeof window !== "undefined" && localStorage.getItem("aster_user_name")) || "Abbas";

  const handlePromptClick = (text: string) => {
    setInputPrompt(text);
    if (openCopilot) openCopilot();
  };

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;
    toast.success("AI Assistant triggered");
    if (openCopilot) openCopilot();
    setInputPrompt("");
  };

  return (
    <PageContainer
      variant="studio"
      className="p-4 md:p-5 lg:p-6 space-y-4 max-w-[1720px] mx-auto min-h-screen text-slate-900 dark:text-slate-100 font-sans"
    >
      {/* ─────────────────────────────────────────────────────────────
          HERO BANNER
      ───────────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 dark:border-slate-800/80 p-5 md:py-4.5 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
        style={{
          backgroundImage: "url('/assets/mountain_panorama_hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 38%",
        }}
      >
        {/* Soft, gentle gradient overlay: luminous and clear on the left, revealing panoramic mountains on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/15 dark:from-slate-950/95 dark:via-slate-950/85 dark:to-slate-950/35 pointer-events-none" />

        {/* Hero Left Content */}
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors w-fit">
            <span>Sunday, Oct 4, 2026</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl lg:text-[34px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Good morning, {userName}.
          </h1>

          {/* Quote */}
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-300 italic font-serif">
            "A focused day builds an exceptional week."
          </p>

          {/* Action Pills */}
          <div className="flex items-center gap-2 pt-2.5 flex-wrap">
            <button
              onClick={() => {
                if (openDailyPlanner) openDailyPlanner();
                else navigate("/my-day");
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles size={13} className="text-sky-300" />
              <span>Plan my day</span>
            </button>

            <button
              onClick={openCapture}
              className="bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-sm transition-all cursor-pointer"
            >
              <Plus size={13} className="text-slate-500 dark:text-slate-400" />
              <span>Quick capture</span>
            </button>

            <button
              onClick={() => {
                if (launchFocusHUD) launchFocusHUD();
                else startFocus(25, "Deep Focus Session");
              }}
              className="bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-sm transition-all cursor-pointer"
            >
              <Play size={12} className="fill-current text-slate-600 dark:text-slate-300" />
              <span>Start focus</span>
            </button>

            <button
              onClick={() => navigate("/calendar")}
              className="bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-sm transition-all cursor-pointer"
            >
              <Calendar size={13} className="text-slate-500 dark:text-slate-400" />
              <span>View calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3-COLUMN DASHBOARD GRID
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── COLUMN 1: MY DAY (Left) ── */}
        <div className="lg:col-span-3 bg-white dark:bg-[#141b26] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 flex flex-col h-[540px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80 mb-2.5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">My Day</h2>
              <div className="flex items-center text-slate-400 gap-0.5 ml-1">
                <ChevronLeft size={15} className="hover:text-slate-700 cursor-pointer" />
                <ChevronRight size={15} className="hover:text-slate-700 cursor-pointer" />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1 flex items-center gap-0.5 cursor-pointer">
                Sun, Oct 4 <ChevronDown size={11} className="text-slate-400" />
              </span>
            </div>
            <button
              onClick={() => navigate("/my-day")}
              className="bg-sky-100/90 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-sky-200/80 transition-colors cursor-pointer"
            >
              <Sparkles size={11} className="fill-current text-sky-600 dark:text-sky-400" />
              <span>Today</span>
            </button>
          </div>

          {/* Timeline Schedule Items */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 select-none scrollbar-thin">
            {DEFAULT_TIMELINE.map((slot) => {
              const ev = slot.event;
              return (
                <div key={slot.hour} className="flex items-start gap-2.5">
                  {/* Time label */}
                  <span className="w-8 pt-1 text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0 text-left">
                    {slot.hour}
                  </span>

                  {/* Event box or empty slot */}
                  {ev ? (
                    <div
                      className={cn(
                        "flex-1 p-2 rounded-xl transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-sm cursor-pointer",
                        ev.bgClass
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={cn("text-xs font-semibold leading-tight", ev.titleClass)}>
                          {ev.title}
                        </span>
                        {ev.duration && (
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {ev.duration}
                          </span>
                        )}
                        {ev.icon && (
                          <div className="flex items-center gap-1">
                            <ev.icon size={12} className={cn("shrink-0", ev.subClass)} />
                            {ev.tag && (
                              <span className={cn("text-[9px] font-medium", ev.subClass)}>
                                {ev.tag}
                              </span>
                            )}
                          </div>
                        )}
                        {ev.avatar && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-[9px] font-bold flex items-center justify-center">
                              {ev.avatar}
                            </span>
                            {ev.progress && (
                              <span className="text-[9px] text-purple-600 dark:text-purple-300 font-semibold">
                                {ev.progress}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-0.5 text-[10px]">
                        <span className={cn("font-medium", ev.subClass)}>
                          {ev.category}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 h-3" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COLUMN 2: TASKS (Kanban Center) ── */}
        <div className="lg:col-span-6 bg-white dark:bg-[#141b26] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 flex flex-col h-[540px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Tasks</h2>
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setActiveTaskTab("board")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer",
                    activeTaskTab === "board"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  Board
                </button>
                <button
                  onClick={() => setActiveTaskTab("list")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                    activeTaskTab === "list"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  List
                </button>
                <button
                  onClick={() => setActiveTaskTab("myday")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                    activeTaskTab === "myday"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  My Day
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button className="text-xs text-slate-700 dark:text-slate-300 font-medium px-2 py-1 flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors cursor-pointer">
                <span>All Projects</span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              <button
                onClick={openCapture}
                className="p-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={14} />
              </button>
              <button className="p-1 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-colors cursor-pointer">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>

          {/* 3 Kanban Sub-Columns */}
          <div className="grid grid-cols-3 gap-3 mt-3 flex-1 overflow-hidden items-start">
            {/* Sub-column 1: Inbox */}
            <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0f1520] rounded-xl border border-slate-100 dark:border-slate-800/80 p-2">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Inbox size={13} className="text-slate-400" />
                  <span>Inbox</span>
                  <span className="text-slate-400 font-semibold text-xs ml-0.5">3</span>
                </div>
                <MoreHorizontal size={13} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                {DEFAULT_INBOX_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1a2232] rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {task.title}
                    </h4>
                    <div className="flex items-center justify-between mt-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        {task.priority === "low" && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-semibold text-[9px]">
                            Low
                          </span>
                        )}
                        {task.project && (
                          <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: task.projectColor }}
                            />
                            <span>{task.project}</span>
                          </div>
                        )}
                      </div>
                      {task.estimateMin && (
                        <span className="text-slate-400 font-medium">{task.estimateMin}</span>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={openCapture}
                  className="w-full text-left text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 pt-1.5 px-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>Add task</span>
                </button>
              </div>
            </div>

            {/* Sub-column 2: In Progress */}
            <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0f1520] rounded-xl border border-slate-100 dark:border-slate-800/80 p-2">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Clock size={13} className="text-sky-500" />
                  <span>In Progress</span>
                  <span className="text-slate-400 font-semibold text-xs ml-0.5">4</span>
                </div>
                <MoreHorizontal size={13} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                {DEFAULT_IN_PROGRESS_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1a2232] rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow cursor-pointer relative"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {task.title}
                      </h4>
                      {task.avatar && (
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-bold flex items-center justify-center shrink-0">
                          {task.avatar}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                      {task.priority === "high" && (
                        <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 px-1 py-0.5 rounded font-semibold text-[9px]">
                          High
                        </span>
                      )}
                      {task.priority === "medium" && (
                        <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 px-1 py-0.5 rounded font-semibold text-[9px]">
                          Medium
                        </span>
                      )}
                      {task.project && (
                        <div className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: task.projectColor }}
                          />
                          <span>{task.project}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={openCapture}
                  className="w-full text-left text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 pt-1.5 px-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>Add task</span>
                </button>
              </div>
            </div>

            {/* Sub-column 3: Done */}
            <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0f1520] rounded-xl border border-slate-100 dark:border-slate-800/80 p-2">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Done</span>
                  <span className="text-slate-400 font-semibold text-xs ml-0.5">5</span>
                </div>
                <MoreHorizontal size={13} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                {DEFAULT_DONE_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1a2232] rounded-xl p-2 border border-slate-200/70 dark:border-slate-700/50 shadow-sm flex items-start gap-1.5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={9} strokeWidth={3} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-normal text-slate-400 dark:text-slate-500 line-through truncate leading-tight">
                        {task.title}
                      </p>
                      {task.project && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {task.projectColor && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: task.projectColor }}
                            />
                          )}
                          <span>{task.project}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── COLUMN 3: AI ASSISTANT & CONTEXT (Right) ── */}
        <div className="lg:col-span-3 flex flex-col gap-3 h-[540px]">
          {/* Card A: AI Assistant */}
          <div className="bg-white dark:bg-[#141b26] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                <Sparkles size={15} className="text-purple-500 fill-current" />
                <h3 className="text-sm font-bold">AI Assistant</h3>
              </div>
              <button
                onClick={openCopilot}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <Maximize2 size={12} />
              </button>
            </div>

            {/* Greeting */}
            <div className="mt-0.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Good morning, {userName}!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
                How can I help you today?
              </p>
            </div>

            {/* 5 Quick Action Prompts */}
            <div className="space-y-1.5">
              {[
                "Plan my day based on my calendar",
                "Summarize unread emails",
                "Find tasks related to Nexus Cloud",
                "Prepare me for the Northwind call",
                "Show my latest client updates",
              ].map((promptText) => (
                <button
                  key={promptText}
                  onClick={() => handlePromptClick(promptText)}
                  className="w-full text-left bg-[#fbf8fe] hover:bg-purple-50/80 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 border border-purple-100/70 dark:border-purple-900/30 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-purple-200 flex items-center gap-2 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-purple-200"
                >
                  <Sparkles size={11} className="text-purple-500 shrink-0" />
                  <span className="truncate">{promptText}</span>
                </button>
              ))}
            </div>

            {/* Input field */}
            <form onSubmit={handleSendPrompt} className="mt-2 relative">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask anything..."
                className="w-full bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-2.5 pr-12 py-1.5 text-xs text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-purple-300 focus:ring-1 focus:ring-purple-200 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                <Paperclip size={12} className="cursor-pointer hover:text-slate-600" />
                <Mic size={12} className="cursor-pointer hover:text-slate-600" />
                <button type="submit" className="cursor-pointer hover:text-purple-600">
                  <Sparkles size={12} className="text-purple-500" />
                </button>
              </div>
            </form>
          </div>

          {/* Card B: Context */}
          <div className="bg-white dark:bg-[#141b26] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Context</h3>
                  <div className="flex items-center gap-2.5 text-xs">
                    <button
                      onClick={() => setActiveContextTab("notes")}
                      className={cn(
                        "font-semibold transition-colors cursor-pointer",
                        activeContextTab === "notes"
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-400 hover:text-slate-700"
                      )}
                    >
                      Notes
                    </button>
                    <button
                      onClick={() => setActiveContextTab("links")}
                      className={cn(
                        "font-medium transition-colors cursor-pointer",
                        activeContextTab === "links"
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-400 hover:text-slate-700"
                      )}
                    >
                      Links
                    </button>
                    <button
                      onClick={() => setActiveContextTab("files")}
                      className={cn(
                        "font-medium transition-colors cursor-pointer",
                        activeContextTab === "files"
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-400 hover:text-slate-700"
                      )}
                    >
                      Files
                    </button>
                  </div>
                </div>
                <ChevronRight size={13} className="text-slate-400 cursor-pointer" />
              </div>

              {/* Items List */}
              <div className="mt-2.5 space-y-2.5">
                {/* Item 1: Northwind intro call */}
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center shrink-0">
                      <Video size={14} />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                        Northwind intro call
                      </h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">Today, 10:30 - 11:15</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.info("Joining Northwind call...")}
                    className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800 shadow-sm cursor-pointer"
                  >
                    Join
                  </button>
                </div>

                {/* Item 2: Nexus Cloud Architecture */}
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-500 flex items-center justify-center shrink-0">
                      <FolderKanban size={14} />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                        Nexus Cloud Architecture
                      </h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">Project • 12 tasks</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/projects")}
                    className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800 shadow-sm cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
