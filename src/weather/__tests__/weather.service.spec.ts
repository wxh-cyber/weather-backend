import { NotFoundException } from '@nestjs/common';
import { WeatherService } from '../weather.service';

const createPrismaMock = () => ({
  city: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  weatherSnapshot: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
});

const createProviderMock = () => ({
  fetchForecast: jest.fn(() => ({
    current: {
      weatherText: '晴',
      temperature: '26°C',
      observedAt: '2026-04-14T06:00:00Z',
      source: 'open-meteo',
    },
    hourly: [
      {
        time: '2026-04-14T09:00:00Z',
        weatherText: '晴',
        temperature: '27°C',
        windDirection: '东南',
      },
    ],
    hourlyDetail: [
      {
        time: '2026-04-14T09:00:00Z',
        weatherText: '晴',
        temperature: '27°C',
        windDirection: '东南',
      },
      {
        time: '2026-04-15T03:00:00Z',
        weatherText: '多云',
        temperature: '22°C',
        windDirection: '西北',
      },
    ],
    daily: [
      {
        date: '2026-04-14',
        weatherText: '晴',
        temperatureMax: '30°C',
        temperatureMin: '20°C',
        sunrise: '05:42',
        sunset: '18:31',
        dayWeatherText: '晴',
        nightWeatherText: '多云',
      },
    ],
    fetchedAt: '2026-04-14T06:00:00Z',
    expiresAt: '2099-04-14T06:30:00Z',
    source: 'open-meteo',
  })),
  buildDailyWeatherDetails: jest.fn(() => [
    {
      date: '2026-04-14',
      temperatureMax: '30°C',
      temperatureMin: '20°C',
      sunrise: '05:42',
      sunset: '18:31',
      dayWeatherText: '晴',
      nightWeatherText: '多云',
      dayMetrics: {
        feelsLike: '31°C',
        precipitationProbability: '10%',
        precipitationAmount: '0.0 mm',
        airQuality: 'AQI 51',
        windDirection: '东南',
        cloudCover: '22%',
      },
      nightMetrics: {
        feelsLike: '23°C',
        precipitationProbability: '16%',
        precipitationAmount: '0.2 mm',
        airQuality: 'AQI 48',
        windDirection: '东北',
        cloudCover: '38%',
      },
    },
  ]),
  resolveCityByName: jest.fn(),
  reverseGeocode: jest.fn(),
});

describe('WeatherService', () => {
  let service: WeatherService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let provider: ReturnType<typeof createProviderMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    provider = createProviderMock();
    service = new WeatherService(prisma as never, provider as never);
  });

  it('should fetch and cache current weather when cache is missing', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    });
    prisma.weatherSnapshot.findUnique.mockResolvedValue(null);
    prisma.weatherSnapshot.upsert.mockResolvedValue({});

    const result = await service.getCurrentWeather('city-1');

    expect(provider.fetchForecast).toHaveBeenCalled();
    expect(prisma.weatherSnapshot.upsert).toHaveBeenCalled();
    expect(result.data.cityName).toBe('武汉市');
  });

  it('should throw when city is missing', async () => {
    prisma.city.findUnique.mockResolvedValue(null);

    await expect(service.getCurrentWeather('missing-city')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return reverse geocode payload when provider resolves a place', async () => {
    provider.reverseGeocode.mockResolvedValue({
      displayName: '湖北省 · 武汉市 · 洪山区 · 光谷广场',
      city: '武汉市',
      province: '湖北省',
      district: '洪山区',
      latitude: 30.5121,
      longitude: 114.4128,
    });

    const result = await service.reverseGeocode(30.5121, 114.4128);

    expect(provider.reverseGeocode).toHaveBeenCalledWith(30.5121, 114.4128);
    expect(result.code).toBe(0);
    expect(result.data.displayName).toContain('武汉市');
  });

  it('should return fallback reverse geocode payload when provider resolves without gaode', async () => {
    provider.reverseGeocode.mockResolvedValue({
      displayName: '上海市 · 黄浦区 · 中山东一路',
      city: '上海市',
      province: '上海市',
      district: '黄浦区',
      latitude: 31.2304,
      longitude: 121.4737,
    });

    const result = await service.reverseGeocode(31.2304, 121.4737);

    expect(result.code).toBe(0);
    expect(result.message).toBe('地点名称解析成功');
    expect(result.data.displayName).toBe('上海市 · 黄浦区 · 中山东一路');
  });

  it('should return empty display name when reverse geocode has no match', async () => {
    provider.reverseGeocode.mockResolvedValue(null);

    const result = await service.reverseGeocode(30.5121, 114.4128);

    expect(result.code).toBe(0);
    expect(result.data.displayName).toBe('');
  });

  it('should build daily weather detail payload from snapshot data', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    });
    prisma.weatherSnapshot.findUnique.mockResolvedValue(null);
    prisma.weatherSnapshot.upsert.mockResolvedValue({});

    const result = await service.getDailyWeatherDetail('city-1');

    expect(provider.buildDailyWeatherDetails).toHaveBeenCalled();
    expect(result.code).toBe(0);
    expect(result.data.items[0]?.dayMetrics.feelsLike).toBe('31°C');
    expect(result.data.items[0]?.nightWeatherText).toBe('多云');
  });

  it('should deserialize cached hourlyDetail payloads for daily weather detail', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    });
    prisma.weatherSnapshot.findUnique.mockResolvedValue({
      source: 'open-meteo',
      weatherText: '晴',
      temperature: '26°C',
      currentJson: {
        weatherText: '晴',
        temperature: '26°C',
        observedAt: '2026-04-14T06:00:00Z',
        source: 'open-meteo',
      },
      hourlyJson: [
        {
          time: '2026-04-14T09:00:00Z',
          weatherText: '晴',
          temperature: '27°C',
          windDirection: '东南',
        },
      ],
      dailyJson: {
        daily: [
          {
            date: '2026-04-14',
            weatherText: '晴',
            temperatureMax: '30°C',
            temperatureMin: '20°C',
            sunrise: '05:42',
            sunset: '18:31',
            dayWeatherText: '晴',
            nightWeatherText: '多云',
          },
        ],
        hourlyDetail: [
          {
            time: '2026-04-14T09:00:00Z',
            weatherText: '晴',
            temperature: '27°C',
            windDirection: '东南',
          },
          {
            time: '2026-04-15T03:00:00Z',
            weatherText: '多云',
            temperature: '22°C',
            windDirection: '西北',
          },
        ],
      },
      fetchedAt: new Date('2026-04-14T06:00:00Z'),
      expiresAt: new Date('2099-04-14T06:30:00Z'),
    });

    await service.getDailyWeatherDetail('city-1');

    expect(provider.buildDailyWeatherDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        hourlyDetail: expect.arrayContaining([
          expect.objectContaining({
            time: '2026-04-15T03:00:00Z',
            windDirection: '西北',
          }),
        ]),
      }),
    );
  });
});
