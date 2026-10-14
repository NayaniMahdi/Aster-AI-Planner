import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { projects, tasks, clients } from "@db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getCascadeModels } from "../ai/provider";

const projectInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(["active", "paused", "done"]).optional(),
  clientId: z.number().nullish(),
  deadline: z.date().nullish(),
});

export const projectsRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const allTasks = await db.select().from(tasks);
    const allClients = await db.select().from(clients);
    return all.map((p) => {
      const linked = allTasks.filter((t) => t.projectId === p.id);
      const done = linked.filter((t) => t.status === "done").length;
      return {
        ...p,
        client: allClients.find((c) => c.id === p.clientId) ?? null,
        taskCount: linked.length,
        doneCount: done,
        progress: linked.length ? Math.round((done / linked.length) * 100) : 0,
        recentTasks: linked
          .slice(0, 2)
          .map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
      };
    });
  }),

  getTasks: publicQuery
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return getDb()
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, input.projectId))
        .orderBy(asc(tasks.status), desc(tasks.priority));
    }),

  create: publicQuery.input(projectInput).mutation(async ({ input }) => {
    const [r] = await getDb().insert(projects).values(input).$returningId();
    return { id: r.id };
  }),

  update: publicQuery
    .input(z.object({ id: z.number(), patch: projectInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(projects).set(input.patch).where(eq(projects.id, input.id));
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, input.id));
      await db.delete(projects).where(eq(projects.id, input.id));
      return { ok: true };
    }),

  // ✨ 1-Click AI Project Plan Generator: creates structured sequenced deliverables
  generatePlan: publicQuery
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
      if (!project) throw new Error("Project not found");

      const cascade = await getCascadeModels();
      let generatedTasks: Array<{
        title: string;
        notes: string;
        priority: "low" | "medium" | "high" | "urgent";
        energy: "low" | "medium" | "high";
        estimateMin: number;
      }> = [];

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
              tasks: z.array(
                z.object({
                  title: z.string(),
                  notes: z.string().describe("Deliverable checklist or definition of done"),
                  priority: z.enum(["low", "medium", "high", "urgent"]),
                  energy: z.enum(["low", "medium", "high"]),
                  estimateMin: z.number().min(15).max(360),
                })
              ).min(3).max(6),
            }),
            system:
              "You are an elite product manager and technical lead. Create a realistic, high-impact 4-6 task execution plan for this project. Sequence tasks from foundation to delivery with accurate time estimates and priority levels.",
            prompt: `Project Name: ${project.name}\nDescription: ${project.description || "None"}\nStatus: ${project.status}`,
            abortSignal: AbortSignal.timeout(10000),
          });

          if (object?.tasks?.length) {
            generatedTasks = object.tasks;
            break;
          }
        } catch (err) {
          console.warn(`[AI Project Plan] Model ${candidate.model} failed:`, err);
        }
      }

      if (generatedTasks.length === 0) {
        generatedTasks = [
          { title: `Define specifications and milestones for ${project.name}`, notes: "Core requirements & scope doc", priority: "high", energy: "medium", estimateMin: 45 },
          { title: `Build initial prototype / MVP for ${project.name}`, notes: "Working implementation of core user flow", priority: "urgent", energy: "high", estimateMin: 120 },
          { title: `QA testing and edge-case verification`, notes: "Verify against requirements", priority: "medium", energy: "medium", estimateMin: 60 },
          { title: `Final polish, launch & deployment`, notes: "Release to users and document", priority: "high", energy: "medium", estimateMin: 60 },
        ];
      }

      for (const t of generatedTasks) {
        await db.insert(tasks).values({
          title: t.title,
          notes: t.notes,
          priority: t.priority,
          energy: t.energy,
          estimateMin: t.estimateMin,
          projectId: project.id,
          status: "next",
        });
      }

      return { ok: true, createdCount: generatedTasks.length };
    }),
});
