import { AppRouter } from './core/router.ts';
import { createHealthRouter } from './modules/health/health.router.ts';
import { createSampleRouter } from './modules/sample/sample.router.ts';
import type { ServerFramework } from './core/types.ts';

export function buildAppRoutes(framework: ServerFramework): AppRouter {
  const rootRouter = new AppRouter();

  // Root welcome endpoint
  rootRouter.get('/', () => ({
    message: 'Homio CRM API Server',
    status: 'online',
    framework,
    docs: '/health',
  }));

  // Mount Health Router
  rootRouter.mount('/health', createHealthRouter(framework));

  // Mount API v1 Routers
  const apiV1Router = new AppRouter('/api/v1');
  apiV1Router.mount('', createSampleRouter());

  // Mount API v1 under root
  rootRouter.mount('', apiV1Router);

  return rootRouter;
}
