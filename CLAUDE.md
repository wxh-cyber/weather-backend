# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Start with hot reload (PowerShell script)
npm run start:prod      # Run compiled output from dist/

# Build
npm run build           # Compile TypeScript via NestJS CLI

# Database
npm run prisma:generate # Regenerate Prisma client after schema changes
npm run prisma:migrate  # Run pending migrations (dev mode, creates migration files)

# Testing
npm test                                          # Run all unit tests (src/**/*.spec.ts)
npx jest src/auth/auth.service.spec.ts            # Run a single test file
npm run test:e2e                                  # End-to-end tests (test/*.e2e-spec.ts)
npm run test:cov                                  # Coverage report

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
WEATHER_CACHE_MINUTES=30
WEATHER_TREND_CACHE_HOURS=24
```

MySQL must be running and the `weather_backend` database must exist before running migrations.

## Architecture

**Framework:** NestJS 11 (Express platform), Prisma 6 ORM, MySQL 8.

**Module layout:**
- [src/auth/](src/auth/) — Registration, login, JWT token rotation, profile management, avatar upload, login history, password change, account deletion
- [src/cities/](src/cities/) — Global city CRUD (`CitiesService`) + per-user city management (`UserCitiesService`, `UserCitiesController`)
- [src/weather/](src/weather/) — Open-Meteo API integration, weather snapshot caching, 90-day climate trend
- [src/common/](src/common/) — `HttpExceptionFilter` (unified error shape) and `ResponseInterceptor` (auto-wraps success responses)
- [src/prisma/](src/prisma/) — Singleton `PrismaService` (global module, no need to import in feature modules)

**Authentication:** JWT with rotation. Login returns `accessToken` (2h) + `refreshToken` (7d). `RefreshToken` rows track revocation via `revokedAt`. `OptionalAuthGuard` supports endpoints that work for both anonymous and authenticated users.

**Password hashing:** SHA-256 on legacy accounts, bcrypt for new accounts. On login with a SHA-256 hash, the password is transparently upgraded to bcrypt in `AuthService.resolveAuthenticatedUser`.

**Cities data:** `CitiesService.onModuleInit()` seeds 34 Chinese cities on startup and repairs any missing coordinate data via geocoding. Search uses `getCityMatchScore` for ranked results. `CityResolverService` resolves user input to standardized city metadata; [city-alias.ts](src/cities/city-alias.ts) maps common aliases to canonical names.

**User cities:** `UserCitiesService` manages per-user city lists with `sortOrder`, `isDefault`, batch deletion, and automatic default reassignment. Operations use Prisma transactions. Race conditions on city creation are handled by catching P2002 and retrying.

**Weather data flow:**
1. Controller receives `cityId`; `WeatherService.getCityOrThrow()` validates the city exists.
2. `getUsableSnapshot()` checks for a non-expired `WeatherSnapshot` row (`source = 'open-meteo'`).
3. On cache miss, `WeatherProvider.fetchForecast()` calls Open-Meteo Forecast + Air Quality APIs in parallel.
4. Response is upserted into `WeatherSnapshot` and returned. On fetch failure, stale cache is returned if available.
5. Cache TTL is controlled by `WEATHER_CACHE_MINUTES` (default 30).

**90-day temperature trend (`GET /weather/trend?period=90`):**
- Calls Open-Meteo Climate API (`climate-api.open-meteo.com/v1/climate`, model `EC_Earth3P_HR`) via `WeatherProvider.fetchClimateForecast`.
- Results are cached in `WeatherSnapshot` with `source = 'open-meteo-climate'`, TTL controlled by `WEATHER_TREND_CACHE_HOURS` (default 24h).
- Response groups days into decade (旬) buckets: 上旬 (1–10), 中旬 (11–20), 下旬 (21–month-end).
- If Climate API fails, falls back to the existing 16-day forecast data with `dataSource: 'forecast'`.
- `period=7/15/30` returns a flat `days` array sliced from the existing forecast snapshot; no extra API call.

**File uploads:** Avatar images saved to `uploads/avatars/` at process CWD, served as static files at `/uploads/`. Max 2 MB, JPEG/PNG/WebP only.

**CORS:** Allowed origins read from `CORS_ORIGINS` env var; defaults to `http://localhost:5173` and `http://127.0.0.1:5173`.

**Response shape:** All endpoints return `{ code: 0, message: string, data: any }` on success via `ResponseInterceptor`. Errors return `{ code, message, data, timestamp, path }` via `HttpExceptionFilter`. Note: service methods currently return `{ code, message, data }` manually; the interceptor wraps this again — do not change this pattern without thorough testing.

**Demo account:** `AuthService.onModuleInit()` ensures `demo@weather.com` / `123456` exists on every startup.

**Prisma models:** `User`, `LoginRecord` (cascade-deletes with user), `RefreshToken` (tracks revocation via `revokedAt`), `City` (normalizedName, searchAliases, coordinates), `UserCity` (sortOrder, isDefault; unique on userId+cityId), `WeatherSnapshot` (unique on cityId+source, has expiresAt).

## Key Patterns

- DTOs use `class-validator`; `ValidationPipe` is configured globally with `whitelist: true`, `transform: true`, `enableImplicitConversion: true`.
- Services catch Prisma error codes directly (P2002 unique violation, P2025 not found) rather than using a generic wrapper.
- `PrismaModule` is global — no need to import it in feature modules.
- Swagger docs at `/api-docs`; decorators are present on controllers.

## Constraints

- **Do not modify** `WeatherProvider.fetchForecast` ([weather.provider.ts:110-296](src/weather/weather.provider.ts#L110-L296)) — short-term forecast path.
- **Do not modify** `WeatherService.getUsableSnapshot` ([weather.service.ts:158-244](src/weather/weather.service.ts#L158-L244)) — cache/fetch/fallback logic shared by all weather endpoints.
- **Do not modify** `CitiesService.onModuleInit` — seeds city data on every startup.
- **Do not modify** `AuthService.resolveAuthenticatedUser` — SHA-256 to bcrypt transparent upgrade.
- **Do not modify the Prisma schema or run migrations** unless the task explicitly requires a database change.
- **Do not mock implementations to make tests pass** — fix the implementation instead.
- **Do not expose Prisma errors to the client** — convert all Prisma exceptions to NestJS HTTP exceptions in the service layer.
