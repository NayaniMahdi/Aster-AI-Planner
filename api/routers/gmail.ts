import { z } from "zod";
import { google } from "googleapis";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { settings, clients, projects, tasks } from "@db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateText } from "ai";
import { getCascadeModels } from "../ai/provider";

// Scopes required for full assistant operation
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Helper: Get a setting by key
async function getSetting(key: string): Promise<string | null> {
  try {
    const db = getDb();
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    return rows[0]?.value ?? null;
  } catch (err) {
    console.error(`Failed to get setting ${key}:`, err);
    return null;
  }
}

// Helper: Set a setting by key
async function setSetting(key: string, value: string): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  } catch (err) {
    console.error(`Failed to set setting ${key}:`, err);
  }
}

// Helper: Delete a setting
async function deleteSetting(key: string): Promise<void> {
  try {
    const db = getDb();
    await db.delete(settings).where(eq(settings.key, key));
  } catch (err) {
    console.error(`Failed to delete setting ${key}:`, err);
  }
}

// Helper: Get OAuth Client credentials
async function getOAuthCredentials() {
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

  const dbClientId = await getSetting("gmail_client_id");
  const dbClientSecret = await getSetting("gmail_client_secret");
  const dbRedirectUri = await getSetting("gmail_redirect_uri");

  const clientId = dbClientId || envClientId;
  const clientSecret = dbClientSecret || envClientSecret;
  const redirectUri = dbRedirectUri || envRedirectUri;

  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    redirectUri,
  };
}

// Helper: Create OAuth2 client
export async function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = await getOAuthCredentials();
  if (!clientId || !clientSecret) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Helper: Get authenticated Gmail client
export async function getAuthenticatedGmailClient() {
  const oauth2Client = await createOAuth2Client();
  if (!oauth2Client) return null;

  const refreshToken = await getSetting("gmail_refresh_token");
  const accessToken = await getSetting("gmail_access_token");
  const expiryDate = await getSetting("gmail_token_expiry");

  if (!refreshToken && !accessToken) {
    return null;
  }

  oauth2Client.setCredentials({
    refresh_token: refreshToken || undefined,
    access_token: accessToken || undefined,
    expiry_date: expiryDate ? parseInt(expiryDate, 10) : undefined,
  });

  // Listen for automatic token refreshes and persist them
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await setSetting("gmail_access_token", tokens.access_token);
    }
    if (tokens.refresh_token) {
      await setSetting("gmail_refresh_token", tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      await setSetting("gmail_token_expiry", tokens.expiry_date.toString());
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Decode base64url email body
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

// Extract plain text or html from Gmail payload parts
function extractEmailBody(payload: any): { text: string; html?: string } {
  if (!payload) return { text: "" };

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      return { text: decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), html: decoded };
    }
    return { text: decoded };
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    let plainText = "";
    let htmlText = "";

    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        plainText += decodeBase64Url(part.body.data) + "\n";
      } else if (part.mimeType === "text/html" && part.body?.data) {
        htmlText += decodeBase64Url(part.body.data) + "\n";
      } else if (part.parts) {
        const nested = extractEmailBody(part);
        plainText += nested.text + "\n";
        if (nested.html) htmlText += nested.html + "\n";
      }
    }

    if (plainText.trim()) {
      return { text: plainText.trim(), html: htmlText || undefined };
    }
    if (htmlText.trim()) {
      return {
        text: htmlText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        html: htmlText,
      };
    }
  }

  return { text: "" };
}

export const gmailRouter = createRouter({
  // Check connection status
  getStatus: publicQuery.query(async () => {
    const { clientId } = await getOAuthCredentials();
    const email = await getSetting("gmail_user_email");
    const refreshToken = await getSetting("gmail_refresh_token");
    const accessToken = await getSetting("gmail_access_token");

    const isConnected = !!(refreshToken || accessToken);

    return {
      hasCredentials: !!clientId,
      isConnected,
      email: isConnected ? email : null,
    };
  }),

  // Save OAuth credentials (if user wants to configure via UI)
  saveCredentials: publicQuery
    .input(
      z.object({
        clientId: z.string().min(5),
        clientSecret: z.string().min(5),
        redirectUri: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await setSetting("gmail_client_id", input.clientId.trim());
      await setSetting("gmail_client_secret", input.clientSecret.trim());
      if (input.redirectUri) {
        await setSetting("gmail_redirect_uri", input.redirectUri.trim());
      }
      return { success: true };
    }),

  // Generate OAuth consent URL
  getAuthUrl: publicQuery.query(async () => {
    const oauth2Client = await createOAuth2Client();
    if (!oauth2Client) {
      throw new Error("Google Client ID and Client Secret are not configured yet.");
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
    });

    return { authUrl };
  }),

  // Exchange auth code for tokens
  exchangeCode: publicQuery
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const oauth2Client = await createOAuth2Client();
      if (!oauth2Client) {
        throw new Error("OAuth client not configured");
      }

      const { tokens } = await oauth2Client.getToken(input.code);
      if (tokens.access_token) {
        await setSetting("gmail_access_token", tokens.access_token);
      }
      if (tokens.refresh_token) {
        await setSetting("gmail_refresh_token", tokens.refresh_token);
      }
      if (tokens.expiry_date) {
        await setSetting("gmail_token_expiry", tokens.expiry_date.toString());
      }

      oauth2Client.setCredentials(tokens);

      // Fetch user profile email
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      try {
        const userInfo = await oauth2.userinfo.get();
        if (userInfo.data.email) {
          await setSetting("gmail_user_email", userInfo.data.email);
        }
      } catch (err) {
        console.warn("Could not fetch user profile email:", err);
      }

      return { success: true };
    }),

  // Disconnect Gmail
  disconnect: publicQuery.mutation(async () => {
    await deleteSetting("gmail_access_token");
    await deleteSetting("gmail_refresh_token");
    await deleteSetting("gmail_token_expiry");
    await deleteSetting("gmail_user_email");
    return { success: true };
  }),

  // List recent inbox messages
  listEmails: publicQuery
    .input(
      z
        .object({
          maxResults: z.number().min(1).max(30).default(15),
          query: z.string().optional().default("in:inbox"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const gmail = await getAuthenticatedGmailClient();
      if (!gmail) {
        return { isConnected: false, emails: [] };
      }

      try {
        const listRes = await gmail.users.messages.list({
          userId: "me",
          maxResults: input?.maxResults ?? 15,
          q: input?.query ?? "in:inbox",
        });

        const messages = listRes.data.messages || [];
        if (messages.length === 0) {
          return { isConnected: true, emails: [] };
        }

        // Fetch details for each message in parallel
        const emailDetails = await Promise.all(
          messages.slice(0, 15).map(async (msg) => {
            try {
              const detail = await gmail.users.messages.get({
                userId: "me",
                id: msg.id!,
                format: "full",
              });

              const headers = detail.data.payload?.headers || [];
              const getHeader = (name: string) =>
                headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

              const fromRaw = getHeader("from");
              const subject = getHeader("subject") || "(No Subject)";
              const dateRaw = getHeader("date");
              const toRaw = getHeader("to");

              // Parse From name and email address
              const match = fromRaw.match(/(.*?)(?:<(.+@.+)>|$)/);
              const sender = (match ? match[1] : fromRaw).replace(/"/g, "").trim() || fromRaw;
              const senderEmail = (match && match[2] ? match[2] : fromRaw).trim();

              const bodyInfo = extractEmailBody(detail.data.payload);
              const isUnread = (detail.data.labelIds || []).includes("UNREAD");

              // Pick an avatar color based on sender name hash
              const colors = [
                "bg-blue-600",
                "bg-purple-600",
                "bg-emerald-600",
                "bg-amber-600",
                "bg-indigo-600",
                "bg-rose-600",
              ];
              const colorIdx = Math.abs(
                sender.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
              ) % colors.length;

              return {
                id: detail.data.id || msg.id!,
                threadId: detail.data.threadId || "",
                sender: sender || senderEmail,
                senderEmail,
                to: toRaw,
                avatarColor: colors[colorIdx],
                subject,
                time: dateRaw ? new Date(dateRaw).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
                date: dateRaw || "",
                snippet: detail.data.snippet || "",
                body: bodyInfo.text || detail.data.snippet || "",
                html: bodyInfo.html,
                isRead: !isUnread,
                labels: detail.data.labelIds || [],
              };
            } catch (err) {
              console.error(`Failed to fetch message ${msg.id}:`, err);
              return null;
            }
          })
        );

        return {
          isConnected: true,
          emails: emailDetails.filter(Boolean),
        };
      } catch (err: any) {
        console.error("Gmail list error:", err);
        const isApiDisabled =
          err.message?.includes("Gmail API has not been used") ||
          err.message?.includes("it is disabled");
        
        // Extract project ID if present in the error message
        const matchProj = err.message?.match(/project[ =](\d+)/i);
        const projectId = matchProj ? matchProj[1] : "811921990007";
        const enableUrl = `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId}`;

        return {
          isConnected: true,
          error: err.message,
          apiDisabled: isApiDisabled,
          enableUrl,
          emails: [],
        };
      }
    }),

  // AI-powered analysis of an email: categorization, action extraction, and draft reply
  analyzeEmail: publicQuery
    .input(
      z.object({
        emailId: z.string(),
        sender: z.string(),
        senderEmail: z.string(),
        subject: z.string(),
        body: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Fetch workspace context (clients & projects) to match context
      const [allClients, allProjects] = await Promise.all([
        db.select().from(clients),
        db.select().from(projects),
      ]);

      const clientMatch = allClients.find(
        (c) =>
          (c.email && input.senderEmail.toLowerCase().includes(c.email.toLowerCase())) ||
          (c.name && input.sender.toLowerCase().includes(c.name.toLowerCase()))
      );

      const projectMatch = allProjects.find(
        (p) =>
          input.subject.toLowerCase().includes(p.name.toLowerCase()) ||
          input.body.toLowerCase().includes(p.name.toLowerCase())
      );

      // AI Analysis Prompt
      const systemPrompt = `You are an elite AI Executive Assistant for Northstar Studio.
Analyze the incoming email and return a JSON object with:
1. "category": "client" | "internal" | "alert" | "newsletter"
2. "priority": "high" | "normal"
3. "summary": One-sentence crisp executive summary
4. "extractedAction": An actionable task required from the recipient (null if purely informational or newsletter)
5. "suggestedReply": A professional, warm, executive-grade draft reply that directly addresses the email sender. Keep it concise, courteous, and proactive. Sign off with "Best,\\nAbbas".
6. "suggestedTaskTitle": If an action is extracted, give a 4-8 word task title (e.g. "Review Nexus staging credentials before audit"). Otherwise null.`;

      const userPrompt = `EMAIL DETAILS:
From: ${input.sender} <${input.senderEmail}>
Subject: ${input.subject}
Body:
${input.body.slice(0, 3000)}

WORKSPACE CONTEXT:
Matched Client: ${clientMatch ? `${clientMatch.name} (${clientMatch.company || ""})` : "None"}
Matched Project: ${projectMatch ? projectMatch.name : "None"}

Generate the JSON response.`;

      try {
        const models = await getCascadeModels();
        const primary = models[0];

        if (primary) {
          const res = await generateText({
            model: primary.model,
            system: systemPrompt,
            prompt: userPrompt,
          });

          // Parse JSON from text
          const jsonMatch = res.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              category: parsed.category || "client",
              priority: parsed.priority || "normal",
              summary: parsed.summary || "",
              extractedAction: parsed.extractedAction || null,
              suggestedTaskTitle: parsed.suggestedTaskTitle || null,
              suggestedReply: parsed.suggestedReply || "",
              relatedClient: clientMatch ? clientMatch.name : undefined,
              relatedProject: projectMatch ? projectMatch.name : undefined,
            };
          }
        }
      } catch (err) {
        console.warn("AI LLM call failed, using heuristic extraction fallback:", err);
      }

      // Fallback heuristics if LLM is unavailable
      const isUrgent = /urgent|asap|deadline|audit|critical|failover/i.test(
        input.subject + " " + input.body
      );

      return {
        category: (clientMatch ? "client" : "internal") as "client" | "internal",
        priority: (isUrgent ? "high" : "normal") as "high" | "normal",
        summary: `Communication from ${input.sender} regarding ${input.subject}`,
        extractedAction: `Review email from ${input.sender} and respond regarding "${input.subject}"`,
        suggestedTaskTitle: `Respond to ${input.sender}: ${input.subject.slice(0, 40)}`,
        suggestedReply: `Hi ${input.sender.split(" ")[0] || input.sender},\n\nThank you for the update. I have reviewed your notes regarding ${input.subject} and am currently addressing the action items.\n\nI will follow up with complete details shortly.\n\nBest,\nAbbas`,
        relatedClient: clientMatch ? clientMatch.name : undefined,
        relatedProject: projectMatch ? projectMatch.name : undefined,
      };
    }),

  // Create a Task directly from an extracted email action
  createTaskFromEmail: publicQuery
    .input(
      z.object({
        title: z.string().min(1),
        notes: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        sender: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [res] = await db.insert(tasks).values({
        title: input.title,
        notes: input.notes || `Created from email sent by ${input.sender || "contact"}`,
        status: "inbox",
        priority: input.priority,
        energy: "medium",
      });
      return { success: true, taskId: (res as any).insertId };
    }),

  // Send an email reply or create a draft in Gmail
  sendReply: publicQuery
    .input(
      z.object({
        threadId: z.string().optional(),
        to: z.string(),
        subject: z.string(),
        body: z.string(),
        isDraftOnly: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return sendOrDraftEmail({
        threadId: input.threadId,
        to: input.to,
        subject: input.subject,
        body: input.body,
        isDraftOnly: input.isDraftOnly,
      });
    }),
});

/**
 * Executive email sending helper with full rights for Assistant & UI
 */
export async function sendOrDraftEmail(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  isDraftOnly?: boolean;
}): Promise<{ success: boolean; mode: "sent" | "draft"; id?: string }> {
  const gmail = await getAuthenticatedGmailClient();
  if (!gmail) {
    throw new Error("Gmail account not connected. Please connect Google account in Inbox.");
  }

  const myEmail = (await getSetting("gmail_user_email")) || "me";

  // Build RFC 2822 email message
  const subjectLine = input.subject || "No Subject";
  const emailLines = [
    `From: ${myEmail}`,
    `To: ${input.to}`,
    `Subject: ${subjectLine}`,
    ...(input.threadId ? [`In-Reply-To: <${input.threadId}>`, `References: <${input.threadId}>`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ];
  const emailContent = emailLines.join("\r\n");
  const encodedMessage = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  if (input.isDraftOnly) {
    // Save as Draft
    const draftRes = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          ...(input.threadId ? { threadId: input.threadId } : {}),
          raw: encodedMessage,
        },
      },
    });
    return { success: true, mode: "draft", id: draftRes.data.id ?? undefined };
  } else {
    // Send immediately
    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        ...(input.threadId ? { threadId: input.threadId } : {}),
        raw: encodedMessage,
      },
    });
    return { success: true, mode: "sent", id: sendRes.data.id ?? undefined };
  }
}

/**
 * Fetch recent inbox emails for Aster AI context
 */
export async function getRecentEmails(limit = 8): Promise<Array<{
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
}>> {
  try {
    const gmail = await getAuthenticatedGmailClient();
    if (!gmail) return [];

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit,
      q: "in:inbox",
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return [];

    const details = await Promise.all(
      messages.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          });
          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          const fromRaw = getHeader("From");
          const subject = getHeader("Subject") || "No subject";
          const date = getHeader("Date") || "";
          const emailMatch = fromRaw.match(/<([^>]+)>/);
          const senderEmail = emailMatch ? emailMatch[1] : fromRaw.trim();
          const sender = fromRaw.replace(/<[^>]+>/, "").trim() || senderEmail;

          return {
            id: detail.data.id || msg.id!,
            threadId: detail.data.threadId || "",
            sender,
            senderEmail,
            subject,
            snippet: detail.data.snippet || "",
            date,
          };
        } catch {
          return null;
        }
      })
    );

    return details.filter(Boolean) as any[];
  } catch (err) {
    console.error("Failed to fetch recent emails for workspace context:", err);
    return [];
  }
}
