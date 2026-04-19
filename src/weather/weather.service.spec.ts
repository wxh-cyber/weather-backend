import { NotFoundException } from '@nestjs/common';
import { WeatherService } from './weather.service';

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
      { time: '2026-04-14T09:00:00Z', weatherText: '晴', temperature: '27°C' },
    ],
    daily: [
      {
        date: '2026-04-14',
        weatherText: '晴',
        temperatureMax: '30°C',
        temperatureMin: '20°C',
      },
    ],
    fetchedAt: '2026-04-14T06:00:00Z',
    expiresAt: '2099-04-14T06:30:00Z',
    source: 'open-meteo',
  })),
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

  it('should return empty display name when reverse geocode has no match', async () => {
    provider.reverseGeocode.mockResolvedValue(null);

    const result = await service.reverseGeocode(30.5121, 114.4128);

    expect(result.code).toBe(0);
    expect(result.data.displayName).toBe('');
  });
});
