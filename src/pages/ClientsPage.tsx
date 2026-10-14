import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { PageContainer, PageHeader, StatMetricCard } from "@/components/layout";
import { cn } from "@/lib/utils";
import { relDay, sig } from "@/lib/util";
import {
  Plus,
  X,
  Trash2,
  Sparkles,
  Briefcase,
  LayoutGrid,
  List,
  Copy,
  Check,
  DollarSign,
  AlertCircle,
  Users,
  Search,
  Mail,
  FolderPlus,
  Edit3,
  ChevronRight,
  SplitSquareVertical,
} from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  status: "lead" | "active" | "dormant";
  stage?: string;
  health: "great" | "ok" | "at_risk";
  dealValue: number;
  notes: string | null;
  lastTouchAt: Date | null;
  projectCount: number;
  openTasks: number;
};

const STAGES = [
  { key: "lead", label: "Lead", dot: "bg-blue-500" },
  { key: "proposal", label: "Proposal", dot: "bg-amber-500" },
  { key: "active", label: "Active", dot: "bg-emerald-500" },
  { key: "review", label: "Review", dot: "bg-purple-500" },
  { key: "completed", label: "Closed", dot: "bg-muted-foreground" },
] as const;

export default function ClientsPage() {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery();
  const projects = trpc.projects.list.useQuery();

  const touch = trpc.clients.touch.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Touchpoint recorded");
    },
  });
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Client account updated");
    },
  });
  const remove = trpc.clients.remove.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Client account removed");
    },
  });

  const [viewMode, setViewMode] = useState<"dossier" | "pipeline" | "table">("dossier");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [projectClient, setProjectClient] = useState<Client | null>(null);

  const list = (clients.data ?? []) as Client[];
  const allProjects = projects.data ?? [];

  useEffect(() => {
    if (list.length > 0 && selectedId === null) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const selected = useMemo(() => {
    return list.find((c) => c.id === selectedId) ?? list[0] ?? null;
  }, [list, selectedId]);

  const pipelineTotal = list.reduce((a, c) => a + (c.status !== "dormant" ? c.dealValue : 0), 0);
  const atRiskCount = list.filter((c) => c.health === "at_risk").length;
  const activeCount = list.filter((c) => c.status === "active").length;

  const filteredList = useMemo(() => {
    return list.filter((c) => {
      const s = c.stage || (c.status === "active" ? "active" : "lead");
      if (stageFilter !== "all" && s !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [list, stageFilter, searchQuery]);

  const byStage = useMemo(() => {
    const map: Record<string, Client[]> = {
      lead: [],
      proposal: [],
      active: [],
      review: [],
      completed: [],
    };
    for (const c of list) {
      const s = c.stage || (c.status === "active" ? "active" : "lead");
      if (map[s]) map[s].push(c);
      else map.lead.push(c);
    }
    return map;
  }, [list]);

  const handleMoveStage = (client: Client, nextStage: string) => {
    update.mutate({
      id: client.id,
      patch: { stage: nextStage },
    });
  };

  return (
    <PageContainer variant="contained" className="space-y-6">
      {/* ── Studio Header ── */}
      <PageHeader
        eyebrow="CLIENT RELATIONSHIP MANAGEMENT"
        title="Client Accounts & Pipeline"
        subtitle="Executive dossier, deal volume pipeline, and touchpoint recency"
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/30 p-1">
            <button
              onClick={() => setViewMode("dossier")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                viewMode === "dossier"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SplitSquareVertical size={13} />
              <span>Dossier</span>
            </button>
            <button
              onClick={() => setViewMode("pipeline")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                viewMode === "pipeline"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid size={13} />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List size={13} />
              <span>Directory</span>
            </button>
          </div>
        }
        primaryAction={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>Add Client</span>
          </button>
        }
      />

      {/* ── Executive Metrics Matrix ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMetricCard
          label="PIPELINE VOLUME"
          value={`$${pipelineTotal.toLocaleString()}`}
          sub="deal volume"
          icon={<DollarSign size={14} />}
          iconColor="emerald"
        />
        <StatMetricCard
          label="ACTIVE ACCOUNTS"
          value={activeCount}
          sub="ongoing engagements"
          icon={<Briefcase size={14} />}
          iconColor="primary"
        />
        <StatMetricCard
          label="ATTENTION NEEDED"
          value={atRiskCount}
          sub={atRiskCount > 0 ? "stale touchpoint alert" : "healthy cadence"}
          icon={<AlertCircle size={14} />}
          iconColor={atRiskCount > 0 ? "rose" : "slate"}
          valueColor={atRiskCount > 0 ? "text-rose-500" : undefined}
        />
        <StatMetricCard
          label="DIRECTORY TOTAL"
          value={list.length}
          sub="tracked relationships"
          icon={<Users size={14} />}
          iconColor="purple"
        />
      </div>

      {/* ── VIEW 1: Master-Detail Dossier ── */}
      {viewMode === "dossier" && (
        <div className="grid gap-5 lg:grid-cols-12 min-h-[580px]">
          {/* Left Column: Account Directory Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs dark:border-white/[0.08]">
            {/* Search & Filter Toolbar */}
            <div className="p-3 border-b border-border/70 space-y-2 bg-secondary/20">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts…"
                  className="h-8 w-full rounded-md border border-border/70 bg-card pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Stage Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  onClick={() => setStageFilter("all")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0 transition-colors",
                    stageFilter === "all"
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  All ({list.length})
                </button>
                {STAGES.map((s) => {
                  const count = byStage[s.key]?.length || 0;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStageFilter(s.key)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0 transition-colors",
                        stageFilter === s.key
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                      <span>{s.label}</span>
                      <span className="font-mono text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No accounts match filter.
                </div>
              ) : (
                filteredList.map((client) => {
                  const isSelected = selected?.id === client.id;
                  const stageMeta =
                    STAGES.find((s) => s.key === (client.stage || client.status)) || STAGES[0];

                  return (
                    <div
                      key={client.id}
                      onClick={() => setSelectedId(client.id)}
                      className={cn(
                        "group p-3 transition-all cursor-pointer flex items-center justify-between gap-2.5",
                        isSelected
                          ? "bg-secondary border-l-2 border-primary"
                          : "hover:bg-secondary/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold border border-border/80 text-foreground">
                          {client.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4
                              className={cn(
                                "text-xs font-semibold truncate leading-tight",
                                isSelected ? "text-primary" : "text-foreground"
                              )}
                            >
                              {client.name}
                            </h4>
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                client.health === "great" && "bg-emerald-500",
                                client.health === "ok" && "bg-blue-500",
                                client.health === "at_risk" && "bg-rose-500 anim-pulse-dot"
                              )}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate block mt-0.5">
                            {client.company || client.email || "Individual"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-semibold text-foreground tabular-nums block">
                          ${client.dealValue.toLocaleString()}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground block uppercase">
                          {stageMeta.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Client Dossier Hub (8 cols) */}
          <div className="lg:col-span-8 flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs dark:border-white/[0.08]">
            {selected ? (
              <ClientDossierHub
                client={selected}
                allProjects={allProjects}
                onStageChange={(s) => handleMoveStage(selected, s)}
                onTouch={(note) => touch.mutate({ id: selected.id, note })}
                onEdit={() => setEditingClient(selected)}
                onDelete={() => remove.mutate({ id: selected.id })}
                onNewProject={() => setProjectClient(selected)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Briefcase size={32} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">Select a Client Account</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Choose a client from the left directory or add a new account to inspect relationship intelligence.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: Pipeline Kanban Board ── */}
      {viewMode === "pipeline" && (
        <div className="grid items-start min-h-0 flex-1 snap-x snap-mandatory auto-cols-[85vw] grid-flow-col gap-3.5 overflow-x-auto pb-4 sm:auto-cols-[280px] xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-5 xl:overflow-x-visible">
          {STAGES.map((st) => {
            const stageClients = byStage[st.key] || [];
            const stageTotal = stageClients.reduce((acc, c) => acc + c.dealValue, 0);

            return (
              <div
                key={st.key}
                className="flex snap-center flex-col self-start rounded-xl border border-border/80 bg-secondary/15 p-2.5 space-y-2 dark:border-white/[0.06]"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between px-1.5 py-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                    <h3 className="text-xs font-semibold text-foreground tracking-tight">{st.label}</h3>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {stageClients.length}
                    </span>
                  </div>
                  {stageTotal > 0 && (
                    <span className="font-mono text-[11px] font-semibold text-foreground tabular-nums">
                      ${stageTotal.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Cards Column */}
                <div className="space-y-2">
                  {stageClients.length === 0 ? (
                    <div
                      onClick={() => setCreating(true)}
                      className="group flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-6 text-center text-xs text-muted-foreground/60 hover:text-foreground hover:border-border transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] font-medium">+ Add {st.label}</span>
                    </div>
                  ) : (
                    stageClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => {
                          setSelectedId(client.id);
                          setViewMode("dossier");
                        }}
                        className="group rounded-lg border border-border/80 bg-card p-3 shadow-xs hover:border-border hover:shadow-sm transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-foreground border border-border/70">
                              {client.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                                {client.name}
                              </h4>
                              {client.company && (
                                <span className="text-[11px] text-muted-foreground truncate block">
                                  {client.company}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full mt-1.5",
                              client.health === "great" && "bg-emerald-500",
                              client.health === "ok" && "bg-blue-500",
                              client.health === "at_risk" && "bg-rose-500 anim-pulse-dot"
                            )}
                          />
                        </div>

                        {/* Deal value & Projects count */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                          <span className="font-mono font-semibold text-foreground tabular-nums">
                            ${client.dealValue.toLocaleString()}
                          </span>

                          <span className="text-[10px] text-muted-foreground">
                            {client.projectCount} proj · {client.openTasks} tasks
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VIEW 3: Directory Table ── */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs dark:border-white/[0.08]">
          <div className="divide-y divide-border/60">
            {list.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setViewMode("dossier");
                }}
                className="group flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground border border-border/80">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{c.name}</span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground border border-border/60 rounded px-1.5 py-0.2">
                        {c.stage || c.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {[c.company, c.email].filter(Boolean).join(" · ") || "No company listed"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-foreground tabular-nums">
                      ${c.dealValue.toLocaleString()}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/75">Value</span>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-foreground tabular-nums">
                      {c.projectCount}
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/75">Projects</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-right w-24 justify-end">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        c.health === "great" && "bg-emerald-500",
                        c.health === "ok" && "bg-blue-500",
                        c.health === "at_risk" && "bg-rose-500"
                      )}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {c.lastTouchAt ? relDay(c.lastTouchAt) : "Never"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      {creating && <CreateClientDialog onClose={() => setCreating(false)} />}
      {editingClient && (
        <EditClientDialog client={editingClient} onClose={() => setEditingClient(null)} />
      )}
      {projectClient && (
        <CreateProjectForClientDialog
          client={projectClient}
          onClose={() => setProjectClient(null)}
        />
      )}
    </PageContainer>
  );
}

function ClientDossierHub({
  client,
  allProjects,
  onStageChange,
  onTouch,
  onEdit,
  onDelete,
  onNewProject,
}: {
  client: Client;
  allProjects: Array<any>;
  onStageChange: (stage: string) => void;
  onTouch: (note?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewProject: () => void;
}) {
  const draftFollowUp = trpc.clients.draftFollowUp.useMutation();
  const [touchNote, setTouchNote] = useState("");
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const linkedProjects = allProjects.filter((p) => p.clientId === client.id);
  const currentStageIndex = STAGES.findIndex((s) => s.key === (client.stage || client.status));

  const handleCopyDraft = () => {
    if (!draftResult) return;
    navigator.clipboard.writeText(draftResult);
    setCopied(true);
    toast.success("Draft copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Top Header ── */}
      <div className="p-6 border-b border-border/70 bg-secondary/15">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background font-bold text-base shadow-sm">
              {client.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground leading-tight">
                  {client.name}
                </h2>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                    client.health === "great" && "border-emerald-500/20 text-emerald-500 bg-emerald-500/10",
                    client.health === "ok" && "border-blue-500/20 text-blue-500 bg-blue-500/10",
                    client.health === "at_risk" && "border-rose-500/20 text-rose-500 bg-rose-500/10"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      client.health === "great" && "bg-emerald-500",
                      client.health === "ok" && "bg-blue-500",
                      client.health === "at_risk" && "bg-rose-500"
                    )}
                  />
                  {client.health === "great" ? "Great Health" : client.health === "ok" ? "On Track" : "At Risk"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-1">
                {client.company && <span className="font-medium text-foreground">{client.company}</span>}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail size={12} /> {client.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={onNewProject}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm"
            >
              <FolderPlus size={13} /> New Project
            </button>
            <button
              onClick={onEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Edit3 size={13} /> Edit
            </button>
            <button
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Delete account"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Interactive Pipeline Stepper ── */}
        <div className="mt-5 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between mb-2">
            <span className="label-eyebrow">Pipeline Stage Progression</span>
            <span className="text-xs font-medium text-foreground">
              Current: <strong className="text-primary">{STAGES[currentStageIndex]?.label || "Lead"}</strong>
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {STAGES.map((st, i) => {
              const isPassed = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;

              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => onStageChange(st.key)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition-all border",
                    isCurrent
                      ? "bg-foreground text-background border-transparent font-semibold shadow-xs"
                      : isPassed
                      ? "bg-secondary text-foreground border-border/80 font-medium"
                      : "bg-transparent text-muted-foreground border-dashed border-border/60 hover:bg-secondary/40"
                  )}
                >
                  <span className="text-[11px] leading-tight">{st.label}</span>
                  <span className="text-[9px] opacity-75 mt-0.5">
                    {isCurrent ? "Active" : isPassed ? "Done ✓" : "Pending"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Dossier Content Body ── */}
      <div className="p-6 space-y-6">
        {/* Metric Triad Strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5">
            <span className="label-eyebrow mb-1 block">Deal Volume</span>
            <div className="font-mono text-xl font-bold text-foreground tabular-nums">
              ${client.dealValue.toLocaleString()}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Estimated contract value</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5">
            <span className="label-eyebrow mb-1 block">Workspaces</span>
            <div className="font-mono text-xl font-bold text-foreground tabular-nums">
              {linkedProjects.length}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">{client.openTasks} active deliverables</span>
          </div>

          <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5">
            <span className="label-eyebrow mb-1 block">Last Touchpoint</span>
            <div className="text-sm font-semibold text-foreground">
              {client.lastTouchAt ? relDay(client.lastTouchAt) : "No log yet"}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {client.lastTouchAt ? new Date(client.lastTouchAt).toLocaleDateString() : "Record interaction"}
            </span>
          </div>
        </div>

        {/* ── Connected Projects ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-eyebrow">
              Connected Projects & Deliverables ({linkedProjects.length})
            </span>
            <button
              onClick={onNewProject}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add Project
            </button>
          </div>

          {linkedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center space-y-2">
              <Briefcase size={22} className="text-muted-foreground/30" />
              <p className="text-xs font-medium text-foreground">No active projects linked</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Create a dedicated project workspace to track deliverables and milestones for {client.name}.
              </p>
              <button
                onClick={onNewProject}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
              >
                <FolderPlus size={12} /> Create Project
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {linkedProjects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border/80 bg-card p-3 space-y-2 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate">{p.name}</h4>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {p.description || "Active milestone track"}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground border border-border/60 rounded px-1.5 py-0.2 shrink-0">
                      {p.status}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Milestones</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">{p.progress}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px]">{p.doneCount}/{p.taskCount} done</span>
                    <Link
                      to="/projects"
                      className="text-primary font-medium hover:underline flex items-center gap-0.5"
                    >
                      Workspace <ChevronRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── AI Follow-Up Generator ── */}
        <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles size={14} className="text-primary" />
              <span>AI Follow-Up Intelligence</span>
            </div>

            <button
              disabled={draftFollowUp.isPending}
              onClick={async () => {
                const res = await draftFollowUp.mutateAsync({ id: client.id });
                setDraftResult(res.emailDraft);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50 transition-all hover:opacity-90 active:scale-95 shadow-sm"
            >
              <Sparkles size={12} className={draftFollowUp.isPending ? "animate-spin" : ""} />
              <span>{draftFollowUp.isPending ? "Drafting…" : "Draft Follow-Up"}</span>
            </button>
          </div>

          {draftResult ? (
            <div className="rounded-lg border border-border/70 bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground border-b border-border/60 pb-2">
                <span>To: {client.email || client.name}</span>
                <button
                  onClick={handleCopyDraft}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? "Copied" : "Copy to Clipboard"}</span>
                </button>
              </div>
              <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {draftResult}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Synthesizes deliverables, project status, and next milestones into an executive follow-up draft.
            </p>
          )}
        </div>

        {/* ── Communication Log ── */}
        <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
          <span className="label-eyebrow block">Touchpoint & Interaction Log</span>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={touchNote}
              onChange={(e) => setTouchNote(e.target.value)}
              placeholder="Log note (e.g. Call discussing roadmap approvals)…"
              className="h-8 flex-1 rounded-md border border-border/80 bg-card px-3 text-xs outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && touchNote.trim()) {
                  onTouch(touchNote.trim());
                  setTouchNote("");
                }
              }}
            />
            <button
              onClick={() => {
                if (touchNote.trim()) {
                  onTouch(touchNote.trim());
                  setTouchNote("");
                }
              }}
              className="flex h-8 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-all hover:opacity-90"
            >
              Log
            </button>
          </div>

          {client.notes ? (
            <div className="rounded-lg border border-border/70 bg-card p-3 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Relationship History
              </span>
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {client.notes}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No notes logged yet. Record an interaction above to track relationship context.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateClientDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Client account created!");
      onClose();
    },
  });

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [dealValue, setDealValue] = useState(15000);
  const [stage, setStage] = useState("lead");

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
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Add Client Account</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="label-eyebrow mb-1 block">Client Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Company / Organization</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Studio"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sarah@acme.com"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow mb-1 block">Pipeline Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-eyebrow mb-1 block">Deal Value ($)</label>
              <input
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
                className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
              />
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
              if (!name.trim()) {
                toast.error("Please enter a client name");
                return;
              }
              await create.mutateAsync({
                name: name.trim(),
                company: company.trim() || undefined,
                email: email.trim() || undefined,
                dealValue,
                stage,
                status: "active",
                health: "great",
              });
            }}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Save Client
          </button>
        </div>
      </div>
    </div>
  );
}

function EditClientDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const utils = trpc.useUtils();
  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      toast.success("Client account updated!");
      onClose();
    },
  });

  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company || "");
  const [email, setEmail] = useState(client.email || "");
  const [dealValue, setDealValue] = useState(client.dealValue);
  const [health, setHealth] = useState<"great" | "ok" | "at_risk">(client.health);
  const [stage, setStage] = useState(client.stage || client.status);

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
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Edit Client Account</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="label-eyebrow mb-1 block">Client Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-eyebrow mb-1 block">Pipeline Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-eyebrow mb-1 block">Health Status</label>
              <select
                value={health}
                onChange={(e) => setHealth(e.target.value as any)}
                className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
              >
                <option value="great">Great</option>
                <option value="ok">On Track</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Deal Value ($)</label>
            <input
              type="number"
              value={dealValue}
              onChange={(e) => setDealValue(Number(e.target.value))}
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
            />
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
              await update.mutateAsync({
                id: client.id,
                patch: {
                  name,
                  company: company || undefined,
                  email: email || undefined,
                  dealValue,
                  health,
                  stage,
                },
              });
            }}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateProjectForClientDialog({
  client,
  onClose,
}: {
  client: Client;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.clients.list.invalidate();
      toast.success(`Project created for ${client.name}!`);
      onClose();
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");

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
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              New Project Workspace
            </h2>
            <span className="text-[11px] text-muted-foreground">Linked to {client.name}</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="label-eyebrow mb-1 block">Project Title</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Website Overhaul & Design System"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 px-3 py-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1 block">Deliverable Scope</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Core deliverable scope and target milestones…"
              className="w-full rounded-lg border border-border/80 bg-secondary/30 p-2.5 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="label-eyebrow mb-1.5 block">Signature Accent Color</label>
            <div className="flex items-center gap-2">
              {["blue", "cyan", "mint", "amber", "magenta"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform",
                    color === c ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: sig(c) }}
                />
              ))}
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
              if (!name.trim()) {
                toast.error("Please enter a project name");
                return;
              }
              await create.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
                color,
                clientId: client.id,
                status: "active",
              });
            }}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
