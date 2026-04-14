import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { City, UserCity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';

@Injectable()
export class UserCitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherService: WeatherService,
  ) {}

  async getUserCities(userId: string) {
    const userCities = await this.prisma.userCity.findMany({
      where: { userId },
      include: {
        city: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const data = await Promise.all(
      userCities.map((item) => this.toUserCityResponse(item.city, item)),
    );

    return {
      code: 0,
      message: '获取成功',
      data,
    };
  }

  async addUserCity(userId: string, cityId: string, isDefault = false) {
    const city = await this.prisma.city.findUnique({ where: { cityId } });
    if (!city) {
      throw new NotFoundException('目标城市不存在');
    }

    const existing = await this.prisma.userCity.findUnique({
      where: {
        userId_cityId: {
          userId,
          cityId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('该城市已在我的城市列表中');
    }

    const count = await this.prisma.userCity.count({ where: { userId } });
    const shouldSetDefault = count === 0 || isDefault;

    if (shouldSetDefault) {
      await this.prisma.userCity.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await this.prisma.userCity.create({
      data: {
        userId,
        cityId,
        isDefault: shouldSetDefault,
        sortOrder: count,
      },
    });

    return this.getUserCities(userId);
  }

  async setDefaultCity(userId: string, cityId: string) {
    const existing = await this.prisma.userCity.findUnique({
      where: {
        userId_cityId: {
          userId,
          cityId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('该城市不在当前用户的城市列表中');
    }

    await this.prisma.$transaction([
      this.prisma.userCity.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.userCity.update({
        where: { userCityId: existing.userCityId },
        data: { isDefault: true },
      }),
    ]);

    return this.getUserCities(userId);
  }

  async removeUserCity(userId: string, cityId: string) {
    const existing = await this.prisma.userCity.findUnique({
      where: {
        userId_cityId: {
          userId,
          cityId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('该城市不在当前用户的城市列表中');
    }

    await this.prisma.userCity.delete({
      where: { userCityId: existing.userCityId },
    });

    const remaining = await this.prisma.userCity.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (!remaining.some((item) => item.isDefault) && remaining[0]) {
      await this.prisma.userCity.update({
        where: { userCityId: remaining[0].userCityId },
        data: { isDefault: true },
      });
    }

    await Promise.all(
      remaining.map((item, index) =>
        this.prisma.userCity.update({
          where: { userCityId: item.userCityId },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.getUserCities(userId);
  }

  private async toUserCityResponse(city: City, userCity: UserCity) {
    const summary = await this.weatherService.getCitySummary(city.cityId, {
      preferCache: true,
      allowFetch: true,
    });

    return {
      cityId: city.cityId,
      cityName: city.cityName,
      cityCode: city.cityCode,
      province: city.province,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
      isDefault: userCity.isDefault,
      sortOrder: userCity.sortOrder,
      weatherText: summary.weatherText,
      temperature: summary.temperature,
    };
  }
}
