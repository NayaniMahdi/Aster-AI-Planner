import { useState } from "react";
import { CopilotChat } from "@/components/Copilot";
import { AiSettingsModal } from "@/components/AiSettingsModal";
import { PageContainer } from "@/components/layout";
import { trpc } from "@/providers/trpc";

export default function CopilotPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const utils = trpc.useUtils();
  const clear = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      utils.ai.history.invalidate();
    },
  });

  return (
    <PageContainer variant="full-bleed" className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* ── Chat Canvas directly integrated under global studio header ── */}
      <div className="min-h-0 flex-1 flex flex-col">
        <CopilotChat
          fullPage
          onOpenSettings={() => setSettingsOpen(true)}
          onClearHistory={() => clear.mutate()}
        />
      </div>

      <AiSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </PageContainer>
  );
}
