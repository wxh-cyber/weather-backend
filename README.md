# 小慕天气后端项目

## 项目简介

`weather-backend` 是“小慕天气”系统的后端服务，基于 `NestJS + Prisma + MySQL` 构建，当前已从早期联调版演进为具备认证、用户资料、城市管理、用户城市、真实天气拉取与缓存能力的毕业设计后端。项目同时提供 Swagger 文档，便于前后端联调与答辩展示。

## 技术栈

- `NestJS`
- `TypeScript`
- `Prisma`
- `MySQL`
- `class-validator`
- `class-transformer`
- `bcryptjs`
- `jsonwebtoken`
- `Swagger`
- `Jest`

## 当前能力

- 用户注册、登录、刷新令牌、登出
- 基于 `Bearer Token` 的受保护接口访问
- 个人资料查询与更新
- 头像上传与静态资源访问
- 登录记录写入与查询
- 城市基础信息查询与维护
- 用户关注城市列表维护、默认城市设置
- 真实天气数据拉取：
  - 当前天气
  - 小时级预报
  - 多日预报
- 天气数据缓存与快照持久化
- Swagger 接口文档与统一响应包装

## 运行环境

- `Node.js`：建议 `>= 20`
- `npm`：建议使用与 Node 版本匹配的较新版本
- `MySQL`：建议 `8.x`

## 环境变量

请先将 `.env.example` 复制为 `.env`，再按本地环境调整：

```env
DATABASE_URL="mysql://root:123456@localhost:3306/weather_backend"
PORT=3000
JWT_ACCESS_SECRET="replace-with-access-secret"
JWT_REFRESH_SECRET="replace-with-refresh-secret"
ACCESS_TOKEN_EXPIRES_IN="2h"
REFRESH_TOKEN_EXPIRES_IN="7d"
WEATHER_API_BASE_URL="https://api.open-meteo.com/v1/forecast"
WEATHER_GEOCODING_BASE_URL="https://geocoding-api.open-meteo.com/v1/search"
WEATHER_API_KEY=""
WEATHER_TIMEZONE="Asia/Shanghai"
WEATHER_CACHE_MINUTES=30
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
UPLOAD_ROOT="uploads"
```

字段说明：

- `DATABASE_URL`：MySQL 连接地址
- `PORT`：服务监听端口，默认 `3000`
- `JWT_ACCESS_SECRET`：访问令牌签名密钥
- `JWT_REFRESH_SECRET`：刷新令牌签名密钥
- `ACCESS_TOKEN_EXPIRES_IN`：访问令牌有效期
- `REFRESH_TOKEN_EXPIRES_IN`：刷新令牌有效期
- `WEATHER_API_BASE_URL`：天气查询接口地址
- `WEATHER_GEOCODING_BASE_URL`：地理编码接口地址
- `WEATHER_API_KEY`：第三方天气接口密钥；当前接入 Open-Meteo 时可留空
- `WEATHER_TIMEZONE`：天气查询默认时区
- `WEATHER_CACHE_MINUTES`：天气缓存时长，单位分钟
- `CORS_ORIGINS`：允许跨域访问的前端地址，多个地址以逗号分隔
- `UPLOAD_ROOT`：上传文件与静态资源根目录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成 Prisma Client

```bash
npm run prisma:generate
```

### 3. 执行数据库迁移

```bash
npm run prisma:migrate
```

### 4. 启动开发环境

```bash
npm run start:dev
```

### 5. 访问文档

- 服务默认地址：`http://localhost:3000`
- Swagger 文档：`http://localhost:3000/api-docs`
- 上传资源前缀：`http://localhost:3000/uploads`

## 常用脚本

```bash
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
npm run lint
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate
```

## 接口说明

### 认证与用户

- `POST /auth/register`：注册
- `POST /auth/login`：登录，返回用户信息、`accessToken`、`refreshToken`
- `POST /auth/refresh`：刷新访问令牌
- `POST /auth/logout`：登出并撤销刷新令牌
- `GET /auth/profile`：获取当前用户资料
- `PUT /auth/profile`：更新当前用户资料
- `POST /auth/avatar`：上传头像
- `GET /auth/login-records`：获取当前用户登录记录

### 城市与用户城市

- `GET /cities?keyword=`：查询城市基础信息
- `POST /cities`：新增城市
- `PUT /cities/:cityName`：修改城市名称
- `DELETE /cities/:cityName`：删除城市
- `GET /user/cities`：查询当前用户关注城市列表
- `POST /user/cities`：添加当前用户关注城市
- `PUT /user/cities/:cityId/default`：设置默认城市
- `DELETE /user/cities/:cityId`：删除当前用户城市

### 天气接口

- `GET /weather/current?cityId=`：获取城市当前天气
- `GET /weather/hourly?cityId=`：获取城市小时级天气
- `GET /weather/daily?cityId=`：获取城市多日天气

## 认证与响应说明

- 当前认证已使用正式 JWT 方案，不再使用 `mock-token-*`。
- 推荐流程为：登录获取 `accessToken` 与 `refreshToken`，访问受保护接口时携带 `Authorization: Bearer <accessToken>`，在访问令牌过期后调用 `/auth/refresh` 获取新令牌。
- 全局已启用统一异常过滤器与响应拦截器，接口返回遵循统一包装结构，便于前端统一处理成功与失败消息。

## 天气数据说明

- 天气数据通过 Provider 层对接第三方天气服务，当前默认接入 Open-Meteo。
- 后端不会把第三方原始结构直接暴露给控制器调用方，而是先映射为内部统一 DTO，再返回给前端。
- 查询天气时会优先命中本地缓存；缓存过期后再重新抓取，并将快照落到数据库表中。

## 数据模型概览

- `User`：用户主表，保存账号、密码哈希、资料信息和头像地址
- `LoginRecord`：登录记录
- `RefreshToken`：刷新令牌记录与撤销状态
- `City`：城市静态信息，如名称、编码、省份、国家、经纬度
- `UserCity`：用户与城市的关联关系，包含默认城市与排序信息
- `WeatherSnapshot`：天气快照缓存，保存当前天气、小时预报、多日预报及过期时间

## 项目结构

```text
weather-backend/
├─ prisma/
│  ├─ migrations/
│  │  ├─ init/                     初始建表（User、LoginRecord）
│  │  └─ 202604141430_backend_upgrade/  升级（RefreshToken、City、UserCity、WeatherSnapshot）
│  └─ schema.prisma                数据模型定义（6 张表）
├─ src/
│  ├─ auth/                        认证模块
│  │  ├─ dto/
│  │  │  ├─ login.dto.ts           登录请求体
│  │  │  ├─ register.dto.ts        注册请求体
│  │  │  ├─ refresh-token.dto.ts   令牌刷新请求体
│  │  │  └─ update-profile.dto.ts  资料更新请求体
│  │  ├─ auth.constants.ts         令牌类型与默认过期时间常量
│  │  ├─ auth.types.ts             TokenPayload、AuthUser、LoginContext 类型定义
│  │  ├─ auth-token.service.ts     JWT 签发与校验（jsonwebtoken）
│  │  ├─ auth.guard.ts             Bearer token 守卫，解析 AccessToken 并查库
│  │  ├─ current-user.decorator.ts @CurrentUser() 参数装饰器
│  │  ├─ auth.service.ts           注册、登录、刷新、注销、资料、头像、登录记录
│  │  ├─ auth.controller.ts        /auth 路由
│  │  ├─ auth.module.ts            模块声明，导出 AuthGuard、AuthTokenService
│  │  ├─ auth.service.spec.ts      AuthService 单元测试（11 个用例）
│  │  └─ auth.controller.spec.ts   AuthController 单元测试
│  ├─ cities/                      城市模块
│  │  ├─ dto/
│  │  │  ├─ create-city.dto.ts     新增城市请求体
│  │  │  ├─ update-city.dto.ts     重命名城市请求体
│  │  │  └─ add-user-city.dto.ts   添加用户城市请求体
│  │  ├─ city-seed.ts              启动时写入数据库的 34 个中国城市初始数据
│  │  ├─ cities.service.ts         城市 CRUD（DB 持久化，启动时自动 seed）
│  │  ├─ cities.controller.ts      /cities 路由
│  │  ├─ user-cities.service.ts    用户城市关联增删改、默认城市设置
│  │  ├─ user-cities.controller.ts /user/cities 路由（全部需要 Bearer 认证）
│  │  ├─ cities.module.ts          模块声明，导入 WeatherModule、AuthModule
│  │  ├─ cities.service.spec.ts    CitiesService 单元测试
│  │  └─ user-cities.service.spec.ts  UserCitiesService 单元测试
│  ├─ weather/                     天气模块
│  │  ├─ weather.types.ts          WeatherCurrent、WeatherHourlyItem 等类型定义
│  │  ├─ weather.provider.ts       对接 Open-Meteo API，负责实际网络请求与城市解析
│  │  ├─ weather.service.ts        快照缓存逻辑：优先命中 DB，过期后重新拉取
│  │  ├─ weather.controller.ts     /weather 路由（current、hourly、daily）
│  │  ├─ weather.module.ts         模块声明，导出 WeatherService、WeatherProvider
│  │  └─ weather.service.spec.ts   WeatherService 单元测试
│  ├─ common/
│  │  ├─ filters/
│  │  │  └─ http-exception.filter.ts  全局异常过滤器，统一错误响应格式
│  │  └─ interceptors/
│  │     └─ response.interceptor.ts   全局响应拦截器，自动包装 { code, message, data }
│  ├─ prisma/
│  │  ├─ prisma.service.ts         PrismaClient 封装
│  │  └─ prisma.module.ts          全局模块，无需在 feature 模块中重复导入
│  ├─ app.module.ts                根模块，组装 ConfigModule、PrismaModule 等
│  └─ main.ts                      应用入口，含 CORS、ValidationPipe、静态资源、Swagger、端口重试
├─ uploads/                        运行时头像上传目录（自动创建）
├─ package.json
├─ .env.example
└─ README.md
```

## 模块说明

### auth 模块

负责完整的身份认证生命周期。`AuthTokenService` 使用 `jsonwebtoken` 对 AccessToken 和 RefreshToken 分别签发与校验，两者使用不同密钥（`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`）。刷新令牌采用 **Rotation 策略**：每次刷新都撤销旧 token 并签发新的一对，撤销状态写入 `RefreshToken` 表的 `revokedAt` 字段。

`AuthGuard` 作为可复用守卫，在请求头中提取 Bearer token，校验后从数据库加载完整用户对象挂载到 `request.user`，供 `@CurrentUser()` 装饰器取用。

密码方面支持双重兼容：存量 SHA-256 密码在登录时自动升级为 bcrypt，无需用户感知。

### cities 模块

城市数据持久化到 `City` 表，服务启动时通过 `city-seed.ts` 的 34 个初始城市数据执行 `createMany + skipDuplicates`，保证幂等。`CitiesService` 在返回城市列表时，会为每个城市异步拉取天气摘要（`getCitySummary`）一并返回，方便前端直接渲染。

`UserCitiesService` 维护 `UserCity` 关联表，支持添加、删除、设置默认城市，以及在删除后自动将下一个城市提升为默认。

### weather 模块

`WeatherProvider` 负责两件事：通过 Open-Meteo Geocoding API 解析城市坐标，以及通过 Forecast API 拉取当前天气、24 小时预报和 7 日预报，再将天气码映射为中文文本。

`WeatherService` 在每次查询前先检查 `WeatherSnapshot` 表中是否存在未过期的缓存（以 `cityId + source` 为唯一键）。若缓存可用则直接反序列化返回；若已过期或不存在则调用 Provider 重新拉取，并将结果 upsert 回数据库，过期时间由 `WEATHER_CACHE_MINUTES` 控制。

### common 模块

- **`HttpExceptionFilter`**：捕获所有异常，将 `HttpException` 的状态码和消息统一格式化为 `{ code, message, data: null, timestamp, path }`，500 错误返回通用提示而非内部细节。
- **`ResponseInterceptor`**：拦截成功响应，若返回值已是标准格式则透传，否则自动包装为 `{ code: 0, message: "success", data: ... }`。

---

## 可拓展点

以下是在现有架构基础上较自然的演进方向，每条均可独立实施，不影响其他模块。

### 认证增强

- **邮箱验证**：注册时发送确认邮件，在 `User` 表增加 `emailVerified` 字段，未验证账号限制登录或接口权限。实现上可引入 `nodemailer` 或调用第三方邮件服务，生成短时有效的验证 token 存入 Redis 或临时表。
- **OAuth2 第三方登录**：接入 GitHub / Google 等，通过 Passport.js 的 strategy 体系扩展，复用现有 `AuthTokenService` 签发 JWT，对账号与第三方 ID 的绑定关系新增一张 `OAuthAccount` 表。
- **双因素认证（2FA）**：在登录流程中增加一个中间态（`needs_2fa`），引入基于时间的一次性密码（TOTP）。
- **登录限流**：在 `AuthController` 的 `/login` 路由上挂载 `ThrottlerGuard`，对同一 IP 的失败尝试次数进行限制，防止暴力破解。

### 城市与用户城市

- **城市管理接口鉴权**：`POST /cities`、`PUT /cities/:cityName`、`DELETE /cities/:cityName` 目前对所有请求开放，可在 `CitiesController` 上加入基于角色（`role` 字段）的 `RolesGuard`，限制只有管理员才能增删改城市。
- **城市排序调整**：`UserCity` 表已有 `sortOrder` 字段，可新增 `PATCH /user/cities/order` 接口，接收城市 ID 顺序数组并批量更新 `sortOrder`。
- **城市搜索增强**：当前通过 `cityName LIKE` 模糊匹配，可扩展为同时匹配 `province`、`cityCode`，或集成全文索引。

### 天气数据

- **多 Provider 支持**：`WeatherProvider` 当前硬编码 Open-Meteo，可将其抽象为 `IWeatherProvider` 接口，再提供 `AccuWeatherProvider`、`QWeatherProvider` 等实现，在 `weather.module.ts` 中通过配置项动态注入不同 provider。
- **天气预警推送**：引入 `Bull` 或 `BullMQ` 队列，定时扫描用户默认城市的天气快照，当天气码匹配恶劣天气条件时通过 WebSocket 或 Server-Sent Events 通知已连接的前端。
- **精细缓存失效**：当前以固定分钟数过期，可改为在城市坐标变更或 provider 返回数据出错时主动 invalidate，减少陈旧数据的展示窗口。
- **历史天气**：Open-Meteo 提供历史数据接口，可扩展 `WeatherSnapshot` 或新增 `WeatherHistory` 表存储历史记录，对外暴露 `GET /weather/history?cityId=&date=` 接口。

### 性能与可靠性

- **Redis 缓存层**：将天气快照的热点数据同步写入 Redis，查询时优先命中内存缓存，降低 MySQL 查询压力。接入 `@nestjs/cache-manager` + `cache-manager-ioredis` 即可。
- **异步天气预热**：可在用户添加城市（`POST /user/cities`）时，将城市 ID 推入 Bull 队列，后台异步拉取天气并写入快照，而不是在请求路径上同步拉取。

### 可观测性

- **结构化日志**：引入 `winston` 并配置 `NestJS` 的自定义 `LoggerService`，对每条请求的耗时、用户 ID、接口路径输出 JSON 日志，便于接入 ELK 或 Loki 等日志平台。
- **健康检查**：使用 `@nestjs/terminus` 暴露 `GET /health` 端点，检查数据库连接状态，供 Docker / Kubernetes 的 liveness probe 使用。
- **接口指标**：集成 `prom-client`，暴露 `GET /metrics`，供 Prometheus 采集请求量、响应时长等指标。

### 工程化

- **Docker 化**：编写 `Dockerfile` 和 `docker-compose.yml`，将应用与 MySQL 一并容器化，一键启动完整开发环境。
- **API 版本管理**：通过 `app.setGlobalPrefix('api/v1')` 或 NestJS 内置版本控制，为未来的破坏性变更预留升级通道。
- **E2E 测试**：利用 `@nestjs/testing` + `supertest` 搭建真实数据库测试环境，覆盖登录→刷新→注销、添加城市→查看天气等完整流程。

## 联调说明

- 前端默认通过 `/api` 反向代理访问本服务。
- 启动前请先准备好 MySQL 数据库，并执行 Prisma 生成与迁移命令。
- 若前端仅接入基础登录、城市列表或页面展示，也可以通过 Swagger 直接验证更完整的用户城市和天气接口能力。

## 说明

- 项目当前以毕业设计展示、联调闭环和接口规范化为主要目标。
- 若继续向生产环境演进，可在现有基础上补充更完善的日志、监控、限流、审计和部署说明。
