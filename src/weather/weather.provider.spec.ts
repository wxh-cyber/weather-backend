import { ConfigService } from '@nestjs/config';
import { WeatherProvider } from './weather.provider';

const createConfigService = (overrides: Record<string, string | number> = {}) =>
  ({
    get: jest.fn((key: string, defaultValue?: string | number) =>
      key in overrides ? overrides[key] : defaultValue,
    ),
  }) as unknown as ConfigService;

describe('WeatherProvider.reverseGeocode', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should build a readable display name from gaode poi data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        regeocode: {
          addressComponent: {
            country: '中国',
            province: '湖北省',
            city: '武汉市',
            district: '洪山区',
            township: '关东街道',
          },
          pois: [{ name: '光谷广场' }],
        },
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_REVERSE_GEOCODING_PROVIDER: 'gaode',
        WEATHER_REVERSE_GEOCODING_BASE_URL:
          'https://restapi.amap.com/v3/geocode/regeo',
        WEATHER_REVERSE_GEOCODING_API_KEY: 'demo-key',
      }),
    );

    const result = await provider.reverseGeocode(30.5121, 114.4128);

    expect(result).toEqual({
      displayName: '湖北省 · 武汉市 · 洪山区 · 关东街道 · 光谷广场',
      name: '光谷广场',
      township: '关东街道',
      district: '洪山区',
      city: '武汉市',
      province: '湖北省',
      country: '中国',
      latitude: 30.5121,
      longitude: 114.4128,
    });
  });

  it('should fall back to administrative name when poi is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: '1',
        regeocode: {
          addressComponent: {
            country: '中国',
            province: '北京市',
            city: [],
            district: '东城区',
            township: '东华门街道',
            streetNumber: {
              street: '东长安街',
              number: '1号',
            },
          },
          pois: [],
        },
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_REVERSE_GEOCODING_PROVIDER: 'gaode',
        WEATHER_REVERSE_GEOCODING_BASE_URL:
          'https://restapi.amap.com/v3/geocode/regeo',
        WEATHER_REVERSE_GEOCODING_API_KEY: 'demo-key',
      }),
    );

    const result = await provider.reverseGeocode(39.9042, 116.4074);

    expect(result?.displayName).toBe(
      '北京市 · 东城区 · 东华门街道 · 东长安街1号',
    );
    expect(result?.city).toBe('北京市');
  });

  it('should return null when gaode key is missing', async () => {
    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_REVERSE_GEOCODING_PROVIDER: 'gaode',
        WEATHER_REVERSE_GEOCODING_BASE_URL:
          'https://restapi.amap.com/v3/geocode/regeo',
        WEATHER_REVERSE_GEOCODING_API_KEY: '',
      }),
    );

    const result = await provider.reverseGeocode(30.5121, 114.4128);

    expect(result).toBeNull();
  });
});
