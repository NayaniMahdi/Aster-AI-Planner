import { z } from "zod";
import { generateText, generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { getAiConfig, getCascadeModels, type CascadeCandidate } from "../ai/provider";
import {
  autonomousChat,
  autonomousBrief,
  autonomousExpandIdea,
  autonomousParseCapture,
  type WorkspaceData,
} from "../ai/engine";
import {
  tasks,
  projects,
  clients,
  events,
  ideas,
  chatMessages,
  settings,
  studyTracks,
} from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { extractWorkspaceActions, executeWorkspaceActions, type ActionResult } from "../ai/actions";
import { getRecentEmails } from "./gmail";

async function getWorkspaceData(): Promise<WorkspaceData> {
  const db = getDb();
  const [allTasks, allProjects, allClients, allEvents, allIdeas, tracks, recentEmails] =
    await Promise.all([
      db.select().from(tasks),
      db.select().from(projects),
      db.select().from(clients),
      db.select().from(events),
      db.select().from(ideas),
      db.select().from(studyTracks),
      getRecentEmails(10).catch(() => []),
    ]);

  return {
    tasks: allTasks,
    projects: allProjects,
    clients: allClients,
    events: allEvents,
    ideas: allIdeas,
    studyTracks: tracks,
    recentEmails: recentEmails || [],
  };
}

// Build a compact live snapshot of the user's world for the system prompt
function buildContextString(data: WorkspaceData): string {
  const { tasks: allTasks, projects: allProjects, clients: allClients, events: allEvents, ideas: allIdeas, studyTracks: tracks, recentEmails } = data;
  const open = allTasks.filter((t) => t.status !== "done");
  const now = new Date();
  const fmt = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  const lines: string[] = [];
  lines.push(`NOW: ${now.toISOString()} (local ${now.toString().slice(0, 21)})`);
  lines.push(
    `TASKS open=${open.length} inbox=${open.filter((t) => t.status === "inbox").length} next=${open.filter((t) => t.status === "next").length} scheduled=${open.filter((t) => t.status === "scheduled").length}`,
  );
  if (open.length) {
    lines.push("OPEN TASKS:");
    for (const t of open.slice(0, 40)) {
      const proj = allProjects.find((p) => p.id === t.projectId)?.name;
      lines.push(
        `- [#${t.id}] (${t.status}/${t.priority}) ${t.title}${t.dueDate ? ` due=${fmt(t.dueDate)}` : ""}${proj ? ` proj=${proj}` : ""}`,
      );
    }
  }
  if (allProjects.length) {
    lines.push("PROJECTS:");
    for (const p of allProjects.slice(0, 20))
      lines.push(`- [#${p.id}] ${p.name} (${p.status})${p.deadline ? ` deadline=${fmt(p.deadline)}` : ""}`);
  }
  if (allClients.length) {
    lines.push("CLIENTS:");
    for (const c of allClients.slice(0, 20))
      lines.push(`- [#${c.id}] ${c.name}${c.company ? ` @ ${c.company}` : ""} (${c.status}, health=${c.health})`);
  }
  if (allEvents.length) {
    lines.push("UPCOMING EVENTS:");
    for (const e of allEvents
      .filter((e) => new Date(e.endAt) >= now)
      .slice(0, 15))
      lines.push(`- ${e.title} ${new Date(e.startAt).toISOString().slice(0, 16)}`);
  }
  if (allIdeas.length) {
    lines.push("NOTES & IDEAS:");
    for (const i of allIdeas.slice(0, 20)) lines.push(`- [#${i.id}] ${i.title} (${i.status})${i.body ? `: ${i.body.slice(0, 80).replace(/\n/g, ' ')}...` : ''}`);
  }
  if (tracks.length) {
    lines.push("STUDY TRACKS: " + tracks.map((t) => t.subject).join(", "));
  }
  if (recentEmails && recentEmails.length > 0) {
    lines.push("RECENT INBOX EMAILS (GMAIL LIVE):");
    for (const em of recentEmails) {
      lines.push(`- [threadId:${em.threadId || em.id}] From: ${em.sender} <${em.senderEmail}> | Subject: "${em.subject}" | Date: ${em.date} | Snippet: ${em.snippet}`);
    }
  }
  return lines.join("\n");
}

const SYSTEM = `You are Aster Assistant — the executive AI assistant built into the user's workspace. You manage their tasks, projects, clients (CRM), schedule, calendar, notes, ideas, study tracks, and Gmail communications with FULL ADMINISTRATIVE AND OPERATIONAL RIGHTS.

STYLE:
Executive, warm, clear, crisp, and proactive. Use markdown. Keep communications concise and actionable. When the user brainstorms, build on their ideas with high-leverage insights.

WORKSPACE FULL EXECUTION AUTHORITY:
You have FULL, UNRESTRICTED RIGHTS to read, create, update, delete, complete, and execute actions across every facet of the user's workspace:
- Tasks & workflow
- Projects & milestones
- CRM Clients & deals
- Calendar events & schedule
- Notes, documents & seed ideas
- Study tracks & deep focus sessions
- Gmail messages (reading live inbox, drafting, and sending emails)

CRITICAL EXECUTION ENFORCEMENT:
Whenever the user asks you to create, modify, schedule, complete, or delete anything, or draft/send an email, you MUST ALWAYS conclude your response with a fenced \`\`\`actions block containing the exact JSON array of actions.
The server automatically parses this block and immediately executes the real SQL mutations or Gmail API requests!
NEVER merely claim "I have created/sent..." without outputting the \`\`\`actions block.

SUPPORTED ACTIONS:
1. TASKS:
{"type":"create_task","title":"...","priority":"low|medium|high|urgent","status":"inbox|next|scheduled","energy":"low|medium|high","dueDate":"YYYY-MM-DD or null","projectId":number|null,"clientId":number|null,"notes":"..."}
{"type":"complete_task","id":number}
{"type":"update_task","id":number,"patch":{"status":"inbox|next|scheduled|done","priority":"low|medium|high|urgent","title":"...","dueDate":"YYYY-MM-DD"}}
{"type":"delete_task","id":number}

2. CLIENTS (CRM):
{"type":"create_client","name":"Full Name","company":"Company Name or null","email":"email@domain.com or null","status":"lead|active|dormant","health":"great|ok|at_risk","dealValue":number,"notes":"..."}
{"type":"update_client","id":number,"patch":{"status":"active|lead|dormant","health":"great|ok|at_risk","dealValue":number}}
{"type":"delete_client","id":number}

3. PROJECTS:
{"type":"create_project","name":"Project Name","description":"...","color":"cyan|magenta|mint|amber","status":"active|paused|done","clientId":number|null,"deadline":"YYYY-MM-DD or null"}
{"type":"update_project","id":number,"patch":{"status":"active|paused|done","deadline":"YYYY-MM-DD"}}
{"type":"delete_project","id":number}

4. CALENDAR EVENTS:
{"type":"create_event","title":"...","startAt":"ISO datetime","endAt":"ISO datetime","location":"..."}
{"type":"update_event","id":number,"patch":{"title":"...","startAt":"ISO datetime"}}
{"type":"delete_event","id":number}

5. NOTES & IDEAS:
{"type":"create_idea","title":"...","body":"...","status":"seed|exploring|parked|shipped"}
{"type":"update_idea","id":number,"patch":{"title":"...","body":"...","status":"seed|exploring|parked|shipped"}}
{"type":"delete_idea","id":number}

6. STUDY & FOCUS:
{"type":"create_study_track","subject":"...","goal":"...","targetMinPerWeek":number}
{"type":"log_study_session","trackId":number,"minutes":number,"note":"..."}
{"type":"log_focus_session","taskId":number|null,"label":"...","minutes":number}

7. GMAIL COMMUNICATIONS:
{"type":"send_email","to":"recipient@example.com","subject":"...","body":"...","threadId":"optional_thread_id"}
{"type":"create_email_draft","to":"recipient@example.com","subject":"...","body":"...","threadId":"optional_thread_id"}

WORKSPACE SNAPSHOT:
`;

export const aiRouter = createRouter({
  // ── AI status query ──
  status: publicQuery.query(async () => {
    return getAiConfig();
  }),

  // ── Test custom AI connection with 10s timeout ──
  testConfig: publicQuery
    .input(
      z.object({
        apiKey: z.string(),
        baseUrl: z.string(),
        model: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const provider = createOpenAICompatible({
          name: "test-ai",
          baseURL: input.baseUrl || "https://api.openai.com/v1",
          apiKey: input.apiKey,
        });
        const model = provider(input.model);
        const res = await generateText({
          model,
          prompt: "Say hello in 3 words.",
          abortSignal: AbortSignal.timeout(10000),
        });
        return {
          ok: true,
          latency: Date.now() - start,
          sample: res.text || "Connected successfully",
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout =
          message.includes("abort") || message.includes("timeout") || message.includes("The operation was aborted");
        return {
          ok: false,
          latency: Date.now() - start,
          error: isTimeout
            ? `Endpoint timed out after 10s. The model '${input.model}' may be queued, slow, or unavailable on this server.`
            : message,
        };
      }
    }),

  // ── Save custom AI configuration ──
  saveConfig: publicQuery
    .input(
      z.object({
        provider: z.string().optional(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const entries: Array<[string, string | undefined]> = [
        ["ai_provider", input.provider],
        ["ai_api_key", input.apiKey],
        ["ai_base_url", input.baseUrl],
        ["ai_model", input.model],
      ];

      const bUrl = (input.baseUrl || "").toLowerCase();
      if (input.apiKey) {
        if (bUrl.includes("nvidia")) entries.push(["api_key_nvidia", input.apiKey]);
        else if (bUrl.includes("openrouter")) entries.push(["api_key_openrouter", input.apiKey]);
        else if (bUrl.includes("groq")) entries.push(["api_key_groq", input.apiKey]);
        else if (bUrl.includes("openai")) entries.push(["api_key_openai", input.apiKey]);
      }

      for (const [key, val] of entries) {
        if (val !== undefined) {
          const [exists] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
          if (exists) {
            await db.update(settings).set({ value: val }).where(eq(settings.key, key));
          } else {
            await db.insert(settings).values({ key, value: val });
          }
        }
      }
      return { ok: true, config: await getAiConfig() };
    }),

  // ── Copilot chat with multi-model failover cascade ──
  chat: publicQuery
    .input(z.object({ message: z.string().min(1).max(8000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(chatMessages).values({ role: "user", content: input.message });

      const history = await db
        .select()
        .from(chatMessages)
        .orderBy(desc(chatMessages.createdAt))
        .limit(24);

      const data = await getWorkspaceData();
      const cascade = await getCascadeModels();

      let reply = "";
      let successCandidate: CascadeCandidate | null = null;
      const errors: Array<{ model: string; providerName: string; error: string }> = [];

      const ctxStr = buildContextString(data);
      const conversation = history
        .slice()
        .reverse()
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      for (const candidate of cascade) {
        try {
          console.log(`[AI Cascade] Trying ${candidate.model} on ${candidate.providerName}...`);
          const provider = createOpenAICompatible({
            name: "cascade-ai",
            baseURL: candidate.baseUrl,
            apiKey: candidate.apiKey,
          });
          const model = provider(candidate.model);
          const result = await generateText({
            model,
            system: SYSTEM + ctxStr,
            messages: conversation,
            abortSignal: AbortSignal.timeout(10000), // 10s timeout per candidate model
          });

          if (result.text && result.text.trim()) {
            reply = result.text.trim();
            successCandidate = candidate;
            break; // Success! Break out of the cascade
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[AI Cascade] ${candidate.model} failed, trying next fallback:`, msg);
          errors.push({
            model: candidate.model,
            providerName: candidate.providerName,
            error: msg,
          });
        }
      }

      if (!reply) {
        console.log("[AI Cascade] Falling back to Aster Autonomous Intelligence Engine...");
        try {
          reply = autonomousChat(input.message, conversation, data);
        } catch (engineErr) {
          console.error("[Autonomous Engine Error]:", engineErr);
          reply = "I'm ready to help you manage your tasks, clients, projects, and schedule. What would you like to work on?";
        }
      }

      // Extract & execute database actions directly on server with full CRUD authority
      const { clean, actions } = extractWorkspaceActions(reply);
      let executedCount = 0;
      let actionResults: ActionResult[] = [];

      if (actions.length > 0) {
        console.log(`[AI Database Authority] Executing ${actions.length} action(s) directly on database...`);
        const execution = await executeWorkspaceActions(db, actions);
        executedCount = execution.count;
        actionResults = execution.results;
        console.log(`[AI Database Authority] Successfully executed ${executedCount} actions.`);
      }

      await db.insert(chatMessages).values({ role: "assistant", content: reply });
      return {
        reply,
        actions,
        executedCount,
        actionResults,
      };
    }),

  history: publicQuery.query(async () => {
    const rows = await getDb()
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(60);
    return rows.reverse();
  }),

  clearHistory: publicQuery.mutation(async () => {
    await getDb().delete(chatMessages);
    return { ok: true };
  }),

  // ── Natural-language quick capture → structured entities ──
  parseCapture: publicQuery
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [allProjects, allClients] = await Promise.all([
        db.select().from(projects),
        db.select().from(clients),
      ]);

      const cascade = await getCascadeModels();
      for (const candidate of cascade) {
        try {
          const provider = createOpenAICompatible({
            name: "cascade-ai",
            baseURL: candidate.baseUrl,
            apiKey: candidate.apiKey,
          });
          const model = provider(candidate.model);
          const { object } = await generateObject({
            model,
            schema: z.object({
              kind: z.enum(["task", "event", "idea"]),
              title: z.string(),
              priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
              status: z.enum(["inbox", "next", "scheduled"]).default("inbox"),
              dueDate: z.string().nullable().describe("YYYY-MM-DD or null"),
              startAt: z.string().nullable().describe("ISO datetime for events"),
              endAt: z.string().nullable(),
              projectId: z.number().nullable(),
              clientId: z.number().nullable(),
              body: z.string().nullable().describe("extra notes / idea body"),
            }),
            system: `You parse quick-capture text into ONE structured entity for a personal OS.
Rules: kind=event only when there's a clear date+time appointment; kind=idea for brainstorms/"what if"/concepts; otherwise task.
Map mentioned projects/clients to these ids: projects=${JSON.stringify(allProjects.map((p) => ({ id: p.id, name: p.name })))} clients=${JSON.stringify(allClients.map((c) => ({ id: c.id, name: c.name })))}. Use null when no match.
Relative dates resolve against NOW=${new Date().toISOString()}. Strip date/time/priority words from the title. "!high" or "urgent" → priority.`,
            prompt: input.text,
            abortSignal: AbortSignal.timeout(10000),
          });
          if (object) return object;
        } catch (err) {
          console.warn(`[AI ParseCapture] Model ${candidate.model} failed, trying next fallback:`, err);
        }
      }

      if (cascade.length === 0) {
        return autonomousParseCapture(input.text, allProjects, allClients);
      }

      // Safe clean fallback if all external AI fail or no key is configured
      try {
        return autonomousParseCapture(input.text, allProjects, allClients);
      } catch {
        return {
          kind: "task" as const,
          title: input.text.trim(),
          priority: "medium" as const,
          status: "inbox" as const,
          dueDate: null,
          startAt: null,
          endAt: null,
          projectId: null,
          clientId: null,
          body: null,
        };
      }
    }),

  // ── Idea expansion ──
  expandIdea: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.id)).limit(1);
      if (!idea) throw new Error("Idea not found");

      const cascade = await getCascadeModels();
      let expansion = "";

      for (const candidate of cascade) {
        try {
          const provider = createOpenAICompatible({
            name: "cascade-ai",
            baseURL: candidate.baseUrl,
            apiKey: candidate.apiKey,
          });
          const model = provider(candidate.model);
          const result = await generateText({
            model,
            system:
              "You are a sharp creative strategist. Expand the user's raw idea into: 1) The core insight (1-2 lines) 2) Three concrete ways it could work (bulleted, specific) 3) First 3 steps to test it this week 4) One risk + how to hedge it. Use markdown, stay under 300 words, be concrete not generic.",
            prompt: `Idea: ${idea.title}\n${idea.body ?? ""}`,
            abortSignal: AbortSignal.timeout(10000),
          });
          if (result.text && result.text.trim()) {
            expansion = result.text.trim();
            break;
          }
        } catch (err) {
          console.warn(`[AI ExpandIdea] Model ${candidate.model} failed, trying next fallback:`, err);
        }
      }

      if (!expansion) {
        try {
          expansion = autonomousExpandIdea({ title: idea.title, body: idea.body });
        } catch {
          expansion = "### 💡 Insight\nFocus on executing the smallest testable prototype this week.";
        }
      }

      await db
        .update(ideas)
        .set({ aiExpansion: expansion, status: "exploring" })
        .where(eq(ideas.id, input.id));

      return { expansion };
    }),

  // ── Daily mission brief ──
  brief: publicQuery.mutation(async () => {
    const data = await getWorkspaceData();
    const cascade = await getCascadeModels();
    let briefText = "";
    const ctx = buildContextString(data);

    for (const candidate of cascade) {
      try {
        const provider = createOpenAICompatible({
          name: "cascade-ai",
          baseURL: candidate.baseUrl,
          apiKey: candidate.apiKey,
        });
        const model = provider(candidate.model);
        const result = await generateText({
          model,
          system: `You are the Northstar Assistant writing the user's morning brief. Format exactly:
**🎯 Today's #1 thing** — the single most important task today and why (1 line)
**📅 On the schedule** — 2-4 bullets: what's due, meetings, deadlines
**🧭 Suggestion** — one smart recommendation based on their projects and load
**💡 Spark** — one unexpected idea connecting two things in their world (projects × study × clients × ideas)
Max 150 words total. Warm, clear, plain language — no jargon.
SNAPSHOT:
`,
          prompt: ctx,
          abortSignal: AbortSignal.timeout(10000),
        });
        if (result.text && result.text.trim()) {
          briefText = result.text.trim();
          break;
        }
      } catch (err) {
        console.warn(`[AI Brief] Model ${candidate.model} failed, trying next fallback:`, err);
      }
    }

    if (!briefText) {
      try {
        briefText = autonomousBrief(data);
      } catch {
        briefText = "Clear runway today: No scheduled meetings booked. Ideal for deep work sprints.";
      }
    }

    return { brief: briefText };
  }),
});

export const settingsRouter = createRouter({
  get: publicQuery.input(z.object({ key: z.string() })).query(async ({ input }) => {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, input.key))
      .limit(1);
    return row?.value ?? null;
  }),
  set: publicQuery
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(settings).where(eq(settings.key, input.key)).limit(1);
      if (row) await db.update(settings).set({ value: input.value }).where(eq(settings.key, input.key));
      else await db.insert(settings).values({ key: input.key, value: input.value });
      return { ok: true };
    }),
});
