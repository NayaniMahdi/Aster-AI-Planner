import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { EmptyState, PriorityBar } from "@/components/bits";
import { cn } from "@/lib/utils";
import { relDay, dueTone, sig, COLOR_OPTIONS, type SigColor } from "@/lib/util";
import {
  FolderKanban,
  Plus,
  X,
  Sparkles,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  TrendingUp,
  Briefcase,
  ExternalLink,
  Github,
  GitBranch,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Image as ImageIcon,
  FileText,
  Calendar,
  CheckSquare,
  ShieldCheck,
  Layers,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer, PageHeader, StatMetricCard } from "@/components/layout";

export type Project = {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "paused" | "done";
  color: string;
  clientId: number | null;
  deadline: Date | null;
  client: { id?: number; name: string; company?: string | null } | null;
  taskCount: number;
  doneCount: number;
  progress: number;
  recentTasks?: Array<{ id: number; title: string; status: string; priority: string }>;
};

export type ProjectMetadata = {
  scope: string;
  gitUrl: string;
  gitBranch: string;
  liveUrl: string;
  adminUrl: string;
  adminUsername: string;
  adminPassword: string;
  envNotes: string;
  images: string[];
  docsNotes: string;
};

export function parseProjectMeta(description: string | null | undefined): ProjectMetadata {
  const defaultMeta: ProjectMetadata = {
    scope: "",
    gitUrl: "",
    gitBranch: "main",
    liveUrl: "",
    adminUrl: "",
    adminUsername: "",
    adminPassword: "",
    envNotes: "",
    images: [],
    docsNotes: "",
  };

  if (!description) return defaultMeta;

  try {
    if (description.trim().startsWith("{")) {
      const parsed = JSON.parse(description);
      return { ...defaultMeta, ...parsed };
    }
  } catch {
    // Non-JSON string is treated as scope
  }

  return { ...defaultMeta, scope: description };
}

export function computeProjectHealth(p: Project) {
  if (p.status === "done") {
    return {
      label: "Shipped",
      badgeClass: "text-purple-700 bg-purple-50 border-purple-200",
      dotClass: "bg-purple-500",
      level: "done",
    };
  }
  if (p.status === "paused") {
    return {
      label: "Paused",
      badgeClass: "text-slate-600 bg-slate-100 border-slate-200",
      dotClass: "bg-slate-400",
      level: "paused",
    };
  }
  if (p.deadline) {
    const diffDays = Math.round((new Date(p.deadline).getTime() - Date.now()) / 86400000);
    if (diffDays < 0) {
      return {
        label: "Overdue",
        badgeClass: "text-rose-700 bg-rose-50 border-rose-200 animate-pulse",
        dotClass: "bg-rose-500",
        level: "danger",
      };
    }
    if (diffDays <= 3 && p.progress < 70) {
      return {
        label: "At Risk",
        badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
        dotClass: "bg-amber-500",
        level: "warning",
      };
    }
    if (diffDays <= 7) {
      return {
        label: "Due Soon",
        badgeClass: "text-amber-700 bg-amber-50/80 border-amber-200",
        dotClass: "bg-amber-400",
        level: "warning",
      };
    }
  }
  return {
    label: "On Track",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dotClass: "bg-emerald-500",
    level: "good",
  };
}

export default function ProjectsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const projectsQuery = trpc.projects.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();

  const projects = (projectsQuery.data ?? []) as Project[];
  const clients = clientsQuery.data ?? [];

  // Active project if on /projects/:id
  const activeProjectId = id ? Number(id) : null;
  const currentProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) ?? null;
  }, [projects, activeProjectId]);

  // If URL has an ID but project is loaded and not found
  if (id && projectsQuery.isSuccess && !currentProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F4F6FB]">
        <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 p-8 shadow-xs text-center max-w-md">
          <FolderKanban size={36} className="mx-auto text-slate-400 mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Project Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            The project workspace you requested does not exist or may have been removed.
          </p>
          <button
            onClick={() => navigate("/projects")}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Projects Catalog
          </button>
        </div>
      </div>
    );
  }

  // If on /projects/:id, render the Full Project Workspace Page
  if (currentProject) {
    return (
      <ProjectDetailPage
        project={currentProject}
        clients={clients}
        onBack={() => navigate("/projects")}
        onRefresh={() => {
          utils.projects.list.invalidate();
        }}
      />
    );
  }

  // Otherwise, render the clean, uncluttered Projects Catalog
  return (
    <ProjectsCatalog
      projects={projects}
      clients={clients}
      onOpenProject={(project) => navigate(`/projects/${project.id}`)}
      onRefresh={() => utils.projects.list.invalidate()}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PROJECTS CATALOG (Clean, Easy, No Over-Complicated Noise)
// ─────────────────────────────────────────────────────────────────────────────
function ProjectsCatalog({
  projects,
  clients,
  onOpenProject,
  onRefresh,
}: {
  projects: Project[];
  clients: Array<{ id: number; name: string }>;
  onOpenProject: (p: Project) => void;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "done">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const activeCount = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "done").length;
  const totalMilestones = projects.reduce((acc, p) => acc + (p.taskCount || 0), 0);
  const completedMilestones = projects.reduce((acc, p) => acc + (p.doneCount || 0), 0);

  const avgVelocity = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    if (active.length === 0) return 0;
    return Math.round(active.reduce((acc, p) => acc + (p.progress || 0), 0) / active.length);
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter === "active" && p.status !== "active") return false;
      if (statusFilter === "done" && p.status !== "done") return false;
      if (clientFilter !== "all") {
        if (clientFilter === "internal" && p.clientId !== null) return false;
        if (clientFilter !== "internal" && p.clientId !== Number(clientFilter)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        const matchClient = p.client?.name.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchClient) return false;
      }
      return true;
    });
  }, [projects, statusFilter, clientFilter, searchQuery]);

  return (
    <PageContainer variant="contained">
      {/* ── Top Header ── */}
      <PageHeader
        eyebrow="PORTFOLIO & WORKSPACES"
        title="Project Workspaces"
        description="Select any project to open its full workspace with Git links, admin credentials, images & notes."
        badge={
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card px-3.5 py-1 text-xs font-sans tracking-tight shadow-2xs">
            <span className="font-semibold text-foreground tabular-nums">{activeCount}</span>
            <span className="text-muted-foreground font-medium text-[11.5px]">active</span>
            <span className="text-border">·</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{completedCount}</span>
            <span className="text-muted-foreground font-medium text-[11.5px]">shipped</span>
          </div>
        }
        primaryAction={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.4} />
            <span>New Project</span>
          </button>
        }
      />

      {/* ── Executive Highlights ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatMetricCard
          label="ACTIVE WORKSPACES"
          value={activeCount}
          sub={`${projects.length} total portfolios`}
          icon={<FolderKanban size={14} />}
          iconBg="bg-blue-500/10 text-blue-500"
        />

        <StatMetricCard
          label="COMPLETION VELOCITY"
          value={`${avgVelocity}%`}
          sub="Average across active roadmaps"
          icon={<TrendingUp size={14} />}
          iconBg="bg-emerald-500/10 text-emerald-500"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />

        <StatMetricCard
          label="MILESTONE DELIVERABLES"
          value={`${completedMilestones} / ${totalMilestones}`}
          sub={
            totalMilestones > 0
              ? `${Math.round((completedMilestones / totalMilestones) * 100)}% execution rate`
              : "Ready for tasks"
          }
          icon={<CheckCircle2 size={14} />}
          iconBg="bg-purple-500/10 text-purple-500"
        />

        <StatMetricCard
          label="SHIPPED PROJECTS"
          value={completedCount}
          sub="Successfully closed to date"
          icon={<ShieldCheck size={14} />}
          iconBg="bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* ── Search & Filter Omnibar ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-card border border-border/80 p-2.5 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by name, description, client…"
            className="h-9 w-full rounded-xl border border-border/80 bg-secondary/30 pl-10 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-border focus:bg-card"
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

        {/* Clean Segmented Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/30 p-1">
          {(["all", "active", "done"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                statusFilter === tab
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "all"
                ? `All (${projects.length})`
                : tab === "active"
                ? `Active (${activeCount})`
                : `Shipped (${completedCount})`}
            </button>
          ))}
        </div>

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 rounded-xl border border-border/80 bg-secondary/30 px-3 text-xs text-foreground font-medium outline-none cursor-pointer focus:border-border focus:bg-card"
        >
          <option value="all">All Clients</option>
          <option value="internal">Internal Deliverables</option>
          {clients.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Project Cards Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={26} strokeWidth={1.4} />}
          title="No Projects Found"
          hint={
            projects.length === 0
              ? "Create your first project workspace to store Git links, credentials, and milestones."
              : "No projects match your current search and filter settings."
          }
          action={
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition-all cursor-pointer shadow-xs"
            >
              <Plus size={14} /> Create Project
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const meta = parseProjectMeta(p.description);
            const colorHex = sig(p.color || "blue");

            return (
              <div
                key={p.id}
                onClick={() => onOpenProject(p)}
                className="group relative flex flex-col justify-between rounded-2xl bg-card border border-border/80 p-5 shadow-2xs hover:shadow-xs hover:border-border transition-all duration-200 cursor-pointer"
              >
                <div>
                  {/* Top Row: Clean Title & Meta */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        {p.client ? (
                          <span className="flex items-center gap-1 font-medium text-foreground truncate">
                            <Briefcase size={12} className="text-muted-foreground shrink-0" />
                            <span className="truncate">{p.client.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Internal Workspace</span>
                        )}
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                          <Clock size={11} />
                          {p.deadline ? relDay(p.deadline) : "Flexible"}
                        </span>
                      </div>
                    </div>

                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0 mt-1 shadow-2xs"
                      style={{ background: colorHex }}
                      title={`Color: ${p.color || "blue"}`}
                    />
                  </div>

                  {/* Scope text */}
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2 min-h-[32px]">
                    {meta.scope || "Active workspace with full repository, notes & credentials."}
                  </p>

                  {/* Quick Badge Indicators for Git & Credentials */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {meta.gitUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 border border-border/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                        <Github size={11} className="text-muted-foreground" />
                        <span>Git Linked</span>
                      </span>
                    )}
                    {meta.adminPassword && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <KeyRound size={11} />
                        <span>Admin Login Saved</span>
                      </span>
                    )}
                    {meta.liveUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <Globe size={11} />
                        <span>Live Site</span>
                      </span>
                    )}
                    {meta.images && meta.images.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10.5px] font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <ImageIcon size={11} />
                        <span>{meta.images.length} images</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer with Progress & Open Page Link */}
                <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Milestones</span>
                      <span className="font-semibold text-foreground">
                        {p.doneCount} / {p.taskCount} ({p.progress}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${p.progress}%`, background: colorHex }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock size={11} />
                      {p.deadline ? relDay(p.deadline) : "Flexible timeline"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline transition-colors">
                      Open Project Page <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {creating && (
        <CreateProjectDialog
          clients={clients}
          onClose={() => setCreating(false)}
          onCreated={onRefresh}
        />
      )}
    </PageContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FULL PROJECT WORKSPACE PAGE (No cramped sidebar window!)
// ─────────────────────────────────────────────────────────────────────────────
function ProjectDetailPage({
  project,
  clients,
  onBack,
  onRefresh,
}: {
  project: Project;
  clients: Array<{ id: number; name: string }>;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const updateProject = trpc.projects.update.useMutation();
  const removeProject = trpc.projects.remove.useMutation();

  const tasksQuery = trpc.projects.getTasks.useQuery({ projectId: project.id });
  const createTask = trpc.tasks.create.useMutation();
  const updateTask = trpc.tasks.update.useMutation();
  const removeTask = trpc.tasks.remove.useMutation();
  const generatePlan = trpc.projects.generatePlan.useMutation();

  const [meta, setMeta] = useState<ProjectMetadata>(() => parseProjectMeta(project.description));
  const [showPassword, setShowPassword] = useState(false);
  const [newDeliverableTitle, setNewDeliverableTitle] = useState("");
  const [newDeliverablePriority, setNewDeliverablePriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newDeliverableEstimate, setNewDeliverableEstimate] = useState<number>(30);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [addingImage, setAddingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "deliverables" | "images" | "notes">("overview");

  // Editable top project info
  const [editName, setEditName] = useState(project.name);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

  // Sync meta state whenever project changes
  useEffect(() => {
    setMeta(parseProjectMeta(project.description));
    setEditName(project.name);
  }, [project.description, project.name]);

  const colorHex = sig(project.color || "blue");
  const health = computeProjectHealth(project);
  const tasks = tasksQuery.data ?? [];
  const completedTasks = tasks.filter((t) => t.status === "done");

  // Save metadata to server
  const saveMetadata = async (updatedMeta: ProjectMetadata) => {
    setMeta(updatedMeta);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        patch: { description: JSON.stringify(updatedMeta) },
      });
      utils.projects.list.invalidate();
      toast.success("Workspace saved");
    } catch {
      toast.error("Failed to save workspace details");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleAddDeliverable = async () => {
    if (!newDeliverableTitle.trim()) return;
    await createTask.mutateAsync({
      title: newDeliverableTitle.trim(),
      projectId: project.id,
      status: "next",
      priority: newDeliverablePriority,
      estimateMin: newDeliverableEstimate,
    });
    setNewDeliverableTitle("");
    utils.projects.getTasks.invalidate({ projectId: project.id });
    utils.projects.list.invalidate();
    toast.success("Deliverable added");
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    const updatedImages = [...(meta.images || []), newImageUrl.trim()];
    saveMetadata({ ...meta, images: updatedImages });
    setNewImageUrl("");
    setAddingImage(false);
  };

  const handleRemoveImage = (imgUrl: string) => {
    const updatedImages = (meta.images || []).filter((i) => i !== imgUrl);
    saveMetadata({ ...meta, images: updatedImages });
  };

  return (
    <PageContainer variant="contained">
      {/* ── Top Bar: Back Button & Actions ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-8.5 items-center gap-2 rounded-xl bg-card border border-border/80 px-3.5 text-xs font-semibold text-foreground hover:bg-secondary/40 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft size={13} strokeWidth={2.4} />
          <span>Back to Projects Catalog</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const next = project.status === "done" ? "active" : "done";
              await updateProject.mutateAsync({ id: project.id, patch: { status: next } });
              onRefresh();
              toast.success(next === "done" ? "Project marked as Shipped!" : "Project reopened");
            }}
            className="flex h-8.5 items-center gap-1.5 rounded-xl bg-card border border-border/80 px-3.5 text-xs font-semibold text-foreground hover:bg-secondary/40 shadow-2xs transition-colors cursor-pointer"
          >
            <CheckCircle2
              size={13}
              className={project.status === "done" ? "text-emerald-500" : "text-muted-foreground"}
            />
            <span>{project.status === "done" ? "Reopen Project" : "Mark as Shipped"}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                await removeProject.mutateAsync({ id: project.id });
                toast.success("Project removed");
                onBack();
              }
            }}
            className="flex h-8.5 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
            title="Delete this project"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* ── Hero Glass Header ── */}
      <div className="rounded-2xl bg-card border border-border/80 p-6 sm:p-7 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && editName.trim()) {
                      await updateProject.mutateAsync({ id: project.id, patch: { name: editName.trim() } });
                      setIsEditingTitle(false);
                      onRefresh();
                      toast.success("Project title updated");
                    }
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="h-10 rounded-xl border border-border/80 bg-secondary/30 px-3 text-xl font-bold font-display text-foreground outline-none focus:border-border"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (editName.trim()) {
                      await updateProject.mutateAsync({ id: project.id, patch: { name: editName.trim() } });
                      setIsEditingTitle(false);
                      onRefresh();
                      toast.success("Project title updated");
                    }
                  }}
                  className="h-9 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background cursor-pointer hover:opacity-90"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                  {project.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
                  title="Edit project name"
                >
                  <Edit3 size={15} />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {project.client ? (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Briefcase size={13} className="text-muted-foreground" />
                  <span>Client: {project.client.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Internal Portfolio Deliverable</span>
              )}

              <span className="text-muted-foreground/40">·</span>

              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Clock size={13} />
                <span>{project.deadline ? relDay(project.deadline) : "No target date set"}</span>
              </span>

              <span className="text-muted-foreground/40">·</span>

              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <CheckCircle2 size={13} className="text-muted-foreground" />
                <span>{project.doneCount} of {project.taskCount} deliverables done</span>
              </span>
            </div>
          </div>

            {/* Quick Action Links if present */}
            <div className="flex items-center gap-2">
              {meta.gitUrl && (
                <a
                  href={meta.gitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs"
                >
                  <Github size={13} />
                  <span>Open GitHub</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>
              )}

              {meta.liveUrl && (
                <a
                  href={meta.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-white border border-slate-200/90 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-all shadow-2xs"
                >
                  <Globe size={13} className="text-emerald-600" />
                  <span>Live App</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Overall Deliverables Velocity</span>
              <span className="text-slate-900 font-bold">{project.progress}% completed ({project.doneCount}/{project.taskCount})</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress}%`, background: colorHex }}
              />
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-secondary/30 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "overview"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers size={13} />
            <span>Overview & Repos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("credentials")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "credentials"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <KeyRound size={13} />
            <span>Admin Logins & Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deliverables")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "deliverables"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare size={13} />
            <span>Deliverables ({completedTasks.length}/{tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("images")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "images"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon size={13} />
            <span>Gallery & Mockups ({meta.images?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "notes"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText size={13} />
            <span>Docs & Notes</span>
          </button>
        </div>

        {/* ── TAB 1: OVERVIEW & GIT REPOSITORIES ── */}
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Col 1: Scope & Repositories ── */}
            <div className="space-y-6">
              {/* Project Scope & Charter Card */}
              <div className="rounded-2xl bg-card border border-border/80 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                    <FileText size={16} className="text-muted-foreground" />
                    <span>Project Scope & Objectives</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Core requirements</span>
                </div>
                <textarea
                  rows={4}
                  value={meta.scope}
                  onChange={(e) => setMeta({ ...meta, scope: e.target.value })}
                  placeholder="Outline core business goals, primary deliverables, and definitions of success for this project…"
                  className="w-full rounded-xl border border-border/80 bg-secondary/30 p-3.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-border focus:bg-card shadow-2xs"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => saveMetadata(meta)}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 transition-all shadow-xs cursor-pointer"
                  >
                    <span>Save Scope</span>
                  </button>
                </div>
              </div>

              {/* Repositories & Environments Card */}
              <div className="rounded-2xl bg-card border border-border/80 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                    <Github size={16} />
                    <span>Repositories & Environments</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Code & Deployment</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                      Git Repository URL
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Github size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={meta.gitUrl}
                          onChange={(e) => setMeta({ ...meta, gitUrl: e.target.value })}
                          placeholder="e.g. https://github.com/my-org/project-repo"
                          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                        />
                      </div>
                      {meta.gitUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(meta.gitUrl, "Git URL")}
                            className="flex h-10 items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Copy size={12} />
                            <span>Copy</span>
                          </button>
                          <a
                            href={meta.gitUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3.5 font-semibold text-white hover:bg-black transition-colors shadow-xs cursor-pointer"
                          >
                            <ExternalLink size={12} />
                            <span>Open</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Default Branch
                      </label>
                      <div className="relative">
                        <GitBranch size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={meta.gitBranch}
                          onChange={(e) => setMeta({ ...meta, gitBranch: e.target.value })}
                          placeholder="main"
                          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Live Production URL
                      </label>
                      <div className="relative">
                        <Globe size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={meta.liveUrl}
                          onChange={(e) => setMeta({ ...meta, liveUrl: e.target.value })}
                          placeholder="https://myproject.com"
                          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => saveMetadata(meta)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs cursor-pointer"
                  >
                    <span>Save Repositories</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Col 2: Settings & Admin Passwords (Clean, spacious alignment) ── */}
            <div className="space-y-6">
              {/* Workspace Settings Card */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                    <Briefcase size={16} className="text-slate-600" />
                    <span>Workspace Settings</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Affiliation & Theme</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Client Attribution
                      </label>
                      <select
                        value={project.clientId ?? ""}
                        onChange={async (e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          await updateProject.mutateAsync({ id: project.id, patch: { clientId: val } });
                          onRefresh();
                          toast.success("Client affiliation updated");
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 px-3 text-xs font-medium text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs cursor-pointer"
                      >
                        <option value="">None (Internal Workspace)</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Target Deadline
                      </label>
                      <input
                        type="date"
                        value={project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : ""}
                        onChange={async (e) => {
                          const d = e.target.value ? new Date(e.target.value) : null;
                          await updateProject.mutateAsync({ id: project.id, patch: { deadline: d } });
                          onRefresh();
                          toast.success("Deadline updated");
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 px-3 text-xs font-medium text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11.5px] font-semibold text-slate-600 mb-2 block">
                      Signature Accent Color
                    </label>
                    <div className="flex items-center gap-2 pt-0.5">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={async () => {
                            await updateProject.mutateAsync({ id: project.id, patch: { color: c } });
                            onRefresh();
                            toast.success("Signature color updated");
                          }}
                          className={cn(
                            "h-6 w-6 rounded-full transition-all cursor-pointer shadow-2xs",
                            project.color === c
                              ? "ring-2 ring-slate-900 ring-offset-2 scale-110"
                              : "hover:scale-110 opacity-75 hover:opacity-100"
                          )}
                          style={{ background: sig(c) }}
                          title={`Color: ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Panel Passwords Card */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                    <KeyRound size={16} className="text-amber-500" />
                    <span>Admin Panel Passwords</span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Secure Vault
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                      Admin Panel URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={meta.adminUrl}
                        onChange={(e) => setMeta({ ...meta, adminUrl: e.target.value })}
                        placeholder="https://app.com/admin"
                        className="h-10 flex-1 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                      />
                      {meta.adminUrl && (
                        <a
                          href={meta.adminUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer shadow-xs shrink-0"
                          title="Open Admin URL"
                        >
                          <ExternalLink size={12} />
                          <span>Launch</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Username / Email
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={meta.adminUsername}
                          onChange={(e) => setMeta({ ...meta, adminUsername: e.target.value })}
                          placeholder="admin@company.com"
                          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-3.5 pr-8 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                        />
                        {meta.adminUsername && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(meta.adminUsername, "Username")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            title="Copy username"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                        Admin Password
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={meta.adminPassword}
                          onChange={(e) => setMeta({ ...meta, adminPassword: e.target.value })}
                          placeholder="••••••••••••"
                          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-3.5 pr-14 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs font-sans"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          {meta.adminPassword && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(meta.adminPassword, "Password")}
                              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                              title="Copy password"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => saveMetadata(meta)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs cursor-pointer"
                  >
                    <KeyRound size={13} />
                    <span>Save Credentials</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: ADMIN CREDENTIALS & SECRETS ── */}
        {activeTab === "credentials" && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <KeyRound size={17} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Project Credentials & Admin Logins
                    </h3>
                    <p className="text-xs text-slate-500">
                      Store admin passwords, URLs, and server credentials securely for this project.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                    Admin Dashboard URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={meta.adminUrl}
                      onChange={(e) => setMeta({ ...meta, adminUrl: e.target.value })}
                      placeholder="e.g. https://admin.project.com or http://localhost:8080"
                      className="h-10 flex-1 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                    />
                    {meta.adminUrl && (
                      <a
                        href={meta.adminUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer shadow-xs"
                      >
                        <ExternalLink size={12} />
                        <span>Launch</span>
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                    Admin Username / Email
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={meta.adminUsername}
                        onChange={(e) => setMeta({ ...meta, adminUsername: e.target.value })}
                        placeholder="admin@example.com"
                        className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-3.5 pr-8 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                      />
                      {meta.adminUsername && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(meta.adminUsername, "Username")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                          title="Copy Username"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                    Admin Password
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={meta.adminPassword}
                        onChange={(e) => setMeta({ ...meta, adminPassword: e.target.value })}
                        placeholder="••••••••••••"
                        className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 pl-3.5 pr-14 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs font-sans"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        {meta.adminPassword && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(meta.adminPassword, "Password")}
                            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            title="Copy Password"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secrets & Environment Keys Notepad */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[11.5px] font-semibold text-slate-600 block">
                  Environment Keys, Database Ports & Security Notes
                </label>
                <textarea
                  rows={4}
                  value={meta.envNotes}
                  onChange={(e) => setMeta({ ...meta, envNotes: e.target.value })}
                  placeholder="e.g. PORT=3000, DB_USER=root, STRIPE_TEST_KEY=pk_test_..., Staging server IP: 192.168.1.10"
                  className="w-full rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 text-xs leading-relaxed text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => saveMetadata(meta)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>Save All Credentials</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: DELIVERABLES & MILESTONES ── */}
        {activeTab === "deliverables" && (
          <div className="max-w-4xl space-y-6">
            {/* AI Roadmap Generator Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white/90 backdrop-blur-xl border border-amber-200/80 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900">
                    AI Strategic Roadmap Generator
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                    Analyzes your project scope and automatically sequences 4–6 phased execution milestones with realistic time estimates, priority levels, and acceptance criteria.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={generatePlan.isPending}
                onClick={async () => {
                  await generatePlan.mutateAsync({ projectId: project.id });
                  utils.projects.getTasks.invalidate({ projectId: project.id });
                  onRefresh();
                  toast.success("AI roadmap generated!");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles size={13} className={generatePlan.isPending ? "animate-spin" : ""} />
                <span>{generatePlan.isPending ? "Generating Plan…" : "Generate AI Plan"}</span>
              </button>
            </div>

            {/* Add Deliverable Form */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-3">
              <span className="font-display text-xs font-bold text-slate-900 block">Add Milestone Deliverable</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newDeliverableTitle}
                  onChange={(e) => setNewDeliverableTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddDeliverable();
                  }}
                  placeholder="e.g. Wireframe Core User Journeys, Implement Auth Middleware…"
                  className="h-10 flex-1 min-w-[240px] rounded-xl border border-slate-200/90 bg-white/95 px-3.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                />

                <select
                  value={newDeliverablePriority}
                  onChange={(e) => setNewDeliverablePriority(e.target.value as any)}
                  className="h-10 rounded-xl border border-slate-200/90 bg-white/95 px-3 text-xs font-medium text-slate-700 outline-none transition-all cursor-pointer focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>

                <select
                  value={newDeliverableEstimate}
                  onChange={(e) => setNewDeliverableEstimate(Number(e.target.value))}
                  className="h-10 rounded-xl border border-slate-200/90 bg-white/95 px-3 text-xs font-medium text-slate-700 outline-none transition-all cursor-pointer focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
                >
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={45}>45m</option>
                  <option value={60}>1h</option>
                  <option value={120}>2h</option>
                  <option value={240}>4h</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddDeliverable}
                  disabled={!newDeliverableTitle.trim() || createTask.isPending}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-black transition-all disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Step</span>
                </button>
              </div>
            </div>

            {/* Deliverables List */}
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Project Deliverables ({completedTasks.length}/{tasks.length})
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {tasks.length > 0 ? `${Math.round((completedTasks.length / tasks.length) * 100)}% complete` : "0%"}
                </span>
              </div>

              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
                    No deliverables added yet. Use the input above or click "Generate AI Plan".
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 hover:border-slate-300 hover:shadow-2xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          await updateTask.mutateAsync({
                            id: task.id,
                            patch: { status: task.status === "done" ? "next" : "done" },
                          });
                          utils.projects.getTasks.invalidate({ projectId: project.id });
                          onRefresh();
                        }}
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        {task.status === "done" ? (
                          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        ) : (
                          <Circle size={18} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "text-xs font-semibold block truncate",
                              task.status === "done" ? "text-slate-400 line-through" : "text-slate-900"
                            )}
                          >
                            {task.title}
                          </span>
                          {task.notes && (
                            <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                              {task.notes}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {task.estimateMin && (
                          <span className="text-[10.5px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                            {task.estimateMin}m
                          </span>
                        )}

                        <PriorityBar priority={task.priority} showLabel />

                        <button
                          type="button"
                          onClick={async () => {
                            await removeTask.mutateAsync({ id: task.id });
                            utils.projects.getTasks.invalidate({ projectId: project.id });
                            onRefresh();
                            toast.success("Deliverable removed");
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Delete deliverable"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: VISUAL GALLERY & SCREENSHOTS ── */}
        {activeTab === "images" && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ImageIcon size={17} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Visual Gallery & Design Assets
                    </h3>
                    <p className="text-xs text-slate-500">
                      Attach screenshots, UI mockups, architecture diagrams, and reference images.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAddingImage(!addingImage)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={13} strokeWidth={2.4} />
                  <span>Add Image</span>
                </button>
              </div>

              {/* Add Image Input */}
              {addingImage && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                  <span className="font-display text-xs font-bold text-purple-900 block">Add Image URL</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      autoFocus
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://example.com/screenshot.png or /assets/mockup.png"
                      className="h-10 flex-1 rounded-xl border border-purple-200 bg-white px-3.5 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddImage}
                      disabled={!newImageUrl.trim()}
                      className="inline-flex h-10 items-center rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Save Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingImage(false)}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Image Grid */}
              {(!meta.images || meta.images.length === 0) ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-3xl space-y-2">
                  <ImageIcon size={32} className="mx-auto text-slate-400" />
                  <p className="font-semibold text-slate-700">No images or mockups attached yet</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Click "Add Image" above to attach architecture sketches, user journey mockups, or UI screenshots.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {meta.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs hover:shadow-md transition-all aspect-video flex items-center justify-center cursor-pointer"
                      onClick={() => setSelectedImageModal(img)}
                    >
                      <img
                        src={img}
                        alt={`Project asset ${idx + 1}`}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="text-xs font-semibold text-white bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                          Click to View
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(img);
                          }}
                          className="h-7 w-7 rounded-lg bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
                          title="Remove image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: DOCUMENTATION & NOTES ── */}
        {activeTab === "notes" && (
          <div className="max-w-4xl space-y-6">
            <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/80 p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText size={17} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Project Scratchpad & Technical Docs
                    </h3>
                    <p className="text-xs text-slate-500">
                      Write specifications, meeting recaps, client feedback, or implementation notes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => saveMetadata(meta)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer shadow-xs"
                >
                  <Check size={13} />
                  <span>Save Notes</span>
                </button>
              </div>

              <textarea
                rows={14}
                value={meta.docsNotes}
                onChange={(e) => setMeta({ ...meta, docsNotes: e.target.value })}
                placeholder="# Technical Notes & Implementation Guide&#10;&#10;- Architecture overview&#10;- Important endpoints&#10;- Deployment steps:&#10;  1. git pull origin main&#10;  2. npm run build&#10;  3. restart server"
                className="w-full rounded-2xl border border-border/80 bg-card p-4 text-xs leading-relaxed text-foreground outline-none transition-all focus:border-border shadow-2xs font-sans"
              />
            </div>
          </div>
        )}

      {/* Lightbox Modal for previewing images */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-black">
            <button
              onClick={() => setSelectedImageModal(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-2 text-white hover:bg-black cursor-pointer z-10"
            >
              <X size={18} />
            </button>
            <img
              src={selectedImageModal}
              alt="Enlarged preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREATE PROJECT DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function CreateProjectDialog({
  clients,
  onClose,
  onCreated,
}: {
  clients: Array<{ id: number; name: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const create = trpc.projects.create.useMutation();
  const generatePlan = trpc.projects.generatePlan.useMutation();

  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [adminUrl, setAdminUrl] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [color, setColor] = useState<SigColor>("blue");
  const [clientId, setClientId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("");
  const [autoAiPlan, setAutoAiPlan] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please provide a project name");
      return;
    }
    setIsSubmitting(true);
    try {
      const metaPayload: ProjectMetadata = {
        scope: scope.trim(),
        gitUrl: gitUrl.trim(),
        gitBranch: "main",
        liveUrl: "",
        adminUrl: adminUrl.trim(),
        adminUsername: adminUsername.trim(),
        adminPassword: adminPassword.trim(),
        envNotes: "",
        images: [],
        docsNotes: "",
      };

      const res = await create.mutateAsync({
        name: name.trim(),
        description: JSON.stringify(metaPayload),
        color,
        clientId: clientId || undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      });

      if (autoAiPlan && res?.id) {
        toast.info("Generating AI roadmap deliverables…");
        try {
          await generatePlan.mutateAsync({ projectId: res.id });
        } catch {
          // Non-fatal
        }
      }

      toast.success("Project workspace created!");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="anim-rise w-full max-w-lg rounded-3xl bg-white/90 backdrop-blur-xl border border-white/80 p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FolderKanban size={15} />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                New Project Workspace
              </h2>
              <span className="text-[11px] text-slate-500">
                Set up repo links, credentials vault & deliverables
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
              Project Title *
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design System V2, Client Onboarding Platform…"
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
              Scope / Description
            </label>
            <textarea
              rows={2}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="What core deliverables define success for this project?"
              className="w-full rounded-xl border border-slate-200/90 bg-white p-3 text-xs leading-relaxed text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                Git Repository Link
              </label>
              <input
                type="text"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                Target Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                Admin Panel Login URL
              </label>
              <input
                type="text"
                value={adminUrl}
                onChange={(e) => setAdminUrl(e.target.value)}
                placeholder="https://app.com/admin"
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password"
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-1.5 block">
                Client Attribution
              </label>
              <select
                value={clientId ?? ""}
                onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3 text-xs text-slate-700 outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs cursor-pointer"
              >
                <option value="">None (Internal)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11.5px] font-semibold text-slate-600 mb-2 block">
                Signature Color
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all cursor-pointer shadow-2xs",
                      color === c && "ring-2 ring-slate-900 ring-offset-2 scale-110"
                    )}
                    style={{ background: sig(c) }}
                    title={`Color: ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* AI Roadmap toggle */}
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAiPlan}
                onChange={(e) => setAutoAiPlan(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-display">
                  <Sparkles size={13} className="text-amber-500" />
                  Auto-generate AI roadmap deliverables upon creation
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Sequences 4–6 phased execution milestones directly into this workspace with time estimates and acceptance criteria.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="h-9 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting && <Sparkles size={12} className="animate-spin" />}
            <span>{isSubmitting ? "Creating…" : "Create Workspace"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
