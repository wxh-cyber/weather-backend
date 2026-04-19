import { BadRequestException } from '@nestjs/common';
import { WeatherController } from '../weather.controller';
import type { WeatherService } from '../weather.service';

const createWeatherServiceMock = () => ({
  getCurrentWeather: jest.fn(),
  getHourlyWeather: jest.fn(),
  getDailyWeather: jest.fn(),
  reverseGeocode: jest.fn(),
});

describe('WeatherController', () => {
  let controller: WeatherController;
  let service: ReturnType<typeof createWeatherServiceMock>;

  beforeEach(() => {
    service = createWeatherServiceMock();
    controller = new WeatherController(service as unknown as WeatherService);
  });

  it('should delegate reverse geocode with parsed coordinates', async () => {
    service.reverseGeocode.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: {
        displayName: '湖北省 武汉市 洪山区',
        city: '武汉市',
        province: '湖北省',
        country: '中国',
        latitude: 30.5928,
        longitude: 114.3055,
      },
    });

    const result = await controller.reverseGeocode('30.5928', '114.3055');

    expect(service.reverseGeocode).toHaveBeenCalledWith(30.5928, 114.3055);
    expect(result.code).toBe(0);
  });

  it('should reject invalid coordinates', async () => {
    expect(() => controller.reverseGeocode('invalid', '114.3055')).toThrow(
      BadRequestException,
    );
  });
});
