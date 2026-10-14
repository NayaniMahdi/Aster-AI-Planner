import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { tasks } from "@db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { getCascadeModels } from "../ai/provider";

const taskInput = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().optional(),
  status: z.enum(["inbox", "next", "scheduled", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  energy: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.date().nullish(),
  projectId: z.number().nullish(),
  clientId: z.number().nullish(),
  estimateMin: z.number().nullish(),
  tags: z.string().optional(),
  checklist: z.string().optional(),
});

export const tasksRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb()
      .select()
      .from(tasks)
      .orderBy(asc(tasks.status), desc(tasks.priority), desc(tasks.createdAt));
  }),

  create: publicQuery.input(taskInput).mutation(async ({ input }) => {
    const db = getDb();
    const [r] = await db.insert(tasks).values(input).$returningId();
    return db.select().from(tasks).where(eq(tasks.id, r.id)).limit(1);
  }),

  update: publicQuery
    .input(z.object({ id: z.number(), patch: taskInput.partial() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const patch: Record<string, unknown> = { ...input.patch, updatedAt: new Date() };
      if (input.patch.status === "done") patch.completedAt = new Date();
      if (input.patch.status && input.patch.status !== "done") patch.completedAt = null;
      await db.update(tasks).set(patch).where(eq(tasks.id, input.id));
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(tasks).where(eq(tasks.id, input.id));
      return { ok: true };
    }),

  batchUpdate: publicQuery
    .input(
      z.object({
        ids: z.array(z.number()),
        patch: taskInput.partial(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.ids.length === 0) return { ok: true, count: 0 };
      const db = getDb();
      const patch: Record<string, unknown> = { ...input.patch, updatedAt: new Date() };
      if (input.patch.status === "done") patch.completedAt = new Date();
      if (input.patch.status && input.patch.status !== "done") patch.completedAt = null;
      await db.update(tasks).set(patch).where(inArray(tasks.id, input.ids));
      return { ok: true, count: input.ids.length };
    }),

  batchDelete: publicQuery
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      if (input.ids.length === 0) return { ok: true, count: 0 };
      await getDb().delete(tasks).where(inArray(tasks.id, input.ids));
      return { ok: true, count: input.ids.length };
    }),

  // 1-Click AI Task Breakdown into actionable checklist steps
  breakdown: publicQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [task] = await db.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1);
      if (!task) throw new Error("Task not found");

      const cascade = await getCascadeModels();
      let subtasks: Array<{ id: string; text: string; done: boolean }> = [];

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
              steps: z.array(
                z.object({
                  title: z.string().describe("Clear, concise subtask action"),
                })
              ).min(3).max(6),
            }),
            system:
              "You are an expert executive coach. Break down this task into 3-5 concrete, small, sequenced, actionable steps that can each be checked off in under 20 minutes. Keep descriptions tight and crisp.",
            prompt: `Task: ${task.title}\nNotes: ${task.notes || "None"}`,
            abortSignal: AbortSignal.timeout(10000),
          });

          if (object?.steps?.length) {
            subtasks = object.steps.map((s, idx) => ({
              id: `${Date.now()}-${idx}`,
              text: s.title,
              done: false,
            }));
            break;
          }
        } catch (err) {
          console.warn(`[AI Task Breakdown] Model ${candidate.model} failed:`, err);
        }
      }

      if (subtasks.length === 0) {
        // Fallback default structured steps if external models are busy
        subtasks = [
          { id: `${Date.now()}-1`, text: `Define clear scope and requirements for "${task.title}"`, done: false },
          { id: `${Date.now()}-2`, text: "Complete core implementation / first draft", done: false },
          { id: `${Date.now()}-3`, text: "Review output and verify against expected result", done: false },
          { id: `${Date.now()}-4`, text: "Ship and document completion notes", done: false },
        ];
      }

      // Merge with existing checklist if any
      let existingList: Array<{ id: string; text: string; done: boolean }> = [];
      try {
        if (task.checklist) existingList = JSON.parse(task.checklist);
      } catch {
        existingList = [];
      }

      const combined = [...existingList, ...subtasks];
      const serialized = JSON.stringify(combined);

      await db.update(tasks).set({ checklist: serialized, updatedAt: new Date() }).where(eq(tasks.id, input.taskId));
      return { ok: true, checklist: combined };
    }),

  // Everything the command center needs in one shot
  overview: publicQuery.query(async () => {
    const db = getDb();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const weekStart = new Date(dayStart.getTime() - 6 * 24 * 3600 * 1000);

    const all = await db.select().from(tasks);
    const open = all.filter((t) => t.status !== "done");
    const dueToday = open.filter(
      (t) => t.dueDate && new Date(t.dueDate) < dayEnd,
    );
    const overdue = open.filter(
      (t) => t.dueDate && new Date(t.dueDate) < dayStart,
    );
    const urgent = open.filter(
      (t) => t.priority === "urgent" || t.priority === "high",
    );
    const completedWeek = all.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= weekStart,
    );

    // 14-day completion history for the momentum chart
    const history: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d0 = new Date(dayStart.getTime() - i * 24 * 3600 * 1000);
      const d1 = new Date(d0.getTime() + 24 * 3600 * 1000);
      history.push({
        date: d0.toISOString().slice(0, 10),
        count: all.filter(
          (t) =>
            t.completedAt &&
            new Date(t.completedAt) >= d0 &&
            new Date(t.completedAt) < d1,
        ).length,
      });
    }

    // streak of consecutive days with >=1 completion (today counts if any)
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d0 = new Date(dayStart.getTime() - i * 24 * 3600 * 1000);
      const d1 = new Date(d0.getTime() + 24 * 3600 * 1000);
      const has = all.some(
        (t) =>
          t.completedAt &&
          new Date(t.completedAt) >= d0 &&
          new Date(t.completedAt) < d1,
      );
      if (has) streak++;
      else if (i === 0) continue; // today not done yet doesn't break streak
      else break;
    }

    return {
      total: all.length,
      open: open.length,
      inbox: all.filter((t) => t.status === "inbox").length,
      next: all.filter((t) => t.status === "next").length,
      scheduled: all.filter((t) => t.status === "scheduled").length,
      doneToday: all.filter(
        (t) =>
          t.completedAt &&
          new Date(t.completedAt) >= dayStart &&
          new Date(t.completedAt) < dayEnd,
      ).length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      urgent: urgent.length,
      completedWeek: completedWeek.length,
      streak,
      history,
      upcoming: open
        .filter((t) => t.dueDate)
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
        )
        .slice(0, 8),
    };
  }),

});
