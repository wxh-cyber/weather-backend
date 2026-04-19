import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import {
  type AuthenticatedRequest,
  resolveAuthenticatedUser,
} from './auth.guard';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.headers.authorization) {
      return true;
    }

    await resolveAuthenticatedUser(request, this.authTokenService, this.prisma);
    return true;
  }
}
