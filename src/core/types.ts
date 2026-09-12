export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type ServerFramework = 'elysia' | 'express';

export interface HttpRequest<
  TBody = any,
  TQuery = Record<string, string | string[] | undefined>,
  TParams = Record<string, string | undefined>,
  THeaders = Record<string, string | string[] | undefined>
> {
  body: TBody;
  query: TQuery;
  params: TParams;
  headers: THeaders;
  method: string;
  url: string;
  path: string;
  ip?: string;
  /** Context storage for middlewares (e.g. authenticated user, request ID) */
  context: Record<string, any>;
  /** Underlying native framework request if ever required */
  raw: unknown;
}

export interface HttpResponseData<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: T;
  isCustomResponse?: boolean;
}

export type HttpHandlerResult<T = any> =
  | HttpResponseData<T>
  | T
  | Promise<HttpResponseData<T> | T>;

export type HttpHandler<TBody = any, TQuery = any, TParams = any, TResult = any> = (
  req: HttpRequest<TBody, TQuery, TParams>
) => HttpHandlerResult<TResult>;

export type NextFunction = () => Promise<any>;

export type HttpMiddleware = (
  req: HttpRequest,
  next: NextFunction
) => Promise<any> | any;

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: HttpHandler;
  middlewares?: HttpMiddleware[];
  description?: string;
  tags?: string[];
}

export interface ServerInstance {
  framework: ServerFramework;
  port: number;
  nativeApp: unknown;
  server: unknown;
  close: () => Promise<void>;
}

export interface ServerContract {
  readonly framework: ServerFramework;
  registerRoutes: (routes: RouteDefinition[]) => void;
  listen: (port: number, host?: string) => Promise<ServerInstance>;
  getNativeApp: () => unknown;
}
