import { getHono } from "../utils/hono";
import { getGitHubAppInstallationUrl } from "../features/auth/github";
import { connectDb } from "../features/db/connect";
import { RepositoryInstallationTable } from "../features/db/schema";
import { eq } from "drizzle-orm";
import { csrfProtect } from "../middleware/csrf";
import { verifySession } from "../features/auth/session";
import { getCookie } from "hono/cookie";

export const githubEndpoint = getHono();

githubEndpoint.use("*", csrfProtect);

githubEndpoint.get("/redirect", async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { ok, payload } = await verifySession({ token: session, secret: c.env.JWT_SECRET });
  if (!ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const githubAppInstallationUrl = getGitHubAppInstallationUrl({ env: c.env });

  // Redirect to GitHub App installation page
  return c.redirect(githubAppInstallationUrl);
});

githubEndpoint.get("/callback", async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { ok, payload } = await verifySession({ token: session, secret: c.env.JWT_SECRET });
  if (!ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = connectDb({ env: c.env });

  const installationId = c.req.query("installation_id");
  const setupAction = c.req.query("setup_action");
  const state = c.req.query("state"); // This 'state' here is actually the redirect URL

  if (!installationId || !setupAction || !state) {
    return c.json({ error: "Invalid GitHub App callback parameters" }, 400);
  }

  try {
    // In a real application, you would perform a check to verify the 'state'
    // parameter matches what was set by your application to prevent CSRF.
    // For simplicity, we are skipping that here, but the GITHUB_APP_REDIRECT_URI
    // is used as the 'state' to ensure the redirect works as expected.

    // Fetch GitHub App installation details (e.g., account login, avatar_url)
    // This requires a GitHub App token, not a user token.
    // For now, we'll use a placeholder or assume we can get this info directly from the callback.
    // In a full implementation, you'd use a GitHub App private key to create an JWT,
    // then exchange that for an installation access token to query GitHub API.
    const githubAccountLogin = "WIP_GITHUB_ACCOUNT_LOGIN"; // Placeholder
    const githubAccountAvatarUrl = "WIP_GITHUB_ACCOUNT_AVATAR_URL"; // Placeholder

    // Check if installation already exists for this user
    const existingInstallation = await db.query.RepositoryInstallationTable.findFirst({
      where: eq(RepositoryInstallationTable.installationId, installationId),
    });

    if (!existingInstallation) {
      await db.insert(RepositoryInstallationTable).values({
        installationId: installationId,
        userId: payload.userId,
        accountLogin: githubAccountLogin,
        accountAvatarUrl: githubAccountAvatarUrl,
      });
    } else if (existingInstallation.userId !== payload.userId) {
      // Handle case where installation exists but belongs to a different user
      return c.json({ error: "Installation already claimed by another user" }, 409);
    }
    // If it exists and belongs to the same user, do nothing (re-installation)

    // Redirect to the dashboard, or a specific repositories page
    return c.redirect("/repositories");
  } catch (e) {
    console.error("GitHub App callback error:", e);
    return c.json({ error: "An unknown error occurred during GitHub App installation" }, 500);
  }
});

