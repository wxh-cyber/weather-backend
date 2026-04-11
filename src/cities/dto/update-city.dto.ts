import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  cityName: string;
}
