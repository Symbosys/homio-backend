import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type {
  HttpRequest,
  RouteDefinition,
  ServerContract,
  ServerInstance,
  ServerFramework,
} from '../core/types.ts';
import { isHttpResponseData } from '../core/response.ts';
import { executeHttpPipeline } from '../core/pipeline.ts';
import { formatErrorResponse } from '../core/errors.ts';

export class ElysiaServerAdapter implements ServerContract {
  public readonly framework: ServerFramework = 'elysia';
  private app: Elysia;

  constructor() {
    this.app = new Elysia();
    this.setupGlobalMiddlewares();
  }

  private setupGlobalMiddlewares(): void {
    this.app.use(cors());

    // Standardized Elysia error handling
    this.app.onError(({ code, error, set }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return {
          success: false,
          error: {
            message: 'Route not found',
            code: 'NOT_FOUND',
            statusCode: 404,
          },
        };
      }

      const { statusCode, payload } = formatErrorResponse(error);
      set.status = statusCode;
      return payload;
    });
  }

  public registerRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      const elysiaMethod = route.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete'
        | 'options';

      if (typeof (this.app as any)[elysiaMethod] !== 'function') {
        throw new Error(`Unsupported HTTP method for Elysia: ${route.method}`);
      }

      (this.app as any)[elysiaMethod](route.path, async (ctx: any) => {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(ctx.request.url);
        } catch {
          parsedUrl = new URL('http://localhost' + route.path);
        }

        const appReq: HttpRequest = {
          body: ctx.body ?? {},
          query: (ctx.query as Record<string, any>) ?? {},
          params: (ctx.params as Record<string, any>) ?? {},
          headers: (ctx.headers as Record<string, any>) ?? {},
          method: ctx.request.method,
          url: ctx.request.url,
          path: parsedUrl.pathname,
          ip: ctx.server?.requestIP?.(ctx.request)?.address,
          context: {},
          raw: ctx,
        };

        try {
          const result = await executeHttpPipeline(
            appReq,
            route.middlewares,
            route.handler
          );

          if (isHttpResponseData(result)) {
            ctx.set.status = result.statusCode;
            for (const [key, value] of Object.entries(result.headers)) {
              ctx.set.headers[key] = value;
            }
            return result.body;
          }

          ctx.set.status = 200;
          return result;
        } catch (err) {
          const { statusCode, payload } = formatErrorResponse(err);
          ctx.set.status = statusCode;
          return payload;
        }
      });
    }
  }

  public async listen(port: number, host = '0.0.0.0'): Promise<ServerInstance> {
    this.app.listen({ port, hostname: host });

    return {
      framework: this.framework,
      port,
      nativeApp: this.app,
      server: (this.app as any).server,
      close: async () => {
        await this.app.stop();
      },
    };
  }

  public getNativeApp(): Elysia {
    return this.app;
  }
}
