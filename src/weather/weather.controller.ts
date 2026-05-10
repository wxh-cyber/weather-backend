import { Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { GetTrendDto } from './dto/get-trend.dto';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  getCurrentWeather(@Query('cityId') cityId: string) {
    return this.weatherService.getCurrentWeather(cityId);
  }

  @Get('hourly')
  getHourlyWeather(@Query('cityId') cityId: string) {
    return this.weatherService.getHourlyWeather(cityId);
  }

  @Get('daily')
  getDailyWeather(@Query('cityId') cityId: string) {
    return this.weatherService.getDailyWeather(cityId);
  }

  @Get('daily-detail')
  getDailyWeatherDetail(@Query('cityId') cityId: string) {
    return this.weatherService.getDailyWeatherDetail(cityId);
  }

  @Get('trend')
  getTemperatureTrend(@Query() query: GetTrendDto) {
    return this.weatherService.getTemperatureTrend(query.cityId, query.period);
  }
}
