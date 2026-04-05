import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: '昵称格式不正确' })
  @MinLength(2, { message: '昵称长度至少为 2 位' })
  @MaxLength(24, { message: '昵称长度不能超过 24 位' })
  nickname?: string;

  @IsOptional()
  @IsString({ message: '手机号格式不正确' })
  @MaxLength(20, { message: '手机号长度不能超过 20 位' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'QQ账号格式不正确' })
  @MaxLength(20, { message: 'QQ账号长度不能超过 20 位' })
  qq?: string;

  @IsOptional()
  @IsString({ message: '微信账号格式不正确' })
  @MaxLength(30, { message: '微信账号长度不能超过 30 位' })
  wechat?: string;

  @IsOptional()
  @IsString({ message: '头像地址格式不正确' })
  @MaxLength(300, { message: '头像地址长度不能超过 300 位' })
  avatarUrl?: string;
}
