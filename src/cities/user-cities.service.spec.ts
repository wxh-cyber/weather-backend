import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserCitiesService } from './user-cities.service';

const createPrismaMock = () => ({
  userCity: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  city: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
    Promise.all(operations),
  ),
});

const createWeatherServiceMock = () => ({
  getCitySummary: jest.fn(() => ({
    weatherText: '晴',
    temperature: '26°C',
  })),
});

describe('UserCitiesService', () => {
  let service: UserCitiesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserCitiesService(
      prisma as never,
      createWeatherServiceMock() as never,
    );
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
    prisma.userCity.findMany.mockResolvedValue([]);

    const result = await service.addUserCity('user-1', 'city-1', true);

    expect(prisma.userCity.create).toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should reject duplicated user city', async () => {
    prisma.city.findUnique.mockResolvedValue({
      cityId: 'city-1',
      cityName: '武汉市',
    });
    prisma.userCity.findUnique.mockResolvedValue({
      userCityId: 'uc-1',
    });

    await expect(service.addUserCity('user-1', 'city-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject missing default target city', async () => {
    prisma.userCity.findUnique.mockResolvedValue(null);

    await expect(service.setDefaultCity('user-1', 'city-404')).rejects.toThrow(
      NotFoundException,
    );
  });
});
