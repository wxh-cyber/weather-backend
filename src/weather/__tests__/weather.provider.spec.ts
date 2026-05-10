import { ConfigService } from '@nestjs/config';
import { WeatherProvider } from '../weather.provider';
import type { WeatherSnapshotPayload } from '../weather.types';

const createConfigService = (overrides: Record<string, string | number> = {}) =>
  ({
    get: jest.fn((key: string, defaultValue?: string | number) =>
      key in overrides ? overrides[key] : defaultValue,
    ),
  }) as unknown as ConfigService;

describe('WeatherProvider.buildDailyWeatherDetails', () => {
  it('should use hourlyDetail for later dates and keep wind direction readable', () => {
    const provider = new WeatherProvider(createConfigService());
    const snapshot: WeatherSnapshotPayload = {
      current: {
        weatherText: '晴',
        temperature: '26°C',
        observedAt: '2026-05-02T09:00:00+08:00',
        source: 'open-meteo',
      },
      hourly: [
        {
          time: '2026-05-02T09:00:00+08:00',
          temperature: '26°C',
          weatherText: '晴',
          apparentTemperature: '28°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '24%',
          windDirection: '东南',
          windDirectionDegrees: 135,
          isDay: true,
          airQuality: 'AQI 48',
        },
      ],
      hourlyDetail: [
        {
          time: '2026-05-02T09:00:00+08:00',
          temperature: '26°C',
          weatherText: '晴',
          apparentTemperature: '28°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '24%',
          windDirection: '东南',
          windDirectionDegrees: 135,
          isDay: true,
          airQuality: 'AQI 48',
        },
        {
          time: '2026-05-03T03:00:00+08:00',
          temperature: '21°C',
          weatherText: '多云',
          apparentTemperature: '20°C',
          precipitationProbability: '22%',
          precipitationAmount: '0.4 mm',
          cloudCover: '60%',
          windDirection: '西北',
          windDirectionDegrees: 315,
          isDay: false,
          airQuality: 'AQI 53',
        },
        {
          time: '2026-05-03T09:00:00+08:00',
          temperature: '24°C',
          weatherText: '小雨',
          apparentTemperature: '23°C',
          precipitationProbability: '35%',
          precipitationAmount: '1.2 mm',
          cloudCover: '72%',
          windDirection: '北',
          windDirectionDegrees: 0,
          isDay: true,
          airQuality: 'AQI 55',
        },
      ],
      daily: [
        {
          date: '2026-05-02',
          weatherText: '晴',
          temperatureMax: '30°C',
          temperatureMin: '20°C',
          sunrise: '05:34',
          sunset: '18:59',
          dayWeatherText: '晴',
          nightWeatherText: '多云',
        },
        {
          date: '2026-05-03',
          weatherText: '小雨',
          temperatureMax: '25°C',
          temperatureMin: '18°C',
          sunrise: '05:33',
          sunset: '19:00',
          dayWeatherText: '小雨',
          nightWeatherText: '多云',
        },
      ],
      fetchedAt: '2026-05-02T09:00:00+08:00',
      expiresAt: '2026-05-02T09:30:00+08:00',
      source: 'open-meteo',
    };

    const result = provider.buildDailyWeatherDetails(snapshot);

    expect(result[1]?.dayMetrics.feelsLike).toBe('23°C');
    expect(result[1]?.dayMetrics.windDirection).toBe('北');
    expect(result[1]?.nightMetrics.precipitationProbability).toBe('22%');
    expect(result[1]?.nightMetrics.windDirection).toBe('西北');
  });

  it('should preserve readable wind direction even when only display text exists', () => {
    const provider = new WeatherProvider(createConfigService());
    const snapshot: WeatherSnapshotPayload = {
      current: {
        weatherText: '晴',
        temperature: '26°C',
        observedAt: '2026-05-02T09:00:00+08:00',
        source: 'open-meteo',
      },
      hourly: [
        {
          time: '2026-05-02T09:00:00+08:00',
          temperature: '26°C',
          weatherText: '晴',
          apparentTemperature: '28°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '24%',
          windDirection: '东南',
          isDay: true,
          airQuality: 'AQI 48',
        },
      ],
      daily: [
        {
          date: '2026-05-02',
          weatherText: '晴',
          temperatureMax: '30°C',
          temperatureMin: '20°C',
          sunrise: '05:34',
          sunset: '18:59',
          dayWeatherText: '晴',
          nightWeatherText: '多云',
        },
      ],
      fetchedAt: '2026-05-02T09:00:00+08:00',
      expiresAt: '2026-05-02T09:30:00+08:00',
      source: 'open-meteo',
    };

    const result = provider.buildDailyWeatherDetails(snapshot);

    expect(result[0]?.dayMetrics.windDirection).toBe('东南');
  });
});

describe('WeatherProvider.fetchForecast', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should use configured forecast days and map current environment metrics', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            time: '2026-05-04T10:00',
            temperature_2m: 26.4,
            weather_code: 1,
          },
          hourly: {
            time: ['2026-05-04T10:00'],
            temperature_2m: [26.4],
            weather_code: [1],
            apparent_temperature: [28.1],
            precipitation_probability: [35],
            precipitation: [0.8],
            cloud_cover: [62],
            wind_direction_10m: [45],
            wind_speed_10m: [16.2],
            relative_humidity_2m: [78],
            dew_point_2m: [21.3],
            pressure_msl: [1008.6],
            visibility: [12000],
            is_day: [1],
          },
          daily: {
            time: ['2026-05-04'],
            temperature_2m_max: [30.2],
            temperature_2m_min: [21.4],
            weather_code: [1],
            sunrise: ['2026-05-04T05:35'],
            sunset: ['2026-05-04T19:02'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hourly: {
            time: ['2026-05-04T10:00'],
            us_aqi: [42],
          },
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_FORECAST_DAYS: 90,
      }),
    );

    const result = await provider.fetchForecast({
      cityName: '武汉市',
      latitude: 30.5928,
      longitude: 114.3055,
    });

    const forecastUrl = fetchMock.mock.calls[0]?.[0] as URL;
    // Values above 16 are clamped to 16 (Open-Meteo free tier limit)
    expect(forecastUrl.searchParams.get('forecast_days')).toBe('16');
    expect(result.current).toMatchObject({
      apparentTemperature: '28°C',
      precipitationProbability: '35%',
      precipitationAmount: '0.8 mm',
      cloudCover: '62%',
      windDirection: '东北',
      windSpeed: '16.2 km/h',
      humidity: '78%',
      visibility: '12.0 公里',
      pressure: '1009 hPa',
      dewPoint: '21°C',
      airQuality: 'AQI 42',
    });
    expect(result.hourly[0]).toMatchObject({
      windSpeed: '16.2 km/h',
      humidity: '78%',
      visibility: '12.0 公里',
      pressure: '1009 hPa',
      dewPoint: '21°C',
    });
  });
});

describe('WeatherProvider.buildDailyWeatherDetails', () => {
  it('should group snapshot hours into day and night metrics', () => {
    const provider = new WeatherProvider(createConfigService());

    const result = provider.buildDailyWeatherDetails({
      current: {
        weatherText: '晴',
        temperature: '26°C',
        observedAt: '2026-05-02T06:00:00+08:00',
        source: 'open-meteo',
      },
      hourly: [
        {
          time: '2026-05-02T09:00',
          temperature: '28°C',
          weatherText: '晴',
          apparentTemperature: '30°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '20%',
          windDirection: '135',
          isDay: true,
          airQuality: 'AQI 52',
        },
        {
          time: '2026-05-02T21:00',
          temperature: '22°C',
          weatherText: '小雨',
          apparentTemperature: '21°C',
          precipitationProbability: '40%',
          precipitationAmount: '1.5 mm',
          cloudCover: '72%',
          windDirection: '270',
          isDay: false,
          airQuality: 'AQI 44',
        },
      ],
      daily: [
        {
          date: '2026-05-02',
          weatherText: '晴',
          temperatureMax: '31°C',
          temperatureMin: '22°C',
          sunrise: '05:34',
          sunset: '18:59',
          dayWeatherText: '晴',
          nightWeatherText: '小雨',
        },
      ],
      fetchedAt: '2026-05-02T06:00:00+08:00',
      expiresAt: '2026-05-02T06:30:00+08:00',
      source: 'open-meteo',
    });

    expect(result).toEqual([
      expect.objectContaining({
        date: '2026-05-02',
        dayWeatherText: '晴',
        nightWeatherText: '小雨',
        dayMetrics: expect.objectContaining({
          feelsLike: '30°C',
          precipitationProbability: '10%',
          airQuality: 'AQI 52',
          windDirection: '东南',
        }),
        nightMetrics: expect.objectContaining({
          precipitationAmount: '1.5 mm',
          cloudCover: '72%',
          windDirection: '西',
        }),
      }),
    ]);
  });
});

describe('WeatherProvider.resolveCityByName', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should prefer gaode geocoding for Chinese city queries when key is available', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        geocodes: [
          {
            country: '中国',
            province: '广东省',
            city: '东莞市',
            district: '',
            citycode: '769',
            adcode: '441900',
            level: '市',
            location: '113.7518,23.0207',
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_GEOCODING_PROVIDER: 'gaode',
        WEATHER_GEOCODING_GAODE_BASE_URL:
          'https://restapi.amap.com/v3/geocode/geo',
        WEATHER_GEOCODING_API_KEY: 'demo-key',
      }),
    );

    const result = await provider.resolveCityByName('东莞');

    expect(result).toEqual({
      cityName: '东莞市',
      cityCode: '769',
      province: '广东省',
      country: '中国',
      latitude: 23.0207,
      longitude: 113.7518,
    });
  });

  it('should prefer the China candidate when foreign duplicate names exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: 'Shanghai',
            admin1: 'Illinois',
            country: 'United States',
            latitude: 41.05087,
            longitude: -90.4968,
          },
          {
            name: '上海市',
            admin1: '上海市',
            country: '中国',
            latitude: 31.2304,
            longitude: 121.4737,
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(createConfigService());

    const result = await provider.resolveCityByName('上海市');

    expect(result).toEqual({
      cityName: '上海市',
      province: '上海市',
      country: '中国',
      latitude: 31.2304,
      longitude: 121.4737,
    });
  });

  it('should fall back to open-meteo when gaode geocoding key is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: '东莞市',
            admin1: '广东省',
            country: '中国',
            latitude: 23.0207,
            longitude: 113.7518,
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_GEOCODING_PROVIDER: 'gaode',
        WEATHER_GEOCODING_API_KEY: '',
      }),
    );

    const result = await provider.resolveCityByName('东莞市');

    expect(result).toEqual({
      cityName: '东莞市',
      province: '广东省',
      country: '中国',
      latitude: 23.0207,
      longitude: 113.7518,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should return null for Chinese city names when only foreign candidates exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: 'Shanghai',
            admin1: 'Illinois',
            country: 'United States',
            latitude: 41.05087,
            longitude: -90.4968,
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(createConfigService());

    const result = await provider.resolveCityByName('上海市');

    expect(result).toBeNull();
  });

  it('should prefer the most city-like Chinese candidate among multiple China results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: '广州',
            admin1: '广东省',
            country: '中国',
            latitude: 23.1291,
            longitude: 113.2644,
          },
          {
            name: '广州市',
            admin1: '广东省',
            country: '中国',
            latitude: 23.1291,
            longitude: 113.2644,
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(createConfigService());

    const result = await provider.resolveCityByName('广州市');

    expect(result?.cityName).toBe('广州市');
    expect(result?.country).toBe('中国');
  });
});
