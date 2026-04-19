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
    const geocodingBaseUrl = this.configService.get<string>(
      'WEATHER_GEOCODING_BASE_URL',
      'https://geocoding-api.open-meteo.com/v1/search',
    );

    const url = new URL(geocodingBaseUrl);
    url.searchParams.set('name', cityName);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'zh');
    url.searchParams.set('format', 'json');

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OpenMeteoGeocodingResponse;
    const result = payload.results?.[0];
    if (!result) {
      return null;
    }

    return {
      cityName,
      province: result.admin1,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    const provider = this.configService.get<string>(
      'WEATHER_REVERSE_GEOCODING_PROVIDER',
      'gaode',
    );
    if (provider !== 'gaode') {
      return null;
    }

    return this.reverseGeocodeWithGaode(latitude, longitude);
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

  private normalizeGaodeCity(
    city: string | string[] | undefined,
    province?: string,
  ) {
    if (Array.isArray(city)) {
      const firstCity = city.find((item) => this.cleanGaodeText(item));
      return this.cleanGaodeText(firstCity) ?? province;
    }

    return this.cleanGaodeText(city) ?? province;
  }

  private cleanGaodeText(value?: string) {
    const normalized = value?.trim();
    if (!normalized || normalized === '[]') {
      return undefined;
    }

    return normalized;
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
