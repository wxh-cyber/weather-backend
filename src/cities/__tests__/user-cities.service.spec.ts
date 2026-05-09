import { NotFoundException } from '@nestjs/common';
import { UserCitiesService } from '../user-cities.service';

const createPrismaMock = () => {
  const prisma = {
    userCity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    city: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (operationsOrCallback) => {
      if (typeof operationsOrCallback === 'function') {
        return operationsOrCallback({
          userCity: {
            findMany: prisma.userCity.findMany,
            findUnique: prisma.userCity.findUnique,
            count: prisma.userCity.count,
            create: prisma.userCity.create,
            update: prisma.userCity.update,
            updateMany: prisma.userCity.updateMany,
            delete: prisma.userCity.delete,
            deleteMany: prisma.userCity.deleteMany,
          },
          city: {
            findUnique: prisma.city.findUnique,
          },
        });
      }

      return Promise.all(operationsOrCallback);
    }),
  };

  return prisma;
};

const createWeatherServiceMock = () => ({
  getCitySummary: jest.fn(() => ({
    weatherText: '晴',
    temperature: '26°C',
  })) as jest.Mock,
  getCityWeatherBundle: jest.fn(() => ({
    current: {
      cityId: 'city-1',
      cityName: '武汉市',
      weatherText: '晴',
      temperature: '26°C',
      observedAt: '2026-04-14T06:00:00Z',
      source: 'open-meteo',
    },
    hourly: {
      cityId: 'city-1',
      cityName: '武汉市',
      source: 'open-meteo',
      items: [
        {
          time: '2026-04-14T09:00:00Z',
          weatherText: '晴',
          temperature: '27°C',
        },
      ],
    },
    daily: {
      cityId: 'city-1',
      cityName: '武汉市',
      source: 'open-meteo',
      items: [
        {
          date: '2026-04-14',
          weatherText: '晴',
          temperatureMax: '30°C',
          temperatureMin: '20°C',
        },
      ],
    },
    dailyDetail: {
      cityId: 'city-1',
      cityName: '武汉市',
      source: 'open-meteo',
      items: [
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
      ],
    },
  })) as jest.Mock,
});

describe('UserCitiesService', () => {
  let service: UserCitiesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let weatherService: ReturnType<typeof createWeatherServiceMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    weatherService = createWeatherServiceMock();
    service = new UserCitiesService(prisma as never, weatherService as never);
  });

  it('should add a city to current user list', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
      cityCode: '420100',
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    });
    prisma.userCity.findUnique.mockResolvedValue(null);
    prisma.userCity.count.mockResolvedValue(0);
    prisma.userCity.create.mockResolvedValue({});
    prisma.userCity.findMany.mockResolvedValue([
      {
        userCityId: 'uc-1',
        userId: 'user-1',
        cityId: 'city-1',
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date('2026-04-14T06:00:00Z'),
        city: {
          cityId: 'city-1',
          cityName: '武汉市',
          cityCode: '420100',
          province: '湖北省',
          country: '中国',
          latitude: 30.5928,
          longitude: 114.3055,
        },
      },
    ]);

    const result = await service.addUserCity('user-1', 'city-1', true);

    expect(prisma.userCity.create).toHaveBeenCalled();
    expect(weatherService.getCityWeatherBundle).toHaveBeenCalledWith('city-1');
    expect(result.code).toBe(0);
    expect(result.data[0]?.weather?.current.weatherText).toBe('晴');
    expect(result.data[0]?.weather?.hourly.items).toHaveLength(1);
    expect(result.data[0]?.weather?.daily.items[0]?.temperatureMax).toBe(
      '30°C',
    );
    expect(result.data[0]?.weather?.dailyDetail.items[0]?.dayMetrics).toEqual(
      expect.objectContaining({
        feelsLike: '31°C',
        windDirection: '东南',
      }),
    );
  });

  it('should include weather bundles when listing existing user cities', async () => {
    prisma.userCity.findMany.mockResolvedValue([
      {
        userCityId: 'uc-1',
        userId: 'user-1',
        cityId: 'city-1',
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date('2026-04-14T06:00:00Z'),
        city: {
          cityId: 'city-1',
          cityName: '武汉市',
          cityCode: '420100',
          province: '湖北省',
          country: '中国',
          latitude: 30.5928,
          longitude: 114.3055,
        },
      },
      {
        userCityId: 'uc-2',
        userId: 'user-1',
        cityId: 'city-2',
        isDefault: false,
        sortOrder: 1,
        createdAt: new Date('2026-04-14T06:01:00Z'),
        city: {
          cityId: 'city-2',
          cityName: '南昌市',
          cityCode: '360100',
          province: '江西省',
          country: '中国',
          latitude: 28.6829,
          longitude: 115.8582,
        },
      },
    ]);

    const result = await service.getUserCities('user-1');

    expect(weatherService.getCityWeatherBundle).toHaveBeenCalledWith('city-1');
    expect(weatherService.getCityWeatherBundle).toHaveBeenCalledWith('city-2');
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.weather?.current.weatherText).toBe('晴');
    expect(result.data[1]?.weather?.dailyDetail.items[0]?.dayMetrics).toEqual(
      expect.objectContaining({
        feelsLike: '31°C',
      }),
    );
  });

  it('should return current city list when adding a duplicated user city (idempotent)', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
    });
    prisma.userCity.findUnique.mockResolvedValue({
      userCityId: 'uc-1',
    });
    prisma.userCity.findMany.mockResolvedValue([
      {
        userCityId: 'uc-1',
        userId: 'user-1',
        cityId: 'city-1',
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date('2026-04-14T06:00:00Z'),
        city: {
          cityId: 'city-1',
          cityName: '武汉市',
          cityCode: '420100',
          province: '湖北省',
          country: '中国',
          latitude: 30.5928,
          longitude: 114.3055,
        },
      },
    ]);

    const result = await service.addUserCity('user-1', 'city-1');

    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.cityId).toBe('city-1');
  });

  it('should reject missing default target city', async () => {
    prisma.userCity.findUnique.mockResolvedValue(null);

    await expect(service.setDefaultCity('user-1', 'city-404')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should promote the first remaining city when removing current default city', async () => {
    prisma.userCity.findUnique.mockResolvedValue({
      userCityId: 'uc-1',
      userId: 'user-1',
      cityId: 'city-1',
      isDefault: true,
      sortOrder: 0,
    });
    prisma.userCity.delete.mockResolvedValue({});
    prisma.userCity.findMany
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: false,
          sortOrder: 1,
          createdAt: new Date('2026-04-14T06:01:00Z'),
        },
        {
          userCityId: 'uc-3',
          userId: 'user-1',
          cityId: 'city-3',
          isDefault: false,
          sortOrder: 2,
          createdAt: new Date('2026-04-14T06:02:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:01:00Z'),
          city: {
            cityId: 'city-2',
            cityName: '南昌市',
            cityCode: '360100',
            province: '江西省',
            country: '中国',
            latitude: 28.6829,
            longitude: 115.8582,
          },
        },
        {
          userCityId: 'uc-3',
          userId: 'user-1',
          cityId: 'city-3',
          isDefault: false,
          sortOrder: 1,
          createdAt: new Date('2026-04-14T06:02:00Z'),
          city: {
            cityId: 'city-3',
            cityName: '上海市',
            cityCode: '310000',
            province: '上海市',
            country: '中国',
            latitude: 31.2304,
            longitude: 121.4737,
          },
        },
      ]);
    prisma.userCity.update.mockResolvedValue({});

    const result = await service.removeUserCity('user-1', 'city-1');

    expect(prisma.userCity.delete).toHaveBeenCalledWith({
      where: { userCityId: 'uc-1' },
    });
    expect(prisma.userCity.update).toHaveBeenCalledWith({
      where: { userCityId: 'uc-2' },
      data: { isDefault: true },
    });
    expect(result.data[0]?.cityName).toBe('南昌市');
    expect(result.data[0]?.isDefault).toBe(true);
  });

  it('should return empty user city list when removing the last default city', async () => {
    prisma.userCity.findUnique.mockResolvedValue({
      userCityId: 'uc-1',
      userId: 'user-1',
      cityId: 'city-1',
      isDefault: true,
      sortOrder: 0,
    });
    prisma.userCity.delete.mockResolvedValue({});
    prisma.userCity.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.removeUserCity('user-1', 'city-1');

    expect(prisma.userCity.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      code: 0,
      message: '获取成功',
      data: [],
    });
  });

  it('should batch remove all requested user cities and return an empty list', async () => {
    prisma.userCity.findMany
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-1',
          userId: 'user-1',
          cityId: 'city-1',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:00:00Z'),
        },
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: false,
          sortOrder: 1,
          createdAt: new Date('2026-04-14T06:01:00Z'),
        },
        {
          userCityId: 'uc-3',
          userId: 'user-1',
          cityId: 'city-3',
          isDefault: false,
          sortOrder: 2,
          createdAt: new Date('2026-04-14T06:02:00Z'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.userCity.deleteMany.mockResolvedValue({ count: 3 });

    const result = await service.removeUserCities('user-1', [
      'city-1',
      'city-2',
      'city-3',
    ]);

    expect(prisma.userCity.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        cityId: {
          in: ['city-1', 'city-2', 'city-3'],
        },
      },
    });
    expect(result).toEqual({
      code: 0,
      message: '删除成功',
      data: [],
      failedCityIds: [],
    });
  });

  it('should keep invalid batch city ids as failures without deleting unrelated cities', async () => {
    prisma.userCity.findMany
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-1',
          userId: 'user-1',
          cityId: 'city-1',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.userCity.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.removeUserCities('user-1', [
      'city-1',
      'city-404',
    ]);

    expect(prisma.userCity.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        cityId: {
          in: ['city-1'],
        },
      },
    });
    expect(result.failedCityIds).toEqual(['city-404']);
  });

  it('should promote a remaining city after batch removal', async () => {
    prisma.userCity.findMany
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-1',
          userId: 'user-1',
          cityId: 'city-1',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: false,
          sortOrder: 1,
          createdAt: new Date('2026-04-14T06:01:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:01:00Z'),
          city: {
            cityId: 'city-2',
            cityName: '南昌市',
            cityCode: '360100',
            province: '江西省',
            country: '中国',
            latitude: 28.6829,
            longitude: 115.8582,
          },
        },
      ]);
    prisma.userCity.deleteMany.mockResolvedValue({ count: 1 });
    prisma.userCity.update.mockResolvedValue({});

    const result = await service.removeUserCities('user-1', ['city-1']);

    expect(prisma.userCity.update).toHaveBeenCalledWith({
      where: { userCityId: 'uc-2' },
      data: { sortOrder: 0, isDefault: true },
    });
    expect(result.data[0]?.cityName).toBe('南昌市');
    expect(result.data[0]?.isDefault).toBe(true);
  });

  it('should keep batch removal response independent from weather failures', async () => {
    prisma.userCity.findMany
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-1',
          userId: 'user-1',
          cityId: 'city-1',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: false,
          sortOrder: 1,
          createdAt: new Date('2026-04-14T06:01:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          userCityId: 'uc-2',
          userId: 'user-1',
          cityId: 'city-2',
          isDefault: true,
          sortOrder: 0,
          createdAt: new Date('2026-04-14T06:01:00Z'),
          city: {
            cityId: 'city-2',
            cityName: '南昌市',
            cityCode: '360100',
            province: '江西省',
            country: '中国',
            latitude: 28.6829,
            longitude: 115.8582,
          },
        },
      ]);
    prisma.userCity.deleteMany.mockResolvedValue({ count: 1 });
    prisma.userCity.update.mockResolvedValue({});
    weatherService.getCitySummary.mockRejectedValue(new Error('weather down'));
    weatherService.getCityWeatherBundle.mockRejectedValue(
      new Error('weather down'),
    );

    const result = await service.removeUserCities('user-1', ['city-1']);

    expect(result).toMatchObject({
      code: 0,
      message: '删除成功',
      failedCityIds: [],
      data: [
        expect.objectContaining({
          cityId: 'city-2',
          cityName: '南昌市',
          isDefault: true,
          weatherText: '',
          temperature: '',
        }),
      ],
    });
    expect(weatherService.getCitySummary).not.toHaveBeenCalled();
    expect(weatherService.getCityWeatherBundle).not.toHaveBeenCalled();
  });

  it('should return city list with empty weather text when getCitySummary throws', async () => {
    prisma.userCity.findMany.mockResolvedValue([
      {
        userCityId: 'uc-1',
        userId: 'user-1',
        cityId: 'city-1',
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date('2026-04-14T06:00:00Z'),
        city: {
          cityId: 'city-1',
          cityName: '武汉市',
          cityCode: '420100',
          province: '湖北省',
          country: '中国',
          latitude: null,
          longitude: null,
        },
      },
    ]);
    weatherService.getCitySummary.mockRejectedValue(
      new Error('geocoding failed'),
    );

    const result = await service.getUserCities('user-1');

    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.cityId).toBe('city-1');
    expect(result.data[0]?.weatherText).toBe('');
    expect(result.data[0]?.temperature).toBe('');
  });

  it('should return city list without weather field when getCityWeatherBundle throws', async () => {
    prisma.userCity.findMany.mockResolvedValue([
      {
        userCityId: 'uc-1',
        userId: 'user-1',
        cityId: 'city-1',
        isDefault: true,
        sortOrder: 0,
        createdAt: new Date('2026-04-14T06:00:00Z'),
        city: {
          cityId: 'city-1',
          cityName: '武汉市',
          cityCode: '420100',
          province: '湖北省',
          country: '中国',
          latitude: null,
          longitude: null,
        },
      },
    ]);
    weatherService.getCityWeatherBundle.mockRejectedValue(
      new Error('coordinates missing'),
    );

    const result = await service.getUserCities('user-1');

    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.cityId).toBe('city-1');
    // weather field must be absent, not an error
    expect(result.data[0]).not.toHaveProperty('weather');
  });
});
