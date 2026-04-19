import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuthGuard } from './auth.guard';
import { LoginGeoService } from './login-geo.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, AuthGuard, LoginGeoService],
  exports: [AuthGuard, AuthTokenService],
})
export class AuthModule {}
