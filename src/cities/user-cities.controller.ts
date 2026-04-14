import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AddUserCityDto } from './dto/add-user-city.dto';
import { UserCitiesService } from './user-cities.service';

@UseGuards(AuthGuard)
@Controller('user/cities')
export class UserCitiesController {
  constructor(private readonly userCitiesService: UserCitiesService) {}

  @Get()
  getUserCities(@CurrentUser() user: AuthUser) {
    return this.userCitiesService.getUserCities(user.userId);
  }

  @Post()
  addUserCity(@CurrentUser() user: AuthUser, @Body() dto: AddUserCityDto) {
    return this.userCitiesService.addUserCity(
      user.userId,
      dto.cityId,
      dto.isDefault,
    );
  }

  @Put(':cityId/default')
  setDefaultCity(
    @CurrentUser() user: AuthUser,
    @Param('cityId') cityId: string,
  ) {
    return this.userCitiesService.setDefaultCity(user.userId, cityId);
  }

  @Delete(':cityId')
  removeUserCity(
    @CurrentUser() user: AuthUser,
    @Param('cityId') cityId: string,
  ) {
    return this.userCitiesService.removeUserCity(user.userId, cityId);
  }
}
