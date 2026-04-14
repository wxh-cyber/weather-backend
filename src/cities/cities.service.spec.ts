import { CitiesService } from './cities.service';

const createPrismaMock = () => ({
  city: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn(),
  },
});

const createWeatherServiceMock = () => ({
  getCitySummary: jest.fn(() => ({
    weatherText: '晴',
    temperature: '26°C',
  })),
});

const createWeatherProviderMock = () => ({
  resolveCityByName: jest.fn((cityName: string) => ({
    cityName,
    province: '湖北省',
    country: '中国',
    latitude: 30.5928,
    longitude: 114.3055,
  })),
});

describe('CitiesService', () => {
  let service: CitiesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let weatherService: ReturnType<typeof createWeatherServiceMock>;
  let weatherProvider: ReturnType<typeof createWeatherProviderMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    weatherService = createWeatherServiceMock();
    weatherProvider = createWeatherProviderMock();
    service = new CitiesService(
      prisma as never,
      weatherService as never,
      weatherProvider as never,
    );
  });

  it('should return matched cities with compatibility weather fields', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-1',
        cityName: '武汉市',
        cityCode: '420100',
        province: '湖北省',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      },
    ]);

    const result = await service.getCities('武汉');

    expect(result.code).toBe(0);
    expect(result.data[0].cityName).toBe('武汉市');
    expect(result.data[0].weatherText).toBe('晴');
    expect(result.data[0].temperature).toBe('26°C');
  });

  it('should create a city when city name is unique', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    const result = await service.createCity('测试城');

    expect(prisma.city.create).toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should rename a city when target name is not duplicated', async () => {
    prisma.city.findUnique
      .mockResolvedValueOnce({
        cityId: 'city-1',
        cityName: '北京市',
        cityCode: '110000',
        province: '北京市',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
      })
      .mockResolvedValueOnce(null);
    prisma.city.update.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    const result = await service.renameCity('北京市', '北京城区');

    expect(prisma.city.update).toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should delete city when city exists', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '北京市',
      cityCode: '110000',
      province: '北京市',
      country: '中国',
      latitude: 39.9042,
      longitude: 116.4074,
    });
    prisma.city.delete.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    const result = await service.deleteCity('北京市');

    expect(prisma.city.delete).toHaveBeenCalled();
    expect(result.code).toBe(0);
  });
});
