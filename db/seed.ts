import { getDb } from "../api/queries/connection";
import { tasks, projects, clients, events, ideas, studyTracks } from "./schema";

async function seed() {
  const db = getDb();
  const existing = await db.select().from(tasks).limit(1);
  if (existing.length > 0) {
    console.log("Data exists — skipping seed.");
    return;
  }

  const now = new Date();
  const day = (offset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const [acme] = await db.insert(clients).values({
    name: "Sarah Chen",
    company: "Acme Studio",
    email: "sarah@acme.studio",
    status: "active",
    health: "ok",
    dealValue: 12000,
    notes: "Prefers async updates. Renewal conversation coming up.",
    lastTouchAt: day(-4, 15),
  }).$returningId();

  const [northwind] = await db.insert(clients).values({
    name: "Marcus Webb",
    company: "Northwind Labs",
    email: "marcus@northwind.io",
    status: "lead",
    health: "great",
    dealValue: 8000,
    lastTouchAt: day(-1, 11),
  }).$returningId();

  const [website] = await db.insert(projects).values({
    name: "Acme Website Redesign",
    description: "Full rebrand + marketing site. Design system, 6 pages, CMS handoff.",
    color: "cyan",
    status: "active",
    clientId: acme.id,
    deadline: day(9, 18),
  }).$returningId();

  await db.insert(projects).values({
    name: "Portfolio v3",
    description: "Personal portfolio rebuild with case studies.",
    color: "magenta",
    status: "active",
    deadline: day(21, 18),
  });

  await db.insert(tasks).values([
    { title: "Send Acme homepage mockups for review", status: "next", priority: "urgent", energy: "high", dueDate: day(0, 17), projectId: website.id, clientId: acme.id, estimateMin: 45 },
    { title: "Draft Northwind proposal + pricing", status: "next", priority: "high", energy: "high", dueDate: day(1, 12), clientId: northwind.id, estimateMin: 90 },
    { title: "Book dentist appointment", status: "inbox", priority: "low", energy: "low" },
    { title: "Review Spanish vocab deck (unit 12)", status: "scheduled", priority: "medium", energy: "low", dueDate: day(0, 21), estimateMin: 20 },
    { title: "Prepare invoice for June milestone", status: "scheduled", priority: "high", energy: "medium", dueDate: day(2, 18), clientId: acme.id },
    { title: "Research Astro vs Next for portfolio", status: "inbox", priority: "medium", energy: "medium", estimateMin: 30 },
    { title: "Follow up with Marcus on scope questions", status: "next", priority: "medium", energy: "low", dueDate: day(3, 18), clientId: northwind.id },
    { title: "Gym — push day", status: "scheduled", priority: "medium", energy: "high", dueDate: day(0, 19) },
  ]);

  await db.insert(events).values([
    { title: "Acme design review call", startAt: day(0, 15), endAt: day(0, 16), location: "Meet link", color: "cyan" },
    { title: "Northwind intro call", startAt: day(1, 10, 30), endAt: day(1, 11, 15), location: "Zoom", color: "magenta" },
    { title: "Spanish tutoring", startAt: day(2, 18), endAt: day(2, 19), color: "amber" },
    { title: "Weekly self-review", startAt: day(4, 17), endAt: day(4, 17, 45), color: "mint" },
  ]);

  await db.insert(ideas).values([
    { title: "Async client update bot", body: "Weekly auto-digest of project progress sent to clients. Saves the Friday email ritual.", status: "seed" },
    { title: "Notion template for freelancers", body: "Package my whole client workflow as a paid template.", status: "exploring" },
  ]);

  await db.insert(studyTracks).values([
    { subject: "Spanish", goal: "Conversational by spring — B1", color: "amber", targetMinPerWeek: 150 },
    { subject: "Systems Design", goal: "Confident with distributed systems basics", color: "magenta", targetMinPerWeek: 240 },
  ]);

  console.log("Seeded ✓");
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
