import { createLogger, Logger } from "../utils/logger";
import { ErrorCodes, Result } from "../utils/error";

/**
 * Cloudflare Queues service for background job processing
 */

export type QueueJobData = {
  repositoryId: string;
  prNumber: string;
  eventId: string;
  correlationId: string;
};

export type QueueJob = {
  type: 'pr_review';
  data: QueueJobData;
  timestamp: number;
};

/**
 * Send a job to the Cloudflare Queue
 */
export async function sendToQueue(
  env: Env,
  jobType: 'pr_review',
  data: QueueJobData,
  logger: Logger
): Promise<void> {
  const job: QueueJob = {
    type: jobType,
    data: {
      ...data,
      correlationId: logger.correlationId,
    },
    timestamp: Date.now(),
  };

  logger.info('Sending job to Cloudflare Queue', {
    jobType,
    repositoryId: data.repositoryId,
    prNumber: data.prNumber,
  });

  try {
    await env.PR_REVIEW_QUEUE.send(job);
    logger.info('Job sent to queue successfully');
  } catch (error) {
    logger.error('Failed to send job to queue', error instanceof Error ? error : null);
    throw error;
  }
}

/**
 * Process jobs from the Cloudflare Queue
 * This function is called by the queue consumer
 */
export async function processQueueJob(
  env: Env,
  job: QueueJob
): Promise<Result<null>> {
  const logger = createLogger({
    correlationId: job.data.correlationId,
    operation: 'queue_processor',
    jobType: job.type,
    repositoryId: job.data.repositoryId,
    prNumber: job.data.prNumber,
  });

  logger.info('Processing queue job', {
    jobType: job.type,
    queueTime: Date.now() - job.timestamp,
  });

  try {
    const reviewResult = await processPRReviewJob(env, job.data, logger);

    if (!reviewResult.ok) {
      logger.error('Queue job failed', { errorCode: reviewResult.errorCode, error: reviewResult.error });
      return reviewResult;
    }

    logger.info('Queue job completed successfully');
    return { ok: true, data: null } as const;
  } catch (error) {
    logger.error('Queue job failed', error instanceof Error ? error : null);
    return {
      ok: false,
      errorCode: ErrorCodes.PR_REVIEW_FAILED,
      error: error instanceof Error ? error.message : "Unexpected queue job error",
    } as const;
  }
}

/**
 * Process a PR review job
 */
async function processPRReviewJob(
  env: Env,
  data: QueueJobData,
  logger: Logger
): Promise<Result<null>> {
  const { performPullRequestReviewInternal } = await import("../features/prReview");
  const { connectDb } = await import("../features/db/connect");

  logger.info('Starting PR review processing');

  const db = connectDb({ env });

  return performPullRequestReviewInternal({
    db,
    env,
    repositoryId: data.repositoryId,
    prNumber: data.prNumber,
    eventId: data.eventId,
  }, logger);
}
