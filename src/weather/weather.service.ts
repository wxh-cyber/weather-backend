import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { City, WeatherSnapshot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherProvider } from './weather.provider';
import type {
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
          dailyJson: fetched.daily,
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
          dailyJson: fetched.daily,
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
    return {
      current: snapshotRecord.currentJson as WeatherSnapshotPayload['current'],
      hourly: snapshotRecord.hourlyJson as WeatherHourlyItem[],
      daily: snapshotRecord.dailyJson as WeatherDailyItem[],
      fetchedAt: snapshotRecord.fetchedAt.toISOString(),
      expiresAt: snapshotRecord.expiresAt.toISOString(),
      source: snapshotRecord.source,
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
