import { getHono } from "../utils/hono";
import { connectDb } from "../features/db/connect";
import { eq } from "drizzle-orm";
import { RepositoryInstallationTable } from "../features/db/schema";
import { getGitHubAppInstallationUrl } from "../features/auth/github";
import { getAuth } from "@hono/clerk-auth";
import jwt from "@tsndr/cloudflare-worker-jwt";

export const githubEndpoint = getHono();

// Redirect to GitHub App installation with state token
githubEndpoint.get("/redirect", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // Generate a JWT state token containing the user ID
    // This will be sent back by GitHub and allows us to identify the user
    const stateToken = await jwt.sign(
      {
        userId: auth.userId,
        timestamp: Date.now(),
        exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes expiry
      },
      c.env.JWT_SECRET
    );

    const installationUrl = getGitHubAppInstallationUrl({ 
      env: c.env,
      state: stateToken,
    });
    
    return c.redirect(installationUrl);
  } catch (error: any) {
    console.error("GitHub redirect error:", error);
    return c.json({ error: "Failed to initiate GitHub App installation", details: error.message }, 500);
  }
});

// Callback from GitHub after app installation
// This endpoint receives a direct server-to-server redirect from GitHub
// We CANNOT rely on browser cookies/sessions here
githubEndpoint.get("/callback", async (c) => {
  const db = connectDb({ env: c.env });

  const installationId = c.req.query("installation_id");
  const setupAction = c.req.query("setup_action");
  const state = c.req.query("state");

  if (!installationId || !setupAction) {
    return c.json({ error: "Invalid GitHub App callback parameters" }, 400);
  }

  if (!state) {
    return c.json({ error: "Missing state parameter" }, 400);
  }

  try {
    // Verify and decode the state token to get the user ID
    const isValid = await jwt.verify(state, c.env.JWT_SECRET);
    if (!isValid) {
      return c.json({ error: "Invalid or expired state token" }, 401);
    }

    const decoded = jwt.decode(state);
    const payload = decoded.payload as { userId?: string; timestamp?: number };
    const userId = payload?.userId;

    if (!userId) {
      return c.json({ error: "Invalid state token payload" }, 401);
    }

    // Sync Clerk user to our database (if not already synced)
    const { syncClerkUser } = await import("../features/user");
    const userResult = await syncClerkUser({
      userId,
      db,
      env: c.env,
    });

    if (!userResult.ok) {
      return c.json({ error: "Failed to sync user", details: userResult.error }, 500);
    }

    // Fetch installation details from GitHub
    const { getInstallation } = await import("../services/github");
    const installation = await getInstallation({
      env: c.env,
      installationId,
    });

    // Check if installation already exists
    const existingInstallation = await db.query.RepositoryInstallationTable.findFirst({
      where: eq(RepositoryInstallationTable.installationId, installationId),
    });

    if (!existingInstallation) {
      await db.insert(RepositoryInstallationTable).values({
        installationId: installationId,
        userId: userId,
        accountLogin: installation.account.login,
        accountAvatarUrl: installation.account.avatar_url,
      });
    } else if (existingInstallation.userId !== userId) {
      // Handle case where installation exists but belongs to a different user
      return c.json({ error: "Installation already claimed by another user" }, 409);
    }
    // If it exists and belongs to the same user, update it (re-installation)
    else {
      await db.update(RepositoryInstallationTable)
        .set({
          accountLogin: installation.account.login,
          accountAvatarUrl: installation.account.avatar_url,
        })
        .where(eq(RepositoryInstallationTable.installationId, installationId));
    }

    // Sync repositories for this installation
    const { syncRepositoriesForInstallation } = await import("../features/repository");
    await syncRepositoriesForInstallation({
      db,
      env: c.env,
      installationId,
    });

    // Redirect back to the FRONTEND dashboard (not backend)
    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:5173";
    return c.redirect(`${frontendUrl}/dashboard?connected=true`);
  } catch (e: any) {
    console.error("GitHub App callback error:", e);
    return c.json({ error: "An unknown error occurred during GitHub App installation", details: e.message }, 500);
  }
});
