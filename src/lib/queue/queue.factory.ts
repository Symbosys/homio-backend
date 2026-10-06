import {
  Queue,
  Worker,
  type Processor,
  type QueueOptions,
  type WorkerOptions,
  type JobsOptions,
} from "bullmq";
import { getRedisConnection, getSharedRedisConnection } from "./redis.connection.js";

// Global registry for graceful application shutdowns
const registeredQueues = new Map<string, Queue>();
const registeredWorkers = new Map<string, Worker>();

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600, // 7 days
  },
};

/**
 * Creates and registers a BullMQ Queue with default enterprise retry policies and shared Redis connection.
 *
 * @param name - Name of the queue (e.g. "whatsapp-webhook", "ai-reply", "email-notifications")
 * @param customOptions - Optional custom QueueOptions override
 */
export function createQueue<TData = any, TResult = any>(
  name: string,
  customOptions?: Partial<QueueOptions>,
): Queue<TData, TResult> {
  if (registeredQueues.has(name)) {
    return registeredQueues.get(name) as Queue<TData, TResult>;
  }

  const connection = customOptions?.connection || getSharedRedisConnection();

  const queue = new Queue<TData, TResult>(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
    ...customOptions,
  });

  queue.on("error", (err) => {
    console.error(`[BullMQ Queue Error] [${name}]:`, err.message);
  });

  registeredQueues.set(name, queue);
  return queue;
}

/**
 * Creates and registers a BullMQ Worker with isolated Redis connection, concurrency control,
 * and standard event logging for monitoring.
 *
 * @param name - Name of the queue to consume
 * @param processor - Async processing function for jobs
 * @param customOptions - Optional WorkerOptions override (concurrency, rate limits)
 */
export function createWorker<TData = any, TResult = any>(
  name: string,
  processor: Processor<TData, TResult>,
  customOptions?: Partial<WorkerOptions>,
): Worker<TData, TResult> {
  // Workers require dedicated Redis connections for blocking pop operations
  const connection = customOptions?.connection || getRedisConnection();

  const worker = new Worker<TData, TResult>(name, processor, {
    connection,
    concurrency: customOptions?.concurrency || 10,
    ...customOptions,
  });

  worker.on("completed", (job) => {
    console.log(`[BullMQ Worker] [${name}] Job #${job.id} (${job.name}) completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[BullMQ Worker] [${name}] Job #${job?.id} (${job?.name}) FAILED (Attempt ${job?.attemptsMade}/${job?.opts.attempts || 3}):`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error(`[BullMQ Worker Error] [${name}]:`, err.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[BullMQ Worker Stalled] [${name}] Job #${jobId} stalled and will be reprocessed.`);
  });

  registeredWorkers.set(name, worker);
  return worker;
}

/**
 * Gracefully pauses and closes all registered queues and workers during server shutdown.
 */
export async function closeAllQueuesAndWorkers(): Promise<void> {
  console.log("[BullMQ] Closing all workers and queues...");

  const workerPromises = Array.from(registeredWorkers.values()).map(async (worker) => {
    try {
      await worker.close();
    } catch (err: any) {
      console.warn(`[BullMQ] Error closing worker ${worker.name}:`, err.message);
    }
  });

  const queuePromises = Array.from(registeredQueues.values()).map(async (queue) => {
    try {
      await queue.close();
    } catch (err: any) {
      console.warn(`[BullMQ] Error closing queue ${queue.name}:`, err.message);
    }
  });

  await Promise.all([...workerPromises, ...queuePromises]);
  registeredWorkers.clear();
  registeredQueues.clear();
  console.log("[BullMQ] All workers and queues closed successfully.");
}
