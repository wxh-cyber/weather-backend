# 小慕天气后端项目

## 项目简介

`weather-backend` 是“小慕天气”系统的后端服务，基于 `NestJS`、`TypeScript`、`Prisma` 和 `MySQL` 构建。项目主要负责用户注册登录、个人信息维护、登录记录持久化、城市与天气相关接口支撑等服务能力，并为前端项目 `weather-frontend` 提供统一的接口支持。

## 技术栈

- `NestJS`：后端应用框架
- `TypeScript`：类型系统支持
- `Prisma`：ORM 与数据库访问层
- `MySQL`：业务数据持久化存储
- `class-validator`：请求参数校验
- `class-transformer`：请求参数转换
- `Jest`：单元测试框架

## 项目功能

- 用户注册
- 用户登录
- 登录状态校验
- 个人资料查询与修改
- 用户头像上传
- 登录记录写入与查询
- 城市数据查询接口

## 项目目录结构

```text
weather-backend/
├─ prisma/                         Prisma 配置、数据模型与迁移文件
│  ├─ migrations/                  数据库迁移记录
│  └─ schema.prisma               Prisma 数据模型定义
├─ src/
│  ├─ auth/                       认证、注册、登录、个人信息、登录记录模块
│  ├─ cities/                     城市相关接口模块
│  ├─ prisma/                     Prisma 服务封装
│  ├─ app.module.ts               应用主模块
│  └─ main.ts                     应用启动入口
├─ uploads/                       上传文件目录
├─ package.json                   项目脚本与依赖配置
├─ .env.example                   环境变量示例
└─ README.md                      项目说明文档
```

## 环境要求

- `Node.js`：建议 `>= 20`
- `npm`：建议使用与 Node 匹配的较新版本
- `MySQL`：建议 `8.x`

## 环境变量配置

项目启动前，请先在项目根目录创建 `.env` 文件，可参考 `.env.example`：

```env
DATABASE_URL="mysql://root:password@localhost:3306/weather_backend"
PORT=3000
```

说明：

- `DATABASE_URL`：MySQL 数据库连接地址
- `PORT`：后端服务启动端口，默认 `3000`

## 项目启动方式

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

如果数据库中还没有对应表结构，需要先执行这一步。

### 4. 启动开发环境

```bash
npm run start:dev
```

### 5. 启动普通运行模式

```bash
npm run start
```

### 6. 启动生产模式

```bash
npm run start:prod
```

## 项目测试命令

### 1. 单元测试

```bash
npm run test
```

### 2. 监听模式测试

```bash
npm run test:watch
```

### 3. 覆盖率测试

```bash
npm run test:cov
```

### 4. 调试模式测试

```bash
npm run test:debug
```

### 5. 端到端测试

```bash
npm run test:e2e
```

## 常用开发命令

### 构建项目

```bash
npm run build
```

### 格式化代码

```bash
npm run format
```

## 数据库相关命令

### 生成 Prisma Client

```bash
npm run prisma:generate
```

### 执行 Prisma 迁移

```bash
npm run prisma:migrate
```

## 前后端联调说明

- 默认后端服务运行在 `http://localhost:3000`
- 前端通过 `/api` 前缀代理访问后端接口
- 登录、注册、个人信息、登录记录等接口都依赖数据库连接正常
- 若登录时报数据库相关错误，请优先检查：
  - `.env` 中的 `DATABASE_URL`
  - MySQL 服务是否已启动
  - Prisma Client 是否已生成
  - 数据库迁移是否已执行

## 主要接口能力说明

- `POST /auth/register`：用户注册
- `POST /auth/login`：用户登录
- `GET /auth/profile`：获取个人信息
- `PUT /auth/profile`：更新个人信息
- `POST /auth/avatar`：上传头像
- `GET /auth/login-records`：获取当前用户登录记录

## 说明

当前项目用于“小慕天气”毕业设计/课程设计场景，已接入 `MySQL + Prisma` 实现用户与登录记录的持久化。后续如果需要继续扩展，可考虑补充：

- JWT 鉴权
- 刷新 token
- 更完善的异常日志记录
- 数据库种子脚本
- 更完整的 Swagger 接口文档
