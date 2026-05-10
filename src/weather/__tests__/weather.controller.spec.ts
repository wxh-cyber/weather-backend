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

  it('should delegate current weather queries', async () => {
    service.getCurrentWeather.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: { cityId: 'city-1', cityName: '武汉市', weatherText: '晴', temperature: '26°C' },
    });

    const result = await controller.getCurrentWeather('city-1');

    expect(service.getCurrentWeather).toHaveBeenCalledWith('city-1');
    expect(result.code).toBe(0);
  });

  it('should delegate hourly weather queries', async () => {
    service.getHourlyWeather.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: { cityId: 'city-1', cityName: '武汉市', source: 'open-meteo', items: [] },
    });

    const result = await controller.getHourlyWeather('city-1');

    expect(service.getHourlyWeather).toHaveBeenCalledWith('city-1');
    expect(result.code).toBe(0);
  });

  it('should delegate daily weather queries', async () => {
    service.getDailyWeather.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: { cityId: 'city-1', cityName: '武汉市', source: 'open-meteo', items: [] },
    });

    const result = await controller.getDailyWeather('city-1');

    expect(service.getDailyWeather).toHaveBeenCalledWith('city-1');
    expect(result.code).toBe(0);
  });
});
