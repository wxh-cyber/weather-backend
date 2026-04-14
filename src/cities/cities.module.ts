import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { WeatherModule } from '../weather/weather.module';
import { UserCitiesController } from './user-cities.controller';
import { UserCitiesService } from './user-cities.service';

@Module({
  imports: [WeatherModule],
  controllers: [CitiesController, UserCitiesController],
  providers: [CitiesService, UserCitiesService],
  exports: [CitiesService, UserCitiesService],
})
export class CitiesModule {}
