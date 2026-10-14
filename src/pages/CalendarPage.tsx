import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { sig, fmtTime, COLOR_OPTIONS } from "@/lib/util";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  MapPin,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  Video,
  FileText,
  Sparkles,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/layout";

type Ev = {
  id: number;
  title: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  notes: string | null;
  color: string;
};

type ScheduledTask = {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  projectName?: string;
  projectColor?: string;
};

export default function CalendarPage() {
  const utils = trpc.useUtils();
  const feedQuery = trpc.events.calendarFeed.useQuery();

  const create = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.calendarFeed.invalidate();
      utils.events.list.invalidate();
      setCreatingForDate(null);
      toast.success("Event scheduled");
    },
  });
  const update = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.calendarFeed.invalidate();
      utils.events.list.invalidate();
      setEditing(null);
      toast.success("Event updated");
    },
  });
  const remove = trpc.events.remove.useMutation({
    onSuccess: () => {
      utils.events.calendarFeed.invalidate();
      utils.events.list.invalidate();
      setEditing(null);
      toast.success("Event deleted");
    },
  });

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editing, setEditing] = useState<Ev | null>(null);
  const [creatingForDate, setCreatingForDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const rawEvents = (feedQuery.data?.events ?? []) as Ev[];
  const tasks = (feedQuery.data?.tasks ?? []) as ScheduledTask[];

  const events = useMemo(() => {
    return rawEvents.filter((e) => {
      if (categoryFilter !== "all" && e.color !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          (e.notes && e.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rawEvents, categoryFilter, searchQuery]);

  const isSameDay = (d1: Date | string | null | undefined, d2: Date | string | null | undefined) => {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startDow = (firstDay.getDay() + 6) % 7;
    for (let i = startDow - 1; i >= 0; i--) days.push(new Date(year, month, -i));
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push(new Date(year, month + 1, i));
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400000));
  }, [currentDate]);

  const isToday = (d: Date) => isSameDay(d, new Date());
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  const handlePrev = () => {
    if (viewMode === "month")
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else if (viewMode === "week")
      setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() - 86400000));
  };

  const handleNext = () => {
    if (viewMode === "month")
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else if (viewMode === "week")
      setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    else setCurrentDate(new Date(currentDate.getTime() + 86400000));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const getItemsForDate = (date: Date) => {
    return {
      events: events.filter((e) => isSameDay(e.startAt, date)),
      tasks: tasks.filter((t) => t.dueDate && isSameDay(t.dueDate, date)),
    };
  };

  const selectedDateItems = useMemo(() => {
    return getItemsForDate(selectedDate);
  }, [selectedDate, events, tasks]);

  const monthTitle = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <PageContainer variant="contained" className="flex-1 flex flex-col space-y-4">
      {/* ── Studio Calendar Header ── */}
      <PageHeader
        eyebrow="SCHEDULE & TIMEBLOCKING"
        title={monthTitle}
        subtitle="Manage calendar events, timeblocked tasks, and milestone agenda"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground cursor-pointer"
                title="Previous"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="h-7 rounded-md px-2.5 text-xs font-medium text-foreground hover:bg-card transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground cursor-pointer"
                title="Next"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5">
              {(["month", "week", "day"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "flex h-7 items-center rounded-md px-3 text-xs font-medium capitalize transition-all cursor-pointer",
                    viewMode === mode
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        }
        primaryAction={
          <button
            type="button"
            onClick={() => setCreatingForDate(selectedDate)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>New Event</span>
          </button>
        }
      />

      {/* ── Calendar Toolbar: Search & Category Filter ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search events, locations, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer",
              categoryFilter === "all"
                ? "bg-foreground text-background font-semibold shadow-xs"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            All ({rawEvents.length})
          </button>
          {COLOR_OPTIONS.map((c) => {
            const count = rawEvents.filter((e) => e.color === c).length;
            if (count === 0 && categoryFilter !== c) return null;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === c ? "all" : c)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium capitalize transition-colors cursor-pointer",
                  categoryFilter === c
                    ? "bg-foreground text-background font-semibold shadow-xs"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: sig(c) }} />
                <span>{c}</span>
                <span className="font-mono text-[10px] tabular-nums opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Workstation: Month Grid + Day Inspector Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* Month View (8 cols) or Full Width */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {viewMode === "month" && (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground py-2.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Day Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-border/60 overflow-y-auto">
                {monthDays.map((d, idx) => {
                  const { events: dayEvents, tasks: dayTasks } = getItemsForDate(d);
                  const inMonth = isCurrentMonth(d);
                  const today = isToday(d);
                  const isSelected = isSameDay(d, selectedDate);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "min-h-[115px] p-2 flex flex-col transition-all cursor-pointer select-none relative group",
                        !inMonth && "opacity-35 bg-muted/20 dark:bg-transparent",
                        isSelected
                          ? "bg-muted/70 dark:bg-white/[0.06] ring-1.5 ring-inset ring-foreground/40 dark:ring-white/40 shadow-xs z-10"
                          : "hover:bg-muted/40 dark:hover:bg-white/[0.03]",
                        today && !isSelected && "bg-muted/30 dark:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-lg font-mono text-[11.5px] tabular-nums transition-colors",
                            today
                              ? "bg-foreground text-background shadow-xs font-bold ring-1 ring-foreground"
                              : isSelected
                              ? "bg-foreground/15 dark:bg-white/20 text-foreground font-bold ring-1 ring-foreground/25"
                              : "text-foreground/80 dark:text-slate-300 font-medium"
                          )}
                        >
                          {d.getDate()}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {dayTasks.length > 0 && (
                            <span className="flex items-center gap-0.5 font-mono text-[10.5px] text-emerald-600 dark:text-emerald-400 tabular-nums font-semibold">
                              <CheckCircle2 size={10} />
                              {dayTasks.length}
                            </span>
                          )}
                          {dayEvents.length > 0 && (
                            <span className="flex items-center gap-0.5 font-mono text-[10.5px] text-foreground/80 dark:text-white/80 tabular-nums font-bold">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Event and Task Badges */}
                      <div className="my-1.5 space-y-1.5 flex-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setEditing(e);
                            }}
                            className="truncate rounded-md px-2 py-1 text-xs font-medium tracking-normal transition-all hover:opacity-90 flex items-center justify-between gap-1 cursor-pointer"
                            style={{
                              background: `${sig(e.color)}18`,
                              color: sig(e.color),
                              borderLeft: `2.5px solid ${sig(e.color)}`,
                            }}
                          >
                            <span className="truncate text-[12px] font-semibold text-foreground/90">{e.title}</span>
                            <span className="font-mono text-[10.5px] tabular-nums font-medium opacity-80 shrink-0">
                              {fmtTime(e.startAt)}
                            </span>
                          </div>
                        ))}
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className="truncate rounded-md border border-border/80 bg-secondary/60 px-1.5 py-0.5 text-[11.5px] text-muted-foreground flex items-center gap-1 font-medium"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: sig(t.projectColor || "blue") }}
                            />
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                        {dayEvents.length + dayTasks.length > 5 && (
                          <span className="text-[10px] font-mono text-muted-foreground pl-1 block">
                            +{dayEvents.length + dayTasks.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
              <div className="grid h-full grid-cols-7 overflow-x-auto divide-x divide-border/60">
                {weekDays.map((d, di) => {
                  const { events: dayEvents, tasks: dayTasks } = getItemsForDate(d);
                  const today = isToday(d);
                  const isSelected = isSameDay(d, selectedDate);
                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "flex min-w-[130px] flex-col overflow-hidden cursor-pointer",
                        isSelected
                          ? "bg-muted/70 dark:bg-white/[0.05] ring-1 ring-inset ring-foreground/20"
                          : today
                          ? "bg-muted/30 dark:bg-white/[0.02]"
                          : ""
                      )}
                    >
                      <div className="border-b border-border/60 p-3 text-left">
                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {d.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-mono text-lg font-bold tabular-nums",
                              today
                                ? "text-foreground font-extrabold"
                                : isSelected
                                ? "text-foreground"
                                : "text-foreground/80 dark:text-white"
                            )}
                          >
                            {d.getDate()}
                          </span>
                          {today && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 overflow-y-auto p-2 min-h-[280px]">
                        {dayEvents.map((e) => (
                          <div
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setEditing(e);
                            }}
                            className="rounded-lg p-2 text-left cursor-pointer transition-all hover:scale-[1.01] shadow-2xs text-xs"
                            style={{
                              background: `${sig(e.color)}14`,
                              borderLeft: `3px solid ${sig(e.color)}`,
                            }}
                          >
                            <div
                              className="font-mono text-[11px] font-bold tabular-nums"
                              style={{ color: sig(e.color) }}
                            >
                              {fmtTime(e.startAt)} – {fmtTime(e.endAt)}
                            </div>
                            <div className="text-[13px] font-semibold text-foreground truncate mt-0.5">
                              {e.title}
                            </div>
                            {e.location && (
                              <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground truncate">
                                <MapPin size={11} />
                                <span>{e.location}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-lg border border-border/80 bg-secondary/50 p-2 text-left text-xs"
                          >
                            <div className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} />
                              <span>Task Due</span>
                            </div>
                            <div className="text-xs font-semibold text-foreground truncate mt-0.5">
                              {t.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-display text-lg font-bold text-foreground">
                  {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  {getItemsForDate(currentDate).events.length} events · {getItemsForDate(currentDate).tasks.length} tasks
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {getItemsForDate(currentDate).events.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-muted/20 border border-dashed border-border/80 space-y-2">
                    <CalendarIcon size={24} className="mx-auto text-muted-foreground opacity-60" />
                    <p className="text-xs font-semibold text-foreground">No events scheduled for this day</p>
                    <button
                      type="button"
                      onClick={() => setCreatingForDate(currentDate)}
                      className="text-xs font-medium text-foreground hover:underline cursor-pointer"
                    >
                      + Schedule an event
                    </button>
                  </div>
                ) : (
                  getItemsForDate(currentDate).events.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => setEditing(e)}
                      className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/30 cursor-pointer hover:border-foreground/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{
                            background: `${sig(e.color)}20`,
                            color: sig(e.color),
                          }}
                        >
                          <Video size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{e.title}</h4>
                          <p className="text-xs text-muted-foreground font-mono tabular-nums">
                            {fmtTime(e.startAt)} – {fmtTime(e.endAt)} {e.location ? `· ${e.location}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-foreground font-medium hover:underline">Edit</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Selected Date Day Inspector & Event Agenda (4 cols) ── */}
        <div className="lg:col-span-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <span className="font-mono text-[10.5px] uppercase font-bold text-muted-foreground tracking-wider block">
                Selected Day Agenda
              </span>
              <h3 className="text-base font-bold text-foreground font-display mt-0.5">
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setCreatingForDate(selectedDate)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.4} />
              <span>Add Event</span>
            </button>
          </div>

          {/* Events List for Selected Day */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground block">
              Events & Time slots ({selectedDateItems.events.length})
            </span>

            {selectedDateItems.events.length === 0 ? (
              <div className="p-5 text-center rounded-xl bg-muted/20 border border-dashed border-border/80 space-y-2">
                <CalendarIcon size={20} className="mx-auto text-muted-foreground opacity-60" />
                <p className="text-xs font-medium text-muted-foreground">No events on this day</p>
                <button
                  type="button"
                  onClick={() => setCreatingForDate(selectedDate)}
                  className="text-xs font-semibold text-foreground hover:underline pt-1 inline-block cursor-pointer"
                >
                  + Add Event
                </button>
              </div>
            ) : (
              selectedDateItems.events.map((e) => (
                <div
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className="rounded-xl p-3 border border-border/80 bg-muted/20 hover:border-foreground/30 transition-all cursor-pointer space-y-1.5"
                  style={{ borderLeftColor: sig(e.color), borderLeftWidth: "3px" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {e.title}
                    </span>
                    <span className="font-mono text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
                      {fmtTime(e.startAt)} – {fmtTime(e.endAt)}
                    </span>
                  </div>

                  {e.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                      <MapPin size={12} className="shrink-0" />
                      <span>{e.location}</span>
                    </div>
                  )}

                  {e.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {e.notes}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Tasks Due on Selected Day */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-xs font-semibold text-foreground block">
              Deliverables Due ({selectedDateItems.tasks.length})
            </span>

            {selectedDateItems.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No tasks due on this date.</p>
            ) : (
              selectedDateItems.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-secondary/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {t.title}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 capitalize">
                    {t.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Create / Edit Event Dialog ── */}
      {(creatingForDate || editing) && (
        <EventDialog
          initialDate={creatingForDate}
          event={editing}
          onClose={() => {
            setCreatingForDate(null);
            setEditing(null);
          }}
          onSave={async (data) => {
            if (editing) {
              await update.mutateAsync({ id: editing.id, patch: data });
            } else {
              await create.mutateAsync(data);
            }
          }}
          onDelete={async () => {
            if (editing) {
              await remove.mutateAsync({ id: editing.id });
            }
          }}
        />
      )}
    </PageContainer>
  );
}

function EventDialog({
  initialDate,
  event,
  onClose,
  onSave,
  onDelete,
}: {
  initialDate: Date | null;
  event: Ev | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    startAt: Date;
    endAt: Date;
    location?: string;
    notes?: string;
    color?: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const base = event ? new Date(event.startAt) : initialDate ?? new Date();

  const formatLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [title, setTitle] = useState(event?.title ?? "");
  const [dateStr, setDateStr] = useState(formatLocalYMD(base));
  const [startTime, setStartTime] = useState(
    event
      ? `${String(new Date(event.startAt).getHours()).padStart(2, "0")}:${String(new Date(event.startAt).getMinutes()).padStart(2, "0")}`
      : "10:00"
  );
  const [durationMin, setDurationMin] = useState(
    event
      ? Math.max(
          15,
          Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000)
        )
      : 45
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [color, setColor] = useState(event?.color ?? "blue");

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Event title required");
      return;
    }
    const [year, month, day] = dateStr.split("-").map(Number);
    const [h, m] = startTime.split(":").map(Number);
    const start = new Date(year, month - 1, day, h, m, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60000);

    await onSave({
      title: title.trim(),
      startAt: start,
      endAt: end,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#0D101A] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 pb-3">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {event ? "Edit Calendar Slot" : "New Calendar Slot"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Title *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Deep work, executive sync, client review…"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3.5 py-2 text-xs font-medium outline-none focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Date</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-1.5 text-xs outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-1.5 text-xs outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Duration</label>
            <div className="flex items-center gap-1.5">
              {[15, 30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMin(mins)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 font-mono text-xs font-medium transition-all cursor-pointer",
                    durationMin === mins
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold shadow-xs"
                      : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  )}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Location / Meeting URL</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, Zoom, Studio, Office…"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] px-3 py-2 text-xs outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Notes & Agenda</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda items, preparation checklist…"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141824] p-3 text-xs outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Signature Color</label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform cursor-pointer",
                    color === c && "ring-2 ring-slate-900 dark:ring-white ring-offset-2 scale-110"
                  )}
                  style={{ background: sig(c) }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/[0.06] dark:border-white/10 pt-3">
          {event ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} /> Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-xl bg-slate-900 dark:bg-white px-4 py-1.5 text-xs font-bold text-white dark:text-slate-950 hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Confirm Slot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
