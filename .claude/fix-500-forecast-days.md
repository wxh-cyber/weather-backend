---
date: 2026-05-09
tests: 112/112 passed
build: clean
status: verified live — all four weather endpoints return code:0 for previously failing city
---

# 城市详情页 500 错误修复记录 — forecast_days 超限（两处）

## 问题现象

前端访问 `GET http://localhost:5173/api/weather/daily?cityId=cmo5snlpd000hv34827obalfb`（武汉市），后端返回 500。四个天气端点全部受影响：`/weather/current`、`/weather/hourly`、`/weather/daily`、`/weather/daily-detail`。

## 诊断过程

1. 确认城市存在且坐标完整：武汉市 (30.5928, 114.3055)，不是坐标缺失问题。
2. 确认外部 API 可达：`api.open-meteo.com` 和 `air-quality-api.open-meteo.com` 均正常响应。
3. 手动构造 `fetchForecast` 实际发出的请求，发现 `forecast_days=90` 时 Forecast API 返回：
   ```json
   {"error": true, "reason": "Forecast days is invalid. Allowed range 0 to 16. Given 16."}
   ```
4. 修复 Forecast API 上限为 16 后，Wuhan 仍然 500。进一步排查发现 Air Quality API 上限更严格，只有 7 天：
   ```json
   {"error": true, "reason": "Forecast days is invalid. Allowed range 0 to 7. Given 7."}
   ```
5. 北京市之所以正常，是因为它已有缓存快照（`WeatherSnapshot` 表中有记录），`getUsableSnapshot` 的 catch 块直接返回旧缓存，不会触发 500。武汉市是首次访问，无缓存，才暴露了这两个问题。

## 根因

[src/weather/weather.provider.ts](../src/weather/weather.provider.ts) 中存在两处 API 限制违反：

1. **Forecast API**：`WEATHER_FORECAST_DAYS` 默认值为 90，clamp 上限也是 90，均超出 Open-Meteo 免费 API 的 16 天限制。
2. **Air Quality API**：复用了相同的 `normalizedForecastDays`（最大 16），但 Air Quality API 上限更严格，只允许 7 天。

## 修复内容

### [src/weather/weather.provider.ts](../src/weather/weather.provider.ts)

**修复 1 — Forecast API `forecast_days`（第 190-198 行）：**

```typescript
// 修复前
const forecastDays = this.configService.get<number>('WEATHER_FORECAST_DAYS', 90);
const normalizedForecastDays = Math.min(90, Math.max(1, Number(forecastDays) || 90));

// 修复后
const forecastDays = this.configService.get<number>('WEATHER_FORECAST_DAYS', 16);
// Open-Meteo free tier caps forecast_days at 16
const normalizedForecastDays = Math.min(16, Math.max(1, Number(forecastDays) || 16));
```

**修复 2 — Air Quality API `forecast_days`（第 236-239 行）：**

```typescript
// 修复前
airQualityUrl.searchParams.set('forecast_days', String(normalizedForecastDays));

// 修复后
airQualityUrl.searchParams.set(
  'forecast_days',
  // Air Quality API caps at 7 days (stricter than Forecast API's 16)
  String(Math.min(7, normalizedForecastDays)),
);
```

### [src/weather/__tests__/weather.provider.spec.ts](../src/weather/__tests__/weather.provider.spec.ts)

更新测试断言：当配置值为 90 时，URL 中的 `forecast_days` 应被 clamp 为 `'16'`，而非 `'90'`。

## 验证结果

```
npm test   → 112/112 passed
npm run build → clean
```

**实时验证（重启后端后）：**

| 端点 | 武汉市（之前失败） | 北京市（回归检查） |
|------|:-----------------:|:-----------------:|
| `/weather/current` | ✅ code:0 | ✅ code:0 |
| `/weather/hourly` | ✅ code:0 | ✅ code:0 |
| `/weather/daily` | ✅ code:0 | ✅ code:0 |
| `/weather/daily-detail` | ✅ code:0 | ✅ code:0 |

- 无效 cityId → 404（正确）
- 重复添加城市 → code:0 两次（无 409）
- 用户城市列表 → code:0

## API 限制速查

| API | 最大 forecast_days |
|-----|:-----------------:|
| Open-Meteo Forecast | 16 |
| Open-Meteo Air Quality | 7 |

## 同类风险排查

- `.env` 中如果配置了 `WEATHER_FORECAST_DAYS` 大于 16 的值，重启后仍会被 clamp 到 16，不影响功能。
- 已有缓存的城市（如北京市）不受影响，缓存过期后重新拉取时也会使用正确的参数。
- Air Quality API 使用独立的 clamp（7），不再复用 Forecast API 的 clamp（16）。
