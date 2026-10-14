// ─── Autonomous Northstar Intelligence Engine ──────────────────────────────
// High-capability local assistant engine that operates fully offline or as
// a resilient fallback when external LLM credentials are not configured.

export interface WorkspaceData {
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    energy: string;
    dueDate: Date | null;
    projectId: number | null;
    clientId: number | null;
  }>;
  projects: Array<{
    id: number;
    name: string;
    status: string;
    deadline: Date | null;
    color: string;
  }>;
  clients: Array<{
    id: number;
    name: string;
    company: string | null;
    status: string;
    health: string;
    dealValue: number;
  }>;
  events: Array<{
    id: number;
    title: string;
    startAt: Date;
    endAt: Date;
    location: string | null;
  }>;
  ideas: Array<{
    id: number;
    title: string;
    body: string | null;
    status: string;
  }>;
  studyTracks: Array<{
    id: number;
    subject: string;
    targetMinPerWeek: number;
  }>;
  recentEmails?: Array<{
    id: string;
    threadId: string;
    sender: string;
    senderEmail: string;
    subject: string;
    snippet: string;
    date: string;
  }>;
}

export interface ChatMessageParam {
  role: "user" | "assistant";
  content: string;
}

function getRelativeDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function getDayOfWeekDate(dayName: string): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetIndex = days.indexOf(dayName.toLowerCase());
  if (targetIndex === -1) return getRelativeDate(1);
  const now = new Date();
  const currentDay = now.getDay();
  let diff = targetIndex - currentDay;
  if (diff <= 0) diff += 7;
  return getRelativeDate(diff);
}

export function autonomousChat(
  message: string,
  _history: ChatMessageParam[],
  data: WorkspaceData
): string {
  const lower = message.toLowerCase().trim();
  const openTasks = data.tasks.filter((t) => t.status !== "done");
  const urgentTasks = openTasks.filter((t) => t.priority === "urgent" || t.priority === "high");
  const activeProjects = data.projects.filter((p) => p.status === "active");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. INTENT: Delete Actions
  // ──────────────────────────────────────────────────────────────────────────
  const delClientMatch = lower.match(/(?:delete|remove)\s+client\s+(?:#?(\d+)|["']?([^"']+)["']?)/i);
  if (delClientMatch) {
    const raw = delClientMatch[1] || delClientMatch[2];
    const target = data.clients.find(
      (c) => c.id === parseInt(raw) || c.name.toLowerCase().includes(raw.toLowerCase())
    );
    if (target) {
      const action = { type: "delete_client", id: target.id };
      return `Deleted client **#${target.id} ("${target.name}")** from your CRM.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  const delProjectMatch = lower.match(/(?:delete|remove)\s+project\s+(?:#?(\d+)|["']?([^"']+)["']?)/i);
  if (delProjectMatch) {
    const raw = delProjectMatch[1] || delProjectMatch[2];
    const target = data.projects.find(
      (p) => p.id === parseInt(raw) || p.name.toLowerCase().includes(raw.toLowerCase())
    );
    if (target) {
      const action = { type: "delete_project", id: target.id };
      return `Deleted project **#${target.id} ("${target.name}")**.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  const delTaskMatch = lower.match(/(?:delete|remove)\s+task\s+#?(\d+)/i);
  if (delTaskMatch) {
    const id = parseInt(delTaskMatch[1]);
    const action = { type: "delete_task", id };
    return `Deleted task **#${id}** from your board.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  const delEventMatch = lower.match(/(?:delete|remove|cancel)\s+event\s+#?(\d+)/i);
  if (delEventMatch) {
    const id = parseInt(delEventMatch[1]);
    const action = { type: "delete_event", id };
    return `Removed calendar event **#${id}**.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  const delIdeaMatch = lower.match(/(?:delete|remove)\s+idea\s+#?(\d+)/i);
  if (delIdeaMatch) {
    const id = parseInt(delIdeaMatch[1]);
    const action = { type: "delete_idea", id };
    return `Removed idea **#${id}** from your seed bank.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. INTENT: Client Management (CRM)
  // ──────────────────────────────────────────────────────────────────────────
  const clientCreateMatch =
    lower.match(/^(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?(?:client|lead|customer|crm\s+contact):?\s*(.+)/i) ||
    lower.match(/^(?:client|lead):\s*(.+)/i);

  if (clientCreateMatch) {
    let raw = clientCreateMatch[1].trim();

    // Deal value extraction: $10,000, 10k, deal: 10000, 45000 deal value
    let dealValue = 0;
    const dealMatch =
      raw.match(/(?:deal:?\s*(?:value:?)?\s*\$?|\$)(\d+[\d,]*)(?:k)?/i) ||
      raw.match(/(\d+[\d,]*)(?:k)?\s*(?:deal\s*value|deal|usd)/i);
    if (dealMatch) {
      let num = parseInt(dealMatch[1].replace(/,/g, ""));
      if (dealMatch[0].toLowerCase().includes("k")) num *= 1000;
      dealValue = num;
      raw = raw.replace(dealMatch[0], "").trim();
    }

    // Email extraction
    let email: string | undefined;
    const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      email = emailMatch[1];
      raw = raw.replace(email, "").trim();
    }

    // Company extraction: at Acme, @ Acme, company: Acme
    let company: string | undefined;
    const compMatch = raw.match(/(?:at|@|company:?\s*)([A-Za-z0-9\s&]+?)(?:,|$|\s+email|\s+status|\s+health)/i);
    if (compMatch) {
      company = compMatch[1].trim();
      raw = raw.replace(compMatch[0], "").trim();
    }

    // Status: active, lead, dormant
    let status: "lead" | "active" | "dormant" = "lead";
    if (/\bactive\b/i.test(raw) || /\bclient\b/i.test(lower)) status = "active";
    if (/\blead\b/i.test(raw) || /\bprospect\b/i.test(raw)) status = "lead";
    if (/\bdormant\b/i.test(raw)) status = "dormant";

    // Health: great, ok, at_risk
    let health: "great" | "ok" | "at_risk" = "great";
    if (/\b(at\s*risk|risk|urgent|fragile)\b/i.test(raw)) health = "at_risk";
    else if (/\b(ok|fair|normal)\b/i.test(raw)) health = "ok";

    // Clean up name
    let name = raw
      .replace(/\b(with|as|for|at|stage|level|pipeline|active|lead|dormant|deal|value|status|health)\b/gi, "")
      .replace(/[!?,;.]*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!name && company) {
      name = company;
      company = undefined;
    }
    if (!name) name = "New Client";
    name = name.charAt(0).toUpperCase() + name.slice(1);

    const action = {
      type: "create_client",
      name,
      company: company || null,
      email: email || null,
      status,
      health,
      dealValue,
      notes: "Created via Assistant conversation.",
    };

    let reply = `Added new client **"${name}"** to your CRM!`;
    if (company) reply += ` at **${company}**`;
    if (dealValue) reply += ` with **$${dealValue.toLocaleString()}** deal pipeline`;
    reply += ` (Status: **${status}**, Health: **${health}**).\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    return reply;
  }

  // Client Update
  const clientUpdateMatch = lower.match(/(?:update|change|mark)\s+client\s+(?:#?(\d+)|["']?([^"']+)["']?)\s+(?:status|health|deal|to|as)\s+(.+)/i);
  if (clientUpdateMatch) {
    const raw = clientUpdateMatch[1] || clientUpdateMatch[2];
    const val = clientUpdateMatch[3].trim().toLowerCase();
    const target = data.clients.find(
      (c) => c.id === parseInt(raw) || c.name.toLowerCase().includes(raw.toLowerCase())
    );
    if (target) {
      const patch: Record<string, unknown> = {};
      if (val.includes("active")) patch.status = "active";
      else if (val.includes("lead")) patch.status = "lead";
      else if (val.includes("dormant")) patch.status = "dormant";

      if (val.includes("great")) patch.health = "great";
      else if (val.includes("ok")) patch.health = "ok";
      else if (val.includes("risk") || val.includes("at_risk")) patch.health = "at_risk";

      const action = { type: "update_client", id: target.id, patch };
      return `Updated client **"${target.name}"** in your CRM!\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INTENT: Project Management
  // ──────────────────────────────────────────────────────────────────────────
  const projectCreateMatch =
    lower.match(/^(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?project:?\s*(.+)/i) ||
    lower.match(/^project:\s*(.+)/i);

  if (projectCreateMatch) {
    let raw = projectCreateMatch[1].trim();

    // Match client
    let matchedClientId: number | null = null;
    let matchedClientName: string | null = null;
    for (const c of data.clients) {
      if (raw.toLowerCase().includes(c.name.toLowerCase().split(" ")[0])) {
        matchedClientId = c.id;
        matchedClientName = c.name;
        break;
      }
    }

    // Match deadline
    let deadline: string | null = null;
    if (/\b(?:in\s+2\s+weeks)\b/i.test(raw)) deadline = getRelativeDate(14);
    else if (/\b(?:next\s+week)\b/i.test(raw)) deadline = getRelativeDate(7);
    else if (/\btomorrow\b/i.test(raw)) deadline = getRelativeDate(1);

    // Color
    let color = "cyan";
    if (/\bmagenta\b/i.test(raw)) color = "magenta";
    else if (/\bmint\b/i.test(raw)) color = "mint";
    else if (/\bamber\b/i.test(raw)) color = "amber";

    let name = raw
      .replace(/\b(for\s+client\s+\w+|for\s+\w+|deadline\s+[\w\s]+|color\s+\w+)\b/gi, "")
      .replace(/[!?,;.]*$/g, "")
      .trim();
    if (!name) name = "New Project";
    name = name.charAt(0).toUpperCase() + name.slice(1);

    const action = {
      type: "create_project",
      name,
      description: "Initialized by Assistant.",
      color,
      status: "active",
      clientId: matchedClientId,
      deadline,
    };

    let reply = `Created project **"${name}"** (Color: **${color}**)`;
    if (matchedClientName) reply += ` linked to client **${matchedClientName}**`;
    if (deadline) reply += ` with deadline set to **${deadline}**`;
    reply += `.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    return reply;
  }

  // Project update
  const projectUpdateMatch = lower.match(/(?:update|finish|complete|mark)\s+project\s+(?:#?(\d+)|["']?([^"']+)["']?)\s+(?:as\s+)?(done|active|paused)/i);
  if (projectUpdateMatch) {
    const raw = projectUpdateMatch[1] || projectUpdateMatch[2];
    const status = projectUpdateMatch[3].toLowerCase();
    const target = data.projects.find(
      (p) => p.id === parseInt(raw) || p.name.toLowerCase().includes(raw.toLowerCase())
    );
    if (target) {
      const action = { type: "update_project", id: target.id, patch: { status } };
      return `Marked project **"${target.name}"** as **${status}**!\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. INTENT: Study Tracks & Sessions
  // ──────────────────────────────────────────────────────────────────────────
  const studyTrackMatch = lower.match(/^(?:add|create|new)\s+(?:a\s+)?study\s+track:?\s*(.+)/i);
  if (studyTrackMatch) {
    const raw = studyTrackMatch[1].trim();
    const action = {
      type: "create_study_track",
      subject: raw.charAt(0).toUpperCase() + raw.slice(1),
      goal: "Tracked study goal",
      targetMinPerWeek: 180,
    };
    return `Created study track **"${action.subject}"** with a target of 3 hours per week!\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  const studySessionMatch =
    lower.match(/(?:log|record)\s+(?:a\s+)?study\s+session:?\s*(.+)/i) ||
    lower.match(/(?:studied|spent)\s+(\d+)\s*(?:mins?|minutes?)\s+(?:on|studying)\s+(.+)/i);

  if (studySessionMatch) {
    let minutes = 30;
    let trackName = "";
    if (studySessionMatch[2]) {
      minutes = parseInt(studySessionMatch[1]) || 30;
      trackName = studySessionMatch[2].trim();
    } else {
      const minM = studySessionMatch[1].match(/(\d+)\s*(?:mins?|minutes?)/i);
      if (minM) minutes = parseInt(minM[1]);
      trackName = studySessionMatch[1].replace(/(\d+)\s*(?:mins?|minutes?)/i, "").trim();
    }

    const matched = data.studyTracks.find((t) => t.subject.toLowerCase().includes(trackName.toLowerCase())) || data.studyTracks[0];
    if (matched) {
      const action = {
        type: "log_study_session",
        trackId: matched.id,
        minutes,
        note: `Logged via Assistant.`,
      };
      return `Logged **${minutes} minutes** of study for **"${matched.subject}"**! 📚\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. INTENT: Task Creation & Completion
  // ──────────────────────────────────────────────────────────────────────────
  const taskCreateMatch =
    lower.match(/^(?:add|create|make|new|todo)\s+(?:a\s+)?(?:new\s+)?task:?\s*(.+)/i) ||
    lower.match(/^(?:remind\s+me\s+to|i\s+need\s+to|i\s+must|don'?t\s+forget\s+to)\s+(.+)/i) ||
    lower.match(/^(?:add|put)\s+(.+?)\s+(?:to|in|on)\s+(?:my\s+)?(?:tasks?|inbox|todo|list)/i);

  if (taskCreateMatch) {
    let rawTitle = taskCreateMatch[1].trim();

    let priority: "low" | "medium" | "high" | "urgent" = "medium";
    if (/\b(urgent|asap|critical|p0)\b/i.test(rawTitle) || /!urgent/i.test(rawTitle)) {
      priority = "urgent";
      rawTitle = rawTitle.replace(/!urgent\b/gi, "").replace(/\b(urgent|asap|critical|p0)\b/gi, "").trim();
    } else if (/\b(high|important|p1)\b/i.test(rawTitle) || /!high/i.test(rawTitle)) {
      priority = "high";
      rawTitle = rawTitle.replace(/!high\b/gi, "").replace(/\b(high|important|p1)\b/gi, "").trim();
    } else if (/\b(low|p3)\b/i.test(rawTitle) || /!low/i.test(rawTitle)) {
      priority = "low";
      rawTitle = rawTitle.replace(/!low\b/gi, "").replace(/\b(low|p3)\b/gi, "").trim();
    }

    let dueDate: string | null = null;
    let dueLabel = "";
    if (/\b(?:today|tonight)\b/i.test(rawTitle)) {
      dueDate = getRelativeDate(0);
      dueLabel = "today";
      rawTitle = rawTitle.replace(/\b(?:by|for|on)?\s*(?:today|tonight)\b/gi, "").trim();
    } else if (/\btomorrow\b/i.test(rawTitle)) {
      dueDate = getRelativeDate(1);
      dueLabel = "tomorrow";
      rawTitle = rawTitle.replace(/\b(?:by|for|on)?\s*tomorrow\b/gi, "").trim();
    } else if (/\b(?:next\s+week)\b/i.test(rawTitle)) {
      dueDate = getRelativeDate(7);
      dueLabel = "next week";
      rawTitle = rawTitle.replace(/\b(?:by|for|on)?\s*next\s+week\b/gi, "").trim();
    } else {
      const dayMatch = rawTitle.match(/\b(?:on|by|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (dayMatch) {
        dueDate = getDayOfWeekDate(dayMatch[1]);
        dueLabel = dayMatch[1];
        rawTitle = rawTitle.replace(dayMatch[0], "").trim();
      }
    }

    let matchedProjectId: number | null = null;
    let matchedProjectName: string | null = null;
    for (const p of data.projects) {
      const pWords = p.name.toLowerCase().split(/\s+/);
      if (pWords.some((w) => w.length > 3 && rawTitle.toLowerCase().includes(w))) {
        matchedProjectId = p.id;
        matchedProjectName = p.name;
        break;
      }
    }

    let matchedClientId: number | null = null;
    let matchedClientName: string | null = null;
    for (const c of data.clients) {
      if (
        rawTitle.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]) ||
        (c.company && rawTitle.toLowerCase().includes(c.company.toLowerCase()))
      ) {
        matchedClientId = c.id;
        matchedClientName = c.name;
        break;
      }
    }

    rawTitle = rawTitle
      .replace(/^(?:to\s+|for\s+)/i, "")
      .replace(/[!?,;.]*$/g, "")
      .trim();
    const finalTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    const action = {
      type: "create_task",
      title: finalTitle || "New Task",
      priority,
      status: dueDate ? "scheduled" : "next",
      dueDate,
      projectId: matchedProjectId,
      clientId: matchedClientId,
    };

    let reply = `I've queued that up for you! **"${finalTitle}"** is set as a **${priority}** priority task`;
    if (dueLabel) reply += `, scheduled for **${dueLabel}**`;
    if (matchedProjectName) reply += `, attached to **${matchedProjectName}**`;
    if (matchedClientName) reply += `, associated with **${matchedClientName}**`;
    reply += `.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    return reply;
  }

  // Complete task
  const completeMatch =
    lower.match(/(?:complete|finish|done|mark\s+(?:as\s+)?done|check\s+off)\s+(?:task\s+)?#?(\d+)/i) ||
    lower.match(/(?:complete|finish|mark\s+(?:as\s+)?done)\s+(?:the\s+task\s+)?["']?([^"']+)["']?/i);

  if (completeMatch) {
    const target = completeMatch[1].trim();
    let matchedTask = null;
    if (/^\d+$/.test(target)) {
      matchedTask = openTasks.find((t) => t.id === parseInt(target));
    }
    if (!matchedTask) {
      matchedTask = openTasks.find((t) => t.title.toLowerCase().includes(target.toLowerCase()));
    }

    if (matchedTask) {
      const action = { type: "complete_task", id: matchedTask.id };
      return `Nicely done! Marking task **#${matchedTask.id} ("${matchedTask.title}")** as complete. Momentum is building! 🚀\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. INTENT: Events & Ideas
  // ──────────────────────────────────────────────────────────────────────────
  const eventMatch =
    lower.match(/(?:schedule|book|add|create|set\s+up)\s+(?:a\s+|an\s+)?(?:meeting|event|call|sync|appointment):?\s*(.+)/i) ||
    lower.match(/(?:meeting|call|sync)\s+with\s+(.+)/i);

  if (eventMatch) {
    const raw = eventMatch[1].trim();
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const action = {
      type: "create_event",
      title: raw.charAt(0).toUpperCase() + raw.slice(1),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      location: "Zoom / Calendar",
    };

    return `Scheduled: **"${action.title}"** on your calendar for tomorrow at 2:00 PM.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  const ideaMatch =
    lower.match(/^(?:add|save|new|capture|log|here'?s\s+an?)\s+idea:?\s*(.+)/i) ||
    lower.match(/^idea:\s*(.+)/i);

  if (ideaMatch) {
    const raw = ideaMatch[1].trim();
    const action = {
      type: "create_idea",
      title: raw.charAt(0).toUpperCase() + raw.slice(1),
      body: "Captured via Assistant conversation.",
    };
    return `Love it! Saved **"${action.title}"** to your Idea Seed Bank. You can expand it anytime in the Ideas page.\n\n\`\`\`actions\n${JSON.stringify([action])}\n\`\`\``;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. INTENT: Planning / Daily Focus
  // ──────────────────────────────────────────────────────────────────────────
  if (
    lower.includes("focus") ||
    lower.includes("plan my day") ||
    lower.includes("plan my schedule") ||
    lower.includes("plan my morning") ||
    lower.includes("schedule") ||
    lower.includes("what should i do") ||
    lower.includes("priorit") ||
    lower.includes("today's plan") ||
    lower.includes("where to start")
  ) {
    const topTask = urgentTasks[0] || openTasks[0];
    const secondaryTasks = openTasks.filter((t) => t.id !== topTask?.id).slice(0, 3);
    const todayEvents = data.events.filter((e) => {
      const start = new Date(e.startAt);
      return start.toDateString() === new Date().toDateString();
    });

    let res = `Here is your high-leverage focus plan for today:\n\n`;
    if (topTask) {
      const proj = data.projects.find((p) => p.id === topTask.projectId);
      res += `### 🎯 #1 Non-Negotiable\n`;
      res += `**[#${topTask.id}] ${topTask.title}** (${topTask.priority.toUpperCase()} priority${proj ? ` · ${proj.name}` : ""})\n`;
      res += `> *Protect 90 minutes of uninterrupted focus early on this before checking email or messages.*\n\n`;
    }

    if (secondaryTasks.length) {
      res += `### ⚡ Secondary Momentum Blocks\n`;
      for (const t of secondaryTasks) {
        res += `- **[#${t.id}] ${t.title}** (${t.priority} · ${t.energy} energy)\n`;
      }
      res += `\n`;
    }

    if (todayEvents.length) {
      res += `### 📅 Committed Calendar Slots\n`;
      for (const e of todayEvents) {
        const time = new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        res += `- **${time}** — ${e.title}\n`;
      }
      res += `\n`;
    }

    res += `💡 **Northstar Rule**: Win the day on the #1 task first. Everything else is a bonus. What would you like to tackle first?`;
    return res;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. INTENT: Review week / what's slipping
  // ──────────────────────────────────────────────────────────────────────────
  if (
    lower.includes("review") ||
    lower.includes("slipping") ||
    lower.includes("status") ||
    lower.includes("bottleneck") ||
    lower.includes("how am i doing")
  ) {
    const overdue = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
    const atRiskClients = data.clients.filter((c) => c.health === "at_risk");

    let res = `### 🧭 Workload Health Audit\n\n`;
    res += `- **Open Tasks**: ${openTasks.length} active (${urgentTasks.length} urgent/high priority)\n`;
    res += `- **Active Projects**: ${activeProjects.length} in flight\n`;
    res += `- **Clients in CRM**: ${data.clients.length} total (${data.clients.filter((c) => c.status === "active").length} active)\n`;

    if (overdue.length > 0) {
      res += `- ⚠️ **Attention**: ${overdue.length} task${overdue.length > 1 ? "s" : ""} past due date (e.g., *"${overdue[0].title}"*)\n`;
    } else {
      res += `- ✅ **Deadlines**: No overdue tasks on the radar.\n`;
    }

    if (atRiskClients.length > 0) {
      res += `- 🚩 **Client Health**: ${atRiskClients.map((c) => c.name).join(", ")} flagged as needs care.\n`;
    }

    res += `\n**Recommended move**: Close out the most urgent task today to clear mental bandwidth. Need me to create or reschedule anything?`;
    return res;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. INTENT: Brainstorming
  // ──────────────────────────────────────────────────────────────────────────
  if (lower.includes("brainstorm") || lower.includes("idea") || lower.includes("creative")) {
    const sampleIdea = data.ideas[0]?.title || "Client automation portal";
    const sampleProject = activeProjects[0]?.name || "Core Platform";

    return `Here are 3 sharp angles we can explore connecting **${sampleProject}** and your creative pipeline:\n\n` +
      `1. **The Async-First Model**: Package your service into fixed-scope asynchronous sprint deliverables with automated onboarding.\n` +
      `2. **Micro-Tool Lead Generator**: Build a lightweight calculator or diagnostic tool based on *"${sampleIdea}"* to drive inbound leads.\n` +
      `3. **Template & System Licensing**: Turn internal workflows into reusable client-ready blueprints.\n\n` +
      `Which of these resonates most? Tell me and I will create the project or tasks right away!`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 10. General conversational / Workload query
  // ──────────────────────────────────────────────────────────────────────────
  const topTask = urgentTasks[0] || openTasks[0];
  return `I have full control over your dashboard! You currently have **${openTasks.length} open tasks**, **${activeProjects.length} active projects**, and **${data.clients.length} clients**.\n\n` +
    (topTask ? `Your highest priority focus item is **"${topTask.title}"** (${topTask.priority}).\n\n` : "") +
    `Ask me to **add clients**, **create projects**, **schedule events**, **log study/focus**, or **plan your day** — I'll write them directly into the database for you.`;
}

export function autonomousBrief(data: WorkspaceData): string {
  const open = data.tasks.filter((t) => t.status !== "done");
  const urgent = open.filter((t) => t.priority === "urgent" || t.priority === "high");
  const topTask = urgent[0] || open[0];
  const now = new Date();

  const todayEvents = data.events.filter((e) => {
    const s = new Date(e.startAt);
    return s.toDateString() === now.toDateString();
  });

  const activeProj = data.projects.filter((p) => p.status === "active");
  const client = data.clients[0];
  const idea = data.ideas[0];

  let out = `**🎯 Today's #1 thing** — `;
  if (topTask) {
    const p = data.projects.find((pr) => pr.id === topTask.projectId);
    out += `Ship **"${topTask.title}"**${p ? ` for ${p.name}` : ""} to unlock your biggest bottleneck today.\n\n`;
  } else {
    out += `Plan out your quarterly milestones and review pipeline leads.\n\n`;
  }

  out += `**📅 On the schedule** — \n`;
  if (todayEvents.length) {
    for (const e of todayEvents.slice(0, 3)) {
      const time = new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      out += `- ${time}: ${e.title}${e.location ? ` (${e.location})` : ""}\n`;
    }
  } else {
    out += `- Clear runway today: No scheduled meetings booked. Ideal for deep work sprints.\n`;
  }
  if (open.length) {
    out += `- ${open.length} tasks in active queue (${urgent.length} urgent/high priority).\n\n`;
  } else {
    out += `\n`;
  }

  out += `**🧭 Suggestion** — Dedicate the morning block (9–11 AM) entirely to deep work before touching communication channels.\n\n`;

  out += `**💡 Spark** — `;
  if (idea && activeProj.length) {
    out += `Cross-pollinate *"${idea.title}"* into *"${activeProj[0].name}"* to surprise client expectations.`;
  } else if (client) {
    out += `Send a brief progress pulse to ${client.name} at ${client.company || "partner"} to reinforce confidence.`;
  } else {
    out += `Block 30 minutes this afternoon to capture new experiment sparks into your Idea Bank.`;
  }

  return out;
}

export function autonomousParseCapture(
  text: string,
  projects: Array<{ id: number; name: string }>,
  clients: Array<{ id: number; name: string }>
) {
  const lower = text.toLowerCase();
  const isEvent = /\b(meeting|call|sync|appointment|dinner|lunch|flight|zoom)\b/i.test(text);
  const isIdea = /\b(idea|what if|brainstorm|concept|spark|ponder)\b/i.test(text);

  let kind: "task" | "event" | "idea" = "task";
  if (isEvent) kind = "event";
  else if (isIdea) kind = "idea";

  let priority: "low" | "medium" | "high" | "urgent" = "medium";
  if (/\b(urgent|asap|critical|p0)\b/i.test(text) || /!urgent/i.test(text)) priority = "urgent";
  else if (/\b(high|important|p1)\b/i.test(text) || /!high/i.test(text)) priority = "high";
  else if (/\b(low|p3)\b/i.test(text) || /!low/i.test(text)) priority = "low";

  let dueDate: string | null = null;
  let startAt: string | null = null;
  let endAt: string | null = null;

  if (/\btoday\b/i.test(lower)) {
    dueDate = getRelativeDate(0);
  } else if (/\btomorrow\b/i.test(lower)) {
    dueDate = getRelativeDate(1);
  } else if (/\bnext\s+week\b/i.test(lower)) {
    dueDate = getRelativeDate(7);
  }

  if (isEvent) {
    const s = new Date();
    s.setDate(s.getDate() + 1);
    s.setHours(14, 0, 0, 0);
    startAt = s.toISOString();
    endAt = new Date(s.getTime() + 3600000).toISOString();
  }

  // Match project
  let projectId: number | null = null;
  for (const p of projects) {
    if (lower.includes(p.name.toLowerCase())) {
      projectId = p.id;
      break;
    }
  }

  // Match client
  let clientId: number | null = null;
  for (const c of clients) {
    if (lower.includes(c.name.toLowerCase()) || lower.includes(c.name.toLowerCase().split(" ")[0])) {
      clientId = c.id;
      break;
    }
  }

  // Clean title
  let cleanTitle = text
    .replace(/\b(!urgent|!high|!low|urgent|high|priority:?\s*\w+)\b/gi, "")
    .replace(/\b(today|tomorrow|next\s+week)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTitle) cleanTitle = text;
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    kind,
    title: cleanTitle,
    priority,
    status: (dueDate ? "scheduled" : "inbox") as "inbox" | "next" | "scheduled",
    dueDate,
    startAt,
    endAt,
    projectId,
    clientId,
    body: isIdea ? cleanTitle : null,
  };
}

export function autonomousExpandIdea(idea: { title: string; body: string | null }): string {
  const title = idea.title.trim();
  const desc = idea.body?.trim() ? `\n> *Context*: ${idea.body.trim()}\n` : "";

  return `### 💡 1. The Core Insight
**${title}** addresses a friction point where standard workflows demand high overhead. The breakthrough comes from compressing friction into a single streamlined loop.${desc}

### 🚀 2. Three Concrete Angles to Execute
- **The Self-Service MVP**: Ship a barebones, single-purpose interface that solves this for one specific ideal user persona in under 2 minutes.
- **The Concierge Pilot**: Manually run the service behind the scenes for 3 trusted clients to uncover real edge cases before writing automation code.
- **The Ecosystem Integration**: Build this as a modular plug-in or template directly inside their existing tool stack to remove adoption barriers.

### 📋 3. First 3 Steps to Test This Week
1. **Day 1**: Write a 1-page "landing page pitch" outlining the exact problem, the promise, and the pricing.
2. **Day 2**: Demo the concept in a 5-minute loom to 3 potential users and measure unprompted enthusiasm.
3. **Day 3**: Define the minimal feature set required to deliver 80% of the value.

### 🛡️ 4. Key Risk & Hedge Strategy
- **Risk**: Over-engineering edge cases before confirming that the core proposition solves a burning daily need.
- **Hedge**: Cap initial build time to 48 hours and require at least one pre-order or active commitment before expanding.`;
}
