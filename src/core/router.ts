import type { HttpHandler, HttpMiddleware, HttpMethod, RouteDefinition } from './types.ts';

type MiddlewareOrHandler = HttpMiddleware | HttpHandler;

export class AppRouter {
  private _prefix: string;
  private _routes: RouteDefinition[] = [];
  private _middlewares: HttpMiddleware[] = [];
  private _subRouters: { prefix: string; router: AppRouter }[] = [];

  constructor(prefix = '') {
    this._prefix = this.normalizePath(prefix);
  }

  public get prefix(): string {
    return this._prefix;
  }

  /**
   * Add middleware that runs for all routes in this router and sub-routers
   */
  public use(...middlewares: HttpMiddleware[]): this {
    this._middlewares.push(...middlewares);
    return this;
  }

  /**
   * Mount a child sub-router under a path prefix
   */
  public mount(prefix: string, subRouter: AppRouter): this {
    this._subRouters.push({
      prefix: this.normalizePath(prefix),
      router: subRouter,
    });
    return this;
  }

  /**
   * Group routes under a sub-path using a callback function
   */
  public group(prefix: string, callback: (router: AppRouter) => void): this {
    const subRouter = new AppRouter();
    callback(subRouter);
    this.mount(prefix, subRouter);
    return this;
  }

  public get(path: string, ...handlers: MiddlewareOrHandler[]): this {
    return this.addRoute('GET', path, handlers);
  }

  public post(path: string, ...handlers: MiddlewareOrHandler[]): this {
    return this.addRoute('POST', path, handlers);
  }

  public put(path: string, ...handlers: MiddlewareOrHandler[]): this {
    return this.addRoute('PUT', path, handlers);
  }

  public patch(path: string, ...handlers: MiddlewareOrHandler[]): this {
    return this.addRoute('PATCH', path, handlers);
  }

  public delete(path: string, ...handlers: MiddlewareOrHandler[]): this {
    return this.addRoute('DELETE', path, handlers);
  }

  private addRoute(method: HttpMethod, path: string, handlers: MiddlewareOrHandler[]): this {
    if (handlers.length === 0) {
      throw new Error(`Route ${method} ${path} must have at least one handler`);
    }

    const handler = handlers[handlers.length - 1] as HttpHandler;
    const middlewares = handlers.slice(0, -1) as HttpMiddleware[];

    this._routes.push({
      method,
      path: this.normalizePath(path),
      handler,
      middlewares,
    });

    return this;
  }

  /**
   * Recursively flatten all routes and prefix them properly
   */
  public getFlattenedRoutes(parentPrefix = '', inheritedMiddlewares: HttpMiddleware[] = []): RouteDefinition[] {
    const currentPrefix = this.combinePaths(parentPrefix, this._prefix);
    const currentMiddlewares = [...inheritedMiddlewares, ...this._middlewares];
    const result: RouteDefinition[] = [];

    // Flatten direct routes
    for (const route of this._routes) {
      result.push({
        method: route.method,
        path: this.combinePaths(currentPrefix, route.path),
        handler: route.handler,
        middlewares: [...currentMiddlewares, ...(route.middlewares ?? [])],
        description: route.description,
        tags: route.tags,
      });
    }

    // Flatten mounted sub-routers
    for (const sub of this._subRouters) {
      const subPrefix = this.combinePaths(currentPrefix, sub.prefix);
      const subRoutes = sub.router.getFlattenedRoutes(subPrefix, currentMiddlewares);
      result.push(...subRoutes);
    }

    return result;
  }

  private normalizePath(path: string): string {
    if (!path || path === '/') return '';
    let p = path.trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }

  private combinePaths(parent: string, child: string): string {
    const p = parent.replace(/\/+$/, '');
    const c = child.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!p && !c) return '/';
    if (!p) return `/${c}`;
    if (!c) return p;
    return `${p}/${c}`;
  }
}
