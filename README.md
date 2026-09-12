# Homio CRM Server - Dual Framework Architecture (Express & Elysia)

This server is designed using a **Hexagonal / Ports-and-Adapters** architecture, enabling you to switch seamlessly between **Elysia** and **Express** at any time without modifying any business logic, controllers, or route definitions—no matter how large the application grows.

---

## 🚀 How to Switch Frameworks

You can switch the active engine in three different ways:

### 1. Via NPM / Bun Scripts
```bash
# Run with Elysia (high-performance Web API standard)
bun run dev:elysia

# Run with Express (battle-tested Node ecosystem)
bun run dev:express
```

### 2. Via CLI Flag
```bash
bun run src/index.ts --framework=express --port=3001
bun run src/index.ts --framework=elysia --port=3001
```

### 3. Via Environment Variable (`.env`)
In `server/.env`:
```env
# Set to "elysia" or "express"
FRAMEWORK=elysia
PORT=3001
```

---

## 🏗️ Architecture Overview

```
                        ┌────────────────────────┐
                        │      Entry Point       │
                        │      src/index.ts      │
                        └───────────┬────────────┘
                                    │
                     Framework Factory (src/server.ts)
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
       ┌─────────────────┐                     ┌─────────────────┐
       │ Elysia Adapter  │                     │ Express Adapter │
       └────────┬────────┘                     └────────┬────────┘
                │                                       │
                └───────────────────┬───────────────────┘
                                    │
                         Implements ServerContract
                                    │
                ┌───────────────────▼───────────────────┐
                │        Core HTTP Abstraction          │
                │  - AppRouter (Hierarchical routing)   │
                │  - HttpRequest & HttpResponse         │
                │  - Async Middleware Pipeline          │
                │  - Standard Error Hierarchy           │
                └───────────────────┬───────────────────┘
                                    │
                                    ▼
                         ┌───────────────────────┐
                         │    Domain Modules     │
                         │  - Health Module      │
                         │  - Feature Modules    │
                         │    (Leads, CRM, etc.) │
                         └───────────────────────┘
```

---

## 📁 Directory Structure

```
server/
├── src/
│   ├── adapters/               # Framework adapters implementing ServerContract
│   │   ├── elysia.adapter.ts   # Elysia adapter (routes, plugins, error handlers)
│   │   ├── express.adapter.ts  # Express adapter (routes, middlewares, error handlers)
│   │   └── index.ts            # Adapter factory
│   │
│   ├── config/                 # Environment and CLI configuration loader
│   │   └── index.ts
│   │
│   ├── core/                   # Framework-agnostic foundation (Ports)
│   │   ├── types.ts            # HttpRequest, HttpResponse, Handler, Middleware types
│   │   ├── response.ts         # Response helpers (HttpResponse.ok, HttpResponse.created, etc.)
│   │   ├── router.ts           # AppRouter supporting prefix mounting and grouping
│   │   ├── errors.ts           # Standard errors (BadRequestError, NotFoundError, etc.)
│   │   ├── pipeline.ts         # Middleware onion execution pipeline
│   │   └── index.ts            # Core barrel export
│   │
│   ├── modules/                # Feature modules (Domain logic & Controllers)
│   │   ├── health/             # Health check module
│   │   └── sample/             # Sample CRUD module with auth middleware & validation
│   │
│   ├── app.routes.ts           # Central router assembling all feature modules
│   ├── server.ts               # Server bootstrap & lifecycle factory
│   └── index.ts                # Application entry point with graceful shutdown
│
├── tests/
│   └── framework-parity.test.ts # Automated test suite running against BOTH frameworks
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🛠️ How to Add a New Feature Module (Scalable Pattern)

When adding new domain features (e.g., `deals`, `contacts`, `pipelines`), you only write standard TypeScript code:

### 1. Define your module router (`src/modules/contacts/contacts.router.ts`)
```typescript
import { AppRouter, HttpResponse, HttpRequest, BadRequestError, NotFoundError } from '../../core';

export function createContactsRouter(): AppRouter {
  const router = new AppRouter('/contacts');

  // GET /api/v1/contacts
  router.get('/', async (req: HttpRequest) => {
    return HttpResponse.ok({ contacts: [] });
  });

  // POST /api/v1/contacts
  router.post('/', async (req: HttpRequest) => {
    const { name, email } = req.body || {};
    if (!name || !email) {
      throw new BadRequestError('Name and email are required');
    }
    return HttpResponse.created({ id: 'cnt_1', name, email });
  });

  return router;
}
```

### 2. Register it in `src/app.routes.ts`
```typescript
import { createContactsRouter } from './modules/contacts/contacts.router.ts';

// Inside buildAppRoutes():
apiV1Router.mount('', createContactsRouter());
```

That's it! Both Express and Elysia will automatically serve your new endpoints with:
- Unified error handling (`BadRequestError`, `NotFoundError`, etc. -> JSON payload with correct status code)
- Unified CORS and body parsing
- Full parameter (`:id`), query (`?key=val`), and body support

---

## 🧪 Testing Parity

Run the automated parity test suite to verify that Express and Elysia produce 100% identical responses, error codes, and headers across all endpoints:

```bash
bun test
```
