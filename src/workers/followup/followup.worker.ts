import type { Job } from "bullmq";
import { createWorker } from "../../lib/queue/index.js";
import {
  FOLLOWUP_EXECUTION_QUEUE_NAME,
  type FollowUpJobData,
  enqueueFollowUpBatchJob,
} from "../../queues/followup/followup.queue.js";
import { autoFollowUpService } from "../../module/auto-followup/services/auto-followup.service.js";

let pollerInterval: NodeJS.Timeout | null = null;

/**
 * Follow-Up Batch Worker
 * Processes queued follow-up execution jobs across all tenants.
 */
export async function processFollowUpJob(_job: Job<FollowUpJobData>): Promise<void> {
  console.log(`[Follow-Up Worker] Processing due follow-up enrollments batch...`);
  try {
    const results = await autoFollowUpService.processDueEnrollments(50);
    if (results.processed > 0) {
      console.log(
        `[Follow-Up Worker] Processed ${results.processed} enrollments (Leads: ${results.leadExecutions}, Meetings: ${results.meetingExecutions}, Errors: ${results.errors.length})`,
      );
    }
  } catch (err: any) {
    console.error(`[Follow-Up Worker] Error processing batch:`, err.message);
    throw err;
  }
}

/**
 * Starts the Auto Follow-Up BullMQ worker and interval poller.
 */
export function startFollowUpWorker() {
  const worker = createWorker<FollowUpJobData>(
    FOLLOWUP_EXECUTION_QUEUE_NAME,
    processFollowUpJob,
    {
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[Follow-Up Worker] Job #${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Follow-Up Worker] Job #${job?.id} failed:`, err.message);
  });

  // Start 1-minute interval poller to queue batches
  if (!pollerInterval) {
    pollerInterval = setInterval(async () => {
      try {
        await enqueueFollowUpBatchJob({ triggeredAt: new Date().toISOString() });
      } catch {
        // In local/fallback mode without Redis, execute directly
        try {
          await autoFollowUpService.processDueEnrollments(50);
        } catch (directErr: any) {
          console.error(`[Follow-Up Direct Poller] Error:`, directErr.message);
        }
      }
    }, 60 * 1000); // Every 1 minute
  }

  return worker;
}

/**
 * Stops the interval poller.
 */
export function stopFollowUpWorker() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}
