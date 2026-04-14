import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AddUserCityDto {
  @IsString({ message: '城市 ID 格式不正确' })
  cityId: string;

  @IsOptional()
  @IsBoolean({ message: '默认城市标记格式不正确' })
  isDefault?: boolean;
}
