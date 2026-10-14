import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { PageContainer } from "@/components/layout";
import {
  FileText,
  Plus,
  Trash2,
  FolderPlus,
  CheckSquare,
  Search,
  Clock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  seed: { label: "Draft", badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  exploring: { label: "Active", badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  parked: { label: "Parked", badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  shipped: { label: "Archived", badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
};

export default function NotesPage() {
  const utils = trpc.useUtils();
  const ideasQuery = trpc.ideas.list.useQuery();
  const rawNotes = ideasQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Editor local state
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mutations
  const createNote = trpc.ideas.create.useMutation({
    onSuccess: (data) => {
      utils.ideas.list.invalidate();
      setSelectedId(data.id);
      toast.success("New structured note created");
    },
    onError: (err) => toast.error(err.message || "Failed to create note"),
  });

  const updateNote = trpc.ideas.update.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      setIsSaving(false);
    },
    onError: (err) => {
      setIsSaving(false);
      toast.error(err.message || "Failed to save note");
    },
  });

  const removeNote = trpc.ideas.remove.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      toast.success("Note removed");
    },
  });

  const convertToProject = trpc.ideas.convertToProject.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      utils.projects.list.invalidate();
      toast.success("Converted note to active project!");
    },
  });

  const convertToTask = trpc.ideas.convertToTask.useMutation({
    onSuccess: () => {
      utils.ideas.list.invalidate();
      utils.tasks.list.invalidate();
      toast.success("Converted note to actionable task!");
    },
  });

  // Filter notes
  const filteredNotes = useMemo(() => {
    return rawNotes.filter((n) => {
      if (activeStatus !== "all" && n.status !== activeStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const titleMatch = n.title.toLowerCase().includes(q);
        const bodyMatch = (n.body || "").toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch) return false;
      }
      return true;
    });
  }, [rawNotes, activeStatus, search]);

  // Sync selected note to local state
  const selectedNote = useMemo(() => {
    if (selectedId) {
      const found = rawNotes.find((n) => n.id === selectedId);
      if (found) return found;
    }
    return filteredNotes[0] ?? rawNotes[0] ?? null;
  }, [selectedId, rawNotes, filteredNotes]);

  useEffect(() => {
    if (selectedNote) {
      setLocalTitle(selectedNote.title);
      setLocalContent(selectedNote.body || "");
      if (selectedId !== selectedNote.id) {
        setSelectedId(selectedNote.id);
      }
    } else {
      setSelectedId(null);
      setLocalTitle("");
      setLocalContent("");
    }
  }, [selectedNote?.id]);

  // Debounced auto-save
  const triggerAutoSave = (newTitle: string, newContent: string) => {
    if (!selectedNote) return;
    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateNote.mutate({
        id: selectedNote.id,
        patch: {
          title: newTitle.trim() || "Untitled Note",
          body: newContent,
        },
      });
    }, 600);
  };

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    triggerAutoSave(val, localContent);
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    triggerAutoSave(localTitle, val);
  };

  const handleCreateNew = () => {
    createNote.mutate({
      title: "Untitled Document",
      body: "# Untitled Document\n\nStart writing notes, agendas, specifications, or architecture docs...",
      status: "seed",
    });
  };

  const handleDeleteCurrent = () => {
    if (!selectedNote) return;
    if (confirm(`Delete "${selectedNote.title}"?`)) {
      const currentId = selectedNote.id;
      removeNote.mutate({ id: currentId });
      setSelectedId(null);
    }
  };

  const handleStatusChange = (newStatus: "seed" | "exploring" | "parked" | "shipped") => {
    if (!selectedNote) return;
    updateNote.mutate({
      id: selectedNote.id,
      patch: { status: newStatus },
    });
  };

  return (
    <PageContainer variant="full-bleed" className="flex flex-row h-full w-full min-h-0 overflow-hidden divide-x divide-border bg-background">
      {/* ── LEFT: Notes Directory ── */}
      <div className="w-80 shrink-0 flex flex-col h-full bg-card border-r border-border min-h-0">
        {/* Header & Controls */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Knowledge Notes ({filteredNotes.length})
            </span>
            <button
              onClick={handleCreateNew}
              disabled={createNote.isPending}
              className="flex items-center gap-1 rounded bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span>New</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes & documents..."
              className="w-full h-7 pl-7 pr-2 rounded bg-secondary/50 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 border-t border-border/70 pt-2 text-xs overflow-x-auto">
            {["all", "seed", "exploring", "parked", "shipped"].map((st) => (
              <button
                key={st}
                onClick={() => setActiveStatus(st)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10.5px] capitalize font-medium transition-colors whitespace-nowrap cursor-pointer",
                  activeStatus === st
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {st === "all" ? "All" : STATUS_LABELS[st]?.label || st}
              </button>
            ))}
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {ideasQuery.isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading workspace notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-3">
              <FileText size={32} className="mx-auto opacity-30" />
              <p className="text-xs font-medium">No notes match your filter</p>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer"
              >
                <Plus size={12} /> Create a new note
              </button>
            </div>
          ) : (
            filteredNotes.map((n) => {
              const isSelected = selectedNote?.id === n.id;
              const statusMeta = STATUS_LABELS[n.status] || STATUS_LABELS.seed;
              const formattedDate = new Date(n.createdAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={cn(
                    "p-3.5 cursor-pointer text-left transition-colors duration-120 space-y-1.5",
                    isSelected
                      ? "bg-secondary/70 border-l-2 border-primary"
                      : "hover:bg-secondary/30"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "font-mono text-[9px] uppercase tracking-wider rounded border px-1.5 py-0.2",
                        statusMeta.badgeClass
                      )}
                    >
                      {statusMeta.label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {formattedDate}
                    </span>
                  </div>

                  <h4 className="text-[13px] text-foreground font-medium truncate leading-tight">
                    {n.title}
                  </h4>

                  {n.body && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.body.replace(/[#*`_]/g, "").trim().slice(0, 110)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── CENTER: Markdown / Structured Document Editor ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-background overflow-hidden min-h-0">
        {selectedNote ? (
          <>
            {/* Document Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-6 py-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Status Selector */}
                <select
                  value={selectedNote.status}
                  onChange={(e) =>
                    handleStatusChange(
                      e.target.value as "seed" | "exploring" | "parked" | "shipped"
                    )
                  }
                  className="rounded border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground outline-none cursor-pointer"
                >
                  <option value="seed">Draft / Seed</option>
                  <option value="exploring">Active / Exploring</option>
                  <option value="parked">Parked</option>
                  <option value="shipped">Archived</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>
                    Created{" "}
                    {new Date(selectedNote.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Save Indicator */}
                <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                  {isSaving ? (
                    <span className="text-amber-500 animate-pulse">Saving...</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-500">
                      <Check size={11} /> Saved
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => convertToTask.mutate({ ideaId: selectedNote.id })}
                  disabled={convertToTask.isPending}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground font-medium hover:bg-secondary transition-colors cursor-pointer"
                  title="Convert note into a task"
                >
                  <CheckSquare size={12} className="text-primary" />
                  <span>To Task</span>
                </button>

                <button
                  onClick={() => convertToProject.mutate({ ideaId: selectedNote.id })}
                  disabled={convertToProject.isPending}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/60 px-2.5 py-1 text-xs text-foreground font-medium hover:bg-secondary transition-colors cursor-pointer"
                  title="Convert note into an active project workspace"
                >
                  <FolderPlus size={12} className="text-emerald-500" />
                  <span>To Project</span>
                </button>

                <button
                  onClick={handleDeleteCurrent}
                  className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer ml-1"
                  title="Delete Note"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Document Editor Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 max-w-4xl mx-auto w-full space-y-4 flex flex-col min-h-0">
              {/* Document Title Input */}
              <input
                type="text"
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Note Title..."
                className="w-full font-display text-2xl sm:text-3xl font-bold tracking-tight bg-transparent text-foreground placeholder:text-muted-foreground outline-none border-b border-border/50 pb-2"
              />

              {/* Document Body Editor */}
              <textarea
                value={localContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write structured note in Markdown. Aster Assistant can view, summarize, or expand on this..."
                className="w-full flex-1 min-h-[420px] resize-none bg-transparent font-mono text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground outline-none border-none focus:outline-none"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/50 border border-border/50">
              <FileText size={28} className="opacity-40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Zero Notes in Workspace</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Your workspace is clean. Create meeting agendas, technical specs, or strategic roadmaps, or ask Aster Assistant to draft notes for you with full administrative rights.
            </p>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Create First Note</span>
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
