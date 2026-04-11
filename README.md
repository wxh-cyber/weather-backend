# 小慕天气后端项目

## 项目简介

`weather-backend` 是“小慕天气”系统的后端服务，基于 `NestJS + TypeScript + Prisma + MySQL`。  
当前版本提供认证、用户资料、头像上传、登录记录，以及城市列表 CRUD 接口（城市模块使用内存 mock 数据，不写入数据库）。

## 技术栈

- `NestJS`
- `TypeScript`
- `Prisma`
- `MySQL`
- `class-validator`
- `class-transformer`
- `Jest`

## 主要功能（当前实现）

- 用户注册
- 用户登录（返回 `mock-token-*` 形式 token）
- 登录态校验（Bearer Token）
- 个人资料查询与更新
- 头像上传（`jpg/png/webp`，最大 `2MB`）
- 登录记录写入与查询（MySQL 持久化）
- 城市管理接口：
  - 查询城市列表
  - 新增城市
  - 修改城市名
  - 删除城市

## 项目目录结构

```text
weather-backend/
├─ prisma/                         Prisma 配置、数据模型与迁移文件
│  ├─ migrations/                  数据库迁移记录
│  └─ schema.prisma                Prisma 数据模型定义
├─ src/
│  ├─ auth/                        认证、资料、头像、登录记录
│  ├─ cities/                      城市列表 CRUD（内存 mock）
│  ├─ prisma/                      Prisma 服务封装
│  ├─ app.module.ts                应用主模块
│  └─ main.ts                      应用入口
├─ uploads/                        上传文件目录（头像）
├─ package.json                    项目脚本与依赖配置
├─ .env.example                    环境变量示例
└─ README.md                       项目说明文档
```

## 环境要求

- `Node.js`：建议 `>= 20`
- `npm`：建议使用与 Node 匹配的较新版本
- `MySQL`：建议 `8.x`

## 环境变量

请先复制 `.env.example` 为 `.env` 并按实际环境调整：

```env
DATABASE_URL="mysql://root:123456@localhost:3306/weather_backend"
PORT=3000
```

字段说明：

- `DATABASE_URL`：数据库连接地址（用户、登录记录等依赖此配置）
- `PORT`：服务端口，默认 `3000`

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

### 4. 启动开发模式

```bash
npm run start:dev
```

## 其他启动命令

```bash
npm run start
npm run start:prod
```

## 测试与开发命令

### 单元测试

```bash
npm run test
```

### 监听测试

```bash
npm run test:watch
```

### 覆盖率测试

```bash
npm run test:cov
```

### e2e 测试

```bash
npm run test:e2e
```

### 构建与格式化

```bash
npm run build
npm run format
```

## 接口清单（当前）

### Auth

- `POST /auth/register`：注册
- `POST /auth/login`：登录
- `GET /auth/profile`：获取当前用户资料
- `PUT /auth/profile`：更新用户资料
- `POST /auth/avatar`：上传头像
- `GET /auth/login-records`：获取当前用户登录记录

### Cities

- `GET /cities`：查询城市（支持 `keyword`）
- `POST /cities`：新增城市（`{ cityName }`）
- `PUT /cities/:cityName`：重命名城市（`{ cityName }`）
- `DELETE /cities/:cityName`：删除城市

## 联调说明

- 默认服务地址：`http://localhost:3000`
- 前端通过 `/api` 前缀代理访问后端
- 认证相关接口依赖 MySQL + Prisma
- 城市接口当前为内存 mock：服务重启后会恢复初始城市集合

## 备注

- 该项目目前用于毕业设计场景，已具备联调与测试基础能力。
- 若后续用于更正式环境，建议补充：JWT/刷新令牌、Swagger 文档、统一审计日志、城市数据持久化方案。
