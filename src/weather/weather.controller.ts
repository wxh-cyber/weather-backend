import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';

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

  @Get('reverse-geocode')
  reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('经纬度参数不合法');
    }

    return this.weatherService.reverseGeocode(latitude, longitude);
  }
}
