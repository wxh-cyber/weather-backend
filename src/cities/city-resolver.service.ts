import { Injectable } from '@nestjs/common';
import { WeatherProvider } from '../weather/weather.provider';
import type { CityMetadata } from '../weather/weather.types';
import { CITY_SEED_DATA, type SeedCity } from './city-seed';
import {
  buildSearchKeywordCandidates,
  findAliasCanonicalName,
  normalizeCityName,
  stripAdministrativeSuffix,
} from './city-search';

@Injectable()
export class CityResolverService {
  constructor(private readonly weatherProvider: WeatherProvider) {}

  async resolveCityMetadata(cityName: string): Promise<CityMetadata | null> {
    const normalizedInput = normalizeCityName(cityName);
    const directSeed = this.findSeedCity(normalizedInput);
    if (directSeed) {
      return this.toCityMetadata(directSeed);
    }

    const aliasCanonicalName = findAliasCanonicalName(normalizedInput);
    if (aliasCanonicalName) {
      const aliasSeed = this.findSeedCity(aliasCanonicalName);
      if (aliasSeed) {
        return this.toCityMetadata(aliasSeed);
      }
    }

    for (const query of this.buildQueryCandidates(normalizedInput)) {
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

  private buildQueryCandidates(cityName: string) {
    return buildSearchKeywordCandidates(cityName);
  }

  private findSeedCity(cityName: string): SeedCity | null {
    const normalizedInput = normalizeCityName(cityName);
    const strippedInput = stripAdministrativeSuffix(normalizedInput);

    return (
      CITY_SEED_DATA.find(
        (item) => normalizeCityName(item.cityName) === normalizedInput,
      ) ??
      CITY_SEED_DATA.find(
        (item) =>
          stripAdministrativeSuffix(normalizeCityName(item.cityName)) ===
          strippedInput,
      ) ??
      null
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
