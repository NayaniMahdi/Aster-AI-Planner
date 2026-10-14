import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { ideas, projects, tasks } from "@db/schema";
import { eq, desc } from "drizzle-orm";

const ideaInput = z.object({
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  status: z.enum(["seed", "exploring", "parked", "shipped"]).optional(),
});

export const ideasRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(ideas).orderBy(desc(ideas.createdAt));
  }),

  create: publicQuery.input(ideaInput).mutation(async ({ input }) => {
    const [r] = await getDb().insert(ideas).values(input).$returningId();
    return { id: r.id };
  }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        patch: ideaInput.partial().extend({ aiExpansion: z.string().optional() }),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().update(ideas).set(input.patch).where(eq(ideas.id, input.id));
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(ideas).where(eq(ideas.id, input.id));
      return { ok: true };
    }),

  // ✨ 1-Click Convert Idea to Real Project
  convertToProject: publicQuery
    .input(
      z.object({
        ideaId: z.number(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.ideaId)).limit(1);
      if (!idea) throw new Error("Idea not found");

      const [p] = await db
        .insert(projects)
        .values({
          name: idea.title,
          description: idea.body || idea.aiExpansion || "Initiated from Seed Bank idea.",
          color: input.color || "cyan",
          status: "active",
        })
        .$returningId();

      // Seed initial setup tasks
      await db.insert(tasks).values([
        {
          title: `Prototype & kickoff: ${idea.title}`,
          notes: idea.body || undefined,
          priority: "high",
          status: "next",
          projectId: p.id,
          estimateMin: 60,
        },
        {
          title: `Validate market & test core concept`,
          notes: idea.aiExpansion || undefined,
          priority: "medium",
          status: "inbox",
          projectId: p.id,
          estimateMin: 45,
        },
      ]);

      // Mark idea as shipped
      await db.update(ideas).set({ status: "shipped" }).where(eq(ideas.id, input.ideaId));

      return { ok: true, projectId: p.id };
    }),

  // ✨ 1-Click Convert Idea to Actionable Task
  convertToTask: publicQuery
    .input(
      z.object({
        ideaId: z.number(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.ideaId)).limit(1);
      if (!idea) throw new Error("Idea not found");

      const [t] = await db
        .insert(tasks)
        .values({
          title: idea.title,
          notes: [idea.body, idea.aiExpansion].filter(Boolean).join("\n\n---\n") || undefined,
          priority: input.priority || "high",
          status: "next",
          energy: "medium",
        })
        .$returningId();

      await db.update(ideas).set({ status: "shipped" }).where(eq(ideas.id, input.ideaId));

      return { ok: true, taskId: t.id };
    }),
});
