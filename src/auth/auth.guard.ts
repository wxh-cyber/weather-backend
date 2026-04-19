import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import type { AuthUser } from './auth.types';

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export const resolveAuthenticatedUser = async (
  request: AuthenticatedRequest,
  authTokenService: AuthTokenService,
  prisma: PrismaService,
) => {
  const authorization = request.headers.authorization;
  if (!authorization) {
    throw new UnauthorizedException('缺少登录凭证');
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('登录凭证格式错误');
  }

  const payload = authTokenService.verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { userId: payload.sub },
    select: {
      userId: true,
      email: true,
      nickname: true,
      phone: true,
      qq: true,
      wechat: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new UnauthorizedException('登录状态已失效');
  }

  request.user = user;
  return user;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await resolveAuthenticatedUser(request, this.authTokenService, this.prisma);
    return true;
  }
}
