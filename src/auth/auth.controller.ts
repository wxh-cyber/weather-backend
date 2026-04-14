import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthUser } from './auth.types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadRoot = join(process.cwd(), 'uploads', 'avatars');
type UploadedAvatarFile = {
  filename: string;
  originalname: string;
  mimetype: string;
};
type UploadCallback = (error: Error | null, acceptFile: boolean) => void;
type StorageCallback = (error: Error | null, value: string) => void;
type StorageConfig = {
  destination: (req: unknown, file: unknown, callback: StorageCallback) => void;
  filename: (
    req: unknown,
    file: UploadedAvatarFile,
    callback: StorageCallback,
  ) => void;
};
type FileInterceptorOptions = {
  storage: ReturnType<typeof diskStorage>;
  limits: {
    fileSize: number;
  };
  fileFilter: (
    req: unknown,
    file: UploadedAvatarFile,
    callback: UploadCallback,
  ) => void;
};

const ensureUploadDir = () => {
  mkdirSync(uploadRoot, { recursive: true });
};

// `multer`'s callback-heavy typings are too loose for this ESLint profile, so we
// keep the unsafe boundary local to the adapter configuration.
const avatarUploadOptions: FileInterceptorOptions = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
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
  } as StorageConfig),
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

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.userId, dto);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user);
  }

  @UseGuards(AuthGuard)
  @Get('login-records')
  getLoginRecords(@CurrentUser() user: AuthUser) {
    return this.authService.getLoginRecords(user.userId);
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @UseGuards(AuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传头像文件');
    }
    const avatarUrl = `${request.protocol}://${request.get('host')}/uploads/avatars/${file.filename}`;
    return this.authService.updateAvatar(user.userId, avatarUrl);
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
