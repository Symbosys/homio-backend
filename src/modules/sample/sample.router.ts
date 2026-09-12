import { AppRouter } from '../../core/router.ts';
import { HttpResponse } from '../../core/response.ts';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../core/errors.ts';
import type { HttpMiddleware, HttpRequest } from '../../core/types.ts';

// Simulated database entity
interface Item {
  id: string;
  name: string;
  price: number;
  createdAt: string;
}

const itemsDb = new Map<string, Item>([
  ['1', { id: '1', name: 'Standard Subscription', price: 99, createdAt: new Date().toISOString() }],
  ['2', { id: '2', name: 'Enterprise CRM License', price: 499, createdAt: new Date().toISOString() }],
]);

/**
 * Example framework-agnostic Authentication Middleware
 */
export const authMiddleware: HttpMiddleware = async (req, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || (Array.isArray(authHeader) ? authHeader[0] : authHeader) !== 'Bearer secret-crm-token') {
    throw new UnauthorizedError('Missing or invalid authorization token');
  }

  // Set user context
  req.context.user = {
    id: 'user_123',
    role: 'admin',
    email: 'admin@homiocrm.com',
  };

  return await next();
};

export function createSampleRouter(): AppRouter {
  const router = new AppRouter('/items');

  // GET /api/v1/items
  router.get('/', (req: HttpRequest) => {
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : undefined;
    let list = Array.from(itemsDb.values());

    if (search) {
      list = list.filter((item) => item.name.toLowerCase().includes(search));
    }

    return HttpResponse.ok({
      total: list.length,
      items: list,
    });
  });

  // Protected route: GET /api/v1/items/secure/profile
  router.get('/secure/profile', authMiddleware, (req: HttpRequest) => {
    return HttpResponse.ok({
      message: 'Access granted to secure resource',
      user: req.context.user,
    });
  });

  // GET /api/v1/items/:id
  router.get('/:id', (req: HttpRequest) => {
    const id = req.params.id;
    if (!id || !itemsDb.has(id)) {
      throw new NotFoundError(`Item with ID "${id}" was not found`);
    }

    return HttpResponse.ok(itemsDb.get(id));
  });

  // POST /api/v1/items
  router.post('/', (req: HttpRequest) => {
    const { name, price } = req.body || {};

    if (!name || typeof name !== 'string') {
      throw new BadRequestError('Item "name" is required and must be a string');
    }
    if (price === undefined || typeof price !== 'number' || price < 0) {
      throw new BadRequestError('Item "price" must be a positive number');
    }

    const newItem: Item = {
      id: String(itemsDb.size + 1),
      name: name.trim(),
      price,
      createdAt: new Date().toISOString(),
    };

    itemsDb.set(newItem.id, newItem);

    return HttpResponse.created(newItem);
  });

  // DELETE /api/v1/items/:id
  router.delete('/:id', (req: HttpRequest) => {
    const id = req.params.id;
    if (!id || !itemsDb.has(id)) {
      throw new NotFoundError(`Item with ID "${id}" does not exist to delete`);
    }

    itemsDb.delete(id);
    return HttpResponse.ok({
      success: true,
      message: `Item ${id} successfully deleted`,
    });
  });

  return router;
}
