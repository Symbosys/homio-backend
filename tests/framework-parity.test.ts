import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createServer } from '../src/server.ts';

describe('Express and Elysia Server Framework Parity', () => {
  const expressPort = 4101;
  const elysiaPort = 4102;

  const expressServer = createServer({ framework: 'express', port: expressPort });
  const elysiaServer = createServer({ framework: 'elysia', port: elysiaPort });

  beforeAll(async () => {
    await expressServer.start();
    await elysiaServer.start();
  });

  afterAll(async () => {
    await expressServer.stop();
    await elysiaServer.stop();
  });

  const targets = [
    { name: 'Express', baseUrl: `http://localhost:${expressPort}` },
    { name: 'Elysia', baseUrl: `http://localhost:${elysiaPort}` },
  ];

  for (const target of targets) {
    describe(`${target.name} Framework Implementation`, () => {
      it('GET / returns root welcome response', async () => {
        const res = await fetch(`${target.baseUrl}/`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('online');
        expect(data.framework.toLowerCase()).toBe(target.name.toLowerCase());
      });

      it('GET /health returns health info', async () => {
        const res = await fetch(`${target.baseUrl}/health`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('healthy');
        expect(data.framework.toLowerCase()).toBe(target.name.toLowerCase());
        expect(typeof data.uptime).toBe('number');
      });

      it('GET /api/v1/items returns items list', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.total).toBeGreaterThanOrEqual(2);
        expect(Array.isArray(data.items)).toBe(true);
      });

      it('GET /api/v1/items with query search filters items', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items?search=enterprise`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.total).toBe(1);
        expect(data.items[0].name).toContain('Enterprise');
      });

      it('GET /api/v1/items/:id returns single item', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items/1`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.id).toBe('1');
      });

      it('GET /api/v1/items/:id returns 404 for missing item', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items/99999`);
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');
        expect(data.error.statusCode).toBe(404);
      });

      it('POST /api/v1/items validates body and returns 400 for bad request', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: -10 }), // missing name and negative price
        });
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('BAD_REQUEST');
      });

      it('POST /api/v1/items creates item and returns 201 Created', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `New CRM Tier ${target.name}`, price: 150 }),
        });
        expect(res.status).toBe(201);
        const data = await res.json() as any;
        expect(data.name).toBe(`New CRM Tier ${target.name}`);
        expect(data.price).toBe(150);
        expect(data.id).toBeDefined();
      });

      it('GET /api/v1/items/secure/profile returns 401 without auth header', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items/secure/profile`);
        expect(res.status).toBe(401);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
      });

      it('GET /api/v1/items/secure/profile returns 200 with valid bearer token', async () => {
        const res = await fetch(`${target.baseUrl}/api/v1/items/secure/profile`, {
          headers: {
            Authorization: 'Bearer secret-crm-token',
          },
        });
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.message).toBe('Access granted to secure resource');
        expect(data.user.role).toBe('admin');
      });

      it('GET /unmapped-route returns standard 404', async () => {
        const res = await fetch(`${target.baseUrl}/non-existent-random-route`);
        expect(res.status).toBe(404);
        const data = await res.json() as any;
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');
      });
    });
  }
});
