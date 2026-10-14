import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { PageContainer } from "@/components/layout";
import {
  Mail,
  CheckCircle2,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  Send,
  ExternalLink,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CommunicationItem {
  id: string;
  threadId?: string;
  sender: string;
  senderEmail: string;
  avatarColor?: string;
  subject: string;
  time: string;
  date?: string;
  snippet: string;
  body: string;
  html?: string;
  category: "client" | "internal" | "alert" | "newsletter";
  isRead: boolean;
  priority: "high" | "normal";
  relatedProject?: string;
  relatedClient?: string;
  extractedAction?: string;
}

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "unread" | "clients">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setSetupModalOpen] = useState(false);

  // AI draft state for selected message
  const [draftReplyText, setDraftReplyText] = useState<string>("");
  const [aiDraftLoading, setAiDraftLoading] = useState<boolean>(false);
  const [extractedActionText, setExtractedActionText] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Gmail status and list queries
  const { data: statusData } = trpc.gmail.getStatus.useQuery();
  const isConnected = statusData?.isConnected ?? false;

  const {
    data: emailsData,
    isFetching: emailsFetching,
    refetch: refetchEmails,
  } = trpc.gmail.listEmails.useQuery(undefined, {
    enabled: isConnected,
  });

  // Disconnect mutation
  const disconnectMutation = trpc.gmail.disconnect.useMutation({
    onSuccess: () => {
      utils.gmail.getStatus.invalidate();
      utils.gmail.listEmails.invalidate();
      toast.success("Gmail disconnected");
    },
  });

  // AI Analyze Mutation
  const analyzeMutation = trpc.gmail.analyzeEmail.useMutation({
    onSuccess: (data) => {
      setDraftReplyText(data.suggestedReply || "");
      if (data.extractedAction) {
        setExtractedActionText(data.extractedAction);
      }
      setAiDraftLoading(false);
      toast.success("AI draft prepared");
    },
    onError: (err) => {
      setAiDraftLoading(false);
      toast.error(`AI analysis failed: ${err.message}`);
    },
  });

  // Send reply mutation
  const sendReplyMutation = trpc.gmail.sendReply.useMutation({
    onSuccess: (res) => {
      if (res.mode === "draft") {
        toast.success("Draft saved in your Gmail account");
      } else {
        toast.success("Reply sent via Gmail");
        refetchEmails();
      }
    },
    onError: (err) => {
      toast.error(`Send failed: ${err.message}`);
    },
  });

  // Create Task Mutation
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.invalidate();
      toast.success("Task added to workspace");
    },
  });

  // Listen for OAuth success message from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "GMAIL_CONNECTED") {
        setSetupModalOpen(false);
        utils.gmail.getStatus.invalidate();
        utils.gmail.listEmails.invalidate();
        toast.success("Google account connected");
      }
    };
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [utils]);

  // Purely dynamic live emails from Gmail API with strict null filtering
  const liveItems: CommunicationItem[] =
    isConnected && emailsData?.emails && emailsData.emails.length > 0
      ? emailsData.emails
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .map((e) => ({
            id: e.id,
            threadId: e.threadId,
            sender: e.sender,
            senderEmail: e.senderEmail,
            subject: e.subject,
            time: e.time,
            date: e.date,
            snippet: e.snippet,
            body: e.body,
            html: e.html,
            category: "client",
            isRead: e.isRead,
            priority: "normal",
          }))
      : [];

  // Auto-select first item if none selected
  useEffect(() => {
    if (!selectedId && liveItems.length > 0) {
      setSelectedId(liveItems[0].id);
    }
  }, [selectedId, liveItems]);

  const selectedMsg = liveItems.find((m) => m.id === selectedId) ?? liveItems[0];

  // Whenever selected message changes, prepare draft text
  useEffect(() => {
    if (selectedMsg) {
      setExtractedActionText(selectedMsg.extractedAction || null);
      const firstName = selectedMsg.sender.split(" ")[0] || selectedMsg.sender;
      setDraftReplyText(
        `Hi ${firstName},\n\nThank you for your note regarding ${selectedMsg.subject}. I have reviewed the details and am handling the next steps.\n\nBest regards,\nAbbas`
      );
    }
  }, [selectedMsg]);

  // Start Google OAuth consent flow
  const startGoogleOAuth = async () => {
    try {
      const res = await utils.gmail.getAuthUrl.fetch();
      if (res?.authUrl) {
        const width = 540;
        const height = 660;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          res.authUrl,
          "google_oauth_popup",
          `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
        );
      }
    } catch {
      setSetupModalOpen(true);
    }
  };

  const handleTriggerAiAnalysis = () => {
    if (!selectedMsg) return;
    setAiDraftLoading(true);
    analyzeMutation.mutate({
      emailId: selectedMsg.id,
      sender: selectedMsg.sender,
      senderEmail: selectedMsg.senderEmail,
      subject: selectedMsg.subject,
      body: selectedMsg.body,
    });
  };

  const handleTurnIntoTask = () => {
    if (!selectedMsg) return;
    createTask.mutate({
      title: extractedActionText
        ? extractedActionText.slice(0, 120)
        : `Follow up: ${selectedMsg.subject}`,
      notes: `Sender: ${selectedMsg.sender} <${selectedMsg.senderEmail}>\nSubject: ${selectedMsg.subject}\n\n${selectedMsg.body}`,
      status: "next",
      priority: selectedMsg.priority === "high" ? "high" : "medium",
    });
  };

  const handleSendEmailReply = (isDraftOnly: boolean) => {
    if (!selectedMsg) return;
    if (!isConnected) {
      toast.info(
        isDraftOnly
          ? "Connect your Google account to save real drafts in Gmail."
          : "Connect your Google account to send real replies via Gmail."
      );
      return;
    }

    sendReplyMutation.mutate({
      threadId: selectedMsg.threadId || selectedMsg.id,
      to: selectedMsg.senderEmail,
      subject: selectedMsg.subject,
      body: draftReplyText,
      isDraftOnly,
    });
  };

  const filteredItems = liveItems.filter((item) => {
    if (filter === "unread" && item.isRead) return false;
    if (filter === "clients" && item.category !== "client") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.subject.toLowerCase().includes(q) ||
        item.sender.toLowerCase().includes(q) ||
        item.snippet.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const unreadCount = liveItems.filter((i) => !i.isRead).length;

  return (
    <PageContainer variant="full-bleed" className="flex-1 flex flex-col min-h-0 select-none overflow-hidden font-sans">
      {/* ── Spacious Production-Grade Header Bar (min-h-[72px] with generous breathing room) ── */}
      <div className="min-h-[72px] py-3.5 bg-card border-b border-border/80 px-6 sm:px-8 flex items-center justify-between gap-6 shrink-0 shadow-2xs">
        {/* Left: View Title & Clear Unread Status */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground font-display tracking-tight">
              Inbox
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground border border-border/80 font-mono tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="h-6 w-px bg-border/80 hidden sm:block" />

          {/* Clean Segmented Filter */}
          <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border/80">
            {(
              [
                { key: "all", label: "All Messages" },
                { key: "unread", label: "Unread" },
                { key: "clients", label: "Clients" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
                  filter === key
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Account & Sync Controls */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/30 px-3.5 py-1.5 text-xs text-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium truncate max-w-[200px] text-foreground">
                  {statusData?.email || "Gmail Connected"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => refetchEmails()}
                disabled={emailsFetching}
                className="h-8.5 px-3 rounded-xl border border-border/80 bg-card text-xs font-medium text-foreground hover:bg-secondary transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Sync recent emails"
              >
                <RefreshCw
                  size={12}
                  className={cn("text-muted-foreground", emailsFetching && "animate-spin")}
                />
                <span className="text-xs">Sync</span>
              </button>

              <button
                type="button"
                onClick={() => disconnectMutation.mutate()}
                className="h-8.5 w-8.5 rounded-xl border border-border/80 bg-card text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                title="Disconnect account"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startGoogleOAuth}
              className="h-8.5 px-4 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              <Mail size={13} />
              <span>Connect Gmail</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Discreet Notice if Gmail API service needs activation ── */}
      {isConnected && (emailsData as any)?.apiDisabled && (
        <div className="bg-slate-900 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 border-b border-black">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span className="text-slate-200 text-xs">
              Gmail API service is pending activation on Google Cloud Console.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={(emailsData as any)?.enableUrl || "https://console.developers.google.com/apis/api/gmail.googleapis.com/overview"}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 bg-white text-slate-900 rounded font-semibold text-xs hover:bg-slate-100 flex items-center gap-1"
            >
              <span>Enable in Google Console</span>
              <ExternalLink size={11} />
            </a>
            <button
              type="button"
              onClick={() => {
                refetchEmails();
                toast.info("Checking connection...");
              }}
              className="px-2.5 py-1 border border-slate-700 text-slate-300 rounded text-xs hover:bg-slate-800 cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Main Two-Column Master-Detail Layout ── */}
      <div className="flex-1 flex min-h-0 p-4 lg:p-6 gap-5 overflow-hidden max-w-[1720px] mx-auto w-full">
        {/* Left: Message Master List */}
        <div className="w-80 lg:w-92 shrink-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xs overflow-hidden h-full">
          {/* Search Box */}
          <div className="p-3.5 border-b border-border/60 bg-secondary/20">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search communications…"
                className="w-full h-8.5 rounded-xl border border-border/80 bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center h-full space-y-2">
                {isConnected ? (
                  <>
                    <CheckCircle2 size={24} className="text-emerald-500 opacity-80" />
                    <p className="font-semibold text-foreground text-sm">Inbox Zero</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      No active emails found. Your communication ledger is clear.
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchEmails()}
                      className="mt-2 text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                    >
                      Sync with Gmail
                    </button>
                  </>
                ) : (
                  <>
                    <Mail size={24} className="text-muted-foreground opacity-60" />
                    <p className="font-semibold text-foreground text-sm">No Live Mailbox</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Connect your Google account to stream your messages.
                    </p>
                    <button
                      type="button"
                      onClick={startGoogleOAuth}
                      className="mt-2 px-3.5 py-1.5 rounded-xl bg-foreground text-background font-semibold text-xs hover:opacity-90 cursor-pointer shadow-2xs"
                    >
                      Connect Gmail
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredItems.map((msg) => {
                const isSelected = msg.id === selectedId;
                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedId(msg.id)}
                    className={cn(
                      "p-3.5 transition-colors cursor-pointer relative space-y-1.5 border-l-2",
                      isSelected
                        ? "bg-secondary/60 border-foreground dark:border-white shadow-2xs"
                        : "hover:bg-secondary/25 border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-[13px] font-sans tracking-tight truncate",
                          !msg.isRead ? "text-foreground font-bold" : "text-foreground/80 font-medium"
                        )}
                      >
                        {msg.sender}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!msg.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground dark:bg-white shrink-0" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums font-medium">
                          {msg.time}
                        </span>
                      </div>
                    </div>

                    <h4
                      className={cn(
                        "text-xs truncate leading-snug",
                        !msg.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                      )}
                    >
                      {msg.subject}
                    </h4>

                    <p className="text-[11.5px] truncate leading-normal text-muted-foreground">
                      {msg.snippet}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message Detail & Clean Workspace */}
        <div className="flex-1 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xs overflow-hidden min-w-0 h-full">
          {selectedMsg ? (
            <>
              {/* Action Toolbar */}
              <div className="h-12 flex items-center justify-between border-b border-border/60 bg-secondary/20 px-6 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTurnIntoTask}
                    disabled={createTask.isPending}
                    className="h-7.5 px-3 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 size={13} />
                    <span>Create Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerAiAnalysis}
                    disabled={aiDraftLoading}
                    className="h-7.5 px-3 rounded-lg border border-border/80 bg-card text-xs font-semibold text-foreground hover:bg-secondary transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Sparkles
                      size={12}
                      className={cn("text-muted-foreground", aiDraftLoading && "animate-spin")}
                    />
                    <span>{aiDraftLoading ? "Analyzing..." : "Draft with AI"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <span>{selectedMsg.date || selectedMsg.time}</span>
                </div>
              </div>

              {/* Message Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                {/* ── Discreet Action Callout ── */}
                {extractedActionText && (
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Sparkles size={13} className="text-sky-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Identified Action Item
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleTurnIntoTask}
                        disabled={createTask.isPending}
                        className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>Add as Workspace Task</span>
                      </button>
                    </div>

                    <p className="text-xs text-foreground leading-relaxed font-normal">
                      "{extractedActionText}"
                    </p>
                  </div>
                )}

                {/* Email Header */}
                <div className="border-b border-border/60 pb-5 space-y-3">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug font-display">
                    {selectedMsg.subject}
                  </h2>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm tracking-[-0.01em]">
                        {selectedMsg.sender}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        &lt;{selectedMsg.senderEmail}&gt;
                      </span>
                    </div>

                    {selectedMsg.relatedProject && (
                      <span className="px-2 py-0.5 rounded border border-border/80 text-foreground text-xs font-medium">
                        {selectedMsg.relatedProject}
                      </span>
                    )}
                  </div>
                </div>

                {/* Email Body */}
                <div className="text-[13.5px] leading-relaxed text-foreground whitespace-pre-line font-sans max-w-3xl">
                  {selectedMsg.body}
                </div>

                {/* ── Executive Reply Composer ── */}
                <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3.5 shadow-2xs max-w-3xl mt-8">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">
                        Reply to {selectedMsg.sender}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTriggerAiAnalysis}
                      disabled={aiDraftLoading}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} className={cn(aiDraftLoading && "animate-spin")} />
                      <span>Generate AI Draft</span>
                    </button>
                  </div>

                  <textarea
                    value={draftReplyText}
                    onChange={(e) => setDraftReplyText(e.target.value)}
                    rows={4}
                    placeholder="Type your response..."
                    className="w-full rounded-xl border border-border/80 bg-secondary/20 p-3 text-xs text-foreground leading-relaxed font-sans focus:outline-none focus:border-border transition-all resize-none placeholder:text-muted-foreground"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      To: {selectedMsg.senderEmail}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendEmailReply(true)}
                        disabled={sendReplyMutation.isPending}
                        className="h-8 px-3 rounded-lg border border-border/80 bg-card text-xs font-semibold text-foreground hover:bg-secondary transition-all cursor-pointer shadow-2xs"
                      >
                        Save as Gmail Draft
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendEmailReply(false)}
                        disabled={sendReplyMutation.isPending}
                        className="h-8 px-3.5 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Send size={11} />
                        <span>{sendReplyMutation.isPending ? "Sending..." : "Send Reply"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Mail size={32} className="opacity-30 mb-2" />
              <p className="text-xs font-medium">Select a communication to read and review</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
