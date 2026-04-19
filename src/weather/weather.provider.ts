import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReverseGeocodeResult } from './reverse-geocode.types';
import type {
  CityMetadata,
  WeatherDailyItem,
  WeatherHourlyItem,
  WeatherSnapshotPayload,
} from './weather.types';

type OpenMeteoForecastResponse = {
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
};

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

type GaodeGeocodingResponse = {
  status?: string;
  info?: string;
  geocodes?: Array<{
    formatted_address?: string;
    country?: string;
    province?: string;
    city?: string | string[];
    district?: string;
    level?: string;
    citycode?: string;
    adcode?: string;
    location?: string;
  }>;
};

type GaodeRegeoResponse = {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      country?: string;
      province?: string;
      city?: string | string[];
      district?: string;
      township?: string;
      neighborhood?: {
        name?: string;
      };
      building?: {
        name?: string;
      };
      streetNumber?: {
        street?: string;
        number?: string;
      };
    };
    pois?: Array<{
      name?: string;
    }>;
    aois?: Array<{
      name?: string;
    }>;
    roads?: Array<{
      name?: string;
    }>;
  };
};

type NominatimReverseGeocodeResponse = {
  name?: string;
  display_name?: string;
  address?: {
    country?: string;
    state?: string;
    province?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    city_district?: string;
    district?: string;
    suburb?: string;
    township?: string;
    neighbourhood?: string;
    neighborhood?: string;
    road?: string;
    house_number?: string;
    attraction?: string;
    building?: string;
    amenity?: string;
  };
};

type GeocodingCandidate = {
  cityName: string;
  cityCode?: string;
  province?: string;
  country?: string;
  district?: string;
  latitude: number;
  longitude: number;
  score: number;
};

@Injectable()
export class WeatherProvider {
  constructor(private readonly configService: ConfigService) {}

  async fetchForecast(city: CityMetadata): Promise<WeatherSnapshotPayload> {
    const weatherApiBaseUrl = this.configService.get<string>(
      'WEATHER_API_BASE_URL',
      'https://api.open-meteo.com/v1/forecast',
    );

    const url = new URL(weatherApiBaseUrl);
    url.searchParams.set('latitude', String(city.latitude));
    url.searchParams.set('longitude', String(city.longitude));
    url.searchParams.set(
      'timezone',
      this.configService.get<string>('WEATHER_TIMEZONE', 'Asia/Shanghai'),
    );
    url.searchParams.set('forecast_days', '7');
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set('hourly', 'temperature_2m,weather_code');
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min',
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new InternalServerErrorException('天气服务暂不可用');
    }

    const payload = (await response.json()) as OpenMeteoForecastResponse;
    if (!payload.current || !payload.hourly || !payload.daily) {
      throw new InternalServerErrorException('天气服务返回的数据不完整');
    }

    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('WEATHER_CACHE_MINUTES', 30) * 60 * 1000,
    ).toISOString();

    const hourly: WeatherHourlyItem[] = payload.hourly.time
      .slice(0, 24)
      .map((time, index) => ({
        time,
        temperature: `${Math.round(payload.hourly?.temperature_2m[index] ?? 0)}°C`,
        weatherText: this.mapWeatherCode(
          payload.hourly?.weather_code[index] ?? 0,
        ),
      }));

    const daily: WeatherDailyItem[] = payload.daily.time.map((date, index) => ({
      date,
      weatherText: this.mapWeatherCode(payload.daily?.weather_code[index] ?? 0),
      temperatureMax: `${Math.round(payload.daily?.temperature_2m_max[index] ?? 0)}°C`,
      temperatureMin: `${Math.round(payload.daily?.temperature_2m_min[index] ?? 0)}°C`,
    }));

    return {
      current: {
        weatherText: this.mapWeatherCode(payload.current.weather_code),
        temperature: `${Math.round(payload.current.temperature_2m)}°C`,
        observedAt: payload.current.time,
        source: 'open-meteo',
      },
      hourly,
      daily,
      fetchedAt,
      expiresAt,
      source: 'open-meteo',
    };
  }

  async resolveCityByName(cityName: string): Promise<CityMetadata | null> {
    const provider = this.configService.get<string>(
      'WEATHER_GEOCODING_PROVIDER',
      'gaode',
    );

    if (provider === 'open-meteo') {
      return this.resolveCityByNameWithOpenMeteo(cityName);
    }

    if (provider !== 'gaode') {
      return this.resolveCityByNameWithOpenMeteo(cityName);
    }

    const gaodeResolved = await this.resolveCityByNameWithGaode(cityName);
    if (gaodeResolved) {
      return gaodeResolved;
    }

    return this.resolveCityByNameWithOpenMeteo(cityName);
  }

  private async resolveCityByNameWithGaode(cityName: string): Promise<CityMetadata | null> {
    const geocodingBaseUrl = this.configService.get<string>(
      'WEATHER_GEOCODING_GAODE_BASE_URL',
      'https://restapi.amap.com/v3/geocode/geo',
    );
    const apiKey = this.configService.get<string>('WEATHER_GEOCODING_API_KEY', '');
    const timeoutMs = this.configService.get<number>('WEATHER_GEOCODING_TIMEOUT_MS', 2500);
    if (!apiKey) {
      return null;
    }

    const url = new URL(geocodingBaseUrl);
    url.searchParams.set('address', cityName);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('output', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as GaodeGeocodingResponse;
      const candidate = this.pickBestGaodeCandidate(cityName, payload.geocodes);
      if (!candidate) {
        return null;
      }

      return this.toCityMetadata(candidate);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveCityByNameWithOpenMeteo(
    cityName: string,
  ): Promise<CityMetadata | null> {
    const geocodingBaseUrl = this.configService.get<string>(
      'WEATHER_GEOCODING_BASE_URL',
      'https://geocoding-api.open-meteo.com/v1/search',
    );

    const url = new URL(geocodingBaseUrl);
    url.searchParams.set('name', cityName);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', 'zh');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as OpenMeteoGeocodingResponse;
      const result = this.pickBestOpenMeteoCandidate(cityName, payload.results);
      if (!result) {
        return null;
      }

      return this.toCityMetadata(result);
    } catch {
      return null;
    }
  }

  private pickBestGaodeCandidate(
    cityName: string,
    geocodes?: GaodeGeocodingResponse['geocodes'],
  ) {
    if (!geocodes?.length) {
      return null;
    }

    const candidates = geocodes
      .map((item) => {
        const city = this.normalizeGaodeCity(item.city, item.province, item.district, cityName);
        const province = this.cleanGaodeText(item.province);
        const district = this.cleanGaodeText(item.district);
        const location = this.parseGaodeLocation(item.location);
        if (!city || !location) {
          return null;
        }

        return {
          cityName: city,
          cityCode: this.cleanGaodeText(item.citycode) ?? this.cleanGaodeText(item.adcode),
          province,
          country: this.cleanGaodeText(item.country) ?? '中国',
          district,
          latitude: location.latitude,
          longitude: location.longitude,
          score: this.getGeocodingScore({
            inputName: cityName,
            cityName: city,
            province,
            district,
            country: item.country,
            level: item.level,
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        } satisfies GeocodingCandidate;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return this.selectBestCandidate(cityName, candidates);
  }

  private pickBestOpenMeteoCandidate(
    cityName: string,
    results?: OpenMeteoGeocodingResponse['results'],
  ) {
    if (!results?.length) {
      return null;
    }

    const candidates = results.map((item) => ({
      cityName: item.name.trim(),
      province: item.admin1,
      country: item.country,
      latitude: item.latitude,
      longitude: item.longitude,
      score: this.getGeocodingScore({
        inputName: cityName,
        cityName: item.name,
        province: item.admin1,
        country: item.country,
        latitude: item.latitude,
        longitude: item.longitude,
      }),
    }));

    if (
      candidates.every((item) => this.normalizeCountry(item.country) !== '中国')
      && this.looksLikeChineseCityName(cityName.trim())
    ) {
      return null;
    }

    return this.selectBestCandidate(cityName, candidates);
  }

  private selectBestCandidate(cityName: string, candidates: GeocodingCandidate[]) {
    if (!candidates.length) {
      return null;
    }

    const sortedCandidates = [...candidates].sort((left, right) => right.score - left.score);
    const bestCandidate = sortedCandidates[0];
    if (!bestCandidate) {
      return null;
    }

    const minimumScore = this.looksLikeChineseCityName(cityName.trim()) ? 110 : 60;
    return bestCandidate.score >= minimumScore ? bestCandidate : null;
  }

  private toCityMetadata(candidate: GeocodingCandidate): CityMetadata {
    return {
      cityName: candidate.cityName,
      cityCode: candidate.cityCode,
      province: candidate.province,
      country: candidate.country,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    };
  }

  private getGeocodingScore(input: {
    inputName: string;
    cityName?: string;
    province?: string;
    district?: string;
    country?: string;
    level?: string;
    latitude: number;
    longitude: number;
  }) {
    let score = 0;
    const normalizedInput = this.normalizeComparableName(input.inputName);
    const normalizedCityName = this.normalizeComparableName(input.cityName);
    const normalizedDistrict = this.normalizeComparableName(input.district);

    if (this.normalizeCountry(input.country) === '中国') {
      score += 100;
    }
    if (normalizedCityName && normalizedCityName === normalizedInput) {
      score += 55;
    }
    if (normalizedDistrict && normalizedDistrict === normalizedInput) {
      score += 32;
    }
    if (normalizedCityName && normalizedInput && normalizedCityName.includes(normalizedInput)) {
      score += 20;
    }
    if (normalizedCityName && normalizedInput && normalizedInput.includes(normalizedCityName)) {
      score += 18;
    }
    if (this.hasChineseAdministrativeSuffix(input.cityName)) {
      score += 10;
    }
    if (this.hasChineseAdministrativeSuffix(input.province)) {
      score += 6;
    }
    if (input.level === '市' || input.level === '区县') {
      score += 8;
    }
    if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
      score += 10;
    }

    return score;
  }

  private normalizeCountry(country?: string) {
    return country?.trim();
  }

  private hasChineseAdministrativeSuffix(value?: string) {
    return Boolean(value?.match(/(市|省|自治区|特别行政区)$/));
  }

  private looksLikeChineseCityName(value: string) {
    return /[\u4e00-\u9fff]/.test(value);
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const provider = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_PROVIDER',
      'gaode',
    );
    if (provider === 'nominatim') {
      return this.reverseGeocodeWithNominatim(latitude, longitude);
    }

    if (provider !== 'gaode') {
      return this.reverseGeocodeWithNominatim(latitude, longitude);
    }

    const gaodeResult = await this.reverseGeocodeWithGaode(latitude, longitude);
    if (gaodeResult) {
      return gaodeResult;
    }

    return this.reverseGeocodeWithNominatim(latitude, longitude);
  }

  private async reverseGeocodeWithGaode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const reverseGeocodingBaseUrl = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_BASE_URL',
      'https://restapi.amap.com/v3/geocode/regeo',
    );
    const timeoutMs = this.configService.get<number>(
      'WEATHER_REVERSE_GEOCODING_TIMEOUT_MS',
      2500,
    );
    const apiKey = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_API_KEY',
      '',
    );
    if (!apiKey) {
      return null;
    }

    const url = new URL(reverseGeocodingBaseUrl);
    url.searchParams.set('location', `${longitude},${latitude}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('extensions', 'all');
    url.searchParams.set('radius', '1000');
    url.searchParams.set('roadlevel', '0');
    url.searchParams.set('output', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as GaodeRegeoResponse;
      if (payload.status !== '1' || !payload.regeocode?.addressComponent) {
        return null;
      }

      const component = payload.regeocode.addressComponent;
      const province = this.cleanGaodeText(component.province);
      const city = this.normalizeGaodeCity(component.city, province);
      const district = this.cleanGaodeText(component.district);
      const township = this.cleanGaodeText(component.township);
      const poiName = this.cleanGaodeText(payload.regeocode.pois?.[0]?.name);
      const aoiName = this.cleanGaodeText(payload.regeocode.aois?.[0]?.name);
      const neighborhoodName = this.cleanGaodeText(
        component.neighborhood?.name,
      );
      const buildingName = this.cleanGaodeText(component.building?.name);
      const streetName = this.joinStreetNumber(
        component.streetNumber?.street,
        component.streetNumber?.number,
      );
      const roadName = this.cleanGaodeText(payload.regeocode.roads?.[0]?.name);
      const name =
        poiName ??
        aoiName ??
        buildingName ??
        neighborhoodName ??
        streetName ??
        roadName;
      const displayName = this.buildDisplayName([
        province,
        city,
        district,
        township,
        name,
      ]);

      if (!displayName) {
        return null;
      }

      return {
        displayName,
        name,
        township,
        district,
        city,
        province,
        country: this.cleanGaodeText(component.country) ?? '中国',
        latitude,
        longitude,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async reverseGeocodeWithNominatim(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const reverseGeocodingBaseUrl = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_FALLBACK_BASE_URL',
      'https://nominatim.openstreetmap.org/reverse',
    );
    const timeoutMs = this.configService.get<number>(
      'WEATHER_REVERSE_GEOCODING_TIMEOUT_MS',
      2500,
    );
    const userAgent = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_USER_AGENT',
      'weather-backend/1.0',
    );

    const url = new URL(reverseGeocodingBaseUrl);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'zh-CN,zh');
    url.searchParams.set('zoom', '18');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as NominatimReverseGeocodeResponse;
      const address = payload.address;
      if (!address) {
        return null;
      }

      const province = this.cleanNominatimText(address.state ?? address.province);
      const city = this.cleanNominatimText(
        address.city ?? address.town ?? address.village ?? address.county,
      );
      const district = this.cleanNominatimText(
        address.city_district ?? address.district ?? address.suburb ?? address.township,
      );
      const name = this.joinStreetNumber(
        address.road
          ?? address.neighbourhood
          ?? address.neighborhood
          ?? address.attraction
          ?? address.building
          ?? address.amenity
          ?? payload.name,
        address.house_number,
      );
      const displayName = this.buildDisplayName([
        province,
        city,
        district,
        name,
      ]) || this.cleanNominatimText(payload.display_name);

      if (!displayName) {
        return null;
      }

      return {
        displayName,
        name,
        district,
        city,
        province,
        country: this.cleanNominatimText(address.country) ?? '中国',
        latitude,
        longitude,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeGaodeCity(
    city: string | string[] | undefined,
    province?: string,
    district?: string,
    fallbackName?: string,
  ) {
    if (Array.isArray(city)) {
      const firstCity = city.find((item) => this.cleanGaodeText(item));
      return (
        this.cleanGaodeText(firstCity)
        ?? this.cleanGaodeText(district)
        ?? this.cleanGaodeText(province)
        ?? this.cleanGaodeText(fallbackName)
      );
    }

    return (
      this.cleanGaodeText(city)
      ?? this.cleanGaodeText(district)
      ?? this.cleanGaodeText(province)
      ?? this.cleanGaodeText(fallbackName)
    );
  }

  private cleanGaodeText(value?: string) {
    const normalized = value?.trim();
    if (!normalized || normalized === '[]') {
      return undefined;
    }

    return normalized;
  }

  private cleanNominatimText(value?: string) {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    return normalized;
  }

  private normalizeComparableName(value?: string) {
    return value?.trim().replace(/\s+/g, '').replace(
      /(特别行政区|自治州|自治县|自治区|市辖区|新区|开发区|街道办事处|街道|城区|地区|盟|州|区|县|旗|镇|乡|市)$/u,
      '',
    );
  }

  private parseGaodeLocation(location?: string) {
    const [longitudeText, latitudeText] = location?.split(',') ?? [];
    const longitude = Number(longitudeText);
    const latitude = Number(latitudeText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
    };
  }

  private joinStreetNumber(street?: string, number?: string) {
    const streetText = this.cleanGaodeText(street);
    const numberText = this.cleanGaodeText(number);
    if (!streetText) {
      return undefined;
    }

    return `${streetText}${numberText ?? ''}`;
  }

  private buildDisplayName(segments: Array<string | undefined>) {
    return [...new Set(segments.filter(Boolean))].join(' · ');
  }

  private mapWeatherCode(code: number) {
    if (code === 0) return '晴';
    if ([1, 2, 3].includes(code)) return '多云';
    if ([45, 48].includes(code)) return '雾';
    if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '小雨';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '小雪';
    if ([95, 96, 99].includes(code)) return '雷阵雨';
    return '阴';
  }
}
