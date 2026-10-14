import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { events, tasks, projects } from "@db/schema";
import { eq, asc, isNotNull } from "drizzle-orm";

const eventInput = z.object({
  title: z.string().min(1).max(500),
  startAt: z.date(),
  endAt: z.date(),
  location: z.string().optional(),
  notes: z.string().optional(),
  color: z.string().optional(),
});

export const eventsRouter = createRouter({
  list: publicQuery.query(async () => {
    return getDb().select().from(events).orderBy(asc(events.startAt));
  }),

  calendarFeed: publicQuery.query(async () => {
    const db = getDb();
    const [allEvents, scheduledTasks, allProjects] = await Promise.all([
      db.select().from(events).orderBy(asc(events.startAt)),
      db.select().from(tasks).where(isNotNull(tasks.dueDate)),
      db.select().from(projects),
    ]);

    const tasksEnriched = scheduledTasks.map((t) => {
      const p = allProjects.find((proj) => proj.id === t.projectId);
      return {
        ...t,
        projectName: p?.name,
        projectColor: p?.color || "cyan",
      };
    });

    return {
      events: allEvents,
      tasks: tasksEnriched,
    };
  }),

  create: publicQuery.input(eventInput).mutation(async ({ input }) => {
    const [r] = await getDb().insert(events).values(input).$returningId();
    return { id: r.id };
  }),

  update: publicQuery
    .input(z.object({ id: z.number(), patch: eventInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(events).set(input.patch).where(eq(events.id, input.id));
      return { ok: true };
    }),

  remove: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(events).where(eq(events.id, input.id));
      return { ok: true };
    }),
});
