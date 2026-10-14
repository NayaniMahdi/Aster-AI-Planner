import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { clients, projects, tasks } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { getCascadeModels } from "../ai/provider";

const clientInput = z.object({
  name: z.string().min(1).max(255),
  company: z.string().optional(),
  email: z.string().optional(),
  status: z.enum(["lead", "active", "dormant"]).optional(),
  stage: z.string().optional(),
  health: z.enum(["great", "ok", "at_risk"]).optional(),
  dealValue: z.number().optional(),
  notes: z.string().optional(),
  lastTouchAt: z.date().nullish(),
});

export const clientsRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(clients).orderBy(desc(clients.createdAt));
    const allProjects = await db.select().from(projects);
    const allTasks = await db.select().from(tasks);
    return all.map((c) => ({
      ...c,
      projectCount: allProjects.filter((p) => p.clientId === c.id).length,
      openTasks: allTasks.filter((t) => t.clientId === c.id && t.status !== "done").length,
    }));
  }),

  create: publicQuery.input(clientInput).mutation(async ({ input }) => {
    const [r] = await getDb().insert(clients).values(input).$returningId();
    return { id: r.id };
  }),

  update: publicQuery
    .input(z.object({ id: z.number(), patch: clientInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(clients).set(input.patch).where(eq(clients.id, input.id));
      return { ok: true };
    }),

  touch: publicQuery
    .input(z.object({ id: z.number(), note: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      const noteAppend = input.note ? `\n\n[Touchpoint ${new Date().toLocaleDateString()}]: ${input.note}` : "";
      const updatedNotes = (existing?.notes || "") + noteAppend;

      await db
        .update(clients)
        .set({ lastTouchAt: new Date(), notes: updatedNotes })
        .where(eq(clients.id, input.id));
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(tasks).set({ clientId: null }).where(eq(tasks.clientId, input.id));
      await db.update(projects).set({ clientId: null }).where(eq(projects.clientId, input.id));
      await db.delete(clients).where(eq(clients.id, input.id));
      return { ok: true };
    }),

  // ✨ 1-Click AI Follow-Up Email Drafter
  draftFollowUp: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [client] = await db.select().from(clients).where(eq(clients.id, input.id)).limit(1);
      if (!client) throw new Error("Client not found");

      const [clientProjects, clientTasks] = await Promise.all([
        db.select().from(projects).where(eq(projects.clientId, input.id)),
        db.select().from(tasks).where(eq(tasks.clientId, input.id)),
      ]);

      const cascade = await getCascadeModels();
      let emailDraft = "";

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
              "You are an executive business partner. Draft a warm, concise, professional follow-up email to this client. Acknowledge current projects and next milestones. Keep it under 150 words.",
            prompt: `Client Name: ${client.name}\nCompany: ${client.company || "Independent"}\nStatus: ${client.status}\nStage: ${client.stage}\nDeal Value: $${client.dealValue}\nProjects: ${JSON.stringify(clientProjects.map((p) => p.name))}\nPending Tasks: ${JSON.stringify(clientTasks.filter((t) => t.status !== "done").map((t) => t.title))}\nNotes: ${client.notes || "None"}`,
            abortSignal: AbortSignal.timeout(10000),
          });

          if (result.text && result.text.trim()) {
            emailDraft = result.text.trim();
            break;
          }
        } catch (err) {
          console.warn(`[AI Client Follow-Up] Model ${candidate.model} failed:`, err);
        }
      }

      if (!emailDraft) {
        emailDraft = `Subject: Checking in on our progress\n\nHi ${client.name.split(" ")[0]},\n\nI hope you're having a productive week! I wanted to check in and share a quick update on our ongoing deliverables.\n\nEverything is tracking nicely according to our roadmap. Let me know if there are any specific priorities you'd like us to focus on this week.\n\nBest regards,\nNorthstar`;
      }

      return { emailDraft };
    }),
});
