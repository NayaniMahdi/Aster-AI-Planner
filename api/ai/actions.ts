import { getDb } from "../queries/connection";
import {
  tasks,
  projects,
  clients,
  events,
  ideas,
  studyTracks,
  studySessions,
  focusSessions,
} from "@db/schema";
import { eq } from "drizzle-orm";
import { sendOrDraftEmail } from "../routers/gmail";

export interface CopilotAction {
  type: string;
  [k: string]: unknown;
}

export function safeParseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s || s === "null" || s === "undefined") return null;
    const lower = s.toLowerCase();
    const now = new Date();
    if (lower === "today") {
      now.setHours(18, 0, 0, 0);
      return now;
    }
    if (lower === "tomorrow") {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(18, 0, 0, 0);
      return tomorrow;
    }
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + "T18:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Extracts action blocks from various possible LLM formats:
 * - ```actions [...] ```
 * - ```action [...] ```
 * - ```json [...] ``` (if array of action objects)
 * - Raw JSON array with {"type": "create_..."}
 */
export function extractWorkspaceActions(text: string): { clean: string; actions: CopilotAction[] } {
  // 1. Try ```actions ... ``` or ```action ... ```
  let m = text.match(/```(?:actions?)\s*([\s\S]*?)```/i);
  if (m) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const actions = Array.isArray(parsed) ? parsed : [parsed];
      return { clean: text.replace(m[0], "").trim(), actions };
    } catch {
      // Continue to next heuristic
    }
  }

  // 2. Try ```json ... ``` containing array of actions
  m = text.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i);
  if (m) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed) && parsed.some((p) => p && typeof p === "object" && "type" in p)) {
        return { clean: text.replace(m[0], "").trim(), actions: parsed };
      }
    } catch {
      // Continue
    }
  }

  // 3. Fallback: Search for raw JSON array of action objects
  const rawMatch = text.match(/\[\s*\{\s*"type"\s*:\s*"(?:create|update|delete|complete|log)_[^"]+"[\s\S]*?\}\s*\]/);
  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { clean: text.replace(rawMatch[0], "").trim(), actions: parsed };
      }
    } catch {
      // No match
    }
  }

  return { clean: text, actions: [] };
}

export interface ActionResult {
  type: string;
  success: boolean;
  id?: number;
  error?: string;
  detail?: string;
}

/**
 * Executes database actions directly with full CRUD authorization.
 */
export async function executeWorkspaceActions(
  db: ReturnType<typeof getDb>,
  actions: CopilotAction[]
): Promise<{ count: number; results: ActionResult[] }> {
  const results: ActionResult[] = [];
  let count = 0;

  for (const a of actions) {
    try {
      switch (a.type) {
        // ── TASKS ──
        case "create_task": {
          const title = String(a.title ?? a.name ?? "Untitled Task").trim();
          const priority = (["low", "medium", "high", "urgent"].includes(String(a.priority))
            ? a.priority
            : "medium") as "low" | "medium" | "high" | "urgent";
          const status = (["inbox", "next", "scheduled", "done"].includes(String(a.status))
            ? a.status
            : "inbox") as "inbox" | "next" | "scheduled" | "done";
          const energy = (["low", "medium", "high"].includes(String(a.energy))
            ? a.energy
            : "medium") as "low" | "medium" | "high";
          const dueDate = safeParseDate(a.dueDate);
          const projectId = typeof a.projectId === "number" ? a.projectId : null;
          const clientId = typeof a.clientId === "number" ? a.clientId : null;
          const notes = a.notes ? String(a.notes) : null;

          const [inserted] = await db
            .insert(tasks)
            .values({
              title,
              priority,
              status,
              energy,
              dueDate,
              projectId,
              clientId,
              notes,
              tags: a.tags ? String(a.tags) : "",
              checklist: a.checklist ? String(a.checklist) : null,
              completedAt: status === "done" ? new Date() : null,
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Created task "${title}"` });
          break;
        }

        case "update_task": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid task id");

          const rawPatch = (a.patch as Record<string, unknown>) ?? {};
          const patch: Record<string, unknown> = { updatedAt: new Date() };

          if (rawPatch.title) patch.title = String(rawPatch.title);
          if (rawPatch.priority) patch.priority = rawPatch.priority;
          if (rawPatch.status) {
            patch.status = rawPatch.status;
            if (rawPatch.status === "done") patch.completedAt = new Date();
            else patch.completedAt = null;
          }
          if (rawPatch.energy) patch.energy = rawPatch.energy;
          if ("dueDate" in rawPatch) patch.dueDate = safeParseDate(rawPatch.dueDate);
          if ("projectId" in rawPatch) patch.projectId = rawPatch.projectId;
          if ("clientId" in rawPatch) patch.clientId = rawPatch.clientId;
          if ("notes" in rawPatch) patch.notes = rawPatch.notes;

          await db.update(tasks).set(patch).where(eq(tasks.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Updated task #${id}` });
          break;
        }

        case "complete_task": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid task id");
          await db
            .update(tasks)
            .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
            .where(eq(tasks.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Completed task #${id}` });
          break;
        }

        case "delete_task": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid task id");
          await db.delete(tasks).where(eq(tasks.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Deleted task #${id}` });
          break;
        }

        // ── CLIENTS ──
        case "create_client": {
          const name = String(a.name ?? "New Client").trim();
          const status = (["lead", "active", "dormant"].includes(String(a.status))
            ? a.status
            : "lead") as "lead" | "active" | "dormant";
          const health = (["great", "ok", "at_risk"].includes(String(a.health))
            ? a.health
            : "ok") as "great" | "ok" | "at_risk";

          const [inserted] = await db
            .insert(clients)
            .values({
              name,
              company: a.company ? String(a.company) : null,
              email: a.email ? String(a.email) : null,
              status,
              health,
              dealValue: typeof a.dealValue === "number" ? a.dealValue : 0,
              notes: a.notes ? String(a.notes) : null,
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Created client "${name}"` });
          break;
        }

        case "update_client": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid client id");
          const rawPatch = (a.patch as Record<string, unknown>) ?? {};
          await db.update(clients).set(rawPatch).where(eq(clients.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Updated client #${id}` });
          break;
        }

        case "delete_client": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid client id");
          await db.delete(clients).where(eq(clients.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Deleted client #${id}` });
          break;
        }

        // ── PROJECTS ──
        case "create_project": {
          const name = String(a.name ?? a.title ?? "New Project").trim();
          const status = (["active", "paused", "done"].includes(String(a.status))
            ? a.status
            : "active") as "active" | "paused" | "done";

          const [inserted] = await db
            .insert(projects)
            .values({
              name,
              description: a.description ? String(a.description) : null,
              color: a.color ? String(a.color) : "cyan",
              status,
              clientId: typeof a.clientId === "number" ? a.clientId : null,
              deadline: safeParseDate(a.deadline),
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Created project "${name}"` });
          break;
        }

        case "update_project": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid project id");
          const rawPatch = (a.patch as Record<string, unknown>) ?? {};
          const patch: Record<string, unknown> = { ...rawPatch };
          if ("deadline" in rawPatch) patch.deadline = safeParseDate(rawPatch.deadline);
          await db.update(projects).set(patch).where(eq(projects.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Updated project #${id}` });
          break;
        }

        case "delete_project": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid project id");
          await db.delete(projects).where(eq(projects.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Deleted project #${id}` });
          break;
        }

        // ── CALENDAR EVENTS ──
        case "create_event": {
          const title = String(a.title ?? "New Event").trim();
          const startAt = safeParseDate(a.startAt) ?? new Date();
          const endAt = safeParseDate(a.endAt) ?? new Date(startAt.getTime() + 3600000);

          const [inserted] = await db
            .insert(events)
            .values({
              title,
              startAt,
              endAt,
              location: a.location ? String(a.location) : null,
              notes: a.notes ? String(a.notes) : null,
              color: a.color ? String(a.color) : "cyan",
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Scheduled event "${title}"` });
          break;
        }

        case "update_event": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid event id");
          const rawPatch = (a.patch as Record<string, unknown>) ?? {};
          const patch: Record<string, unknown> = { ...rawPatch };
          if ("startAt" in rawPatch) patch.startAt = safeParseDate(rawPatch.startAt);
          if ("endAt" in rawPatch) patch.endAt = safeParseDate(rawPatch.endAt);
          await db.update(events).set(patch).where(eq(events.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Updated event #${id}` });
          break;
        }

        case "delete_event": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid event id");
          await db.delete(events).where(eq(events.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Deleted event #${id}` });
          break;
        }

        // ── IDEAS ──
        case "create_idea": {
          const title = String(a.title ?? "New Idea").trim();
          const status = (["seed", "exploring", "parked", "shipped"].includes(String(a.status))
            ? a.status
            : "seed") as "seed" | "exploring" | "parked" | "shipped";

          const [inserted] = await db
            .insert(ideas)
            .values({
              title,
              body: a.body ? String(a.body) : null,
              status,
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Created idea "${title}"` });
          break;
        }

        case "update_idea": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid idea id");
          const rawPatch = (a.patch as Record<string, unknown>) ?? {};
          await db.update(ideas).set(rawPatch).where(eq(ideas.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Updated idea #${id}` });
          break;
        }

        case "delete_idea": {
          const id = Number(a.id);
          if (isNaN(id)) throw new Error("Missing or invalid idea id");
          await db.delete(ideas).where(eq(ideas.id, id));
          count++;
          results.push({ type: a.type, success: true, id, detail: `Deleted idea #${id}` });
          break;
        }

        // ── STUDY & FOCUS ──
        case "create_study_track": {
          const subject = String(a.subject ?? a.title ?? "Study Track").trim();
          const targetMinPerWeek = typeof a.targetMinPerWeek === "number" ? a.targetMinPerWeek : 180;
          const [inserted] = await db
            .insert(studyTracks)
            .values({
              subject,
              goal: a.goal ? String(a.goal) : null,
              targetMinPerWeek,
            })
            .$returningId();

          count++;
          results.push({ type: a.type, success: true, id: inserted.id, detail: `Created study track "${subject}"` });
          break;
        }

        case "log_study_session": {
          const trackId = Number(a.trackId);
          if (isNaN(trackId)) throw new Error("Missing or invalid trackId");
          const minutes = Number(a.minutes ?? 30);
          await db.insert(studySessions).values({
            trackId,
            minutes,
            note: a.note ? String(a.note) : null,
          });
          count++;
          results.push({ type: a.type, success: true, detail: `Logged ${minutes}m study session` });
          break;
        }

        case "log_focus_session": {
          const minutes = Number(a.minutes ?? 25);
          const taskId = typeof a.taskId === "number" ? a.taskId : null;
          await db.insert(focusSessions).values({
            taskId,
            label: a.label ? String(a.label) : "Deep Focus",
            minutes,
          });
          count++;
          results.push({ type: a.type, success: true, detail: `Logged ${minutes}m focus session` });
          break;
        }

        // ── GMAIL COMMUNICATIONS (FULL RIGHTS) ──
        case "send_email": {
          const to = String(a.to ?? "").trim();
          if (!to) throw new Error("Missing recipient email ('to')");
          const subject = String(a.subject ?? "Message from Aster Assistant").trim();
          const body = String(a.body ?? "").trim();
          const threadId = a.threadId ? String(a.threadId) : undefined;

          const res = await sendOrDraftEmail({
            to,
            subject,
            body,
            threadId,
            isDraftOnly: false,
          });

          count++;
          results.push({
            type: a.type,
            success: true,
            detail: `Sent email to ${to} (Subject: "${subject}")`,
          });
          break;
        }

        case "create_email_draft": {
          const to = String(a.to ?? "").trim();
          if (!to) throw new Error("Missing recipient email ('to')");
          const subject = String(a.subject ?? "Draft from Aster Assistant").trim();
          const body = String(a.body ?? "").trim();
          const threadId = a.threadId ? String(a.threadId) : undefined;

          const res = await sendOrDraftEmail({
            to,
            subject,
            body,
            threadId,
            isDraftOnly: true,
          });

          count++;
          results.push({
            type: a.type,
            success: true,
            detail: `Created Gmail draft for ${to} (Subject: "${subject}")`,
          });
          break;
        }

        default: {
          console.warn("[AI Actions] Unrecognized action type:", a.type);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AI Actions Execution Error]:", a, msg);
      results.push({ type: a.type, success: false, error: msg });
    }
  }

  return { count, results };
}
