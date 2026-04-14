import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt, { type SignOptions } from 'jsonwebtoken';
import {
  ACCESS_TOKEN_TYPE,
  DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_TYPE,
} from './auth.constants';
import type { TokenPayload } from './auth.types';

@Injectable()
export class AuthTokenService {
  constructor(private readonly configService: ConfigService) {}

  signAccessToken(payload: Omit<TokenPayload, 'type'>) {
    return jwt.sign(
      {
        ...payload,
        type: ACCESS_TOKEN_TYPE,
      },
      this.getAccessSecret(),
      {
        expiresIn: this.configService.get<string>(
          'ACCESS_TOKEN_EXPIRES_IN',
          DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
        ) as SignOptions['expiresIn'],
      },
    );
  }

  signRefreshToken(payload: Omit<TokenPayload, 'type'> & { tokenId: string }) {
    return jwt.sign(
      {
        ...payload,
        type: REFRESH_TOKEN_TYPE,
      },
      this.getRefreshSecret(),
      {
        expiresIn: this.configService.get<string>(
          'REFRESH_TOKEN_EXPIRES_IN',
          DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
        ) as SignOptions['expiresIn'],
      },
    );
  }

  verifyAccessToken(token: string) {
    return this.verifyToken(token, this.getAccessSecret(), ACCESS_TOKEN_TYPE);
  }

  verifyRefreshToken(token: string) {
    return this.verifyToken(token, this.getRefreshSecret(), REFRESH_TOKEN_TYPE);
  }

  private verifyToken(token: string, secret: string, expectedType: string) {
    try {
      const payload = jwt.verify(token, secret) as TokenPayload;
      if (payload.type !== expectedType) {
        throw new UnauthorizedException('登录凭证类型错误');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
  }

  private getAccessSecret() {
    return this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'weather-access-secret',
    );
  }

  private getRefreshSecret() {
    return this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'weather-refresh-secret',
    );
  }
}
