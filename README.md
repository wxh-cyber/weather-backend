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
├─ prisma/                         Prisma 配置、数据模型与迁移文件
│  ├─ migrations/                  数据库迁移记录
│  └─ schema.prisma                Prisma 数据模型定义
├─ src/
│  ├─ auth/                        认证、资料、头像、登录记录
│  ├─ cities/                      城市基础信息与用户城市
│  ├─ weather/                     天气查询、Provider 与缓存
│  ├─ common/                      过滤器、拦截器等公共能力
│  ├─ prisma/                      Prisma 服务封装
│  ├─ app.module.ts                应用主模块
│  └─ main.ts                      应用入口
├─ uploads/                        上传文件目录
├─ package.json                    项目脚本与依赖配置
├─ .env.example                    环境变量示例
└─ README.md                       项目说明文档
```

## 联调说明

- 前端默认通过 `/api` 反向代理访问本服务。
- 启动前请先准备好 MySQL 数据库，并执行 Prisma 生成与迁移命令。
- 若前端仅接入基础登录、城市列表或页面展示，也可以通过 Swagger 直接验证更完整的用户城市和天气接口能力。

## 说明

- 项目当前以毕业设计展示、联调闭环和接口规范化为主要目标。
- 若继续向生产环境演进，可在现有基础上补充更完善的日志、监控、限流、审计和部署说明。
