import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { City } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherProvider } from '../weather/weather.provider';
import { WeatherService } from '../weather/weather.service';
import { CITY_SEED_DATA } from './city-seed';

@Injectable()
export class CitiesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherService: WeatherService,
    private readonly weatherProvider: WeatherProvider,
  ) {}

  async onModuleInit() {
    await this.seedCities();
  }

  async getCities(keyword?: string) {
    const normalizedKeyword = this.normalizeKeyword(keyword);
    const cities = await this.prisma.city.findMany({
      where: normalizedKeyword
        ? {
            cityName: {
              contains: normalizedKeyword,
            },
          }
        : undefined,
      orderBy: [{ province: 'asc' }, { cityName: 'asc' }],
      take: normalizedKeyword ? 50 : 100,
    });

    const data = await Promise.all(
      cities.map((city) => this.toCityListItem(city)),
    );

    return {
      code: 0,
      message: '获取成功',
      data,
    };
  }

  async createCity(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const existing = await this.prisma.city.findUnique({
      where: { cityName: normalizedName },
    });
    if (existing) {
      throw new ConflictException('城市已存在，请勿重复添加');
    }

    const resolved =
      await this.weatherProvider.resolveCityByName(normalizedName);
    await this.prisma.city.create({
      data: {
        cityName: normalizedName,
        province: resolved?.province ?? '',
        country: resolved?.country ?? '中国',
        latitude: resolved?.latitude ?? null,
        longitude: resolved?.longitude ?? null,
      },
    });

    return this.getCities();
  }

  async renameCity(oldCityName: string, newCityName: string) {
    const normalizedOldName = this.normalizeAndValidateCityName(oldCityName);
    const normalizedNewName = this.normalizeAndValidateCityName(newCityName);

    const source = await this.prisma.city.findUnique({
      where: { cityName: normalizedOldName },
    });
    if (!source) {
      throw new NotFoundException('未找到待修改的城市');
    }

    const duplicate = await this.prisma.city.findUnique({
      where: { cityName: normalizedNewName },
    });
    if (duplicate && duplicate.cityId !== source.cityId) {
      throw new ConflictException('目标城市名称已存在');
    }

    const resolved =
      await this.weatherProvider.resolveCityByName(normalizedNewName);
    await this.prisma.city.update({
      where: { cityId: source.cityId },
      data: {
        cityName: normalizedNewName,
        province: resolved?.province ?? source.province,
        country: resolved?.country ?? source.country,
        latitude: resolved?.latitude ?? source.latitude,
        longitude: resolved?.longitude ?? source.longitude,
      },
    });

    return this.getCities();
  }

  async deleteCity(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const city = await this.prisma.city.findUnique({
      where: { cityName: normalizedName },
    });
    if (!city) {
      throw new NotFoundException('未找到待删除的城市');
    }

    await this.prisma.city.delete({
      where: { cityId: city.cityId },
    });

    return this.getCities();
  }

  private async seedCities() {
    await this.prisma.city.createMany({
      data: CITY_SEED_DATA,
      skipDuplicates: true,
    });
  }

  private normalizeKeyword(keyword?: string) {
    return (keyword ?? '').trim();
  }

  private normalizeAndValidateCityName(cityName: string) {
    const normalizedName = cityName.trim();
    if (!normalizedName) {
      throw new BadRequestException('城市名称不能为空');
    }
    return normalizedName;
  }

  private async toCityListItem(city: City) {
    const summary = await this.weatherService.getCitySummary(city.cityId, {
      preferCache: true,
      allowFetch: false,
    });

    return {
      cityId: city.cityId,
      cityName: city.cityName,
      cityCode: city.cityCode,
      province: city.province,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
      weatherText: summary.weatherText,
      temperature: summary.temperature,
    };
  }
}
