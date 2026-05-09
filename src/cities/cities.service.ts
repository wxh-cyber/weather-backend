import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { City } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';
import { CITY_SEED_DATA } from './city-seed';
import { CityResolverService } from './city-resolver.service';
import {
  buildCitySearchMetadata,
  buildSearchKeywordCandidates,
  getCityMatchScore,
} from './city-search';

@Injectable()
export class CitiesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherService: WeatherService,
    private readonly cityResolver: CityResolverService,
  ) {}

  async onModuleInit() {
    await this.seedCities();
    await this.repairSeedCityCoordinates();
  }

  async getCities(keyword?: string) {
    const normalizedKeyword = this.normalizeKeyword(keyword);
    const keywordCandidates = normalizedKeyword
      ? buildSearchKeywordCandidates(normalizedKeyword)
      : [];
    const cities = await this.prisma.city.findMany({
      where: normalizedKeyword
        ? {
            OR: [
              {
                cityName: {
                  contains: normalizedKeyword,
                },
              },
              {
                normalizedName: {
                  in: keywordCandidates,
                },
              },
              ...keywordCandidates.map((candidate) => ({
                searchAliases: {
                  contains: candidate,
                },
              })),
            ],
          }
        : undefined,
      orderBy: [{ province: 'asc' }, { cityName: 'asc' }],
      take: normalizedKeyword ? 100 : 100,
    });
    const matchedCities = normalizedKeyword
      ? cities
          .filter((city) =>
            Number.isFinite(getCityMatchScore(city, normalizedKeyword)),
          )
          .sort((left, right) => {
            const scoreDiff =
              getCityMatchScore(left, normalizedKeyword) -
              getCityMatchScore(right, normalizedKeyword);
            if (scoreDiff !== 0) {
              return scoreDiff;
            }

            const provinceDiff = left.province.localeCompare(right.province);
            if (provinceDiff !== 0) {
              return provinceDiff;
            }

            return left.cityName.localeCompare(right.cityName);
          })
      : cities;

    const data = await Promise.all(
      matchedCities.map((city) => this.toCityListItem(city)),
    );

    return {
      code: 0,
      message: '获取成功',
      data,
    };
  }

  async createCity(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const resolved = await this.resolveCityMetadataOrThrow(normalizedName);
    const searchMetadata = buildCitySearchMetadata(resolved.cityName);
    const existing = await this.prisma.city.findUnique({
      where: { cityName: resolved.cityName },
    });
    if (existing) {
      throw new ConflictException('城市已存在，请勿重复添加');
    }

    try {
      await this.prisma.city.create({
        data: {
          cityName: resolved.cityName,
          normalizedName: searchMetadata.normalizedName,
          searchAliases: searchMetadata.searchAliases,
          cityCode: resolved.cityCode ?? null,
          province: resolved.province ?? '',
          country: resolved.country ?? '中国',
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        // Race condition: another request created the city concurrently
        // Retry to check if city now exists and return 409
        const retryExisting = await this.prisma.city.findUnique({
          where: { cityName: resolved.cityName },
        });
        if (retryExisting) {
          throw new ConflictException('城市已存在，请勿重复添加');
        }
        // If still not found after retry, treat as database error
        throw new InternalServerErrorException('Failed to create city');
      }
      throw new InternalServerErrorException('Failed to create city');
    }

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

    const resolved = await this.resolveCityMetadataOrThrow(normalizedNewName);
    const searchMetadata = buildCitySearchMetadata(resolved.cityName);
    const duplicate = await this.prisma.city.findUnique({
      where: { cityName: resolved.cityName },
    });
    if (duplicate && duplicate.cityId !== source.cityId) {
      throw new ConflictException('目标城市名称已存在');
    }

    await this.prisma.city.update({
      where: { cityId: source.cityId },
      data: {
        cityName: resolved.cityName,
        normalizedName: searchMetadata.normalizedName,
        searchAliases: searchMetadata.searchAliases,
        cityCode: resolved.cityCode ?? source.cityCode,
        province: resolved.province ?? source.province,
        country: resolved.country ?? source.country,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      },
    });

    return this.getCities();
  }

  async deleteCity(cityName: string) {
    const city = await this.getCityByNameOrThrow(cityName);
    if (!city) {
      throw new NotFoundException('未找到待删除的城市');
    }

    await this.prisma.city.delete({
      where: { cityId: city.cityId },
    });

    return this.getCities();
  }

  async ensureCityExists(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const resolved = await this.resolveCityMetadataOrThrow(normalizedName);
    const searchMetadata = buildCitySearchMetadata(resolved.cityName);
    const existing = await this.prisma.city.findUnique({
      where: { cityName: resolved.cityName },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.city.create({
        data: {
          cityName: resolved.cityName,
          normalizedName: searchMetadata.normalizedName,
          searchAliases: searchMetadata.searchAliases,
          cityCode: resolved.cityCode ?? null,
          province: resolved.province ?? '',
          country: resolved.country ?? '中国',
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        // Concurrent insertion: retry findUnique
        const retryExisting = await this.prisma.city.findUnique({
          where: { cityName: resolved.cityName },
        });
        if (retryExisting) {
          return retryExisting;
        }
      }
      throw new InternalServerErrorException(
        'Failed to create or retrieve city',
      );
    }
  }

  async getCityByNameOrThrow(cityName: string) {
    const normalizedName = this.normalizeAndValidateCityName(cityName);
    const city = await this.prisma.city.findUnique({
      where: { cityName: normalizedName },
    });
    if (!city) {
      throw new NotFoundException('未找到待删除的城市');
    }

    return city;
  }

  private async seedCities() {
    await this.prisma.city.createMany({
      data: CITY_SEED_DATA.map((city) => ({
        ...city,
        normalizedName: buildCitySearchMetadata(city.cityName).normalizedName,
        searchAliases: buildCitySearchMetadata(city.cityName).searchAliases,
      })),
      skipDuplicates: true,
    });
  }

  private async repairSeedCityCoordinates() {
    for (const seedCity of CITY_SEED_DATA) {
      const searchMetadata = buildCitySearchMetadata(seedCity.cityName);
      const existing = await this.prisma.city.findUnique({
        where: { cityName: seedCity.cityName },
      });
      if (!existing) {
        continue;
      }

      const shouldRepair =
        existing.normalizedName !== searchMetadata.normalizedName ||
        existing.searchAliases !== searchMetadata.searchAliases ||
        existing.cityCode !== seedCity.cityCode ||
        existing.country !== seedCity.country ||
        existing.province !== seedCity.province ||
        existing.latitude !== seedCity.latitude ||
        existing.longitude !== seedCity.longitude;
      if (!shouldRepair) {
        continue;
      }

      await this.prisma.city.update({
        where: { cityId: existing.cityId },
        data: {
          normalizedName: searchMetadata.normalizedName,
          searchAliases: searchMetadata.searchAliases,
          cityCode: seedCity.cityCode,
          province: seedCity.province,
          country: seedCity.country,
          latitude: seedCity.latitude,
          longitude: seedCity.longitude,
        },
      });
    }

    const unresolvedCities = await this.prisma.city.findMany({
      where: {
        OR: [{ latitude: null }, { longitude: null }],
      },
    });

    for (const city of unresolvedCities) {
      const resolved = await this.cityResolver.resolveCityMetadata(
        city.cityName,
      );
      if (!resolved) {
        continue;
      }

      const nextCityName = await this.resolveRepairCityName(
        city,
        resolved.cityName,
      );
      const searchMetadata = buildCitySearchMetadata(
        nextCityName === city.cityName ? city.cityName : resolved.cityName,
      );
      await this.prisma.city.update({
        where: { cityId: city.cityId },
        data: {
          cityName: nextCityName,
          normalizedName: searchMetadata.normalizedName,
          searchAliases: searchMetadata.searchAliases,
          cityCode: resolved.cityCode ?? city.cityCode,
          province: resolved.province ?? city.province,
          country: resolved.country ?? city.country,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        },
      });
    }
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

  private async resolveCityMetadataOrThrow(cityName: string) {
    const resolved = await this.cityResolver.resolveCityMetadata(cityName);
    if (!resolved) {
      throw new NotFoundException(
        '未找到可用于地图定位的地点，请输入更完整的名称',
      );
    }

    return resolved;
  }

  private async resolveRepairCityName(city: City, resolvedCityName: string) {
    if (city.cityName === resolvedCityName) {
      return city.cityName;
    }

    const duplicate = await this.prisma.city.findUnique({
      where: { cityName: resolvedCityName },
    });

    return duplicate ? city.cityName : resolvedCityName;
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
