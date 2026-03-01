import { getHono } from "./utils/hono";
import { authEndpoint } from "./endpoints/auth";
import { githubEndpoint } from "./endpoints/github";
import { installationsEndpoint } from "./endpoints/installations";
import { repositoriesEndpoint } from "./endpoints/repositories";
import { webhooksEndpoint } from "./endpoints/webhooks";
import { eventsEndpoint } from "./endpoints/events";
import { prReviewsEndpoint } from "./endpoints/prReviews";
import { cors } from "hono/cors";
import { processQueueJob, QueueJob } from "./services/queue";
import { createLogger, generateCorrelationId } from "./utils/logger";

// Start a Hono app
const app = getHono();

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Frontend origins
    allowHeaders: ["Content-Type", "Authorization", "X-GitHub-Event", "X-GitHub-Delivery", "X-Hub-Signature-256"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Webhooks, auth callbacks, and GitHub App callbacks are public.
app.route("api/v1/auth", authEndpoint);
app.route("api/v1/github", githubEndpoint);
app.route("api/v1/webhooks", webhooksEndpoint);

app.route("api/v1/repositories", repositoriesEndpoint);
app.route("api/v1/installations", installationsEndpoint);
app.route("api/v1/events", eventsEndpoint);
app.route("api/v1/pr-reviews", prReviewsEndpoint);

// Export both fetch (Hono) and queue handlers as default export
// Cloudflare Workers requires all handlers to be in the default export object
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueJob>, env: Env) {
    for (const message of batch.messages) {
      const logger = createLogger({
        correlationId: message.body.data.correlationId || generateCorrelationId(),
        operation: "worker_queue_handler",
        repositoryId: message.body.data.repositoryId,
        prNumber: message.body.data.prNumber,
      });

      try {
        const result = await processQueueJob(env, message.body);

        if (!result.ok) {
          logger.error("Queue message processing failed", {
            errorCode: result.errorCode,
            error: result.error,
          });
          message.retry();
          continue;
        }

        message.ack();
      } catch (error) {
        logger.error(
          "Queue message processing failed",
          error instanceof Error ? error : null
        );
        message.retry();
      }
    }
  }
};
