import { getHono } from "../utils/hono";
import { getAuth } from "@hono/clerk-auth";
import { verifyWebhookSignature } from "../services/github";
import { GitHubPullRequestWebhookSchema } from "../types/github";
import { connectDb } from "../features/db/connect";
import { RepositoryTable } from "../features/db/schema";
import { eq } from "drizzle-orm";
import { createPullRequestEvent } from "../features/pullRequestEvent";
import { syncRepositoriesForInstallation } from "../features/repository";

export const webhooksEndpoint = getHono();

/**
 * Handle GitHub webhooks
 * POST /webhooks/github
 */
webhooksEndpoint.post("/github", async (c) => {
  try {
    // Get headers
    const signature = c.req.header("x-hub-signature-256");
    const githubEvent = c.req.header("x-github-event");
    const deliveryId = c.req.header("x-github-delivery");

    console.log("=== GitHub Webhook Received ===");
    console.log("Event Type:", githubEvent);
    console.log("Delivery ID:", deliveryId);
    console.log("Has Signature:", !!signature);

    if (!signature || !githubEvent || !deliveryId) {
      console.error("Missing required headers:", { signature: !!signature, githubEvent, deliveryId });
      return c.json({ error: "Missing required webhook headers" }, 400);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();
    console.log("Payload size:", rawBody.length, "bytes");

    // Verify signature
    const isValid = await verifyWebhookSignature({
      env: c.env,
      payload: rawBody,
      signature,
    });

    if (!isValid) {
      console.error("Webhook signature verification failed");
      return c.json({ error: "Invalid webhook signature" }, 401);
    }

    console.log("✓ Signature verified");

    // Parse payload
    const payload = JSON.parse(rawBody);
    console.log("Payload keys:", Object.keys(payload));
    console.log("Full payload:", JSON.stringify(payload, null, 2));

    // Handle different event types
    if (githubEvent === "pull_request") {
      console.log("→ Handling pull_request event");
      return await handlePullRequestEvent(c, payload);
    } else if (githubEvent === "installation" || githubEvent === "installation_repositories") {
      console.log("→ Handling installation event");
      return await handleInstallationEvent(c, payload);
    } else {
      console.log("→ Event type not processed:", githubEvent);
      // Acknowledge other events
      return c.json({ ok: true, message: `Event ${githubEvent} received but not processed` });
    }
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

/**
 * Handle pull_request webhook events
 */
async function handlePullRequestEvent(c: any, payload: any) {
  try {
    console.log("  PR Action:", payload.action);
    console.log("  PR Number:", payload.pull_request?.number);
    console.log("  PR Title:", payload.pull_request?.title);
    console.log("  Repository ID:", payload.repository?.id);
    console.log("  Repository Name:", payload.repository?.full_name);

    // Validate payload structure
    const webhook = GitHubPullRequestWebhookSchema.parse(payload);
    console.log("  ✓ Webhook payload validated");

    // Only process opened and synchronize events
    if (webhook.action !== "opened" && webhook.action !== "synchronize") {
      console.log(`  → Skipping action '${webhook.action}' (only processing 'opened' and 'synchronize')`);
      return c.json({ ok: true, message: `PR action ${webhook.action} acknowledged` });
    }

    console.log("  → Processing PR event...");

    const db = connectDb({ env: c.env });

    // Get the repository ID (GitHub repository ID)
    const repositoryId = webhook.repository.id.toString();
    console.log("  Looking up repository in DB:", repositoryId);

    // Check if we have this repository in our database
    const repository = await db
      .select()
      .from(RepositoryTable)
      .where(eq(RepositoryTable.id, repositoryId))
      .limit(1);

    if (repository.length === 0) {
      console.log("  ⚠ Repository not in DB, attempting to sync...");
      // Repository not tracked, sync it if we have the installation
      if (webhook.installation) {
        try {
          const installationId = webhook.installation.id.toString();
          console.log("  Syncing installation:", installationId);
          await syncRepositoriesForInstallation({
            db,
            env: c.env,
            installationId,
          });
          console.log("  ✓ Repository synced");
        } catch (syncError) {
          console.error("  ✗ Failed to sync repository:", syncError);
          // Continue processing even if sync fails
        }
      } else {
        console.warn(`  ✗ Repository ${repositoryId} not found and no installation info provided`);
      }
    } else {
      console.log("  ✓ Repository found in DB");
    }

    // Create pull request event
    console.log("  Creating PR event in database...");
    const event = await createPullRequestEvent({
      db,
      env: c.env,
      webhook,
      repositoryId,
    });

    console.log("  ✓ PR event created with ID:", event.id);

    return c.json({
      ok: true,
      message: "Pull request event processed",
      eventId: event.id,
    });
  } catch (error: any) {
    console.error("Pull request event processing error:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: "Failed to process pull request event", details: error.message }, 500);
  }
}

/**
 * Handle installation and installation_repositories events
 */
async function handleInstallationEvent(c: any, payload: any) {
  try {
    const action = payload.action;
    const installation = payload.installation;

    if (!installation) {
      return c.json({ error: "Missing installation data" }, 400);
    }

    const installationId = installation.id.toString();
    const db = connectDb({ env: c.env });

    // For created or repositories_added events, sync repositories
    if (action === "created" || action === "added" || action === "repositories_added") {
      await syncRepositoriesForInstallation({
        db,
        env: c.env,
        installationId,
      });

      return c.json({
        ok: true,
        message: "Installation repositories synced",
      });
    }

    return c.json({ ok: true, message: `Installation action ${action} acknowledged` });
  } catch (error: any) {
    console.error("Installation event processing error:", error);
    return c.json({ error: "Failed to process installation event", details: error.message }, 500);
  }
}
