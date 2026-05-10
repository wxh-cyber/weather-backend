import { IsNotEmpty, IsString } from 'class-validator';

export class DestroyAccountDto {
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  @IsString({ message: '刷新令牌格式不正确' })
  refreshToken: string;
}
