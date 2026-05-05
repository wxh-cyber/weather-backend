import { BadRequestException } from '@nestjs/common';
import { UserCitiesController } from '../user-cities.controller';
import type { UserCitiesService } from '../user-cities.service';

const createUserCitiesServiceMock = () => ({
  getUserCities: jest.fn(),
  addUserCity: jest.fn(),
  setDefaultCity: jest.fn(),
  removeUserCity: jest.fn(),
  removeUserCities: jest.fn(),
});

describe('UserCitiesController', () => {
  let controller: UserCitiesController;
  let userCitiesService: ReturnType<typeof createUserCitiesServiceMock>;

  beforeEach(() => {
    userCitiesService = createUserCitiesServiceMock();
    controller = new UserCitiesController(
      userCitiesService as unknown as UserCitiesService,
    );
  });

  it('should remove the current user city relation by city id', async () => {
    userCitiesService.removeUserCity.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [],
    });

    const result = await controller.removeUserCity(
      {
        userId: 'user-1',
      } as never,
      'city-1',
    );

    expect(userCitiesService.removeUserCity).toHaveBeenCalledWith(
      'user-1',
      'city-1',
    );
    expect(result).toEqual({
      code: 0,
      message: '获取成功',
      data: [],
    });
  });

  it('should batch remove current user city relations by post body city ids', async () => {
    userCitiesService.removeUserCities.mockResolvedValue({
      code: 0,
      message: '删除成功',
      data: [],
      failedCityIds: ['city-404'],
    });

    const result = await controller.batchRemoveUserCities(
      {
        userId: 'user-1',
      } as never,
      {
        cityIds: ['city-1', 'city-2', 'city-404'],
      },
    );

    expect(userCitiesService.removeUserCities).toHaveBeenCalledWith('user-1', [
      'city-1',
      'city-2',
      'city-404',
    ]);
    expect(result.failedCityIds).toEqual(['city-404']);
  });

  it('should keep delete batch compatibility when body has city ids', async () => {
    userCitiesService.removeUserCities.mockResolvedValue({
      code: 0,
      message: '删除成功',
      data: [],
      failedCityIds: [],
    });

    const result = await controller.removeUserCities(
      {
        userId: 'user-1',
      } as never,
      {
        cityIds: ['city-1'],
      },
    );

    expect(userCitiesService.removeUserCities).toHaveBeenCalledWith('user-1', [
      'city-1',
    ]);
    expect(result.data).toEqual([]);
  });

  it('should reject delete batch requests without a body instead of throwing 500', async () => {
    expect(() =>
      controller.removeUserCities(
        {
          userId: 'user-1',
        } as never,
        undefined as never,
      ),
    ).toThrow(BadRequestException);
    expect(userCitiesService.removeUserCities).not.toHaveBeenCalled();
  });
});
