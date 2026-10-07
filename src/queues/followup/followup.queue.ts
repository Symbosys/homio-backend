import { createQueue } from "../../lib/queue/index.js";

export const FOLLOWUP_EXECUTION_QUEUE_NAME = "followup-execution-queue";

export interface FollowUpJobData {
  organizationId?: string;
  enrollmentId?: string;
  triggeredAt: string;
}

/**
 * Returns the BullMQ Queue instance for Auto Follow-Up executions.
 */
export function getFollowUpQueue() {
  return createQueue<FollowUpJobData>(FOLLOWUP_EXECUTION_QUEUE_NAME, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        count: 500,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 1000,
        age: 7 * 24 * 3600,
      },
    },
  });
}

/**
 * Enqueues a batch execution job for due follow-up enrollments.
 */
export async function enqueueFollowUpBatchJob(data: FollowUpJobData = { triggeredAt: new Date().toISOString() }) {
  const queue = getFollowUpQueue();
  return queue.add("process-due-followups", data);
}
