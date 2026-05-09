---
date: 2026-05-09
branch: main
tests: 112/112 passed
build: clean
---

# 城市详情页 500 错误修复报告

## 问题描述

前后端同步运行时，进入城市详情页面后端返回 500 错误，同时存在"打地鼠"式 409 冲突错误风险。

## 根因分析

### 根因 1：`getCitySummary` 缺少软失败保护（直接导致 500）

**文件：** [src/cities/user-cities.service.ts:261-266](../src/cities/user-cities.service.ts#L261)

`toUserCityResponse` 中调用 `getCitySummary` 时没有 try/catch 保护：

```
toUserCityResponse
  → getCitySummary(cityId, { preferCache: true, allowFetch: true })
      → getUsableSnapshot(city, allowFetch=true)
          → ensureCityCoordinates(city)          ← 城市坐标为 null 时触发
              → weatherProvider.resolveCityByName()
                  → [Geocoding API 失败] → throw NotFoundException / InternalServerErrorException
  ← 异常穿透 Promise.all → 整个 getUserCities 返回 500
```

`getCityWeatherBundle` 已有 try/catch 保护（[user-cities.service.ts:271-278](../src/cities/user-cities.service.ts#L271)），但 `getCitySummary` 没有——保护不对称。

### 根因 2：409 打地鼠（已在历史提交中修复，本次确认无回归）

- `createCity`（匿名路径）：P2002 竞态时重试 findUnique 后返回 409，语义正确。
- `ensureCityExists`（登录路径）：城市已存在时直接返回，不抛 409，幂等正确。
- `addUserCity`：P2002 竞态时返回当前列表（HTTP 200），不抛 409，幂等正确。

## 修复内容

### 修改文件：[src/cities/user-cities.service.ts](../src/cities/user-cities.service.ts)

将 `getCitySummary` 的调用从裸 await 改为 try/catch 软失败，与 `getCityWeatherBundle` 的保护模式对齐：

**修复前：**
```typescript
const summary = includeWeatherSummary
  ? await this.weatherService.getCitySummary(city.cityId, {
      preferCache: true,
      allowFetch: true,
    })
  : undefined;
```

**修复后：**
```typescript
let summary: Awaited<ReturnType<typeof this.weatherService.getCitySummary>> | undefined;
if (includeWeatherSummary) {
  try {
    summary = await this.weatherService.getCitySummary(city.cityId, {
      preferCache: true,
      allowFetch: true,
    });
  } catch {
    // Single city summary failure must not kill the entire list response.
    summary = undefined;
  }
}
```

失败时 `weatherText` 和 `temperature` 降级为空字符串（[user-cities.service.ts:297-298](../src/cities/user-cities.service.ts#L297)），不影响其他城市或整体响应。

### 修改文件：[src/cities/__tests__/user-cities.service.spec.ts](../src/cities/__tests__/user-cities.service.spec.ts)

1. 新增测试：`getCitySummary` 抛异常时 `getUserCities` 仍返回 HTTP 200，`weatherText`/`temperature` 降级为空字符串。
2. 修复 mock 类型：`getCitySummary` 和 `getCityWeatherBundle` 的 `jest.fn()` 加 `as jest.Mock` 类型断言，使 `mockRejectedValue` 可正常调用。

## 验证结果

```
npm test   → Tests: 112 passed, 112 total (新增 1 个测试)
npm run build → 无 TypeScript 编译错误
```

## 未修改的关键逻辑

| 位置 | 原因 |
|------|------|
| `requireSnapshot` | 硬失败语义正确，城市详情页天气不可用时必须返回 500 |
| `getCityWeatherBundle` 的 try/catch | 已有保护，不得删除 |
| `getUsableSnapshot` 的 catch 块 | 无旧缓存时 re-throw 正确，不得改为静默返回 null |
| `addUserCity` 的 P2002 处理 | 幂等返回 200 正确，不得改为抛出 409 |
| `ensureCityExists` | 幂等返回已有城市正确 |

## 影响范围

- `GET /user/cities`：单城市天气摘要失败不再导致整个列表 500，降级返回空天气字段。
- `POST /cities`（登录用户）：无变更，幂等语义不变。
- 城市详情页四个天气端点（`/weather/current` 等）：无变更，硬失败语义保持。
