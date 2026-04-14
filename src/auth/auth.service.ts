import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import type { LoginRecord, RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthUser, LoginContext } from './auth.types';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

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
          passwordHash: await hash(dto.password, 10),
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
      if (!(await compare(dto.password, user.passwordHash))) {
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

      const tokens = await this.issueTokens(user);

      return {
        code: 0,
        message: '登录成功',
        data: {
          token: tokens.accessToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: this.toAuthUser(user),
        },
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.authTokenService.verifyRefreshToken(
        dto.refreshToken,
      );
      if (!payload.tokenId) {
        throw new UnauthorizedException('刷新令牌无效');
      }

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenId: payload.tokenId },
      });
      const user = await this.prisma.user.findUnique({
        where: { userId: payload.sub },
      });

      this.assertRefreshTokenValid(storedToken, dto.refreshToken, payload.sub);
      if (!user) {
        throw new UnauthorizedException('登录状态已失效');
      }

      await this.prisma.refreshToken.update({
        where: { tokenId: storedToken!.tokenId },
        data: { revokedAt: new Date() },
      });

      const tokens = await this.issueTokens(user);

      return {
        code: 0,
        message: '刷新成功',
        data: {
          token: tokens.accessToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: this.toAuthUser(user),
        },
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async logout(userId: string, dto: RefreshTokenDto) {
    try {
      const payload = this.authTokenService.verifyRefreshToken(
        dto.refreshToken,
      );
      if (!payload.tokenId || payload.sub !== userId) {
        throw new UnauthorizedException('刷新令牌无效');
      }

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenId: payload.tokenId },
      });
      this.assertRefreshTokenValid(storedToken, dto.refreshToken, userId);

      await this.prisma.refreshToken.update({
        where: { tokenId: payload.tokenId },
        data: { revokedAt: new Date() },
      });

      return {
        code: 0,
        message: '退出成功',
        data: null,
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  getProfile(user: AuthUser) {
    return {
      code: 0,
      message: '获取成功',
      data: this.toProfile(user),
    };
  }

  async getLoginRecords(userId: string) {
    try {
      const records = await this.prisma.loginRecord.findMany({
        where: { userId },
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { userId },
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

  async updateAvatar(userId: string, avatarUrl: string) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { userId },
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

  private async issueTokens(user: User) {
    const tokenId = randomUUID();
    const accessToken = this.authTokenService.signAccessToken({
      sub: user.userId,
      email: user.email,
    });
    const refreshToken = this.authTokenService.signRefreshToken({
      sub: user.userId,
      email: user.email,
      tokenId,
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.resolveRefreshTokenExpiry(),
        userId: user.userId,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private assertRefreshTokenValid(
    storedToken: RefreshToken | null,
    refreshToken: string,
    expectedUserId: string,
  ) {
    if (!storedToken) {
      throw new UnauthorizedException('刷新令牌不存在');
    }
    if (storedToken.userId !== expectedUserId) {
      throw new UnauthorizedException('刷新令牌不属于当前用户');
    }
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('刷新令牌已失效');
    }
    if (storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('刷新令牌已过期');
    }
    if (storedToken.tokenHash !== this.hashRefreshToken(refreshToken)) {
      throw new UnauthorizedException('刷新令牌校验失败');
    }
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
          passwordHash: await hash('123456', 10),
          nickname: '演示账号',
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private resolveRefreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: Pick<User, 'userId' | 'email' | 'nickname'>) {
    return {
      userId: user.userId,
      email: user.email,
      nickname: user.nickname ?? undefined,
    };
  }

  private toProfile(user: AuthUser | User) {
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
