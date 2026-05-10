import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTrendDto {
  @IsString()
  @IsNotEmpty()
  cityId: string;

  @Type(() => Number)
  @IsIn([7, 15, 30, 90])
  period: 7 | 15 | 30 | 90;
}
