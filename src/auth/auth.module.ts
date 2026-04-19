import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuthGuard } from './auth.guard';
import { LoginGeoService } from './login-geo.service';
import { OptionalAuthGuard } from './optional-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthGuard,
    OptionalAuthGuard,
    LoginGeoService,
  ],
  exports: [AuthGuard, OptionalAuthGuard, AuthTokenService],
})
export class AuthModule {}
