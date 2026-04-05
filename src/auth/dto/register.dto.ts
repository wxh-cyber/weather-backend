import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码长度至少为 6 位' })
  password: string;

  @IsOptional()
  @IsString({ message: '昵称格式不正确' })
  nickname?: string;
}
