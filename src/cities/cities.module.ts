import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { WeatherModule } from '../weather/weather.module';
import { AuthModule } from '../auth/auth.module';
import { UserCitiesController } from './user-cities.controller';
import { UserCitiesService } from './user-cities.service';
import { CityResolverService } from './city-resolver.service';

@Module({
  imports: [WeatherModule, AuthModule],
  controllers: [CitiesController, UserCitiesController],
  providers: [CitiesService, UserCitiesService, CityResolverService],
  exports: [CitiesService, UserCitiesService, CityResolverService],
})
export class CitiesModule {}
