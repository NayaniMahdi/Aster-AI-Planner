import { createRouter, publicQuery } from "./middleware";
import { tasksRouter } from "./routers/tasks";
import { projectsRouter } from "./routers/projects";
import { clientsRouter } from "./routers/clients";
import { eventsRouter } from "./routers/events";
import { ideasRouter } from "./routers/ideas";
import { studyRouter, focusRouter } from "./routers/study";
import { aiRouter, settingsRouter } from "./routers/ai";
import { gmailRouter } from "./routers/gmail";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  tasks: tasksRouter,
  projects: projectsRouter,
  clients: clientsRouter,
  events: eventsRouter,
  ideas: ideasRouter,
  study: studyRouter,
  focus: focusRouter,
  ai: aiRouter,
  settings: settingsRouter,
  gmail: gmailRouter,
});

export type AppRouter = typeof appRouter;
