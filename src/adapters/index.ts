import type { ServerContract, ServerFramework } from '../core/types.ts';
import { ExpressServerAdapter } from './express.adapter.ts';
import { ElysiaServerAdapter } from './elysia.adapter.ts';

export * from './express.adapter.ts';
export * from './elysia.adapter.ts';

export function createServerAdapter(framework: ServerFramework): ServerContract {
  switch (framework.toLowerCase()) {
    case 'express':
      return new ExpressServerAdapter();
    case 'elysia':
      return new ElysiaServerAdapter();
    default:
      throw new Error(
        `Unsupported framework "${framework}". Supported frameworks are: "elysia", "express"`
      );
  }
}
