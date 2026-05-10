import { WeatherController } from '../weather.controller';
import type { WeatherService } from '../weather.service';

const createWeatherServiceMock = () => ({
  getCurrentWeather: jest.fn(),
  getHourlyWeather: jest.fn(),
  getDailyWeather: jest.fn(),
  getDailyWeatherDetail: jest.fn(),
});

describe('WeatherController', () => {
  let controller: WeatherController;
  let service: ReturnType<typeof createWeatherServiceMock>;

  beforeEach(() => {
    service = createWeatherServiceMock();
    controller = new WeatherController(service as unknown as WeatherService);
  });

  it('should delegate daily weather detail queries', async () => {
    service.getDailyWeatherDetail.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: {
        cityId: 'city-1',
        cityName: '武汉市',
        source: 'open-meteo',
        items: [],
      },
    });

    const result = await controller.getDailyWeatherDetail('city-1');

    expect(service.getDailyWeatherDetail).toHaveBeenCalledWith('city-1');
    expect(result.code).toBe(0);
  });
});
