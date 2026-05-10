# 小慕天气后端项目

![NestJS](https://img.shields.io/badge/NestJS-11.0.1-e0234e?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.17.1-2d3748?style=for-the-badge&logo=prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479a1?style=for-the-badge&logo=mysql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-jsonwebtoken%209.0.3-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-11.2.7-85ea2d?style=for-the-badge&logo=swagger&logoColor=1f2937)
![Jest](https://img.shields.io/badge/Jest-30.0.0-c21325?style=for-the-badge&logo=jest&logoColor=white)
![class-validator](https://img.shields.io/badge/class--validator-0.14.2-ef4444?style=for-the-badge&logo=typescript&logoColor=white)

## 项目简介

`weather-backend` 是“小慕天气”系统的后端服务，基于 `NestJS + Prisma + MySQL` 构建，当前已从早期联调版演进为具备认证、用户资料、城市管理、用户城市、城市坐标解析、真实天气拉取与缓存能力的毕业设计后端。项目同时提供 Swagger 文档，便于前后端联调与答辩展示。

## 技术栈

| 技术栈 | 当前版本 | 主要作用 |
|------|------|------|
| `NestJS` | `11.0.1` | 提供模块化后端框架、控制器与依赖注入能力 |
| `TypeScript` | `5.7.3` | 提供后端类型约束与服务层接口定义 |
| `Prisma / @prisma/client` | `6.17.1` | 管理数据库模型、查询访问与 Prisma Client 生成 |
| `MySQL` | `8.x` | 承载用户、城市、用户城市、天气快照等业务数据 |
| `class-validator` | `0.14.2` | 校验 DTO 请求参数 |
| `class-transformer` | `0.5.1` | 配合 DTO 与 Nest 管道做请求体转换 |
| `bcryptjs` | `3.0.3` | 处理用户密码哈希与校验 |
| `jsonwebtoken` | `9.0.3` | 签发与校验 Access Token / Refresh Token |
| `@nestjs/swagger` | `11.2.7` | 生成 Swagger 接口文档，便于联调与展示 |
| `Jest` | `30.0.0` | 承担服务层、控制器与模块级测试 |

## 当前能力

- 用户注册、登录、刷新令牌、登出
- 基于 `Bearer Token` 的受保护接口访问
- 可选鉴权能力：同一接口可按是否携带有效 Bearer token 自动切换匿名 / 登录用户语义
- 个人资料查询与更新
- 头像上传与静态资源访问
- 登录记录写入、查询与登录地址解析
- 城市基础信息查询与维护
- 用户关注城市列表维护、默认城市设置与排序语义维护
- 真实天气数据拉取：
  - 当前天气
  - 小时级预报
  - 多日预报
- 城市名称解析与坐标补齐，支撑天气接口按城市稳定拉取数据
- 天气数据缓存与快照持久化
- `no-map` 分支已移除地图逆地理编码接口，当前聚焦城市天气核心链路
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
WEATHER_AIR_QUALITY_API_BASE_URL="https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_FORECAST_DAYS=16
WEATHER_GEOCODING_PROVIDER="gaode"
WEATHER_GEOCODING_BASE_URL="https://geocoding-api.open-meteo.com/v1/search"
WEATHER_GEOCODING_GAODE_BASE_URL="https://restapi.amap.com/v3/geocode/geo"
WEATHER_GEOCODING_API_KEY=""
WEATHER_GEOCODING_TIMEOUT_MS=2500
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
- `WEATHER_AIR_QUALITY_API_BASE_URL`：Open-Meteo 空气质量接口地址
- `WEATHER_FORECAST_DAYS`：天气预报天数，当前会限制在 Open-Meteo 支持的范围内
- `WEATHER_GEOCODING_PROVIDER`：城市解析 Provider，默认优先使用 `gaode`，失败后回退到 Open-Meteo
- `WEATHER_GEOCODING_BASE_URL`：Open-Meteo 城市名称解析接口地址，用于按城市名补齐坐标
- `WEATHER_GEOCODING_GAODE_BASE_URL`：高德地理编码接口地址
- `WEATHER_GEOCODING_API_KEY`：高德地理编码接口密钥；未配置时自动跳过高德解析
- `WEATHER_GEOCODING_TIMEOUT_MS`：高德地理编码请求超时时间，单位毫秒
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

## Docker 容器化部署

项目提供了 `Dockerfile` 与 `docker-compose.yml`，可一键启动后端服务与 `MySQL`。

### 1. 准备环境变量

Docker 部署默认会加载 `.env.docker.example`。如果你需要自定义 JWT 密钥、第三方接口地址或其他业务配置，可以再额外准备一个 `.env` 作为覆盖层。

推荐做法：

```bash
cp .env.docker.example .env
```

如需保留本地开发配置，也可以手动参考 `.env.docker.example` 补齐 Docker 相关字段。使用 `Docker Compose` 启动时，会自动覆盖以下容器内运行所需变量：

- `DATABASE_URL`：改为连接 Compose 内部的 `mysql` 服务
- `PORT`：容器监听端口，默认 `3000`
- `APP_HOST_PORT`：宿主机访问端口，默认 `3001`
- `UPLOAD_ROOT`：固定为容器内的 `uploads`

如需自定义数据库初始化参数，可在宿主机环境或同目录 `.env` 中额外提供：

```env
MYSQL_DATABASE=weather_backend
MYSQL_ROOT_PASSWORD=123456
```

### 2. 启动容器

```bash
docker compose up -d --build
```

首次启动时，应用容器会自动执行：

```bash
npx prisma generate
npx prisma migrate deploy
node dist/main
```

### 3. 常用命令

```bash
# 查看容器状态
docker compose ps

# 实时查看 app 这个服务的控制台输出日志
# logs:看日志    app:指定只看app这个服务的日志 
# -f（核心参数）:代表 follow（跟随）。就像 Linux 里的 tail -f，它会一直挂在终端上，实时滚动输出最新的日志，直到你按下 Ctrl + C 退出。
docker compose logs -f app

# 查看数据库日志
docker compose logs -f mysql

# 停止并删除当前项目定义的所有容器，同时清理它们之间的网络。
docker compose down

#  停止、删除容器、网络，并且连同数据卷一起彻底删除！
docker compose down -v
```

### 4. 访问地址

- 服务地址：`http://localhost:3001`
- Swagger 文档：`http://localhost:3001/api-docs`
- 上传资源前缀：`http://localhost:3001/uploads`

### 5. 持久化说明

- `mysql-data`：持久化 MySQL 数据
- `uploads-data`：持久化头像与上传资源

### 6. 端口说明

- 后端服务默认映射到宿主机 `3001`
- 后端服务容器内默认监听 `3000`，宿主机默认映射到 `3001`，避免与本机已运行的后端服务冲突
- `MySQL` 仅在 Compose 内部网络暴露 `3306`，默认不占用宿主机端口，避免与本机已安装的 MySQL 冲突

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 NestJS 项目到 `dist/` |
| `npm run build:watch` | 监听模式编译后端代码 |
| `npm run start` | 使用 Nest CLI 启动服务 |
| `npm run start:dev` | 前台启动开发服务，当前封装为 PowerShell 脚本 |
| `npm run start:dev:bg` | 后台启动开发服务 |
| `npm run start:dev:check` | 检查后台开发服务状态 |
| `npm run start:dev:logs` | 查看后台开发服务日志 |
| `npm run start:dev:stop` | 停止后台开发服务 |
| `npm run start:dev:cleanup` | 清理开发服务占用端口 |
| `npm run start:dev:ports` | 查看开发服务相关端口 |
| `npm run start:dev:probe` | 启动开发服务并做短时探测 |
| `npm run start:dev:observe` | 启动并观察服务控制台状态 |
| `npm run start:dev:observe:http` | 启动并观察 HTTP 可访问状态 |
| `npm run start:debug` | Debug + watch 模式启动 |
| `npm run start:prod` | 运行 `dist/main` 生产产物 |
| `npm run lint` | ESLint 检查并自动修复 TypeScript 文件 |
| `npm run test` | 运行 Jest 单元测试 |
| `npm run test:watch` | Jest watch 模式 |
| `npm run test:cov` | 生成测试覆盖率 |
| `npm run test:debug` | Node inspect 模式调试 Jest |
| `npm run test:e2e` | 运行 e2e 测试配置 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 执行 Prisma 本地迁移 |

常用联调启动方式：

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
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
- `PUT /auth/password`：修改当前用户密码
- `POST /auth/destroy`：注销当前账号

### 城市与用户城市

- `GET /cities?keyword=`：匿名时查询公共城市基础信息；登录后无 `keyword` 时返回当前用户城市列表，带 `keyword` 时继续走全局搜索
- `POST /cities`：匿名时新增公共城市；登录后将目标城市加入当前用户城市列表
- `PUT /cities/:cityName`：修改城市名称
- `DELETE /cities/:cityName`：匿名时删除公共城市；登录后仅移除当前用户城市关联
- `GET /user/cities`：查询当前用户关注城市列表，返回完整天气 bundle 供详情页首屏展示
- `POST /user/cities`：添加当前用户关注城市
- `PUT /user/cities/:cityId/default`：设置默认城市
- `POST /user/cities/batch-delete`：批量删除当前用户城市关系，删除后统一重排默认城市
- `DELETE /user/cities`：兼容旧版批量删除调用；正式联调建议使用 `POST /user/cities/batch-delete`
- `DELETE /user/cities/:cityId`：删除当前用户城市

### 天气接口

- `GET /weather/current?cityId=`：获取城市当前天气
- `GET /weather/hourly?cityId=`：获取城市小时级天气
- `GET /weather/daily?cityId=`：获取城市多日天气
- `GET /weather/daily-detail?cityId=`：获取逐日详细天气指标

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
│  ├─ __tests__/
│  │  └─ app.controller.spec.ts    根控制器单元测试
│  ├─ auth/                        认证模块
│  │  ├─ __tests__/
│  │  │  ├─ auth.controller.spec.ts
│  │  │  ├─ auth.service.spec.ts
│  │  │  ├─ login-geo.service.spec.ts
│  │  │  └─ optional-auth.guard.spec.ts
│  │  ├─ dto/
│  │  │  ├─ login.dto.ts           登录请求体
│  │  │  ├─ register.dto.ts        注册请求体
│  │  │  ├─ refresh-token.dto.ts   令牌刷新请求体
│  │  │  └─ update-profile.dto.ts  资料更新请求体
│  │  ├─ auth.constants.ts         令牌类型与默认过期时间常量
│  │  ├─ auth.types.ts             TokenPayload、AuthUser、LoginContext 类型定义
│  │  ├─ auth-token.service.ts     JWT 签发与校验（jsonwebtoken）
│  │  ├─ auth.guard.ts             Bearer token 守卫，解析 AccessToken 并查库
│  │  ├─ optional-auth.guard.ts    可选鉴权守卫，兼容匿名与登录态分流接口
│  │  ├─ current-user.decorator.ts @CurrentUser() 参数装饰器
│  │  ├─ login-geo.service.ts      登录 IP 归属地解析服务
│  │  ├─ auth.service.ts           注册、登录、刷新、注销、资料、头像、登录记录
│  │  ├─ auth.controller.ts        /auth 路由
│  │  ├─ auth.module.ts            模块声明，导出 AuthGuard、OptionalAuthGuard、AuthTokenService
│  ├─ cities/                      城市模块
│  │  ├─ __tests__/
│  │  │  ├─ cities.controller.spec.ts
│  │  │  ├─ cities.service.spec.ts
│  │  │  ├─ user-cities.service.spec.ts
│  │  │  └─ user-cities.controller.spec.ts
│  │  ├─ dto/
│  │  │  ├─ create-city.dto.ts     新增城市请求体
│  │  │  ├─ update-city.dto.ts     重命名城市请求体
│  │  │  ├─ add-user-city.dto.ts   添加用户城市请求体
│  │  │  └─ batch-remove-user-cities.dto.ts 批量删除用户城市请求体
│  │  ├─ city-alias.ts             城市别名与标准名映射
│  │  ├─ city-seed.ts              启动时写入数据库的城市初始数据
│  │  ├─ city-resolver.service.ts  城市解析与标准化服务
│  │  ├─ cities.service.ts         公共城市 CRUD、种子修复与天气摘要聚合
│  │  ├─ cities.controller.ts      /cities 路由（按登录态自适应公共 / 用户列表语义）
│  │  ├─ user-cities.service.ts    用户城市关联增删改、默认城市设置
│  │  ├─ user-cities.controller.ts /user/cities 路由（全部需要 Bearer 认证）
│  │  ├─ cities.module.ts          模块声明，导入 WeatherModule、AuthModule
│  ├─ weather/                     天气模块
│  │  ├─ __tests__/
│  │  │  ├─ weather.controller.spec.ts
│  │  │  ├─ weather.provider.spec.ts
│  │  │  └─ weather.service.spec.ts
│  │  ├─ weather.types.ts          WeatherCurrent、WeatherHourlyItem 等类型定义
│  │  ├─ weather.provider.ts       对接 Open-Meteo API，负责实际网络请求与城市解析
│  │  ├─ weather.service.ts        快照缓存逻辑：优先命中 DB，过期后重新拉取
│  │  ├─ weather.controller.ts     /weather 路由（current、hourly、daily、daily-detail）
│  │  └─ weather.module.ts         模块声明，导出 WeatherService、WeatherProvider
│  ├─ common/
│  │  ├─ filters/
│  │  │  └─ http-exception.filter.ts  全局异常过滤器，统一错误响应格式
│  │  └─ interceptors/
│  │     └─ response.interceptor.ts   全局响应拦截器，自动包装 { code, message, data }
│  ├─ prisma/
│  │  ├─ prisma.service.ts         PrismaClient 封装
│  │  └─ prisma.module.ts          全局模块，无需在 feature 模块中重复导入
│  ├─ app.controller.ts            根控制器
│  ├─ app.service.ts               根服务
│  ├─ app.module.ts                根模块，组装 ConfigModule、PrismaModule 等
│  └─ main.ts                      应用入口，含 CORS、ValidationPipe、静态资源、Swagger、端口重试
├─ test/                           e2e 测试目录与 Jest 配置
├─ uploads/                        运行时头像上传目录（自动创建）
├─ package.json
├─ .env.example
└─ README.md
```

## 模块说明

### auth 模块

负责完整的身份认证生命周期。`AuthTokenService` 使用 `jsonwebtoken` 对 AccessToken 和 RefreshToken 分别签发与校验，两者使用不同密钥（`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`）。刷新令牌采用 **Rotation 策略**：每次刷新都撤销旧 token 并签发新的一对，撤销状态写入 `RefreshToken` 表的 `revokedAt` 字段。

`AuthGuard` 作为可复用守卫，在请求头中提取 Bearer token，校验后从数据库加载完整用户对象挂载到 `request.user`，供 `@CurrentUser()` 装饰器取用。

当前还补充了 `OptionalAuthGuard`，用于 `/cities` 这类既要兼容匿名访问、又要在登录时读取用户上下文的接口：没有凭证时直接放行，有合法凭证时挂载用户信息，有非法或过期凭证时继续返回 401。`LoginGeoService` 则负责把登录 IP 尽量解析为可读地址，补充到登录记录中，方便个人中心查看历史登录来源。

密码方面支持双重兼容：存量 SHA-256 密码在登录时自动升级为 bcrypt，无需用户感知。

### cities 模块

城市数据持久化到 `City` 表，服务启动时通过 `city-seed.ts` 的初始城市数据执行 `createMany + skipDuplicates`，并在启动阶段自动修复种子城市的坐标/编码异常。`CitiesService` 在返回城市列表时，会为每个城市异步拉取天气摘要（`getCitySummary`）一并返回，方便前端直接渲染。

`city-alias.ts` 负责收敛常见城市别名与标准名，`CityResolverService` 在此基础上把用户输入的城市名称解析成可入库的标准城市元数据，统一服务于新增城市、修复坐标和用户城市接入流程。

`UserCitiesService` 维护 `UserCity` 关联表，支持添加、删除、批量删除、设置默认城市、维持默认城市优先顺序，并在删除后自动将剩余第一项设为默认。当前用户城市列表会附带完整天气 bundle，供前端城市详情页和趋势预报首屏直接消费；批量删除响应则使用轻量城市列表，避免天气服务失败影响删除写操作。

当前 `/cities` 已与用户城市能力打通：

- 匿名访问 `/cities` 时返回公共城市列表
- 登录后无 `keyword` 拉取 `/cities` 时返回当前账号自己的城市列表
- 登录后 `POST /cities` / `DELETE /cities/:cityName` 时优先操作当前用户与城市的关联，而不是直接影响所有用户共享数据
- 城市管理中心批量删除走 `POST /user/cities/batch-delete`，后端在一次请求内删除关系并重排默认城市；删空后返回空数组，不会恢复默认城市

### weather 模块

`WeatherProvider` 负责城市解析与天气数据获取：城市坐标可优先通过高德地理编码补齐，失败后回退到 Open-Meteo Geocoding；天气数据通过 Open-Meteo Forecast API 拉取当前天气、小时预报、多日预报，并额外调用 Open-Meteo Air Quality API 补充空气质量字段，再将天气码映射为中文文本。当前 `no-map` 分支不再暴露地图逆地理编码接口，天气模块聚焦按城市查询和缓存。

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

- **城市管理权限分层**：当前 `/cities` 已支持按登录态自动分流，后续可继续把公共城市维护（重命名、全局删除）升级为管理员权限，避免普通用户误操作全局城市数据。
- **城市排序调整**：`UserCity` 表已有 `sortOrder` 字段，可新增 `PATCH /user/cities/order` 接口，接收城市 ID 顺序数组并批量更新 `sortOrder`，配合前端拖拽排序。
- **城市搜索增强**：当前通过 `cityName LIKE` 模糊匹配，可扩展为同时匹配 `province`、`cityCode`，或接入更强的地理搜索能力。
- **批量操作审计**：可为 `POST /user/cities/batch-delete` 增加操作日志，记录请求城市、成功项、失败项和触发用户，方便排查误删与联调问题。

### 天气数据

- **多 Provider 支持**：`WeatherProvider` 当前默认以 Open-Meteo 为主，可进一步抽象为多 Provider 注入模式，支持更多天气源切换。
- **天气预警推送**：引入 `Bull` 或 `BullMQ` 队列，定时扫描用户默认城市的天气快照，当天气码匹配恶劣天气条件时通过 WebSocket 或 Server-Sent Events 通知已连接的前端。
- **精细缓存失效**：当前以固定分钟数过期，可改为在城市坐标变更或 provider 返回数据出错时主动失效，减少陈旧数据展示窗口。
- **天气 bundle 缓存优化**：用户城市列表会返回详情页所需的 `current/hourly/daily/dailyDetail`，后续可对 bundle 组装增加批量缓存读取或后台预热，降低列表接口压力。
- **历史天气**：可扩展 `WeatherSnapshot` 或新增 `WeatherHistory` 表，对外暴露按日期查询的历史天气接口。
- **地图能力可选恢复**：如后续前端重新需要地图页，可从 `main` 分支恢复逆地理编码接口、类型定义与测试，再按当前 Provider 结构重新接入坐标到地点名称的解析能力。

### 性能与可靠性

- **Redis 缓存层**：将天气快照的热点数据同步写入 Redis，查询时优先命中内存缓存，降低 MySQL 查询压力。接入 `@nestjs/cache-manager` + `cache-manager-ioredis` 即可。
- **异步天气预热**：可在用户添加城市（`POST /user/cities` 或登录态 `POST /cities`）时，将城市 ID 推入队列，后台异步拉取天气并写入快照，而不是在请求路径上同步拉取。
- **批量删除事务强化**：当前批量删除已在服务层集中处理默认城市重排，后续可进一步补充数据库级约束或审计表，保证复杂并发场景下也能追踪最终状态。

### 可观测性

- **结构化日志**：引入 `winston` 并配置 `NestJS` 的自定义 `LoggerService`，对每条请求的耗时、用户 ID、接口路径输出 JSON 日志，便于接入 ELK 或 Loki 等日志平台。
- **健康检查**：使用 `@nestjs/terminus` 暴露 `GET /health` 端点，检查数据库连接状态，供 Docker / Kubernetes 的 liveness probe 使用。
- **接口指标**：集成 `prom-client`，暴露 `GET /metrics`，供 Prometheus 采集请求量、响应时长等指标。

### 工程化

- **部署与环境增强**：当前已提供 `Dockerfile` 和 `docker-compose.yml`，后续可补充多环境 Compose 配置、生产环境健康检查和镜像发布流程。
- **API 版本管理**：通过 `app.setGlobalPrefix('api/v1')` 或 NestJS 内置版本控制，为未来的破坏性变更预留升级通道。
- **E2E 测试**：利用 `@nestjs/testing` + `supertest` 搭建真实数据库测试环境，覆盖登录→切换账号→拉取用户城市列表、添加城市→查看天气等完整流程。

## main 与 no-map 分支对比

当前 README 以 `no-map` 分支为准。两个分支的主要差异集中在天气地图能力：

| 对比项 | `main` 分支 | `no-map` 分支 |
|------|------|------|
| 天气地图接口 | 保留 `GET /weather/reverse-geocode?lat=&lng=`，用于按经纬度解析地图地点信息 | 已移除该接口，`/weather` 仅保留 `current`、`hourly`、`daily`、`daily-detail` |
| 逆地理编码类型 | 保留 `src/weather/reverse-geocode.types.ts` | 已移除该类型文件 |
| Provider 职责 | 同时覆盖天气拉取、城市解析与地图逆地理编码相关逻辑 | 聚焦天气拉取、城市名称解析、坐标补齐和空气质量字段组装 |
| 测试覆盖 | 包含逆地理编码相关控制器、Provider、Service 测试 | 删除地图逆地理编码相关测试，保留城市天气核心链路测试 |
| 适用场景 | 适合需要地图选点、经纬度反查地点名称的前端版本 | 适合无地图页版本，接口面更集中，便于围绕城市天气完成联调与答辩 |

如果后期需要把 `main` 的地图能力合回 `no-map`，建议同步恢复控制器接口、Provider 方法、类型定义、单元测试和 README 接口说明，避免代码与文档再次出现偏差。

## 联调说明

- 前端默认通过 `/api` 反向代理访问本服务。
- 启动前请先准备好 MySQL 数据库，并执行 Prisma 生成与迁移命令。
- 若前端仅接入基础登录、城市列表或页面展示，也可以通过 Swagger 直接验证更完整的用户城市和天气接口能力。

## 说明

- 项目当前以毕业设计展示、联调闭环和接口规范化为主要目标。
- 若继续向生产环境演进，可在现有基础上补充更完善的日志、监控、限流、审计和部署说明。
