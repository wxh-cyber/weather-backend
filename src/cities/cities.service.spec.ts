import { CitiesService } from './cities.service';
import { CityResolverService } from './city-resolver.service';
import type { CityMetadata } from '../weather/weather.types';

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
  resolveCityByName: jest.fn<Promise<CityMetadata | null>, [string]>(
    async (cityName: string) => ({
      cityName,
      province: '湖北省',
      country: '中国',
      latitude: 30.5928,
      longitude: 114.3055,
    }),
  ),
});

describe('CitiesService', () => {
  let service: CitiesService;
  let cityResolver: CityResolverService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let weatherService: ReturnType<typeof createWeatherServiceMock>;
  let weatherProvider: ReturnType<typeof createWeatherProviderMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    weatherService = createWeatherServiceMock();
    weatherProvider = createWeatherProviderMock();
    cityResolver = new CityResolverService(weatherProvider as never);
    service = new CitiesService(
      prisma as never,
      weatherService as never,
      cityResolver as never,
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

    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '测试城',
        cityCode: null,
        province: '湖北省',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      },
    });
    expect(result.code).toBe(0);
  });

  it('should prefer seed metadata when creating a seeded city', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.createCity('上海市');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '上海市',
        cityCode: '310000',
        province: '上海市',
        country: '中国',
        latitude: 31.2304,
        longitude: 121.4737,
      },
    });
  });

  it('should prefer seed metadata when creating 东莞市', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.createCity('东莞市');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '东莞市',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
  });

  it('should normalize 东莞 to 东莞市 when creating a city', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.createCity('东莞');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '东莞市',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
  });

  it('should map 虎门 to 东莞市 when creating a city', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.createCity('虎门');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '东莞市',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
  });

  it('should reject creation when no resolvable coordinates are found', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.findMany.mockResolvedValue([]);
    weatherProvider.resolveCityByName.mockImplementation(() => Promise.resolve(null));

    await expect(service.createCity('火星基地')).rejects.toThrow(
      '未找到可用于地图定位的地点，请输入更完整的名称',
    );
    expect(prisma.city.create).not.toHaveBeenCalled();
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

  it('should prefer seed metadata when renaming to a seeded city', async () => {
    prisma.city.findUnique
      .mockResolvedValueOnce({
        cityId: 'city-1',
        cityName: '深圳',
        cityCode: null,
        province: '',
        country: '中国',
        latitude: null,
        longitude: null,
      })
      .mockResolvedValueOnce(null);
    prisma.city.update.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.renameCity('深圳', '广州市');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { cityId: 'city-1' },
      data: {
        cityName: '广州市',
        cityCode: '440100',
        province: '广东省',
        country: '中国',
        latitude: 23.1291,
        longitude: 113.2644,
      },
    });
  });

  it('should repair seeded city coordinates on module init when existing data is wrong', async () => {
    prisma.city.findUnique.mockImplementation(({ where }: { where: { cityName: string } }) => {
      if (where.cityName === '上海市') {
        return Promise.resolve({
          cityId: 'city-sh',
          cityName: '上海市',
          cityCode: null,
          province: '伊利诺伊州',
          country: '美国',
          latitude: 41.05087,
          longitude: -90.4968,
        });
      }

      if (where.cityName === '广州市') {
        return Promise.resolve({
          cityId: 'city-gz',
          cityName: '广州市',
          cityCode: null,
          province: '',
          country: '中国',
          latitude: null,
          longitude: null,
        });
      }

      if (where.cityName === '东莞市') {
        return Promise.resolve({
          cityId: 'city-dg',
          cityName: '东莞市',
          cityCode: null,
          province: '',
          country: '中国',
          latitude: null,
          longitude: null,
        });
      }

      if (where.cityName === '虎门') {
        return Promise.resolve({
          cityId: 'city-hm',
          cityName: '虎门',
          cityCode: null,
          province: '',
          country: '中国',
          latitude: null,
          longitude: null,
        });
      }

      return Promise.resolve({
        cityId: 'city-ok',
        cityName: where.cityName,
        cityCode: 'seed-ok',
        province: '已修复省份',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      });
    });
    prisma.city.createMany.mockResolvedValue({ count: 0 });
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-gz',
        cityName: '广州市',
        cityCode: null,
        province: '',
        country: '中国',
        latitude: null,
        longitude: null,
      },
      {
        cityId: 'city-dg',
        cityName: '东莞市',
        cityCode: null,
        province: '',
        country: '中国',
        latitude: null,
        longitude: null,
      },
      {
        cityId: 'city-hm',
        cityName: '虎门',
        cityCode: null,
        province: '',
        country: '中国',
        latitude: null,
        longitude: null,
      },
    ]);
    prisma.city.update.mockResolvedValue({});

    await service.onModuleInit();

    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { cityId: 'city-sh' },
      data: {
        cityCode: '310000',
        province: '上海市',
        country: '中国',
        latitude: 31.2304,
        longitude: 121.4737,
      },
    });
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { cityId: 'city-gz' },
      data: {
        cityCode: '440100',
        province: '广东省',
        country: '中国',
        latitude: 23.1291,
        longitude: 113.2644,
      },
    });
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { cityId: 'city-dg' },
      data: {
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { cityId: 'city-hm' },
      data: {
        cityName: '虎门',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
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
