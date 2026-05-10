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
  fetchClimateForecast: jest.fn(),
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

  it('should return a complete weather bundle for a city', async () => {
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

    const result = await service.getCityWeatherBundle('city-1');

    expect(provider.fetchForecast).toHaveBeenCalledTimes(1);
    expect(provider.buildDailyWeatherDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        current: expect.objectContaining({
          weatherText: '晴',
          temperature: '26°C',
        }),
        hourly: expect.arrayContaining([
          expect.objectContaining({
            time: '2026-04-14T09:00:00Z',
            temperature: '27°C',
          }),
        ]),
        daily: expect.arrayContaining([
          expect.objectContaining({
            date: '2026-04-14',
            temperatureMax: '30°C',
          }),
        ]),
      }),
    );
    expect(result.current.cityName).toBe('武汉市');
    expect(result.hourly.items[0]?.temperature).toBe('27°C');
    expect(result.daily.items[0]?.temperatureMin).toBe('20°C');
    expect(result.dailyDetail.items[0]?.nightMetrics.airQuality).toBe('AQI 48');
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

  it('should backfill current weather metrics from cached hourly data when legacy currentJson is incomplete', async () => {
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
          apparentTemperature: '28°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '22%',
          windDirection: '东南',
          windSpeed: '12.6 km/h',
          humidity: '68%',
          visibility: '10.0 公里',
          pressure: '1008 hPa',
          dewPoint: '18°C',
          airQuality: 'AQI 51',
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
            apparentTemperature: '28°C',
            precipitationProbability: '10%',
            precipitationAmount: '0.0 mm',
            cloudCover: '22%',
            windDirection: '东南',
            windSpeed: '12.6 km/h',
            humidity: '68%',
            visibility: '10.0 公里',
            pressure: '1008 hPa',
            dewPoint: '18°C',
            airQuality: 'AQI 51',
          },
        ],
      },
      fetchedAt: new Date('2026-04-14T06:00:00Z'),
      expiresAt: new Date('2099-04-14T06:30:00Z'),
    });

    const result = await service.getCurrentWeather('city-1');

    expect(result.data.apparentTemperature).toBe('28°C');
    expect(result.data.precipitationProbability).toBe('10%');
    expect(result.data.precipitationAmount).toBe('0.0 mm');
    expect(result.data.cloudCover).toBe('22%');
    expect(result.data.windDirection).toBe('东南');
    expect(result.data.windSpeed).toBe('12.6 km/h');
    expect(result.data.humidity).toBe('68%');
    expect(result.data.visibility).toBe('10.0 公里');
    expect(result.data.pressure).toBe('1008 hPa');
    expect(result.data.dewPoint).toBe('18°C');
    expect(result.data.airQuality).toBe('AQI 51');
  });

  it('should backfill placeholder current weather metrics from cached hourly detail data', async () => {
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
        apparentTemperature: '--',
        precipitationProbability: ' ',
        precipitationAmount: '',
        cloudCover: '--',
        windDirection: '--',
        windSpeed: '--',
        humidity: '--',
        visibility: '--',
        pressure: '--',
        dewPoint: '--',
        airQuality: '--',
        observedAt: '2026-04-14T06:00:00Z',
        source: 'open-meteo',
      },
      hourlyJson: [
        {
          time: '2026-04-14T09:00:00Z',
          weatherText: '晴',
          temperature: '27°C',
          apparentTemperature: '28°C',
          precipitationProbability: '10%',
          precipitationAmount: '0.0 mm',
          cloudCover: '22%',
          windDirection: '东南',
          windSpeed: '12.6 km/h',
          humidity: '68%',
          visibility: '10.0 公里',
          pressure: '1008 hPa',
          dewPoint: '18°C',
          airQuality: 'AQI 51',
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
            apparentTemperature: '28°C',
            precipitationProbability: '10%',
            precipitationAmount: '0.0 mm',
            cloudCover: '22%',
            windDirection: '东南',
            windSpeed: '12.6 km/h',
            humidity: '68%',
            visibility: '10.0 公里',
            pressure: '1008 hPa',
            dewPoint: '18°C',
            airQuality: 'AQI 51',
          },
        ],
      },
      fetchedAt: new Date('2026-04-14T06:00:00Z'),
      expiresAt: new Date('2099-04-14T06:30:00Z'),
    });

    const result = await service.getCurrentWeather('city-1');

    expect(result.data.apparentTemperature).toBe('28°C');
    expect(result.data.precipitationProbability).toBe('10%');
    expect(result.data.precipitationAmount).toBe('0.0 mm');
    expect(result.data.cloudCover).toBe('22%');
    expect(result.data.windDirection).toBe('东南');
    expect(result.data.windSpeed).toBe('12.6 km/h');
    expect(result.data.humidity).toBe('68%');
    expect(result.data.visibility).toBe('10.0 公里');
    expect(result.data.pressure).toBe('1008 hPa');
    expect(result.data.dewPoint).toBe('18°C');
    expect(result.data.airQuality).toBe('AQI 51');
  });

  it('should fall back to stale cache when external API fails and snapshot exists', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    });
    // Expired snapshot exists
    prisma.weatherSnapshot.findUnique.mockResolvedValue({
      source: 'open-meteo',
      weatherText: '多云',
      temperature: '22°C',
      currentJson: {
        weatherText: '多云',
        temperature: '22°C',
        observedAt: '2026-04-13T06:00:00Z',
        source: 'open-meteo',
      },
      hourlyJson: [],
      dailyJson: { daily: [], hourlyDetail: [] },
      fetchedAt: new Date('2026-04-13T06:00:00Z'),
      expiresAt: new Date('2026-04-13T06:30:00Z'), // already expired
    });
    // API call fails
    provider.fetchForecast.mockRejectedValue(new Error('network error'));

    const result = await service.getCurrentWeather('city-1');

    expect(result.code).toBe(0);
    expect(result.data.weatherText).toBe('多云');
    expect(provider.fetchForecast).toHaveBeenCalled();
  });

  it('should throw InternalServerErrorException when API fails and no cache exists', async () => {
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
    provider.fetchForecast.mockRejectedValue(new Error('network error'));

    await expect(service.getCurrentWeather('city-1')).rejects.toThrow(
      '天气数据获取失败，请稍后重试',
    );
  });

  describe('getTemperatureTrend', () => {
    const city = {
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    };

    const forecastSnapshot = {
      source: 'open-meteo',
      weatherText: '晴',
      temperature: '26°C',
      currentJson: { weatherText: '晴', temperature: '26°C', observedAt: '2026-05-10T06:00:00Z', source: 'open-meteo' },
      hourlyJson: [],
      dailyJson: {
        daily: Array.from({ length: 16 }, (_, i) => ({
          date: `2026-05-${String(i + 10).padStart(2, '0')}`,
          weatherText: '晴',
          temperatureMax: '30°C',
          temperatureMin: '20°C',
        })),
        hourlyDetail: [],
      },
      fetchedAt: new Date('2026-05-10T06:00:00Z'),
      expiresAt: new Date('2099-05-10T06:30:00Z'),
    };

    it('should return flat days array for period=7', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      prisma.weatherSnapshot.findUnique.mockResolvedValue(forecastSnapshot);

      const result = await service.getTemperatureTrend('city-1', 7);

      expect(result.code).toBe(0);
      expect(result.data.period).toBe(7);
      expect(result.data.dataSource).toBe('forecast');
      expect((result.data as { days: unknown[] }).days).toHaveLength(7);
    });

    it('should return flat days array for period=30 capped at available data', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      prisma.weatherSnapshot.findUnique.mockResolvedValue(forecastSnapshot);

      const result = await service.getTemperatureTrend('city-1', 30);

      expect(result.data.dataSource).toBe('forecast');
      // Only 16 days available in the mock snapshot
      expect((result.data as { days: unknown[] }).days).toHaveLength(16);
    });

    it('should return grouped data for period=90 using climate API', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      // No climate cache
      prisma.weatherSnapshot.findUnique.mockResolvedValue(null);
      prisma.weatherSnapshot.upsert.mockResolvedValue({});

      const climateItems = Array.from({ length: 90 }, (_, i) => {
        const d = new Date('2026-05-10');
        d.setDate(d.getDate() + i);
        return {
          date: d.toISOString().slice(0, 10),
          weatherText: '晴',
          temperatureMax: '28°C',
          temperatureMin: '18°C',
        };
      });
      provider.fetchClimateForecast.mockResolvedValue(climateItems);

      const result = await service.getTemperatureTrend('city-1', 90);

      expect(result.data.dataSource).toBe('climate');
      expect(provider.fetchClimateForecast).toHaveBeenCalled();
      const groups = (result.data as { groups: { days: unknown[] }[] }).groups;
      expect(groups.length).toBeGreaterThanOrEqual(8);
      // Every group must have at least one day
      for (const g of groups) {
        expect(g.days.length).toBeGreaterThan(0);
      }
    });

    it('should fill missing days with placeholder data', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      prisma.weatherSnapshot.findUnique.mockResolvedValue(null);
      prisma.weatherSnapshot.upsert.mockResolvedValue({});

      // Return only a single day — all other days should be filled with placeholders
      provider.fetchClimateForecast.mockResolvedValue([
        { date: '2026-05-10', weatherText: '晴', temperatureMax: '28°C', temperatureMin: '18°C' },
      ]);

      const result = await service.getTemperatureTrend('city-1', 90);
      const groups = (result.data as { groups: { days: { temperatureMax: string }[] }[] }).groups;
      const allDays = groups.flatMap((g) => g.days);
      const placeholders = allDays.filter((d) => d.temperatureMax === '--');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('should fall back to forecast data when climate API fails', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      // First call: climate cache lookup returns null; second call: forecast snapshot
      prisma.weatherSnapshot.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(forecastSnapshot);
      provider.fetchClimateForecast.mockRejectedValue(new Error('climate API down'));

      const result = await service.getTemperatureTrend('city-1', 90);

      expect(result.data.dataSource).toBe('forecast');
      const groups = (result.data as { groups: unknown[] }).groups;
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should use cached climate snapshot when available', async () => {
      prisma.city.findUnique.mockResolvedValue(city);
      const cachedItems = Array.from({ length: 90 }, (_, i) => {
        const d = new Date('2026-05-10');
        d.setDate(d.getDate() + i);
        return { date: d.toISOString().slice(0, 10), weatherText: '多云', temperatureMax: '25°C', temperatureMin: '15°C' };
      });
      prisma.weatherSnapshot.findUnique.mockResolvedValue({
        source: 'open-meteo-climate',
        dailyJson: { daily: cachedItems },
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await service.getTemperatureTrend('city-1', 90);

      expect(provider.fetchClimateForecast).not.toHaveBeenCalled();
      expect(result.data.dataSource).toBe('climate');
    });
  });
});
