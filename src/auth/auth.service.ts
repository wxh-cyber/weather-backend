import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type MockUser = {
  userId: string;
  email: string;
  password: string;
  nickname?: string;
  phone: string;
  qq: string;
  wechat: string;
  avatarUrl: string;
};

@Injectable()
export class AuthService {
  private readonly usersByEmail = new Map<string, MockUser>();
  private readonly usersById = new Map<string, MockUser>();

  constructor() {
    const defaultUser: MockUser = {
      userId: randomUUID(),
      email: 'demo@weather.com',
      password: '123456',
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    };
    this.usersByEmail.set(defaultUser.email, defaultUser);
    this.usersById.set(defaultUser.userId, defaultUser);
  }

  register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    if (this.usersByEmail.has(normalizedEmail)) {
      throw new ConflictException('该邮箱已注册');
    }

    const user: MockUser = {
      userId: randomUUID(),
      email: normalizedEmail,
      password: dto.password,
      nickname: dto.nickname?.trim() || undefined,
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    };
    this.usersByEmail.set(normalizedEmail, user);
    this.usersById.set(user.userId, user);

    return {
      code: 0,
      message: '注册成功',
      data: {
        userId: user.userId,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }

  login(dto: LoginDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = this.usersByEmail.get(normalizedEmail);

    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return {
      code: 0,
      message: '登录成功',
      data: {
        token: `mock-token-${user.userId}`,
        user: {
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
        },
      },
    };
  }

  getProfile(authHeader?: string) {
    const user = this.resolveUserFromAuthHeader(authHeader);
    return {
      code: 0,
      message: '获取成功',
      data: this.toProfile(user),
    };
  }

  updateProfile(authHeader: string | undefined, dto: UpdateProfileDto) {
    const user = this.resolveUserFromAuthHeader(authHeader);

    if (dto.nickname !== undefined) {
      const nextNickname = dto.nickname.trim();
      user.nickname = nextNickname || undefined;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone.trim();
    }
    if (dto.qq !== undefined) {
      user.qq = dto.qq.trim();
    }
    if (dto.wechat !== undefined) {
      user.wechat = dto.wechat.trim();
    }
    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl.trim();
    }

    return {
      code: 0,
      message: '保存成功',
      data: this.toProfile(user),
    };
  }

  private resolveUserFromAuthHeader(authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('缺少登录凭证');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('登录凭证格式错误');
    }
    if (!token.startsWith('mock-token-')) {
      throw new UnauthorizedException('登录凭证无效');
    }

    const userId = token.slice('mock-token-'.length);
    if (!userId) {
      throw new BadRequestException('登录凭证解析失败');
    }

    const user = this.usersById.get(userId);
    if (!user) {
      throw new UnauthorizedException('登录状态已失效');
    }
    return user;
  }

  private toProfile(user: MockUser) {
    return {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      qq: user.qq,
      wechat: user.wechat,
      avatarUrl: user.avatarUrl,
    };
  }
}
