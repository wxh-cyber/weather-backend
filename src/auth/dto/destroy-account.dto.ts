import { IsOptional, IsString } from 'class-validator';

export class DestroyAccountDto {
  @IsOptional()
  @IsString({ message: '刷新令牌格式不正确' })
  refreshToken?: string;
}
