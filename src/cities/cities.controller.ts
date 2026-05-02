import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { UserCitiesService } from './user-cities.service';

@Controller('cities')
export class CitiesController {
  constructor(
    private readonly citiesService: CitiesService,
    private readonly userCitiesService: UserCitiesService,
  ) {}

  @UseGuards(OptionalAuthGuard)
  @Get()
  getCities(
    @Query('keyword') keyword?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    if (user && !(keyword ?? '').trim()) {
      return this.userCitiesService.getUserCities(user.userId);
    }

    return this.citiesService.getCities(keyword);
  }

  @UseGuards(OptionalAuthGuard)
  @Post()
  async createCity(@Body() dto: CreateCityDto, @CurrentUser() user?: AuthUser) {
    if (!user) {
      return this.citiesService.createCity(dto.cityName);
    }

    const city = await this.citiesService.ensureCityExists(dto.cityName);
    return this.userCitiesService.addUserCity(user.userId, city.cityId);
  }

  @Put(':cityName')
  updateCity(@Param('cityName') cityName: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.renameCity(cityName, dto.cityName);
  }

  @UseGuards(OptionalAuthGuard)
  @Delete(':cityName')
  async deleteCity(
    @Param('cityName') cityName: string,
    @CurrentUser() user?: AuthUser,
  ) {
    if (!user) {
      return this.citiesService.deleteCity(cityName);
    }

    const city = await this.citiesService.getCityByNameOrThrow(cityName);
    return this.userCitiesService.removeUserCity(user.userId, city.cityId);
  }
}
