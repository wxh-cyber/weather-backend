import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadRoot = join(process.cwd(), 'uploads', 'avatars');

const ensureUploadDir = () => {
  mkdirSync(uploadRoot, { recursive: true });
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      ipAddress: this.resolveClientIp(request),
      userAgent: request.get('user-agent') || undefined,
    });
  }

  @Get('profile')
  getProfile(@Headers('authorization') authorization?: string) {
    return this.authService.getProfile(authorization);
  }

  @Get('login-records')
  getLoginRecords(@Headers('authorization') authorization?: string) {
    return this.authService.getLoginRecords(authorization);
  }

  @Put('profile')
  updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(authorization, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          ensureUploadDir();
          callback(null, uploadRoot);
        },
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const safeExt = extension || '.png';
          callback(null, `${Date.now()}-${randomUUID()}${safeExt}`);
        },
      }),
      limits: {
        fileSize: MAX_AVATAR_SIZE,
      },
      fileFilter: (_req, file, callback) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(new BadRequestException('仅支持 jpg/png/webp 格式图片'), false);
      },
    }),
  )
  uploadAvatar(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: { filename: string } | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传头像文件');
    }
    const avatarUrl = `${request.protocol}://${request.get('host')}/uploads/avatars/${file.filename}`;
    return this.authService.updateAvatar(authorization, avatarUrl);
  }

  private resolveClientIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }
    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0]?.split(',')[0]?.trim();
    }
    return request.ip || request.socket.remoteAddress || undefined;
  }
}
