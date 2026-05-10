import { CitiesService } from '../cities.service';
import { CityResolverService } from '../city-resolver.service';
import type { CityMetadata } from '../../weather/weather.types';

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
        normalizedName: '武汉',
        searchAliases: '武汉|武汉市',
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

  it('should return the same search result for 北京 and 北京市', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-bj',
        cityName: '北京市',
        normalizedName: '北京',
        searchAliases: '北京|北京市',
        cityCode: '110000',
        province: '北京市',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
      },
    ]);

    const shortKeywordResult = await service.getCities('北京');
    const fullKeywordResult = await service.getCities('北京市');

    expect(shortKeywordResult.data).toEqual(fullKeywordResult.data);
    expect(shortKeywordResult.data[0]?.cityName).toBe('北京市');
  });

  it('should return the same search result for 广州 and 广州市', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-gz',
        cityName: '广州市',
        normalizedName: '广州',
        searchAliases: '广州|广州市',
        cityCode: '440100',
        province: '广东省',
        country: '中国',
        latitude: 23.1291,
        longitude: 113.2644,
      },
    ]);

    const shortKeywordResult = await service.getCities('广州');
    const fullKeywordResult = await service.getCities('广州市');

    expect(shortKeywordResult.data).toEqual(fullKeywordResult.data);
    expect(fullKeywordResult.data[0]?.cityName).toBe('广州市');
  });

  it('should map 松山湖 search to 东莞市', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-dg',
        cityName: '东莞市',
        normalizedName: '东莞',
        searchAliases:
          '东莞|东莞市|东莞城区|松山湖|松山湖园区|虎门|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    ]);

    const result = await service.getCities('松山湖');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.cityName).toBe('东莞市');
  });

  it('should normalize whitespace variants during search', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-bj',
        cityName: '北京市',
        normalizedName: '北京',
        searchAliases: '北京|北京市',
        cityCode: '110000',
        province: '北京市',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
      },
    ]);

    const result = await service.getCities(' 北京市 ');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.cityName).toBe('北京市');
  });

  it('should create a city when city name is unique', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    const result = await service.createCity('测试城');

    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '测试城',
        normalizedName: '测试城',
        searchAliases: '测试城',
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
        normalizedName: '上海',
        searchAliases: '上海市|上海',
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
        normalizedName: '东莞',
        searchAliases:
          '东莞市|东莞|东莞城区|松山湖|松山湖园区|松山湖园|虎门|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
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
        normalizedName: '东莞',
        searchAliases:
          '东莞市|东莞|东莞城区|松山湖|松山湖园区|松山湖园|虎门|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
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
        normalizedName: '东莞',
        searchAliases:
          '东莞市|东莞|东莞城区|松山湖|松山湖园区|松山湖园|虎门|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
  });

  it('should normalize 北京 to 北京市 when creating a city', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.create.mockResolvedValue({});
    prisma.city.findMany.mockResolvedValue([]);

    await service.createCity('北京');

    expect(weatherProvider.resolveCityByName).not.toHaveBeenCalled();
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: {
        cityName: '北京市',
        normalizedName: '北京',
        searchAliases: '北京市|北京',
        cityCode: '110000',
        province: '北京市',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
      },
    });
  });

  it('should reject creation when no resolvable coordinates are found', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    prisma.city.findMany.mockResolvedValue([]);
    weatherProvider.resolveCityByName.mockImplementation(() =>
      Promise.resolve(null),
    );

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
        normalizedName: '广州',
        searchAliases: '广州市|广州',
        cityCode: '440100',
        province: '广东省',
        country: '中国',
        latitude: 23.1291,
        longitude: 113.2644,
      },
    });
  });

  it('should repair seeded city coordinates on module init when existing data is wrong', async () => {
    prisma.city.findUnique.mockImplementation(
      ({ where }: { where: { cityName: string } }) => {
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
          normalizedName: where.cityName.replace(/市$/u, ''),
          searchAliases: [where.cityName, where.cityName.replace(/市$/u, '')]
            .filter(
              (value, index, items) => value && items.indexOf(value) === index,
            )
            .join('|'),
          latitude: 30.5928,
          longitude: 114.3055,
        });
      },
    );
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
        normalizedName: '上海',
        searchAliases: '上海市|上海',
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
        normalizedName: '广州',
        searchAliases: '广州市|广州',
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
        normalizedName: '东莞',
        searchAliases:
          '东莞市|东莞|东莞城区|松山湖|松山湖园区|松山湖园|虎门|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
        cityCode: '441900',
        province: '广东省',
        country: '中国',
        latitude: 23.0207,
        longitude: 113.7518,
      },
    });
    const tigerGateRepairCall = prisma.city.update.mock.calls.find(
      ([argument]) => argument.where.cityId === 'city-hm',
    );

    expect(tigerGateRepairCall).toBeDefined();
    expect(tigerGateRepairCall?.[0]).toEqual({
      where: { cityId: 'city-hm' },
      data: {
        cityName: '虎门',
        normalizedName: '虎门',
        searchAliases:
          '虎门|东莞市|东莞|东莞城区|松山湖|松山湖园区|松山湖园|虎门镇|长安|长安镇|常平|常平镇|厚街|厚街镇',
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

  it('should return all cities when no keyword is provided', async () => {
    prisma.city.findMany.mockResolvedValue([
      {
        cityId: 'city-bj',
        cityName: '北京市',
        normalizedName: '北京',
        searchAliases: '北京|北京市',
        cityCode: '110000',
        province: '北京市',
        country: '中国',
        latitude: 39.9042,
        longitude: 116.4074,
      },
      {
        cityId: 'city-sh',
        cityName: '上海市',
        normalizedName: '上海',
        searchAliases: '上海|上海市',
        cityCode: '310000',
        province: '上海市',
        country: '中国',
        latitude: 31.2304,
        longitude: 121.4737,
      },
    ]);

    const result = await service.getCities();

    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(2);
    expect(prisma.city.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('should handle P2002 race condition in ensureCityExists and return existing city', async () => {
    prisma.city.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        cityId: 'city-wh',
        cityName: '武汉市',
        normalizedName: '武汉',
        searchAliases: '武汉|武汉市',
        cityCode: '420100',
        province: '湖北省',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      });

    const p2002Error = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    prisma.city.create.mockRejectedValue(p2002Error);

    const result = await service.ensureCityExists('武汉市');

    expect(result.cityName).toBe('武汉市');
    expect(prisma.city.findUnique).toHaveBeenCalledTimes(2);
  });

  it('should handle P2002 race condition in createCity and return 409', async () => {
    prisma.city.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        cityId: 'city-wh',
        cityName: '武汉市',
        normalizedName: '武汉',
        searchAliases: '武汉|武汉市',
        cityCode: '420100',
        province: '湖北省',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      });

    const p2002Error = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    prisma.city.create.mockRejectedValue(p2002Error);

    await expect(service.createCity('武汉市')).rejects.toThrow('城市已存在');
  });
});
