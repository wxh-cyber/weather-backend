import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReverseGeocodeResult } from './reverse-geocode.types';
import type {
  CityMetadata,
  DailyWeatherDetailItem,
  DayPeriodMetrics,
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
    apparent_temperature: number[];
    precipitation_probability: number[];
    precipitation: number[];
    cloud_cover: number[];
    wind_direction_10m: number[];
    wind_speed_10m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    pressure_msl: number[];
    visibility: number[];
    is_day: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
  };
};

type OpenMeteoAirQualityResponse = {
  hourly?: {
    time: string[];
    us_aqi: number[];
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

type ReverseGeocodeFetchOptions = {
  url: URL;
  timeoutMs: number;
  headers: Record<string, string>;
  isUsablePayload?: (payload: unknown) => boolean;
};

type PointCoordinate = {
  longitude: number;
  latitude: number;
};

type WeatherHourSlice = {
  time: string;
  hour: number;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  precipitationAmount: number | null;
  cloudCover: number | null;
  windDirection: number | null;
  windDirectionText: string;
  isDay: boolean;
  airQuality: number | null;
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
    const forecastDays = this.configService.get<number>(
      'WEATHER_FORECAST_DAYS',
      16,
    );
    // Open-Meteo free tier caps forecast_days at 16
    const normalizedForecastDays = Math.min(
      16,
      Math.max(1, Number(forecastDays) || 16),
    );
    url.searchParams.set('forecast_days', String(normalizedForecastDays));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set(
      'hourly',
      [
        'temperature_2m',
        'weather_code',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'cloud_cover',
        'wind_direction_10m',
        'wind_speed_10m',
        'relative_humidity_2m',
        'dew_point_2m',
        'pressure_msl',
        'visibility',
        'is_day',
      ].join(','),
    );
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    );

    const airQualityUrl = new URL(
      this.configService.get<string>(
        'WEATHER_AIR_QUALITY_API_BASE_URL',
        'https://air-quality-api.open-meteo.com/v1/air-quality',
      ),
    );
    airQualityUrl.searchParams.set('latitude', String(city.latitude));
    airQualityUrl.searchParams.set('longitude', String(city.longitude));
    airQualityUrl.searchParams.set(
      'timezone',
      this.configService.get<string>('WEATHER_TIMEZONE', 'Asia/Shanghai'),
    );
    airQualityUrl.searchParams.set(
      'forecast_days',
      // Air Quality API caps at 7 days (stricter than Forecast API's 16)
      String(Math.min(7, normalizedForecastDays)),
    );
    airQualityUrl.searchParams.set('hourly', 'us_aqi');

    const [response, airQualityResponse] = await Promise.all([
      fetch(url),
      fetch(airQualityUrl),
    ]);

    if (!response.ok || !airQualityResponse.ok) {
      throw new InternalServerErrorException('天气服务暂不可用');
    }

    const [payload, airQualityPayload] = (await Promise.all([
      response.json(),
      airQualityResponse.json(),
    ])) as [OpenMeteoForecastResponse, OpenMeteoAirQualityResponse];

    if (
      !payload.current ||
      !payload.hourly ||
      !payload.daily ||
      !airQualityPayload.hourly
    ) {
      throw new InternalServerErrorException('天气服务返回的数据不完整');
    }

    const hourlyPayload = payload.hourly;
    const dailyPayload = payload.daily;
    const airQualityHourly = airQualityPayload.hourly;

    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('WEATHER_CACHE_MINUTES', 30) * 60 * 1000,
    ).toISOString();

    const fullHourly: WeatherHourlyItem[] = hourlyPayload.time.map(
      (time, index) => ({
        time,
        temperature: `${Math.round(hourlyPayload.temperature_2m[index] ?? 0)}°C`,
        weatherText: this.mapWeatherCode(
          hourlyPayload.weather_code[index] ?? 0,
        ),
        apparentTemperature: this.formatTemperature(
          hourlyPayload.apparent_temperature[index],
        ),
        precipitationProbability: this.formatPercentage(
          hourlyPayload.precipitation_probability[index],
        ),
        precipitationAmount: this.formatPrecipitation(
          hourlyPayload.precipitation[index],
        ),
        cloudCover: this.formatPercentage(hourlyPayload.cloud_cover[index]),
        windDirectionDegrees: hourlyPayload.wind_direction_10m[index] ?? null,
        windDirection: this.formatWindDirection(
          hourlyPayload.wind_direction_10m[index],
        ),
        windSpeed: this.formatWindSpeed(hourlyPayload.wind_speed_10m[index]),
        humidity: this.formatPercentage(
          hourlyPayload.relative_humidity_2m[index],
        ),
        visibility: this.formatVisibility(hourlyPayload.visibility[index]),
        pressure: this.formatPressure(hourlyPayload.pressure_msl[index]),
        dewPoint: this.formatTemperature(hourlyPayload.dew_point_2m[index]),
        isDay: (hourlyPayload.is_day[index] ?? 0) === 1,
        airQuality: this.formatAirQuality(
          this.lookupAirQualityByTime(
            airQualityHourly.time,
            airQualityHourly.us_aqi,
            time,
          ),
        ),
      }),
    );
    const hourly: WeatherHourlyItem[] = fullHourly.slice(0, 24);

    const daily: WeatherDailyItem[] = dailyPayload.time.map((date, index) => ({
      date,
      weatherText: this.mapWeatherCode(dailyPayload.weather_code[index] ?? 0),
      temperatureMax: `${Math.round(dailyPayload.temperature_2m_max[index] ?? 0)}°C`,
      temperatureMin: `${Math.round(dailyPayload.temperature_2m_min[index] ?? 0)}°C`,
      sunrise: this.formatClock(dailyPayload.sunrise[index]),
      sunset: this.formatClock(dailyPayload.sunset[index]),
      dayWeatherText: this.resolvePeriodWeatherText(
        hourlyPayload.time,
        hourlyPayload.weather_code,
        date,
        true,
      ),
      nightWeatherText: this.resolvePeriodWeatherText(
        hourlyPayload.time,
        hourlyPayload.weather_code,
        date,
        false,
      ),
    }));

    return {
      current: {
        weatherText: this.mapWeatherCode(payload.current.weather_code),
        temperature: `${Math.round(payload.current.temperature_2m)}°C`,
        apparentTemperature: fullHourly[0]?.apparentTemperature ?? '--',
        precipitationProbability:
          fullHourly[0]?.precipitationProbability ?? '--',
        precipitationAmount: fullHourly[0]?.precipitationAmount ?? '--',
        cloudCover: fullHourly[0]?.cloudCover ?? '--',
        windDirection: fullHourly[0]?.windDirection ?? '--',
        windSpeed: fullHourly[0]?.windSpeed ?? '--',
        humidity: fullHourly[0]?.humidity ?? '--',
        visibility: fullHourly[0]?.visibility ?? '--',
        pressure: fullHourly[0]?.pressure ?? '--',
        dewPoint: fullHourly[0]?.dewPoint ?? '--',
        airQuality: fullHourly[0]?.airQuality ?? '--',
        observedAt: payload.current.time,
        source: 'open-meteo',
      },
      hourly,
      hourlyDetail: fullHourly,
      daily,
      fetchedAt,
      expiresAt,
      source: 'open-meteo',
    };
  }

  buildDailyWeatherDetails(
    snapshot: WeatherSnapshotPayload,
  ): DailyWeatherDetailItem[] {
    const hourlyDetailItems = snapshot.hourlyDetail ?? snapshot.hourly;
    const dailyItems = snapshot.daily;
    return dailyItems.map(
      (dailyItem: WeatherDailyItem): DailyWeatherDetailItem => {
        const dayHours = this.collectDatePeriodHours(
          hourlyDetailItems,
          dailyItem.date,
          true,
        );
        const nightHours = this.collectDatePeriodHours(
          hourlyDetailItems,
          dailyItem.date,
          false,
        );

        return {
          date: dailyItem.date,
          temperatureMax: dailyItem.temperatureMax,
          temperatureMin: dailyItem.temperatureMin,
          sunrise: `${dailyItem.sunrise ?? '--'}`,
          sunset: `${dailyItem.sunset ?? '--'}`,
          dayWeatherText: `${
            dailyItem.dayWeatherText ?? dailyItem.weatherText ?? '未知'
          }`,
          nightWeatherText: `${
            dailyItem.nightWeatherText ?? dailyItem.weatherText ?? '未知'
          }`,
          // buildPeriodMetrics 已返回 DayPeriodMetrics；部分 ESLint+project 组合仍误报 error-typed

          dayMetrics: this.buildPeriodMetrics(dayHours),

          nightMetrics: this.buildPeriodMetrics(nightHours),
        };
      },
    );
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

  private async resolveCityByNameWithGaode(
    cityName: string,
  ): Promise<CityMetadata | null> {
    const geocodingBaseUrl = this.configService.get<string>(
      'WEATHER_GEOCODING_GAODE_BASE_URL',
      'https://restapi.amap.com/v3/geocode/geo',
    );
    const apiKey = this.configService.get<string>(
      'WEATHER_GEOCODING_API_KEY',
      '',
    );
    const timeoutMs = this.configService.get<number>(
      'WEATHER_GEOCODING_TIMEOUT_MS',
      2500,
    );
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
        const city = this.normalizeGaodeCity(
          item.city,
          item.province,
          item.district,
          cityName,
        );
        const province = this.cleanGaodeText(item.province);
        const district = this.cleanGaodeText(item.district);
        const location = this.parseGaodeLocation(item.location);
        if (!city || !location) {
          return null;
        }

        return {
          cityName: city,
          cityCode:
            this.cleanGaodeText(item.citycode) ??
            this.cleanGaodeText(item.adcode),
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
      candidates.every(
        (item) => this.normalizeCountry(item.country) !== '中国',
      ) &&
      this.looksLikeChineseCityName(cityName.trim())
    ) {
      return null;
    }

    return this.selectBestCandidate(cityName, candidates);
  }

  private selectBestCandidate(
    cityName: string,
    candidates: GeocodingCandidate[],
  ) {
    if (!candidates.length) {
      return null;
    }

    const sortedCandidates = [...candidates].sort(
      (left, right) => right.score - left.score,
    );
    const bestCandidate = sortedCandidates[0];
    if (!bestCandidate) {
      return null;
    }

    const minimumScore = this.looksLikeChineseCityName(cityName.trim())
      ? 110
      : 60;
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
    if (
      normalizedCityName &&
      normalizedInput &&
      normalizedCityName.includes(normalizedInput)
    ) {
      score += 20;
    }
    if (
      normalizedCityName &&
      normalizedInput &&
      normalizedInput.includes(normalizedCityName)
    ) {
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

  private isPointInChina(longitude: number, latitude: number) {
    return (
      longitude >= 72.004 &&
      longitude <= 137.8347 &&
      latitude >= 0.8293 &&
      latitude <= 55.8271
    );
  }

  private transformLatitude(x: number, y: number) {
    let result =
      -100 +
      2 * x +
      3 * y +
      0.2 * y * y +
      0.1 * x * y +
      0.2 * Math.sqrt(Math.abs(x));
    result +=
      ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) /
      3;
    result +=
      ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
    result +=
      ((160 * Math.sin((y / 12) * Math.PI) +
        320 * Math.sin((y * Math.PI) / 30)) *
        2) /
      3;
    return result;
  }

  private transformLongitude(x: number, y: number) {
    let result =
      300 +
      x +
      2 * y +
      0.1 * x * x +
      0.1 * x * y +
      0.1 * Math.sqrt(Math.abs(x));
    result +=
      ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) /
      3;
    result +=
      ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
    result +=
      ((150 * Math.sin((x / 12) * Math.PI) +
        300 * Math.sin((x / 30) * Math.PI)) *
        2) /
      3;
    return result;
  }

  private wgs84ToGcj02(longitude: number, latitude: number): PointCoordinate {
    if (!this.isPointInChina(longitude, latitude)) {
      return {
        longitude,
        latitude,
      };
    }

    const a = 6378245.0;
    const ee = Number.parseFloat('0.006693421622965943');
    const deltaLat = this.transformLatitude(longitude - 105, latitude - 35);
    const deltaLng = this.transformLongitude(longitude - 105, latitude - 35);
    const radLat = (latitude / 180) * Math.PI;
    const sinLat = Math.sin(radLat);
    const magic = 1 - ee * sinLat * sinLat;
    const sqrtMagic = Math.sqrt(magic);
    const adjustedLat =
      (deltaLat * 180) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
    const adjustedLng =
      (deltaLng * 180) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

    return {
      longitude: longitude + adjustedLng,
      latitude: latitude + adjustedLat,
    };
  }

  private async fetchReverseGeocodeJson<T>({
    url,
    timeoutMs,
    headers,
    isUsablePayload,
  }: ReverseGeocodeFetchOptions): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        });
        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as T;
        if (isUsablePayload && !isUsablePayload(payload)) {
          continue;
        }

        return payload;
      } catch {
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }

    return null;
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
    const gcj02Point = this.wgs84ToGcj02(longitude, latitude);

    const url = new URL(reverseGeocodingBaseUrl);
    url.searchParams.set(
      'location',
      `${gcj02Point.longitude},${gcj02Point.latitude}`,
    );
    url.searchParams.set('key', apiKey);
    url.searchParams.set('extensions', 'all');
    url.searchParams.set('radius', '1000');
    url.searchParams.set('roadlevel', '0');
    url.searchParams.set('output', 'json');

    const payload = await this.fetchReverseGeocodeJson<GaodeRegeoResponse>({
      url,
      timeoutMs,
      headers: {
        Accept: 'application/json',
      },
      isUsablePayload: (value) =>
        Boolean(
          (value as GaodeRegeoResponse | undefined)?.status === '1' &&
          (value as GaodeRegeoResponse | undefined)?.regeocode
            ?.addressComponent,
        ),
    });
    if (
      !payload ||
      payload.status !== '1' ||
      !payload.regeocode?.addressComponent
    ) {
      return null;
    }

    const component = payload.regeocode.addressComponent;
    const province = this.cleanGaodeText(component.province);
    const city = this.normalizeGaodeCity(component.city, province);
    const district = this.cleanGaodeText(component.district);
    const township = this.cleanGaodeText(component.township);
    const poiName = this.cleanGaodeText(payload.regeocode.pois?.[0]?.name);
    const aoiName = this.cleanGaodeText(payload.regeocode.aois?.[0]?.name);
    const neighborhoodName = this.cleanGaodeText(component.neighborhood?.name);
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

    const payload =
      await this.fetchReverseGeocodeJson<NominatimReverseGeocodeResponse>({
        url,
        timeoutMs,
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        isUsablePayload: (value) => {
          const payload = value as NominatimReverseGeocodeResponse | undefined;
          const address = payload?.address;
          const displayName = this.cleanNominatimText(payload?.display_name);
          const fallbackName = this.cleanNominatimText(payload?.name);
          const hasStructuredAddress = Boolean(
            this.cleanNominatimText(address?.country) ??
            this.cleanNominatimText(address?.state) ??
            this.cleanNominatimText(address?.province) ??
            this.cleanNominatimText(address?.city) ??
            this.cleanNominatimText(address?.town) ??
            this.cleanNominatimText(address?.village) ??
            this.cleanNominatimText(address?.county) ??
            this.cleanNominatimText(address?.city_district) ??
            this.cleanNominatimText(address?.district) ??
            this.cleanNominatimText(address?.suburb) ??
            this.cleanNominatimText(address?.township) ??
            this.cleanNominatimText(address?.neighbourhood) ??
            this.cleanNominatimText(address?.neighborhood) ??
            this.cleanNominatimText(address?.road) ??
            this.cleanNominatimText(address?.house_number) ??
            this.cleanNominatimText(address?.attraction) ??
            this.cleanNominatimText(address?.building) ??
            this.cleanNominatimText(address?.amenity),
          );

          return Boolean(hasStructuredAddress || displayName || fallbackName);
        },
      });
    if (!payload) {
      return null;
    }

    const address = payload.address;
    const province = this.cleanNominatimText(
      address?.state ?? address?.province,
    );
    const city = this.cleanNominatimText(
      address?.city ?? address?.town ?? address?.village ?? address?.county,
    );
    const district = this.cleanNominatimText(
      address?.city_district ??
        address?.district ??
        address?.suburb ??
        address?.township,
    );
    const name = this.joinStreetNumber(
      address?.road ??
        address?.neighbourhood ??
        address?.neighborhood ??
        address?.attraction ??
        address?.building ??
        address?.amenity ??
        payload.name,
      address?.house_number,
    );
    const displayName =
      this.buildDisplayName([province, city, district, name]) ||
      this.cleanNominatimText(payload.display_name);

    if (!displayName) {
      return null;
    }

    return {
      displayName,
      name,
      district,
      city,
      province,
      country: this.cleanNominatimText(address?.country) ?? '中国',
      latitude,
      longitude,
    };
  }

  private collectDatePeriodHours(
    hourlyItems: WeatherHourlyItem[],
    date: string,
    isDay: boolean,
  ): WeatherHourSlice[] {
    const slices = hourlyItems
      .filter((item: WeatherHourlyItem) => item.time.startsWith(date))
      .map((item: WeatherHourlyItem) => ({
        time: item.time,
        hour: Number.parseInt(item.time.slice(11, 13), 10),
        apparentTemperature: this.parseNumericValue(item.apparentTemperature),
        precipitationProbability: this.parseNumericValue(
          item.precipitationProbability,
        ),
        precipitationAmount: this.parseNumericValue(item.precipitationAmount),
        cloudCover: this.parseNumericValue(item.cloudCover),
        windDirection:
          item.windDirectionDegrees ??
          this.parseNumericValue(item.windDirection),
        windDirectionText: item.windDirection ?? '--',
        isDay: item.isDay ?? false,
        airQuality: this.parseNumericValue(item.airQuality),
      }))
      .filter((item) =>
        isDay
          ? item.isDay || (item.hour >= 6 && item.hour < 18)
          : !item.isDay || item.hour < 6 || item.hour >= 18,
      );

    return slices;
  }

  private buildPeriodMetrics(hours: WeatherHourSlice[]): DayPeriodMetrics {
    if (!hours.length) {
      return this.createEmptyMetrics();
    }

    const representativeHour =
      hours[Math.floor(hours.length / 2)] ?? hours[0] ?? null;
    const precipitationTotal = hours.reduce(
      (sum, item) => sum + (item.precipitationAmount ?? 0),
      0,
    );

    const formattedWindDirection = this.formatWindDirection(
      representativeHour?.windDirection,
    );
    const metrics = {
      feelsLike:
        this.formatTemperature(representativeHour?.apparentTemperature) ?? '--',
      precipitationProbability:
        this.formatPercentage(
          this.average(
            hours.map(
              (item: WeatherHourSlice) => item.precipitationProbability,
            ),
          ),
        ) ?? '--',
      precipitationAmount:
        this.formatPrecipitation(
          precipitationTotal > 0
            ? precipitationTotal
            : representativeHour?.precipitationAmount,
        ) ?? '--',
      airQuality:
        this.formatAirQuality(
          this.average(hours.map((item: WeatherHourSlice) => item.airQuality)),
        ) ?? '--',
      windDirection:
        formattedWindDirection !== '--'
          ? formattedWindDirection
          : (representativeHour?.windDirectionText ?? '--'),
      cloudCover:
        this.formatPercentage(
          this.average(hours.map((item: WeatherHourSlice) => item.cloudCover)),
        ) ?? '--',
    } satisfies DayPeriodMetrics;

    return metrics;
  }

  private createEmptyMetrics(): DayPeriodMetrics {
    return {
      feelsLike: '--',
      precipitationProbability: '--',
      precipitationAmount: '--',
      airQuality: '--',
      windDirection: '--',
      cloudCover: '--',
    };
  }

  private resolvePeriodWeatherText(
    times: string[],
    weatherCodes: number[],
    date: string,
    isDay: boolean,
  ): string {
    const items = times
      .map((time, index) => ({
        time,
        code: weatherCodes[index] ?? 0,
        hour: Number.parseInt(time.slice(11, 13), 10),
      }))
      .filter((item) => item.time.startsWith(date))
      .filter((item) =>
        isDay
          ? item.hour >= 6 && item.hour < 18
          : item.hour < 6 || item.hour >= 18,
      );

    if (!items.length) {
      return '';
    }

    const representative = items[Math.floor(items.length / 2)] ?? items[0];
    return this.mapWeatherCode(representative?.code ?? 0);
  }

  private lookupAirQualityByTime(
    times: string[],
    values: number[],
    targetTime: string,
  ): number | null {
    const index = times.findIndex((time) => time === targetTime);
    if (index >= 0) {
      return values[index] ?? null;
    }

    return null;
  }

  private average(values: Array<number | null>): number | null {
    const usable = values.filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );
    if (!usable.length) {
      return null;
    }

    return usable.reduce((sum, value) => sum + value, 0) / usable.length;
  }

  private parseNumericValue(value?: string): number | null {
    if (!value || value === '--') {
      return null;
    }

    const matched = value.match(/-?\d+(\.\d+)?/);
    const matchedText = matched?.[0];
    const parsed = Number.parseFloat(matchedText ?? '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatTemperature(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${Math.round(value as number)}°C`;
  }

  private formatPercentage(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${Math.round(value as number)}%`;
  }

  private formatPrecipitation(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${(value as number).toFixed((value as number) >= 10 ? 0 : 1)} mm`;
  }

  private formatWindSpeed(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${(value as number).toFixed(1)} km/h`;
  }

  private formatVisibility(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${((value as number) / 1000).toFixed(1)} 公里`;
  }

  private formatPressure(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `${Math.round(value as number)} hPa`;
  }

  private formatAirQuality(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    return `AQI ${Math.round(value as number)}`;
  }

  private formatClock(value?: string): string {
    if (!value) {
      return '--';
    }

    const matched = value.match(/T(\d{2}:\d{2})/);
    return matched?.[1] ?? '--';
  }

  private formatWindDirection(value?: number | null): string {
    if (!Number.isFinite(value ?? NaN)) {
      return '--';
    }

    const angle = (((value as number) % 360) + 360) % 360;
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const index = Math.round(angle / 45) % directions.length;
    return directions[index] ?? '--';
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
        this.cleanGaodeText(firstCity) ??
        this.cleanGaodeText(district) ??
        this.cleanGaodeText(province) ??
        this.cleanGaodeText(fallbackName)
      );
    }

    return (
      this.cleanGaodeText(city) ??
      this.cleanGaodeText(district) ??
      this.cleanGaodeText(province) ??
      this.cleanGaodeText(fallbackName)
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
    return value
      ?.trim()
      .replace(/\s+/g, '')
      .replace(
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

  private mapWeatherCode(code: number): string {
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
