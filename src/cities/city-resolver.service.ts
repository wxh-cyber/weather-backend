import { Injectable } from '@nestjs/common';
import { WeatherProvider } from '../weather/weather.provider';
import type { CityMetadata } from '../weather/weather.types';
import { CITY_ALIAS_GROUPS } from './city-alias';
import { CITY_SEED_DATA, type SeedCity } from './city-seed';

@Injectable()
export class CityResolverService {
  constructor(private readonly weatherProvider: WeatherProvider) {}

  async resolveCityMetadata(cityName: string): Promise<CityMetadata | null> {
    const normalizedInput = this.normalizeCityName(cityName);
    const directSeed = this.findSeedCity(normalizedInput);
    if (directSeed) {
      return this.toCityMetadata(directSeed);
    }

    const aliasCanonicalName = this.findAliasCanonicalName(normalizedInput);
    if (aliasCanonicalName) {
      const aliasSeed = this.findSeedCity(aliasCanonicalName);
      if (aliasSeed) {
        return this.toCityMetadata(aliasSeed);
      }
    }

    for (const query of this.buildQueryCandidates(
      normalizedInput,
      aliasCanonicalName,
    )) {
      const resolved = await this.weatherProvider.resolveCityByName(query);
      if (!resolved) {
        continue;
      }

      if (aliasCanonicalName) {
        return {
          ...resolved,
          cityName: aliasCanonicalName,
        };
      }

      return resolved;
    }

    return null;
  }

  private buildQueryCandidates(cityName: string, aliasCanonicalName?: string) {
    const strippedName = this.stripAdministrativeSuffix(cityName);
    const normalizedCandidates = [
      aliasCanonicalName,
      cityName,
      strippedName,
      strippedName && !strippedName.endsWith('市')
        ? `${strippedName}市`
        : undefined,
    ].filter((value): value is string => Boolean(value));

    return [
      ...new Set(
        normalizedCandidates.map((value) => this.normalizeCityName(value)),
      ),
    ];
  }

  private findSeedCity(cityName: string): SeedCity | null {
    const normalizedInput = this.normalizeCityName(cityName);
    const strippedInput = this.stripAdministrativeSuffix(normalizedInput);

    return (
      CITY_SEED_DATA.find(
        (item) => this.normalizeCityName(item.cityName) === normalizedInput,
      ) ??
      CITY_SEED_DATA.find(
        (item) =>
          this.stripAdministrativeSuffix(
            this.normalizeCityName(item.cityName),
          ) === strippedInput,
      ) ??
      null
    );
  }

  private findAliasCanonicalName(cityName: string) {
    const normalizedInput = this.normalizeCityName(cityName);
    const strippedInput = this.stripAdministrativeSuffix(normalizedInput);

    for (const group of CITY_ALIAS_GROUPS) {
      const normalizedCanonical = this.normalizeCityName(group.canonicalName);
      const strippedCanonical =
        this.stripAdministrativeSuffix(normalizedCanonical);
      if (
        normalizedCanonical === normalizedInput ||
        strippedCanonical === strippedInput
      ) {
        return group.canonicalName;
      }

      for (const alias of group.aliases) {
        const normalizedAlias = this.normalizeCityName(alias);
        if (
          normalizedAlias === normalizedInput ||
          this.stripAdministrativeSuffix(normalizedAlias) === strippedInput
        ) {
          return group.canonicalName;
        }
      }
    }

    return undefined;
  }

  private normalizeCityName(cityName: string) {
    return cityName.trim().replace(/\s+/g, '').replace(/　/g, '');
  }

  private stripAdministrativeSuffix(cityName: string) {
    return cityName.replace(
      /(特别行政区|自治州|自治县|自治区|市辖区|新区|开发区|街道办事处|街道|城区|地区|盟|州|区|县|旗|镇|乡|市)$/u,
      '',
    );
  }

  private toCityMetadata(seedCity: SeedCity): CityMetadata {
    return {
      cityName: seedCity.cityName,
      cityCode: seedCity.cityCode,
      province: seedCity.province,
      country: seedCity.country,
      latitude: seedCity.latitude,
      longitude: seedCity.longitude,
    };
  }
}
