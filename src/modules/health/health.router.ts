import { AppRouter } from '../../core/router.ts';
import { HttpResponse } from '../../core/response.ts';
import type { HttpRequest } from '../../core/types.ts';

export function createHealthRouter(framework: string): AppRouter {
  const router = new AppRouter();

  router.get('/', (req: HttpRequest) => {
    return HttpResponse.ok({
      status: 'healthy',
      framework,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  });

  return router;
}
