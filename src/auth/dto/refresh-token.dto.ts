import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: '刷新令牌格式不正确' })
  @MinLength(10, { message: '刷新令牌长度不正确' })
  refreshToken: string;
}
