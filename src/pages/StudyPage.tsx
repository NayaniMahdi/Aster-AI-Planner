import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Panel, EmptyState } from "@/components/bits";
import { PageContainer, PageHeader, StatMetricCard } from "@/components/layout";
import { sig, COLOR_OPTIONS } from "@/lib/util";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  Trash2,
  GraduationCap,
  BookOpen,
  Play,
  BarChart2,
  Target,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { FocusTimerModal } from "@/components/FocusTimerModal";

type StudyTrack = {
  id: number;
  subject: string;
  goal: string | null;
  color: string;
  targetMinPerWeek: number;
  totalMin: number;
  weekMin: number;
  sessionCount: number;
  recent: Array<{ id: number; minutes: number; note: string | null; studiedAt: Date }>;
};

export default function StudyPage() {
  const utils = trpc.useUtils();
  const study = trpc.study.list.useQuery();
  const focus = trpc.focus.stats.useQuery();
  const logSession = trpc.study.logSession.useMutation({
    onSuccess: () => {
      utils.study.list.invalidate();
      utils.focus.stats.invalidate();
    },
  });
  const removeTrack = trpc.study.removeTrack.useMutation({
    onSuccess: () => {
      utils.study.list.invalidate();
      toast.success("Subject track removed");
    },
  });

  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [note, setNote] = useState("");
  const [liveStudyTrack, setLiveStudyTrack] = useState<{ id: number; title: string } | null>(null);

  const tracks = (study.data ?? []) as StudyTrack[];
  const totalWeekMin = tracks.reduce((a, t) => a + t.weekMin, 0);
  const totalTargetMin = tracks.reduce((a, t) => a + t.targetMinPerWeek, 0);
  const overallPct = totalTargetMin ? Math.min(100, Math.round((totalWeekMin / totalTargetMin) * 100)) : 0;

  return (
    <PageContainer variant="contained" className="space-y-6">
      {/* ── Studio Header ── */}
      <PageHeader
        eyebrow="DEEP WORK & KNOWLEDGE MASTERY"
        title="Study & Disciplines"
        primaryAction={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>New Subject</span>
          </button>
        }
      />

      {/* ── Executive Metrics Matrix ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMetricCard
          label="STUDY OUTPUT (WEEK)"
          value={`${Math.round(totalWeekMin / 60)}h ${totalWeekMin % 60}m`}
          sub="logged sessions"
          icon={<GraduationCap size={14} />}
          iconColor="primary"
        />
        <StatMetricCard
          label="WEEKLY QUOTA PACE"
          value={`${overallPct}%`}
          sub="of target output"
          icon={<Target size={14} />}
          iconColor="emerald"
        />
        <StatMetricCard
          label="ACTIVE SUBJECTS"
          value={tracks.length}
          sub="disciplines tracked"
          icon={<BookOpen size={14} />}
          iconColor="purple"
        />
        <StatMetricCard
          label="DEEP WORK TODAY"
          value={`${focus.data?.todayMin ?? 0}m`}
          sub="focus session logged"
          icon={<Timer size={14} />}
          iconColor="amber"
        />
      </div>

      {/* ── Subjects & Sessions Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Subject Tracks Cards */}
        <div className="space-y-4 lg:col-span-2">
          {tracks.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={24} strokeWidth={1.3} />}
              title="No Study Disciplines Tracked Yet"
              hint="Add a topic or discipline you're mastering — e.g. System Architecture, Type Theory, or Mandarin."
              action={
                <button
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-medium text-background hover:opacity-90 transition-all shadow-sm"
                >
                  <Plus size={13} /> Add Subject Track
                </button>
              }
            />
          ) : (
            tracks.map((t) => {
              const pct = Math.min(100, Math.round((t.weekMin / t.targetMinPerWeek) * 100));
              return (
                <div
                  key={t.id}
                  className="anim-rise rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs dark:border-white/[0.08]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs shadow-xs"
                        style={{ background: sig(t.color || "blue") }}
                      >
                        <BookOpen size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
                            {t.subject}
                          </h3>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t.sessionCount} sessions
                          </span>
                        </div>
                        {t.goal && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {t.goal}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setLiveStudyTrack({ id: t.id, title: `Study: ${t.subject}` })
                        }
                        className="flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm"
                        title="Start live focus timer for this subject"
                      >
                        <Play size={9} className="fill-current text-primary" />
                        <span>Live Study</span>
                      </button>

                      <button
                        onClick={() => {
                          setLogging(t.id);
                          setMinutes(25);
                          setNote("");
                        }}
                        className="flex h-7 items-center gap-1 rounded-md border border-border/80 bg-secondary/30 px-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-all"
                      >
                        <Plus size={12} />
                        <span>Log Time</span>
                      </button>

                      <button
                        onClick={() => removeTrack.mutate({ id: t.id })}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Goal */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                      <span className="text-muted-foreground font-mono">
                        {t.weekMin}m / {t.targetMinPerWeek}m weekly target
                      </span>
                      <span className="font-mono font-bold tabular-nums" style={{ color: sig(t.color) }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: sig(t.color) }}
                      />
                    </div>
                  </div>

                  {/* Inline Session Logger */}
                  {logging === t.id && (
                    <div className="rounded-lg border border-border/80 bg-secondary/25 p-3.5 space-y-3">
                      <span className="text-xs font-semibold text-foreground">Log Completed Session</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-card rounded-md p-1 border border-border/70">
                          {[15, 25, 45, 60, 90].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMinutes(m)}
                              className={cn(
                                "rounded px-2 py-0.5 font-mono text-xs font-medium transition-all",
                                minutes === m
                                  ? "bg-foreground text-background font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="What did you focus on / master?"
                          className="h-8 flex-1 min-w-[160px] rounded-md border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary"
                        />

                        <button
                          onClick={async () => {
                            await logSession.mutateAsync({
                              trackId: t.id,
                              minutes,
                              note: note || undefined,
                            });
                            toast.success(`+${minutes} min logged to ${t.subject}!`);
                            setLogging(null);
                          }}
                          className="flex h-8 items-center gap-1 rounded-md bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setLogging(null)}
                          className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recent Sessions History */}
                  {t.recent.length > 0 && (
                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                      <span className="label-eyebrow block">
                        Recent Study Logs
                      </span>
                      <div className="space-y-1">
                        {t.recent.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-1.5"
                          >
                            <span className="truncate">{s.note || "Deep Study Session"}</span>
                            <span className="font-mono text-xs font-medium text-foreground shrink-0 tabular-nums">
                              {s.minutes} min · {new Date(s.studiedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Col: 14-Day Focus Velocity & Deep Work Stats */}
        <div className="space-y-6">
          <Panel className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="label-eyebrow block">Velocity Trend</span>
                <h3 className="text-sm font-semibold text-foreground">Deep Work Output</h3>
                <span className="text-xs text-muted-foreground">Focus minutes over 14 days</span>
              </div>
              <BarChart2 size={16} className="text-primary" />
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={focus.data?.history ?? []}>
                  <defs>
                    <linearGradient id="studyFocusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#studyFocusGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      {/* Create Subject Modal */}
      {creating && <CreateSubjectDialog onClose={() => setCreating(false)} />}

      {/* Live Study Focus Chamber */}
      <FocusTimerModal
        open={!!liveStudyTrack}
        onOpenChange={(open) => {
          if (!open) setLiveStudyTrack(null);
        }}
        initialTask={liveStudyTrack ? { id: liveStudyTrack.id, title: liveStudyTrack.title } : null}
      />
    </PageContainer>
  );
}

function CreateSubjectDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.study.createTrack.useMutation({
    onSuccess: () => {
      utils.study.list.invalidate();
      toast.success("Subject track created!");
      onClose();
    },
  });

  const [subject, setSubject] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState("mint");
  const [targetMinPerWeek, setTargetMinPerWeek] = useState(180);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="anim-rise w-full max-w-md rounded-xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 dark:border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Add Study Discipline</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="label-eyebrow mb-1 block">Subject Title</label>
            <input
              type="text"
              autoFocus
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Distributed Systems, Type Theory, Machine Learning"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Mastery Milestone / Target</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Complete Raft implementation and verify benchmarks"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow mb-1 block">Weekly Target (Minutes)</label>
              <input
                type="number"
                value={targetMinPerWeek}
                onChange={(e) => setTargetMinPerWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="label-eyebrow mb-1 block">Signature Color</label>
              <div className="mt-1.5 flex items-center gap-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform",
                      color === c && "ring-2 ring-foreground ring-offset-2 scale-110"
                    )}
                    style={{ background: sig(c) }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!subject.trim()) {
                toast.error("Please provide a subject title");
                return;
              }
              await create.mutateAsync({
                subject: subject.trim(),
                goal: goal.trim() || undefined,
                color,
                targetMinPerWeek,
              });
            }}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Add Subject
          </button>
        </div>
      </div>
    </div>
  );
}
