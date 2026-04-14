# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Start with hot reload (watches for changes)
npm run start:prod      # Run compiled output from dist/

# Build
npm run build           # Compile TypeScript via NestJS CLI

# Database
npm run prisma:generate # Regenerate Prisma client after schema changes
npm run prisma:migrate  # Run pending migrations (dev mode, creates migration files)

# Testing
npm test                # Run all unit tests (*.spec.ts in src/)
npm run test:e2e        # Run end-to-end tests (test/*.e2e-spec.ts)
npm run test:cov        # Run tests with coverage report
npx jest src/auth/auth.service.spec.ts   # Run a single test file

# Code quality
npm run lint            # ESLint with auto-fix
npm run format          # Prettier format
```

## Environment Setup

Copy `.env.example` to `.env` and configure:
```
DATABASE_URL="mysql://root:password@localhost:3306/weather_backend"
PORT=3000
```

Requires a running MySQL instance. The database `weather_backend` must exist before running migrations.

## Architecture

**Framework:** NestJS (Express platform) with Prisma ORM, MySQL database.

**Module layout:**
- `src/auth/` — User registration, login, profile management (`nickname`, `phone`, `qq`, `wechat`), avatar upload, login history (`GET /auth/login-records`)
- `src/cities/` — City weather listing with keyword search
- `src/prisma/` — Singleton `PrismaService` (global module, injected everywhere)
- `src/app.module.ts` — Root module wiring: `ConfigModule` (global), `PrismaModule`, `AuthModule`, `CitiesModule`

**Authentication:** Stateless mock-token scheme — login returns `mock-token-{userId}`, subsequent requests pass it as `Authorization: Bearer mock-token-{userId}`. `AuthService.resolveUserFromAuthHeader()` decodes the userId and looks it up in DB. No JWT library is used.

**Password hashing:** SHA-256 via Node.js built-in `crypto.createHash`.

**Cities data:** In-memory mock data built in `CitiesService` constructor using a hardcoded list of 34 Chinese cities with randomly assigned weather. Changes (CRUD) mutate the in-memory array only — data resets on restart. Endpoints: `GET /cities?keyword=` (filter by substring), `POST /cities` (add), `PUT /cities/:cityName` (rename), `DELETE /cities/:cityName` (remove).

**File uploads:** Avatar images saved to `uploads/avatars/` at process CWD, served as static files at `/uploads/`. Max 2 MB, JPEG/PNG/WebP only.

**CORS:** Allowed origins are `http://localhost:5173` and `http://127.0.0.1:5173` (Vite dev server default).

**Response shape:** All endpoints return `{ code: 0, message: string, data: any }` on success. HTTP status codes map NestJS exceptions on error.

**Demo account:** On every startup, `AuthService.onModuleInit()` ensures `demo@weather.com` / `123456` exists.

**Prisma models:** `User` (userId CUID PK, email unique) and `LoginRecord` (records each login with IP/device, cascade-deletes with user).

## Key Patterns

- DTOs live in `src/auth/dto/` and `src/cities/dto/`, using `class-validator` decorators; `ValidationPipe` is configured with `whitelist: true`, `transform: true`, and `enableImplicitConversion: true`.
- `PrismaModule` is global — no need to import it in feature modules.
- Error handling in services uses a private `handlePrismaError()` pattern: re-throw NestJS HTTP exceptions as-is, wrap Prisma errors as 500.
