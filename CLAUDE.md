# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Start with hot reload
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
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
WEATHER_CACHE_MINUTES=10
```

Requires a running MySQL instance. The database `weather_backend` must exist before running migrations.

## Architecture

**Framework:** NestJS (Express platform) with Prisma ORM, MySQL database.

**Module layout:**
- `src/auth/` — Registration, login, profile management, avatar upload, login history, token refresh, password change, account deletion
- `src/cities/` — Global city CRUD (`CitiesService`) + per-user city management (`UserCitiesService`, `UserCitiesController`)
- `src/weather/` — Open-Meteo API integration, weather snapshot caching, reverse geocoding
- `src/common/` — `HttpExceptionFilter` (unified error shape) and `ResponseInterceptor` (auto-wraps success responses)
- `src/prisma/` — Singleton `PrismaService` (global module)

**Authentication:** JWT with rotation. Login returns `accessToken` (2h) + `refreshToken` (7d). `RefreshToken` rows track revocation via `revokedAt`. `OptionalAuthGuard` supports endpoints that work for both anonymous and authenticated users.

**Password hashing:** SHA-256 on legacy accounts, bcrypt for new accounts. On login with a SHA-256 hash, the password is transparently upgraded to bcrypt.

**Cities data:** Persisted in MySQL. `CitiesService.onModuleInit()` seeds 34 Chinese cities with coordinates on startup and repairs any missing coordinate data. Search uses a scoring algorithm (`getCityMatchScore`) for ranked results. `CityResolverService` resolves user input to standardized city metadata; `city-alias.ts` maps common aliases to canonical names.

**User cities:** `UserCitiesService` manages per-user city lists with `sortOrder`, `isDefault`, batch deletion, and automatic default reassignment. Operations use Prisma transactions. Race conditions on city creation are handled by catching P2002 and retrying.

**Weather:** `WeatherProvider` calls Open-Meteo Forecast + Geocoding APIs. `WeatherService` caches responses as `WeatherSnapshot` rows; cache TTL is controlled by `WEATHER_CACHE_MINUTES`. Supports reverse geocoding at `GET /weather/reverse-geocode`.

**File uploads:** Avatar images saved to `uploads/avatars/` at process CWD, served as static files at `/uploads/`. Max 2 MB, JPEG/PNG/WebP only.

**CORS:** Allowed origins are `http://localhost:5173` and `http://127.0.0.1:5173`.

**Response shape:** All endpoints return `{ code: 0, message: string, data: any }` on success via `ResponseInterceptor`. Errors use `HttpExceptionFilter`.

**Demo account:** `AuthService.onModuleInit()` ensures `demo@weather.com` / `123456` exists on every startup.

**Prisma models:** `User`, `LoginRecord` (cascade-deletes with user), `RefreshToken` (tracks revocation), `City` (normalizedName, searchAliases, coordinates), `UserCity` (sortOrder, isDefault; unique on userId+cityId), `WeatherSnapshot` (unique on cityId+source, has expiresAt).

## Key Patterns

- DTOs in `src/auth/dto/` and `src/cities/dto/` use `class-validator`; `ValidationPipe` is configured with `whitelist: true`, `transform: true`, `enableImplicitConversion: true`.
- `PrismaModule` is global — no need to import it in feature modules.
- Services catch Prisma error codes directly (P2002 unique violation, P2025 not found) rather than using a generic wrapper.
- Swagger docs are enabled; decorators are present on controllers.
