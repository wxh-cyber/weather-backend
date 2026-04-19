import { CitiesController } from './cities.controller';
import type { CitiesService } from './cities.service';
import type { UserCitiesService } from './user-cities.service';

const createCitiesServiceMock = () => ({
  getCities: jest.fn(),
  createCity: jest.fn(),
  renameCity: jest.fn(),
  deleteCity: jest.fn(),
  ensureCityExists: jest.fn(),
  getCityByNameOrThrow: jest.fn(),
});

const createUserCitiesServiceMock = () => ({
  getUserCities: jest.fn(),
  addUserCity: jest.fn(),
  removeUserCity: jest.fn(),
});

describe('CitiesController', () => {
  let controller: CitiesController;
  let citiesService: ReturnType<typeof createCitiesServiceMock>;
  let userCitiesService: ReturnType<typeof createUserCitiesServiceMock>;

  beforeEach(() => {
    citiesService = createCitiesServiceMock();
    userCitiesService = createUserCitiesServiceMock();
    controller = new CitiesController(
      citiesService as unknown as CitiesService,
      userCitiesService as unknown as UserCitiesService,
    );
  });

  it('should return public city list for anonymous request', async () => {
    citiesService.getCities.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [],
    });

    const result = await controller.getCities('', undefined);

    expect(citiesService.getCities).toHaveBeenCalledWith('');
    expect(userCitiesService.getUserCities).not.toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should return current user city list when authenticated and keyword is empty', async () => {
    userCitiesService.getUserCities.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [{ cityName: '武汉市' }],
    });

    const result = await controller.getCities('', {
      userId: 'user-1',
    } as never);

    expect(userCitiesService.getUserCities).toHaveBeenCalledWith('user-1');
    expect(citiesService.getCities).not.toHaveBeenCalled();
    expect(result.data[0].cityName).toBe('武汉市');
  });

  it('should keep global search when authenticated request carries keyword', async () => {
    citiesService.getCities.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [{ cityName: '武汉市' }],
    });

    const result = await controller.getCities('武汉', {
      userId: 'user-1',
    } as never);

    expect(citiesService.getCities).toHaveBeenCalledWith('武汉');
    expect(userCitiesService.getUserCities).not.toHaveBeenCalled();
    expect(result.data[0].cityName).toBe('武汉市');
  });

  it('should add city to user list for authenticated create request', async () => {
    citiesService.ensureCityExists.mockResolvedValue({
      cityId: 'city-1',
    });
    userCitiesService.addUserCity.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [{ cityName: '武汉市' }],
    });

    const result = await controller.createCity(
      { cityName: '武汉市' },
      { userId: 'user-1' } as never,
    );

    expect(citiesService.ensureCityExists).toHaveBeenCalledWith('武汉市');
    expect(userCitiesService.addUserCity).toHaveBeenCalledWith(
      'user-1',
      'city-1',
    );
    expect(citiesService.createCity).not.toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should keep public create behavior for anonymous request', async () => {
    citiesService.createCity.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [],
    });

    const result = await controller.createCity(
      { cityName: '武汉市' },
      undefined,
    );

    expect(citiesService.createCity).toHaveBeenCalledWith('武汉市');
    expect(userCitiesService.addUserCity).not.toHaveBeenCalled();
    expect(result.code).toBe(0);
  });

  it('should remove only current user city relation for authenticated delete request', async () => {
    citiesService.getCityByNameOrThrow.mockResolvedValue({
      cityId: 'city-1',
    });
    userCitiesService.removeUserCity.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [],
    });

    const result = await controller.deleteCity(
      '武汉市',
      { userId: 'user-1' } as never,
    );

    expect(citiesService.getCityByNameOrThrow).toHaveBeenCalledWith('武汉市');
    expect(userCitiesService.removeUserCity).toHaveBeenCalledWith(
      'user-1',
      'city-1',
    );
    expect(citiesService.deleteCity).not.toHaveBeenCalled();
    expect(result.code).toBe(0);
  });
});
