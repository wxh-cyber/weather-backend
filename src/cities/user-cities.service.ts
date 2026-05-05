import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
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
    return this.getUserCitiesResponse(userId, { includeWeatherBundle: true });
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

    try {
      await this.prisma.$transaction(async (tx) => {
        if (shouldSetDefault) {
          await tx.userCity.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }

        await tx.userCity.create({
          data: {
            userId,
            cityId,
            isDefault: shouldSetDefault,
            sortOrder: count,
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('该城市已在我的城市列表中');
      }
      throw new InternalServerErrorException('Failed to add city to user');
    }

    return this.getUserCitiesResponse(userId, { includeWeatherBundle: true });
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

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userCity.delete({
          where: { userCityId: existing.userCityId },
        });

        const remaining = await tx.userCity.findMany({
          where: { userId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        if (!remaining.some((item) => item.isDefault) && remaining[0]) {
          await tx.userCity.update({
            where: { userCityId: remaining[0].userCityId },
            data: { isDefault: true },
          });
        }

        await Promise.all(
          remaining.map((item, index) =>
            tx.userCity.update({
              where: { userCityId: item.userCityId },
              data: { sortOrder: index },
            }),
          ),
        );
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException('该城市不在当前用户的城市列表中');
      }
      throw new InternalServerErrorException('Failed to remove city from user');
    }

    return this.getUserCities(userId);
  }

  async removeUserCities(userId: string, cityIds: string[]) {
    const uniqueCityIds = [
      ...new Set(cityIds.map((cityId) => cityId.trim())),
    ].filter(Boolean);

    const existingItems = await this.prisma.userCity.findMany({
      where: {
        userId,
        cityId: {
          in: uniqueCityIds,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const existingCityIds = new Set(existingItems.map((item) => item.cityId));
    const failedCityIds = uniqueCityIds.filter(
      (cityId) => !existingCityIds.has(cityId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.userCity.deleteMany({
        where: {
          userId,
          cityId: {
            in: existingItems.map((item) => item.cityId),
          },
        },
      });

      await this.normalizeUserCityOrder(userId, tx);
    });
    const response = await this.getUserCitiesResponse(userId, {
      includeWeatherSummary: false,
      includeWeatherBundle: false,
    });

    return {
      ...response,
      message: '删除成功',
      failedCityIds,
    };
  }

  private async normalizeUserCityOrder(
    userId: string,
    prisma: Pick<PrismaService, 'userCity'> = this.prisma,
  ) {
    const remaining = await prisma.userCity.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    await Promise.all(
      remaining.map((item, index) =>
        prisma.userCity.update({
          where: { userCityId: item.userCityId },
          data: {
            sortOrder: index,
            isDefault: index === 0,
          },
        }),
      ),
    );
  }

  private async getUserCitiesResponse(
    userId: string,
    options: {
      includeWeatherSummary?: boolean;
      includeWeatherBundle?: boolean;
    } = {},
  ) {
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
      userCities.map((item) =>
        this.toUserCityResponse(
          item.city,
          item,
          options.includeWeatherSummary !== false,
          options.includeWeatherBundle === true,
        ),
      ),
    );

    return {
      code: 0,
      message: '获取成功',
      data,
    };
  }

  private async toUserCityResponse(
    city: City,
    userCity: UserCity,
    includeWeatherSummary = true,
    includeWeatherBundle = false,
  ) {
    const summary = includeWeatherSummary
      ? await this.weatherService.getCitySummary(city.cityId, {
          preferCache: true,
          allowFetch: true,
        })
      : undefined;
    const weather = includeWeatherBundle
      ? await this.weatherService.getCityWeatherBundle(city.cityId)
      : undefined;

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
      weatherText: summary?.weatherText ?? '',
      temperature: summary?.temperature ?? '',
      ...(weather ? { weather } : {}),
    };
  }
}
