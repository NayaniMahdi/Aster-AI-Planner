import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Tasks — the atomic unit of the flow system ─────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["inbox", "next", "scheduled", "done"])
    .notNull()
    .default("inbox"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
    .notNull()
    .default("medium"),
  energy: mysqlEnum("energy", ["low", "medium", "high"])
    .notNull()
    .default("medium"),
  dueDate: timestamp("due_date"),
  projectId: bigint("project_id", { mode: "number", unsigned: true }),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  estimateMin: int("estimate_min"),
  tags: varchar("tags", { length: 500 }).notNull().default(""),
  checklist: text("checklist"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Projects ────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).notNull().default("cyan"),
  status: mysqlEnum("status", ["active", "paused", "done"])
    .notNull()
    .default("active"),
  clientId: bigint("client_id", { mode: "number", unsigned: true }),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Clients (CRM-lite) ──────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 255 }),
  status: mysqlEnum("status", ["lead", "active", "dormant"])
    .notNull()
    .default("lead"),
  stage: varchar("stage", { length: 50 }).notNull().default("lead"),
  health: mysqlEnum("health", ["great", "ok", "at_risk"])
    .notNull()
    .default("ok"),
  dealValue: int("deal_value").notNull().default(0),
  notes: text("notes"),
  lastTouchAt: timestamp("last_touch_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Calendar events ─────────────────────────────────────────────────────────
export const events = mysqlTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  location: varchar("location", { length: 255 }),
  notes: text("notes"),
  color: varchar("color", { length: 20 }).notNull().default("cyan"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Ideas — the seed bank ───────────────────────────────────────────────────
export const ideas = mysqlTable("ideas", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  status: mysqlEnum("status", ["seed", "exploring", "parked", "shipped"])
    .notNull()
    .default("seed"),
  aiExpansion: text("ai_expansion"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Study tracks + sessions ─────────────────────────────────────────────────
export const studyTracks = mysqlTable("study_tracks", {
  id: serial("id").primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  goal: text("goal"),
  color: varchar("color", { length: 20 }).notNull().default("mint"),
  targetMinPerWeek: int("target_min_per_week").notNull().default(180),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const studySessions = mysqlTable("study_sessions", {
  id: serial("id").primaryKey(),
  trackId: bigint("track_id", { mode: "number", unsigned: true }).notNull(),
  minutes: int("minutes").notNull(),
  note: varchar("note", { length: 500 }),
  studiedAt: timestamp("studied_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Focus sessions (deep work log) ──────────────────────────────────────────
export const focusSessions = mysqlTable("focus_sessions", {
  id: serial("id").primaryKey(),
  taskId: bigint("task_id", { mode: "number", unsigned: true }),
  label: varchar("label", { length: 255 }),
  minutes: int("minutes").notNull(),
  endedAt: timestamp("ended_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Copilot chat history ────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Settings (single workspace key-value) ───────────────────────────────────
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
});
