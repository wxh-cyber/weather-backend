import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: '当前密码格式不正确' })
  @MinLength(6, { message: '当前密码长度至少为 6 位' })
  @MaxLength(64, { message: '当前密码长度不能超过 64 位' })
  currentPassword: string;

  @IsString({ message: '新密码格式不正确' })
  @MinLength(6, { message: '新密码长度至少为 6 位' })
  @MaxLength(64, { message: '新密码长度不能超过 64 位' })
  newPassword: string;
}
