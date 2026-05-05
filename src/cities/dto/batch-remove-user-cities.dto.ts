import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BatchRemoveUserCitiesDto {
  @IsArray({ message: '城市 ID 列表格式不正确' })
  @ArrayNotEmpty({ message: '城市 ID 列表不能为空' })
  @IsString({ each: true, message: '城市 ID 格式不正确' })
  cityIds: string[];
}
