import { getHono } from "../utils/hono";
import type { Context } from "hono";
import { verifyWebhookSignature } from "../services/github";
import {
  GitHubInstallationEvent,
  GitHubInstallationEventSchema,
  GitHubPullRequestWebhook,
  GitHubPullRequestWebhookSchema,
} from "../types/github";
import { connectDb } from "../features/db/connect";
import { RepositoryTable } from "../features/db/schema";
import { and, eq } from "drizzle-orm";
import { createPullRequestEvent } from "../features/pullRequestEvent";
import { syncRepositoriesForInstallation } from "../features/repository";
import { queuePullRequestReview } from "../features/prReview";
import type { SessionUser } from "../features/auth/session";
import { createLogger, generateCorrelationId } from "../utils/logger";
import { getErrorMessage, ErrorCodes } from "../utils/error";

export const webhooksEndpoint = getHono();
type AppContext = Context<{
  Bindings: Env;
  Variables: {
    authUser: SessionUser;
  };
}>;

const RepositorySelectInfo = {
  info: {
    id: RepositoryTable.id,
    installationId: RepositoryTable.installationId,
    name: RepositoryTable.name,
    owner: RepositoryTable.owner,
    isActive: RepositoryTable.isActive,
    isRemovedFromWorkspace: RepositoryTable.isRemovedFromWorkspace,
  },
} as const;

/**
 * Handle GitHub webhooks
 * POST /webhooks/github
 */
webhooksEndpoint.post("/github", async (c) => {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const logger = createLogger({
    correlationId,
    operation: 'webhook_github',
  });

  logger.info('GitHub webhook received', {
    method: c.req.method,
    url: c.req.url,
    userAgent: c.req.header('User-Agent'),
  });

  try {
    // Get headers
    const signature = c.req.header("x-hub-signature-256");
    const githubEvent = c.req.header("x-github-event");
    const deliveryId = c.req.header("x-github-delivery");
    const contentType = c.req.header("content-type");

    logger.info('Webhook headers received', {
      githubEvent,
      deliveryId,
      hasSignature: !!signature,
      signatureLength: signature?.length,
      contentType,
      allHeaders: Object.fromEntries(c.req.raw.headers.entries()),
    });

    if (!signature || !githubEvent || !deliveryId) {
      logger.error('Missing required webhook headers', {
        signature: !!signature,
        githubEvent,
        deliveryId,
      });
      return c.json({ error: "Missing required webhook headers" }, 400);
    }

    // Get raw body for signature verification
    logger.debug('Reading webhook payload');
    const rawBody = await c.req.text();
    const payloadSize = rawBody.length;

    logger.info('Webhook payload received', {
      payloadSize,
      payloadSizeKB: (payloadSize / 1024).toFixed(2),
    });

    // Verify signature
    logger.debug('Verifying webhook signature');
    const signatureStart = Date.now();
    const isValid = await verifyWebhookSignature({
      env: c.env,
      payload: rawBody,
      signature,
    });
    const signatureDuration = Date.now() - signatureStart;

    logger.info('Signature verification completed', {
      isValid,
      verificationDuration: signatureDuration,
    });

    if (!isValid) {
      logger.error('Webhook signature verification failed', {
        signaturePrefix: signature.substring(0, 10) + '...',
        envHasSecret: !!c.env.GITHUB_WEBHOOK_SECRET,
      });
      return c.json({ error: "Invalid webhook signature" }, 401);
    }

    // Handle different event types
    if (githubEvent === "pull_request") {
      const payloadValidation = GitHubPullRequestWebhookSchema.safeParse(
        JSON.parse(rawBody)
      );

      if (!payloadValidation.success) {
        logger.error('Failed to validate pull request webhook payload', {
          validationError: payloadValidation.error.message,
        });
        return c.json(
          {
            errorCode: ErrorCodes.JSON_INVALID,
            error: payloadValidation.error.message,
          },
          400
        );
      }

      const payload = payloadValidation.data;
      logger.info('Routing webhook event', {
        githubEvent,
        action: payload.action,
        repositoryId: payload.repository.id,
        repositoryName: payload.repository.full_name,
        installationId: payload.installation?.id,
      });
      logger.info('Routing to pull request handler');
      return await handlePullRequestEvent(c, payload, logger.child({ eventType: 'pull_request' }));
    } else if (githubEvent === "installation" || githubEvent === "installation_repositories") {
      const payloadValidation = GitHubInstallationEventSchema.safeParse(
        JSON.parse(rawBody)
      );

      if (!payloadValidation.success) {
        logger.error('Failed to validate installation webhook payload', {
          validationError: payloadValidation.error.message,
        });
        return c.json(
          {
            errorCode: ErrorCodes.JSON_INVALID,
            error: payloadValidation.error.message,
          },
          400
        );
      }

      const payload = payloadValidation.data;
      logger.info('Routing webhook event', {
        githubEvent,
        action: payload.action,
        installationId: payload.installation.id,
      });
      logger.info('Routing to installation handler');
      return await handleInstallationEvent(c, payload, logger.child({ eventType: 'installation' }));
    } else {
      logger.info('Event type not processed', { githubEvent });
      // Acknowledge other events
      return c.json({ ok: true, message: `Event ${githubEvent} received but not processed` });
    }
  } catch (error) {
    logger.error('Webhook processing error', error instanceof Error ? error : null, {
      processingDuration: Date.now() - startTime,
    });
    return c.json(
      {
        error: "Internal server error",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
});

/**
 * Handle pull_request webhook events
 */
async function handlePullRequestEvent(
  c: AppContext,
  payload: GitHubPullRequestWebhook,
  logger: ReturnType<typeof createLogger>
) {
  const handlerStart = Date.now();

  try {
    logger.info('Processing pull request event', {
      action: payload.action,
      prNumber: payload.pull_request?.number,
      prTitle: payload.pull_request?.title,
      repositoryId: payload.repository?.id,
      repositoryName: payload.repository?.full_name,
      installationId: payload.installation?.id,
    });

    const supportedReviewActions = new Set(["opened", "synchronize", "reopened"]);

    if (!supportedReviewActions.has(payload.action)) {
      logger.info('Skipping non-opened action', {
        action: payload.action,
        reason: 'Only processing opened, synchronize, and reopened events for AI reviews',
      });
      return c.json({ ok: true, message: `PR action ${payload.action} acknowledged` });
    }

    logger.info('Processing PR event for AI review');

    logger.debug('Connecting to database');
    const db = connectDb({ env: c.env });

    // Get the repository ID (GitHub repository ID)
    const repositoryId = payload.repository.id.toString();
    logger.info('Looking up repository in database', { repositoryId });

    async function lookupTrackedRepository() {
      return db
        .select(RepositorySelectInfo.info)
        .from(RepositoryTable)
        .where(
          and(
            eq(RepositoryTable.id, repositoryId),
            eq(RepositoryTable.isActive, true),
            eq(RepositoryTable.isRemovedFromWorkspace, false)
          )
        )
        .limit(1);
    }

    const repoLookupStart = Date.now();
    let repository = await lookupTrackedRepository();
    const repoLookupDuration = Date.now() - repoLookupStart;

    logger.info('Repository lookup completed', {
      found: repository.length > 0,
      lookupDuration: repoLookupDuration,
    });

    if (repository.length === 0) {
      logger.warn('Repository not found in database, attempting to sync', {
        repositoryId,
        hasInstallation: !!payload.installation,
      });

      // Repository not tracked, sync it if we have the installation
      if (payload.installation) {
        try {
          const installationId = payload.installation.id.toString();
          logger.info('Syncing repository for installation', { installationId });

          const syncStart = Date.now();
          const syncResult = await syncRepositoriesForInstallation({
            db,
            env: c.env,
            installationId,
            mode: "background",
          });
          const syncDuration = Date.now() - syncStart;

          if (!syncResult.ok) {
            logger.error('Failed to sync repository', {
              installationId,
              syncError: syncResult.error,
            });
          } else {
            logger.info('Repository sync completed successfully', {
              syncDuration,
              installationId,
            });
          }
        } catch (syncError) {
          logger.error('Failed to sync repository', syncError instanceof Error ? syncError : null, {
            installationId: payload.installation?.id?.toString(),
          });
          // Continue processing even if sync fails
        }
      } else {
        logger.warn('Cannot sync repository - no installation info provided', {
          repositoryId,
        });
      }

      repository = await lookupTrackedRepository();

      if (repository.length === 0) {
        logger.info("Repository is still not active in the workspace after sync; ignoring webhook", {
          repositoryId,
        });

        return c.json({
          ok: true,
          message: "Repository is not active in the CommitLens workspace",
        });
      }
    } else {
      logger.info('Repository found in database', {
        repoName: repository[0].name,
        repoOwner: repository[0].owner,
        installationId: repository[0].installationId,
      });
    }

    // Create pull request event
    logger.info('Creating PR event in database');
    const eventCreateStart = Date.now();
    const event = await createPullRequestEvent({
      db,
      env: c.env,
      webhook: payload,
      repositoryId,
    });
    const eventCreateDuration = Date.now() - eventCreateStart;

    logger.info('PR event created successfully', {
      eventId: event.id,
      eventCreateDuration,
      prNumber: event.prNumber,
      action: event.action,
    });

    // Queue AI review job
    const prReviewLogger = logger.child({
      operation: 'webhook_pr_review_trigger',
      prNumber: payload.pull_request.number.toString(),
      eventId: event.id,
    });

    prReviewLogger.info('Queueing AI review job');
    const queueStart = Date.now();
    queuePullRequestReview({
      db,
      env: c.env,
      repositoryId,
      prNumber: payload.pull_request.number.toString(),
      eventId: event.id,
    }).catch((error) => {
      prReviewLogger.error('Failed to queue AI review job', error instanceof Error ? error : null);
    });
    const queueDuration = Date.now() - queueStart;

    prReviewLogger.info('AI review job queued successfully', {
      queueDuration,
      totalHandlerDuration: Date.now() - handlerStart,
    });

    return c.json({
      ok: true,
      message: "Pull request event processed and review started",
      eventId: event.id,
      correlationId: logger.correlationId,
    });
  } catch (error) {
    logger.error('Pull request event processing failed', error instanceof Error ? error : null, {
      handlerDuration: Date.now() - handlerStart,
    });
    return c.json(
      {
        error: "Failed to process pull request event",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
}

/**
 * Handle installation and installation_repositories events
 */
async function handleInstallationEvent(
  c: AppContext,
  payload: GitHubInstallationEvent,
  logger: ReturnType<typeof createLogger>
) {
  const handlerStart = Date.now();

  try {
    const action = payload.action;
    const installation = payload.installation;

    logger.info('Processing installation event', {
      action,
      installationId: installation?.id,
      accountLogin: installation?.account?.login,
      repositorySelection: installation?.repository_selection,
      hasPermissions: !!installation?.permissions,
    });

    if (!installation) {
      logger.error('Missing installation data in payload');
      return c.json({ error: "Missing installation data" }, 400);
    }

    const installationId = installation.id.toString();
    logger.debug('Connecting to database');
    const db = connectDb({ env: c.env });

    // Reconcile the selected repositories whenever GitHub changes installation scope.
    if (
      action === "created" ||
      action === "added" ||
      action === "removed" ||
      action === "repositories_added" ||
      action === "repositories_removed"
    ) {
      logger.info('Syncing repositories for installation', { installationId });

      const syncStart = Date.now();
      const syncResult = await syncRepositoriesForInstallation({
        db,
        env: c.env,
        installationId,
        mode: "background",
      });
      const syncDuration = Date.now() - syncStart;

      if (!syncResult.ok) {
        return c.json(
          {
            errorCode: syncResult.errorCode,
            error: syncResult.error,
          },
          500
        );
      }

      logger.info('Installation repositories synced successfully', {
        syncDuration,
        installationId,
        handlerDuration: Date.now() - handlerStart,
      });

      return c.json({
        ok: true,
        message: "Installation repositories synced",
      });
    }

    logger.info('Installation action acknowledged without sync', {
      action,
      handlerDuration: Date.now() - handlerStart,
    });

    return c.json({ ok: true, message: `Installation action ${action} acknowledged` });
  } catch (error) {
    logger.error('Installation event processing failed', error instanceof Error ? error : null, {
      handlerDuration: Date.now() - handlerStart,
    });
    return c.json(
      {
        error: "Failed to process installation event",
        details: getErrorMessage(error instanceof Error ? error : null),
      },
      500
    );
  }
}
