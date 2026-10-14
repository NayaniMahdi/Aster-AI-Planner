import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, Server, Check, Activity, AlertCircle, ShieldCheck, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { NVIDIA_FLAGSHIP_MODELS, OPENROUTER_FREE_MODELS } from "@/lib/ai-models";

export function AiSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.ai.status.useQuery(undefined, { enabled: open });
  const testMutation = trpc.ai.testConfig.useMutation();
  const saveMutation = trpc.ai.saveConfig.useMutation({
    onSuccess: () => {
      utils.ai.status.invalidate();
      toast.success("AI model configuration saved");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save settings");
    },
  });

  const [activeTab, setActiveTab] = useState<"nvidia" | "openrouter" | "custom">("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://integrate.api.nvidia.com/v1");
  const [model, setModel] = useState("meta/llama-3.3-70b-instruct");
  const [showAssistantLauncher, setShowAssistantLauncher] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("aster_show_floating_assistant") !== "false";
  });
  const [keysByProvider, setKeysByProvider] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latency?: number;
    sample?: string;
    error?: string;
  } | null>(null);

  // Sync state when status query loads
  useEffect(() => {
    if (statusQuery.data) {
      const bUrl = statusQuery.data.baseUrl || "https://integrate.api.nvidia.com/v1";
      setBaseUrl(bUrl);
      setModel(statusQuery.data.model || "meta/llama-3.3-70b-instruct");

      const providerKeys: Record<string, string> = {};
      if (statusQuery.data.keysByProvider) {
        if (statusQuery.data.keysByProvider.nvidia) providerKeys.nvidia = statusQuery.data.keysByProvider.nvidia;
        if (statusQuery.data.keysByProvider.openrouter) providerKeys.openrouter = statusQuery.data.keysByProvider.openrouter;
        if (statusQuery.data.keysByProvider.groq) providerKeys.groq = statusQuery.data.keysByProvider.groq;
        if (statusQuery.data.keysByProvider.openai) providerKeys.openai = statusQuery.data.keysByProvider.openai;
      }

      setKeysByProvider(providerKeys);

      // Determine active tab
      let tab: "nvidia" | "openrouter" | "custom" = "nvidia";
      if (bUrl.includes("nvidia")) {
        tab = "nvidia";
        setApiKey(providerKeys.nvidia || statusQuery.data.apiKey || "");
      } else if (bUrl.includes("openrouter")) {
        tab = "openrouter";
        setApiKey(providerKeys.openrouter || statusQuery.data.apiKey || "");
      } else {
        tab = "custom";
        setApiKey(statusQuery.data.apiKey || "");
      }
      setActiveTab(tab);
    }
  }, [statusQuery.data]);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    setKeysByProvider((prev) => ({
      ...prev,
      [activeTab]: val,
    }));
  };

  const handleSelectNvidiaModel = (modelId: string) => {
    setActiveTab("nvidia");
    setBaseUrl("https://integrate.api.nvidia.com/v1");
    setModel(modelId);
    setTestResult(null);
    const existingKey = keysByProvider.nvidia || (apiKey.startsWith("nvapi-") ? apiKey : "");
    setApiKey(existingKey);
  };

  const handleSelectOpenRouterModel = (modelId: string) => {
    setActiveTab("openrouter");
    setBaseUrl("https://openrouter.ai/api/v1");
    setModel(modelId);
    setTestResult(null);
    const existingKey = keysByProvider.openrouter || (apiKey.startsWith("sk-or-") ? apiKey : "");
    setApiKey(existingKey);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API Key to test");
      return;
    }
    setTestResult(null);
    try {
      const res = await testMutation.mutateAsync({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
      });
      setTestResult(res);
      if (res.ok) {
        toast.success(`Connected! Latency: ${res.latency}ms`);
      } else {
        toast.error("Connection test failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTestResult({ ok: false, error: msg });
      toast.error(msg);
    }
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API Key");
      return;
    }
    saveMutation.mutate({
      provider: "custom",
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim() || "meta/llama-3.3-70b-instruct",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-secondary/80 text-foreground">
              <Cpu size={16} className="text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight">Intelligence Engine Settings</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-normal">
                Select your flagship provider with automatic multi-model failover
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          {/* Provider Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-secondary/60 p-1 border border-border/60">
            <button
              type="button"
              onClick={() => handleSelectNvidiaModel(NVIDIA_FLAGSHIP_MODELS[0].id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeTab === "nvidia"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              NVIDIA NIM
            </button>
            <button
              type="button"
              onClick={() => handleSelectOpenRouterModel(OPENROUTER_FREE_MODELS[0].id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeTab === "openrouter"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              OpenRouter
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("custom");
                setTestResult(null);
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                activeTab === "custom"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom Endpoint
            </button>
          </div>

          {/* Model Selection Grid */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Select Model Architecture:</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                70B+ &amp; Reasoning Flagships
              </span>
            </label>

            {activeTab === "nvidia" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NVIDIA_FLAGSHIP_MODELS.map((m) => {
                  const isSelected = model === m.id && baseUrl.includes("nvidia");
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectNvidiaModel(m.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary/60 bg-primary/5 text-foreground ring-1 ring-primary/30"
                          : "border-border/70 bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate text-foreground">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</p>
                      </div>
                      {isSelected && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "openrouter" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OPENROUTER_FREE_MODELS.map((m) => {
                  const isSelected = model === m.id && baseUrl.includes("openrouter");
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectOpenRouterModel(m.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-primary/60 bg-primary/5 text-foreground ring-1 ring-primary/30"
                          : "border-border/70 bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate text-foreground">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</p>
                      </div>
                      {isSelected && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Persistent API Key & Endpoint Details */}
          <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/30 p-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key size={13} className="text-primary" /> API Key ({activeTab === "nvidia" ? "NVIDIA NIM" : activeTab === "openrouter" ? "OpenRouter" : "Custom"})
                </label>
                {apiKey && (
                  <span className="text-[11px] font-mono text-emerald-500 font-medium">
                    ✓ Cached Securely
                  </span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={activeTab === "nvidia" ? "nvapi-..." : "sk-or-v1-..."}
                className="mt-1.5 w-full rounded-lg border border-border/80 bg-card px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground font-normal">
                Credentials are remembered per provider. Models switch seamlessly without re-typing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Server size={11} /> Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-[11px] outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Active Model Identifier</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-[11px] outline-none font-mono"
                />
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleTest}
                disabled={testMutation.isPending || !apiKey.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              >
                <Activity size={12} className={testMutation.isPending ? "animate-spin text-primary" : "text-muted-foreground"} />
                {testMutation.isPending ? "Testing connection (10s max)..." : "Test Latency & Connection"}
              </button>

              {testResult && (
                <div
                  className={`mt-2 rounded-lg p-2.5 text-xs font-mono leading-relaxed ${
                    testResult.ok
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.ok ? (
                    <div>
                      <strong>✓ Connected:</strong> {testResult.latency}ms latency · <em>"{testResult.sample}"</em>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <div>
                        <strong>Diagnostic Fault:</strong> {testResult.error}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Automatic Multi-Model Failover Shield Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-secondary/20 p-3.5 text-xs text-foreground/80">
            <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-foreground">Multi-Model Auto-Failover:</span>{" "}
              If your chosen model experiences queue congestion or rate limits, Aster automatically cascades to the next flagship model on your provider with zero interruption.
            </div>
          </div>

          {/* Floating Assistant Widget Visibility Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/20 p-3.5 text-xs">
            <div>
              <span className="font-semibold text-foreground block">Floating Aster Assistant Launcher</span>
              <span className="text-[11px] text-muted-foreground">Show or hide the floating chat icon in the bottom right corner</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !showAssistantLauncher;
                setShowAssistantLauncher(next);
                localStorage.setItem("aster_show_floating_assistant", String(next));
                window.dispatchEvent(new Event("storage"));
                toast.success(next ? "Floating assistant enabled" : "Floating assistant hidden from dashboard");
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                showAssistantLauncher ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out",
                  showAssistantLauncher ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !apiKey.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              <Check size={13} />
              {saveMutation.isPending ? "Saving..." : "Apply Configuration"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
