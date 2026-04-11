import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  getCities(@Query('keyword') keyword?: string) {
    return this.citiesService.getCities(keyword);
  }

  @Post()
  createCity(@Body() dto: CreateCityDto) {
    return this.citiesService.createCity(dto.cityName);
  }

  @Put(':cityName')
  updateCity(@Param('cityName') cityName: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.renameCity(cityName, dto.cityName);
  }

  @Delete(':cityName')
  deleteCity(@Param('cityName') cityName: string) {
    return this.citiesService.deleteCity(cityName);
  }
}
