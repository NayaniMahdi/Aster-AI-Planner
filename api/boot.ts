import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// Google OAuth callback redirect handler
app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error || !code) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Google Authorization Cancelled</title></head>
        <body style="font-family: system-ui; background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; max-width: 400px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; background: rgba(255,255,255,0.03);">
            <h2 style="color: #f87171; margin-top: 0;">Authorization Cancelled</h2>
            <p style="color: #94a3b8; font-size: 14px;">${error || "No authorization code returned from Google."}</p>
            <a href="/inbox" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 500;">Return to Inbox</a>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const caller = appRouter.createCaller(
      await createContext({ req: c.req.raw, resHeaders: new Headers(), info: {} as any })
    );
    await caller.gmail.exchangeCode({ code });

    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Gmail Connected</title></head>
        <body style="font-family: system-ui; background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; max-width: 400px; padding: 28px; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; background: rgba(255,255,255,0.03);">
            <div style="font-size: 36px; margin-bottom: 12px;">✨</div>
            <h2 style="color: #34d399; margin: 0 0 8px;">Gmail Connected</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 16px;">Your inbox is now ready. Syncing your messages...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GMAIL_CONNECTED' }, '*');
              setTimeout(() => { window.close(); }, 800);
            } else {
              setTimeout(() => { window.location.href = '/inbox?connected=true'; }, 1000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Error</title></head>
        <body style="font-family: system-ui; background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center; max-width: 420px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; background: rgba(255,255,255,0.03);">
            <h2 style="color: #f87171; margin-top: 0;">Failed to Authorize</h2>
            <p style="color: #94a3b8; font-size: 13px;">${err?.message || "Error exchanging authorization code."}</p>
            <a href="/inbox" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 500;">Return to Inbox</a>
          </div>
        </body>
      </html>
    `);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
