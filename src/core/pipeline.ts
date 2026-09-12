import type { HttpHandler, HttpMiddleware, HttpRequest } from './types.ts';

/**
 * Executes a chain of framework-agnostic middlewares and the final route handler.
 */
export async function executeHttpPipeline(
  req: HttpRequest,
  middlewares: HttpMiddleware[] = [],
  handler: HttpHandler
): Promise<any> {
  let index = -1;

  async function dispatch(i: number): Promise<any> {
    if (i <= index) {
      throw new Error('next() called multiple times');
    }
    index = i;

    if (i < middlewares.length) {
      const mw = middlewares[i];
      if (!mw) {
        return await dispatch(i + 1);
      }
      return await mw(req, () => dispatch(i + 1));
    }

    return await handler(req);
  }

  return await dispatch(0);
}
