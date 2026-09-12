import { createServerAdapter } from './adapters/index.ts';
import { buildAppRoutes } from './app.routes.ts';
import { config } from './config/index.ts';
import type { ServerFramework, ServerInstance } from './core/types.ts';

export interface CreateServerOptions {
  framework?: ServerFramework;
  port?: number;
  host?: string;
}

export interface AppServer {
  framework: ServerFramework;
  start: () => Promise<ServerInstance>;
  stop: () => Promise<void>;
  getAdapter: () => ReturnType<typeof createServerAdapter>;
}

export function createServer(options: CreateServerOptions = {}): AppServer {
  const selectedFramework = options.framework || config.framework;
  const port = options.port || config.port;
  const host = options.host || config.host;

  const adapter = createServerAdapter(selectedFramework);
  const rootRouter = buildAppRoutes(selectedFramework);
  const flattenedRoutes = rootRouter.getFlattenedRoutes();

  adapter.registerRoutes(flattenedRoutes);

  let runningInstance: ServerInstance | null = null;

  return {
    framework: selectedFramework,
    getAdapter: () => adapter,
    start: async () => {
      runningInstance = await adapter.listen(port, host);
      return runningInstance;
    },
    stop: async () => {
      if (runningInstance) {
        await runningInstance.close();
        runningInstance = null;
      }
    },
  };
}
