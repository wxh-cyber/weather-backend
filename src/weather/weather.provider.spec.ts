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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: {
          country: '中国',
          state: '上海市',
          city: '上海市',
          suburb: '黄浦区',
          road: '中山东一路',
        },
        display_name: '上海市, 黄浦区, 中山东一路',
      }),
    }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_REVERSE_GEOCODING_PROVIDER: 'gaode',
        WEATHER_REVERSE_GEOCODING_BASE_URL:
          'https://restapi.amap.com/v3/geocode/regeo',
        WEATHER_REVERSE_GEOCODING_API_KEY: '',
        WEATHER_REVERSE_GEOCODING_FALLBACK_BASE_URL:
          'https://nominatim.openstreetmap.org/reverse',
      }),
    );

    const result = await provider.reverseGeocode(30.5121, 114.4128);

    expect(result).toEqual({
      displayName: '上海市 · 黄浦区 · 中山东一路',
      name: '中山东一路',
      district: '黄浦区',
      city: '上海市',
      province: '上海市',
      country: '中国',
      latitude: 30.5121,
      longitude: 114.4128,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should fall back to nominatim when gaode request fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            country: '中国',
            state: '广东省',
            city: '广州市',
            suburb: '天河区',
            road: '天河路',
            house_number: '208号',
          },
          display_name: '广东省, 广州市, 天河区, 天河路208号',
        }),
      }) as typeof fetch;

    const provider = new WeatherProvider(
      createConfigService({
        WEATHER_REVERSE_GEOCODING_PROVIDER: 'gaode',
        WEATHER_REVERSE_GEOCODING_BASE_URL:
          'https://restapi.amap.com/v3/geocode/regeo',
        WEATHER_REVERSE_GEOCODING_API_KEY: 'demo-key',
        WEATHER_REVERSE_GEOCODING_FALLBACK_BASE_URL:
          'https://nominatim.openstreetmap.org/reverse',
      }),
    );

    const result = await provider.reverseGeocode(23.1291, 113.2644);

    expect(result?.displayName).toBe('广东省 · 广州市 · 天河区 · 天河路208号');
    expect(global.fetch).toHaveBeenCalledTimes(2);
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
