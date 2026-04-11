import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { LoginRecord, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDemoUser();
  }

  async register(dto: RegisterDto) {
    try {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { userId: true },
      });

      if (existingUser) {
        throw new ConflictException('该邮箱已注册');
      }

      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: this.hashPassword(dto.password),
          nickname: dto.nickname?.trim() || null,
        },
      });

      return {
        code: 0,
        message: '注册成功',
        data: this.toAuthUser(user),
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async login(dto: LoginDto, context: LoginContext = {}) {
    try {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        throw new NotFoundException('账号未注册');
      }
      if (user.passwordHash !== this.hashPassword(dto.password)) {
        throw new UnauthorizedException('密码错误');
      }

      await this.prisma.loginRecord.create({
        data: {
          account: user.email,
          loginAddress: this.resolveLoginAddress(context.ipAddress),
          loginDevice: this.resolveLoginDevice(context.userAgent),
          userId: user.userId,
        },
      });

      return {
        code: 0,
        message: '登录成功',
        data: {
          token: `mock-token-${user.userId}`,
          user: this.toAuthUser(user),
        },
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getProfile(authHeader?: string) {
    try {
      const user = await this.resolveUserFromAuthHeader(authHeader);
      return {
        code: 0,
        message: '获取成功',
        data: this.toProfile(user),
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getLoginRecords(authHeader?: string) {
    try {
      const user = await this.resolveUserFromAuthHeader(authHeader);
      const records = await this.prisma.loginRecord.findMany({
        where: { userId: user.userId },
        orderBy: { loginTime: 'desc' },
      });

      return {
        code: 0,
        message: '获取成功',
        data: records.map((record) => this.toLoginRecord(record)),
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateProfile(authHeader: string | undefined, dto: UpdateProfileDto) {
    try {
      const user = await this.resolveUserFromAuthHeader(authHeader);

      const updatedUser = await this.prisma.user.update({
        where: { userId: user.userId },
        data: {
          ...(dto.nickname !== undefined
            ? { nickname: dto.nickname.trim() || null }
            : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.qq !== undefined ? { qq: dto.qq.trim() } : {}),
          ...(dto.wechat !== undefined ? { wechat: dto.wechat.trim() } : {}),
          ...(dto.avatarUrl !== undefined
            ? { avatarUrl: dto.avatarUrl.trim() }
            : {}),
        },
      });

      return {
        code: 0,
        message: '保存成功',
        data: this.toProfile(updatedUser),
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateAvatar(authHeader: string | undefined, avatarUrl: string) {
    try {
      const user = await this.resolveUserFromAuthHeader(authHeader);
      const updatedUser = await this.prisma.user.update({
        where: { userId: user.userId },
        data: { avatarUrl: avatarUrl.trim() },
      });

      return {
        code: 0,
        message: '头像上传成功',
        data: {
          avatarUrl: updatedUser.avatarUrl,
        },
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async resolveUserFromAuthHeader(authHeader?: string) {
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

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });
    if (!user) {
      throw new UnauthorizedException('登录状态已失效');
    }
    return user;
  }

  private async ensureDemoUser() {
    try {
      const demoEmail = 'demo@weather.com';
      const existingDemo = await this.prisma.user.findUnique({
        where: { email: demoEmail },
        select: { userId: true },
      });

      if (existingDemo) {
        return;
      }

      await this.prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash: this.hashPassword('123456'),
          nickname: '演示账号',
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  private toAuthUser(user: User) {
    return {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname ?? undefined,
    };
  }

  private toProfile(user: User) {
    return {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname ?? undefined,
      phone: user.phone,
      qq: user.qq,
      wechat: user.wechat,
      avatarUrl: user.avatarUrl,
    };
  }

  private toLoginRecord(record: LoginRecord) {
    return {
      recordId: record.recordId,
      account: record.account,
      loginTime: record.loginTime.toISOString(),
      loginAddress: record.loginAddress,
      loginDevice: record.loginDevice,
    };
  }

  private resolveLoginAddress(ipAddress?: string) {
    if (
      !ipAddress ||
      ipAddress === '::1' ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '::ffff:127.0.0.1'
    ) {
      return '本地网络 / 开发环境';
    }
    return `网络节点 ${ipAddress}`;
  }

  private resolveLoginDevice(userAgent?: string) {
    if (!userAgent) {
      return '未知设备';
    }

    const browser =
      userAgent
        .match(/(Chrome|Firefox|Safari|Edg|Opera)\/[\d.]+/i)?.[0]
        ?.replace('Edg', 'Edge') || '未知浏览器';
    const os =
      userAgent.match(
        /(Windows NT [\d.]+|Mac OS X [\d_]+|Android [\d.]+|iPhone OS [\d_]+|Linux)/i,
      )?.[0] || '未知系统';

    return `${browser} / ${os}`.trim();
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException
    ) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      throw new InternalServerErrorException(
        '数据库连接异常，请检查后端服务或数据库配置',
      );
    }

    throw new InternalServerErrorException('服务异常，请稍后重试');
  }
}
