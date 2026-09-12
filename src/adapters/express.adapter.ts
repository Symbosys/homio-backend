import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import type { Server } from 'http';
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

export class ExpressServerAdapter implements ServerContract {
  public readonly framework: ServerFramework = 'express';
  private app: Express;
  private serverInstance: Server | null = null;

  constructor() {
    this.app = express();
    this.setupGlobalMiddlewares();
  }

  private setupGlobalMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  public registerRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      const expressMethod = route.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete'
        | 'options'
        | 'head';

      if (typeof (this.app as any)[expressMethod] !== 'function') {
        throw new Error(`Unsupported HTTP method for Express: ${route.method}`);
      }

      (this.app as any)[expressMethod](
        route.path,
        async (req: Request, res: Response, next: NextFunction) => {
          const appReq: HttpRequest = {
            body: req.body ?? {},
            query: (req.query as Record<string, any>) ?? {},
            params: (req.params as Record<string, any>) ?? {},
            headers: (req.headers as Record<string, any>) ?? {},
            method: req.method,
            url: req.originalUrl || req.url,
            path: req.path,
            ip: req.ip || req.socket.remoteAddress,
            context: {},
            raw: req,
          };

          try {
            const result = await executeHttpPipeline(
              appReq,
              route.middlewares,
              route.handler
            );

            if (res.headersSent) return;

            if (isHttpResponseData(result)) {
              for (const [key, value] of Object.entries(result.headers)) {
                res.setHeader(key, value);
              }
              if (result.statusCode === 204 || result.body === null) {
                res.status(result.statusCode).end();
              } else {
                res.status(result.statusCode).json(result.body);
              }
            } else {
              res.status(200).json(result);
            }
          } catch (err) {
            const { statusCode, payload } = formatErrorResponse(err);
            if (!res.headersSent) {
              res.status(statusCode).json(payload);
            }
          }
        }
      );
    }

    // 404 handler for unmapped routes
    this.app.use((req: Request, res: Response) => {
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: 'NOT_FOUND',
            statusCode: 404,
          },
        });
      }
    });

    // Global Express error handler fallback
    this.app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const { statusCode, payload } = formatErrorResponse(err);
      if (!res.headersSent) {
        res.status(statusCode).json(payload);
      }
    });
  }

  public async listen(port: number, host = '0.0.0.0'): Promise<ServerInstance> {
    return new Promise((resolve) => {
      this.serverInstance = this.app.listen(port, host, () => {
        resolve({
          framework: this.framework,
          port,
          nativeApp: this.app,
          server: this.serverInstance,
          close: async () => {
            return new Promise<void>((resClose, rejClose) => {
              if (this.serverInstance) {
                this.serverInstance.close((err) => {
                  if (err) rejClose(err);
                  else resClose();
                });
              } else {
                resClose();
              }
            });
          },
        });
      });
    });
  }

  public getNativeApp(): Express {
    return this.app;
  }
}
