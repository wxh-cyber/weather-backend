import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherProvider } from './weather.provider';
import { WeatherService } from './weather.service';

@Module({
  controllers: [WeatherController],
  providers: [WeatherProvider, WeatherService],
  exports: [WeatherService, WeatherProvider],
})
export class WeatherModule {}
