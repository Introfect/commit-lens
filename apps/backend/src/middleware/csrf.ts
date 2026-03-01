import { Context, Next } from "hono";

// For API endpoints, checking the Origin header is a simple and effective CSRF protection.
// In a production environment, you should replace '*' with your actual frontend origin.
const ALLOWED_ORIGINS = ["*", "http://localhost:5173", "http://127.0.0.1:5173"]; // Replace with your frontend domains

export async function csrfProtect(c: Context, next: Next) {
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.method !== "OPTIONS") {
    const origin = c.req.header("Origin");
    const referer = c.req.header("Referer");

    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return c.json({ error: "CSRF: Invalid Origin header" }, 403);
    }

    // Fallback check for Referer header if Origin is not present (though less reliable)
    if (!origin && referer) {
      const refererOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.includes(refererOrigin)) {
        return c.json({ error: "CSRF: Invalid Referer header" }, 403);
      }
    }
    
    if (!origin && !referer) {
        return c.json({ error: "CSRF: Missing Origin or Referer header for state-changing request" }, 403);
    }
  }
  await next();
}
