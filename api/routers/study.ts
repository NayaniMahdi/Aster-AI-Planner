import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { studyTracks, studySessions, focusSessions } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const studyRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const tracks = await db.select().from(studyTracks).orderBy(desc(studyTracks.createdAt));
    const sessions = await db.select().from(studySessions).orderBy(desc(studySessions.studiedAt));
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return tracks.map((t) => {
      const mine = sessions.filter((s) => s.trackId === t.id);
      const weekMin = mine
        .filter((s) => new Date(s.studiedAt) >= weekStart)
        .reduce((a, s) => a + s.minutes, 0);
      return {
        ...t,
        totalMin: mine.reduce((a, s) => a + s.minutes, 0),
        weekMin,
        sessionCount: mine.length,
        recent: mine.slice(0, 5),
      };
    });
  }),

  createTrack: publicQuery
    .input(
      z.object({
        subject: z.string().min(1).max(255),
        goal: z.string().optional(),
        color: z.string().optional(),
        targetMinPerWeek: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [r] = await getDb().insert(studyTracks).values(input).$returningId();
      return { id: r.id };
    }),

  removeTrack: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(studySessions).where(eq(studySessions.trackId, input.id));
      await db.delete(studyTracks).where(eq(studyTracks.id, input.id));
      return { ok: true };
    }),

  logSession: publicQuery
    .input(
      z.object({
        trackId: z.number(),
        minutes: z.number().min(1).max(1440),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [r] = await getDb().insert(studySessions).values(input).$returningId();
      return { id: r.id };
    }),

  removeSession: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(studySessions).where(eq(studySessions.id, input.id));
      return { ok: true };
    }),
});

export const focusRouter = createRouter({
  log: publicQuery
    .input(
      z.object({
        minutes: z.number().min(1).max(720),
        taskId: z.number().nullish(),
        label: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [r] = await getDb().insert(focusSessions).values(input).$returningId();
      return { id: r.id };
    }),

  stats: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(focusSessions).orderBy(desc(focusSessions.endedAt));
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart.getTime() - 6 * 24 * 3600 * 1000);
    const todayMin = all
      .filter((s) => new Date(s.endedAt) >= dayStart)
      .reduce((a, s) => a + s.minutes, 0);
    const weekMin = all
      .filter((s) => new Date(s.endedAt) >= weekStart)
      .reduce((a, s) => a + s.minutes, 0);
    // last 14 days focus minutes
    const history: { date: string; minutes: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d0 = new Date(dayStart.getTime() - i * 24 * 3600 * 1000);
      const d1 = new Date(d0.getTime() + 24 * 3600 * 1000);
      history.push({
        date: d0.toISOString().slice(0, 10),
        minutes: all
          .filter((s) => new Date(s.endedAt) >= d0 && new Date(s.endedAt) < d1)
          .reduce((a, s) => a + s.minutes, 0),
      });
    }
    return { todayMin, weekMin, totalSessions: all.length, history };
  }),

});
