# Copilot Instructions for weather-backend

This repository is a NestJS backend service for a weather application ("小慕天气"). Use this guide to understand the architecture, conventions, and commands.

See [CLAUDE.md](../CLAUDE.md) in the root for detailed command reference and architectural notes.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Environment: Copy `.env.example` to `.env` and configure `DATABASE_URL` (MySQL connection) and auth secrets.

## Commands

| Task | Command | Notes |
|------|---------|-------|
| **Development** | `npm run start:dev` | Hot-reload via NestJS watch |
| **Build** | `npm run build` | Compiles TypeScript to `dist/` |
| **Testing** | `npm test` | Unit tests in `src/**/*.spec.ts` |
| **Single test** | `npx jest src/auth/auth.service.spec.ts` | Run one test file |
| **E2E tests** | `npm run test:e2e` | Tests in `test/**/*.e2e-spec.ts` |
| **Test coverage** | `npm run test:cov` | Coverage report in `coverage/` |
| **Lint & fix** | `npm run lint` | ESLint with auto-fix |
| **Format** | `npm run format` | Prettier for `src/**` and `test/**` |
| **Prisma generate** | `npm run prisma:generate` | After schema changes; regenerates Prisma client |
| **Database migrate** | `npm run prisma:migrate` | Creates migration files and runs pending migrations |

## Architecture Overview

**Stack:** NestJS 11 + TypeScript 5.7 + Prisma 6.17 + MySQL 8

**Module structure:**
```
src/
  app.module.ts               # Root module: wires ConfigModule, PrismaModule, and feature modules
  app.controller.ts           # Health check endpoint
  
  prisma/
    prisma.module.ts          # Global module exporting PrismaService
    prisma.service.ts         # Singleton DB client
  
  auth/
    auth.module.ts            # User registration, login, JWT auth, profile management
    auth.service.ts           # Core auth logic
    auth-token.service.ts     # JWT token generation/validation
    login-geo.service.ts      # IP geolocation for login records
    auth.controller.ts        # Endpoints: /auth/register, /auth/login, /auth/profile, etc.
    dto/                      # DTOs with class-validator decorators
  
  cities/
    cities.module.ts          # City data management
    cities.service.ts         # CRUD operations on city database
    cities.controller.ts      # Endpoints: GET /cities, POST /cities, PUT /cities/:id, DELETE /cities/:id
    dto/
  
  weather/
    weather.module.ts         # Real-time weather data (Open-Meteo API integration)
    weather.service.ts        # Weather fetching and caching logic
    weather.controller.ts     # Endpoints: GET /weather/current, /weather/forecast, etc.
    dto/

prisma/
  schema.prisma               # Database models: User, LoginRecord, RefreshToken, City, UserCity, WeatherSnapshot
```

**Database models:**
- `User` — Login accounts (email, password hash, profile fields: nickname, phone, qq, wechat, avatarUrl)
- `LoginRecord` — Login history with geolocation (account, loginTime, loginAddress, loginDevice)
- `RefreshToken` — Token revocation tracking (tokenHash, expiresAt, revokedAt)
- `City` — Weather locations (cityName, latitude, longitude, province, country)
- `UserCity` — User's favorited cities with sort order and default flag
- `WeatherSnapshot` — Cached weather data (currentJson, hourlyJson, dailyJson, expiresAt)

## Key Patterns & Conventions

### Module Structure
- **PrismaModule** is marked `@Global()` in `src/prisma/prisma.module.ts` — no need to import it in feature modules; `PrismaService` is available everywhere via dependency injection.
- ConfigModule is also global, loaded in `app.module.ts` with `isGlobal: true`.
- Feature modules (Auth, Cities, Weather) import their DTOs and services internally.

### Authentication
- **Scheme:** Stateless JWT Bearer tokens. Login endpoint returns both `accessToken` and `refreshToken`.
- **Implementation:** `AuthTokenService` signs/verifies JWS tokens using `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` env vars.
- **Protected routes:** Inject `AuthGuard('jwt')` on controller methods that require authentication.
- **Optional auth:** Use `@AuthUser()` decorator on route parameters to support both authenticated and anonymous access (passes `null` if no token).

### Data Validation & Transformation
- DTOs use `class-validator` decorators (`@IsEmail()`, `@MinLength()`, etc.) and live in `src/{module}/dto/` directories.
- `ValidationPipe` is configured in `main.ts` with `whitelist: true` (strip unknown properties), `transform: true` (convert primitives), and `enableImplicitConversion: true`.

### Database Operations
- Import `PrismaService` via constructor injection: `constructor(private readonly prisma: PrismaService) {}`
- Follow Prisma query patterns: `this.prisma.user.findUnique()`, `create()`, `update()`, `delete()`, `findMany()`.
- **Error handling:** Catch `Prisma.PrismaClientKnownRequestError` (unique constraint, foreign key, etc.) and wrap as NestJS HTTP exceptions; re-throw NestJS exceptions as-is.

### Password Hashing
- Use `bcryptjs` library: `hash(password, 10)` for storing, `compare(plaintext, hash)` for verification.
- **Never store plain text passwords**; always hash before saving to DB.

### API Response Format
- All endpoints return `{ code: 0, message: string, data: T }` on success.
- NestJS HTTP exceptions are automatically mapped to appropriate status codes (400, 401, 403, 404, 409, 500).
- Use `throw new ConflictException('Email already registered')` for 409, `throw new NotFoundException()` for 404, etc.

### File Uploads
- Avatar images are saved to `uploads/avatars/` directory (configured via `UPLOAD_ROOT` env var).
- Middleware serves uploads as static files at `/uploads/`.
- Enforce file size (max 2 MB) and MIME types (JPEG, PNG, WebP) at the controller layer using `MulterModule`.

### CORS
- Configured in `main.ts` via `app.enableCors()` with origins from `CORS_ORIGINS` env var (defaults: `http://localhost:5173`, `http://127.0.0.1:5173` for Vite).

### Development Data
- `AuthService.onModuleInit()` ensures two demo accounts exist on startup (email: `demo@weather.com` / password: `123456`).
- Cities data is pulled from a Prisma query; weather snapshots cache Open-Meteo API responses.

## Testing

- **Unit tests:** Live in `src/**/*.spec.ts`. Use Jest matchers and `@nestjs/testing` to mock services.
- **E2E tests:** Live in `test/**/*.e2e-spec.ts`. Use Supertest to test HTTP endpoints against a live server instance.
- **Coverage:** Run `npm run test:cov` and check `coverage/` folder.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Prisma client out of date` | Run `npm run prisma:generate` after schema changes. |
| `Database connection fails` | Verify `DATABASE_URL` in `.env`, ensure MySQL server is running, database `weather_backend` exists. |
| `TypeScript errors in IDE` | Run `npm run build` to check compilation; IDE should reflect errors after. |
| `Tests fail with "module not found"` | Ensure `npm install` has completed; check Jest `moduleFileExtensions` and `rootDir` in `package.json`. |
