import { Redis, type RedisOptions } from "ioredis";
import { ENV } from "../../config/env.js";

let sharedRedisConnection: Redis | null = null;

/**
 * Returns a configured ioredis instance optimized for BullMQ queues and workers.
 * Ensures `maxRetriesPerRequest: null` and graceful reconnect handling.
 */
export function getRedisConnection(customOptions: Partial<RedisOptions> = {}): Redis {
  const options: RedisOptions = {
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
    password: ENV.REDIS_PASSWORD,
    db: ENV.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy(times) {
      // Exponential backoff with max 3000ms delay
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
      return targetErrors.some((target) => err.message.includes(target));
    },
    ...customOptions,
  };

  const redis = new Redis(options);

  redis.on("error", (err: Error) => {
    // Avoid unhandled crash on transient redis connectivity blips
    console.warn(`[Redis Connection Warning] (${ENV.REDIS_HOST}:${ENV.REDIS_PORT}):`, err.message);
  });

  return redis;
}

/**
 * Returns the singleton shared connection for lightweight queue publishing.
 */
export function getSharedRedisConnection(): Redis {
  if (!sharedRedisConnection) {
    sharedRedisConnection = getRedisConnection();
  }
  return sharedRedisConnection;
}
