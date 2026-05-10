import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { City, WeatherSnapshot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherProvider } from './weather.provider';
import type {
  CityWeatherBundle,
  DailyWeatherDetailPayload,
  WeatherCurrent,
  WeatherDailyItem,
  WeatherHourlyItem,
  WeatherSnapshotPayload,
} from './weather.types';

@Injectable()
export class WeatherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherProvider: WeatherProvider,
  ) {}

  async getCurrentWeather(cityId: string) {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.requireSnapshot(city);

    return {
      code: 0,
      message: '获取成功',
      data: {
        cityId: city.cityId,
        cityName: city.cityName,
        ...snapshot.current,
      } satisfies WeatherCurrent,
    };
  }

  async getHourlyWeather(cityId: string) {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.requireSnapshot(city);

    return {
      code: 0,
      message: '获取成功',
      data: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: snapshot.hourly,
      },
    };
  }

  async getDailyWeather(cityId: string) {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.requireSnapshot(city);

    return {
      code: 0,
      message: '获取成功',
      data: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: snapshot.daily,
      },
    };
  }

  async getDailyWeatherDetail(cityId: string) {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.requireSnapshot(city);

    return {
      code: 0,
      message: '获取成功',
      data: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: this.weatherProvider.buildDailyWeatherDetails(snapshot),
      } satisfies DailyWeatherDetailPayload,
    };
  }

  async getCityWeatherBundle(cityId: string): Promise<CityWeatherBundle> {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.requireSnapshot(city);

    return {
      current: {
        cityId: city.cityId,
        cityName: city.cityName,
        ...snapshot.current,
      },
      hourly: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: snapshot.hourly,
      },
      daily: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: snapshot.daily,
      },
      dailyDetail: {
        cityId: city.cityId,
        cityName: city.cityName,
        source: snapshot.source,
        items: this.weatherProvider.buildDailyWeatherDetails(snapshot),
      },
    };
  }

  async getCitySummary(
    cityId: string,
    options: { preferCache: boolean; allowFetch: boolean },
  ) {
    const city = await this.getCityOrThrow(cityId);
    const snapshot = await this.getUsableSnapshot(
      city,
      options.allowFetch,
      options.preferCache,
    );
    if (snapshot) {
      return {
        weatherText: snapshot.current.weatherText,
        temperature: snapshot.current.temperature,
      };
    }

    return this.buildFallbackSummary(city.cityName);
  }

  private async getCityOrThrow(cityId: string) {
    if (!cityId || !cityId.trim()) {
      throw new NotFoundException('目标城市不存在');
    }
    const city = await this.prisma.city.findUnique({ where: { cityId } });
    if (!city) {
      throw new NotFoundException('目标城市不存在');
    }
    return city;
  }

  private async requireSnapshot(city: City) {
    const snapshot = await this.getUsableSnapshot(city, true);
    if (!snapshot) {
      throw new InternalServerErrorException('天气数据获取失败，请稍后重试');
    }
    return snapshot;
  }

  private async getUsableSnapshot(
    city: City,
    allowFetch: boolean,
    preferCache = false,
  ): Promise<WeatherSnapshotPayload | null> {
    const snapshotRecord = await this.prisma.weatherSnapshot.findUnique({
      where: {
        cityId_source: {
          cityId: city.cityId,
          source: 'open-meteo',
        },
      },
    });

    if (snapshotRecord && snapshotRecord.expiresAt.getTime() > Date.now()) {
      return this.deserializeSnapshot(snapshotRecord);
    }

    if (preferCache && snapshotRecord) {
      return this.deserializeSnapshot(snapshotRecord);
    }

    if (!allowFetch) {
      return null;
    }

    try {
      const resolvedCity = await this.ensureCityCoordinates(city);
      const fetched = await this.weatherProvider.fetchForecast({
        cityName: resolvedCity.cityName,
        cityCode: resolvedCity.cityCode ?? undefined,
        province: resolvedCity.province ?? undefined,
        country: resolvedCity.country ?? undefined,
        latitude: Number(resolvedCity.latitude),
        longitude: Number(resolvedCity.longitude),
      });

      await this.prisma.weatherSnapshot.upsert({
        where: {
          cityId_source: {
            cityId: city.cityId,
            source: fetched.source,
          },
        },
        update: {
          weatherText: fetched.current.weatherText,
          temperature: fetched.current.temperature,
          currentJson: fetched.current,
          hourlyJson: fetched.hourly,
          dailyJson: {
            daily: fetched.daily,
            hourlyDetail: fetched.hourlyDetail ?? fetched.hourly,
          },
          fetchedAt: new Date(fetched.fetchedAt),
          expiresAt: new Date(fetched.expiresAt),
        },
        create: {
          cityId: city.cityId,
          source: fetched.source,
          weatherText: fetched.current.weatherText,
          temperature: fetched.current.temperature,
          currentJson: fetched.current,
          hourlyJson: fetched.hourly,
          dailyJson: {
            daily: fetched.daily,
            hourlyDetail: fetched.hourlyDetail ?? fetched.hourly,
          },
          fetchedAt: new Date(fetched.fetchedAt),
          expiresAt: new Date(fetched.expiresAt),
        },
      });

      return fetched;
    } catch (error) {
      if (snapshotRecord) {
        return this.deserializeSnapshot(snapshotRecord);
      }

      if (!preferCache) {
        throw error instanceof NotFoundException
          ? error
          : new InternalServerErrorException('天气数据获取失败，请稍后重试');
      }

      return null;
    }
  }

  private deserializeSnapshot(
    snapshotRecord: WeatherSnapshot,
  ): WeatherSnapshotPayload {
    const dailyJson = snapshotRecord.dailyJson as
      | WeatherDailyItem[]
      | {
          daily: WeatherDailyItem[];
          hourlyDetail?: WeatherHourlyItem[];
        };
    const dailyItems = Array.isArray(dailyJson) ? dailyJson : dailyJson.daily;
    const hourlyDetailItems = Array.isArray(dailyJson)
      ? undefined
      : dailyJson.hourlyDetail;
    const hourlyItems = snapshotRecord.hourlyJson as WeatherHourlyItem[];
    const currentPayload = this.backfillCurrentWeatherMetrics(
      snapshotRecord.currentJson as WeatherSnapshotPayload['current'],
      hourlyDetailItems ?? hourlyItems,
    );

    return {
      current: currentPayload,
      hourly: hourlyItems,
      hourlyDetail: hourlyDetailItems,
      daily: dailyItems,
      fetchedAt: snapshotRecord.fetchedAt.toISOString(),
      expiresAt: snapshotRecord.expiresAt.toISOString(),
      source: snapshotRecord.source,
    };
  }

  private backfillCurrentWeatherMetrics(
    current: WeatherSnapshotPayload['current'],
    sourceItems: WeatherHourlyItem[],
  ): WeatherSnapshotPayload['current'] {
    const fallback = sourceItems[0];
    if (!fallback) {
      return current;
    }

    const preferCurrent = <T extends string | undefined>(
      value: T,
      fallbackValue: T,
    ) => {
      if (value === undefined || value === null) {
        return fallbackValue;
      }

      const normalizedValue = value.trim();
      if (!normalizedValue || normalizedValue === '--') {
        return fallbackValue;
      }

      return value;
    };

    return {
      ...current,
      apparentTemperature: preferCurrent(
        current.apparentTemperature,
        fallback.apparentTemperature,
      ),
      precipitationProbability: preferCurrent(
        current.precipitationProbability,
        fallback.precipitationProbability,
      ),
      precipitationAmount: preferCurrent(
        current.precipitationAmount,
        fallback.precipitationAmount,
      ),
      cloudCover: preferCurrent(current.cloudCover, fallback.cloudCover),
      windDirection: preferCurrent(
        current.windDirection,
        fallback.windDirection,
      ),
      windSpeed: preferCurrent(current.windSpeed, fallback.windSpeed),
      humidity: preferCurrent(current.humidity, fallback.humidity),
      visibility: preferCurrent(current.visibility, fallback.visibility),
      pressure: preferCurrent(current.pressure, fallback.pressure),
      dewPoint: preferCurrent(current.dewPoint, fallback.dewPoint),
      airQuality: preferCurrent(current.airQuality, fallback.airQuality),
    };
  }

  private async ensureCityCoordinates(city: City) {
    if (city.latitude !== null && city.longitude !== null) {
      return city;
    }

    const resolved = await this.weatherProvider.resolveCityByName(
      city.cityName,
    );
    if (!resolved) {
      throw new NotFoundException('当前城市缺少可用坐标，暂无法拉取天气');
    }

    return this.prisma.city.update({
      where: { cityId: city.cityId },
      data: {
        province: resolved.province ?? city.province,
        country: resolved.country ?? city.country,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      },
    });
  }

  private buildFallbackSummary(cityName: string) {
    const seed = Array.from(cityName).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const weatherPool = ['晴', '多云', '阴', '小雨'];
    return {
      weatherText: weatherPool[seed % weatherPool.length] ?? '多云',
      temperature: `${12 + (seed % 17)}°C`,
    };
  }

}
