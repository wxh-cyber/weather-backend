import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuthService } from '../auth.service';

const createPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  loginRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

const createTokenServiceMock = () => ({
  signAccessToken: jest.fn(() => 'access-token'),
  signRefreshToken: jest.fn(() => 'refresh-token'),
  verifyRefreshToken: jest.fn(),
});

const createLoginGeoServiceMock = () => ({
  resolveLoginAddress: jest.fn(async (ipAddress?: string) =>
    ipAddress ? `网络节点 ${ipAddress}` : '本地网络 / 开发环境',
  ),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let authTokenService: ReturnType<typeof createTokenServiceMock>;
  let loginGeoService: ReturnType<typeof createLoginGeoServiceMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    authTokenService = createTokenServiceMock();
    loginGeoService = createLoginGeoServiceMock();
    service = new AuthService(
      prisma as never,
      authTokenService as never,
      loginGeoService as never,
    );
  });

  it('should register a new account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      userId: 'user-1',
      email: 'new-user@weather.com',
      nickname: '新用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });

    const result = await service.register({
      email: 'new-user@weather.com',
      password: '123456',
      nickname: '新用户',
    });

    expect(result.code).toBe(0);
    expect(result.message).toBe('注册成功');
    expect(result.data.email).toBe('new-user@weather.com');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should throw conflict for duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ userId: 'exists' });

    await expect(
      service.register({
        email: 'repeat@weather.com',
        password: '123456',
        nickname: '用户A',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should login with correct credentials and persist login record', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'login-user@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.loginRecord.create.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      {
        email: 'login-user@weather.com',
        password: '123456',
      },
      {
        ipAddress: '192.168.1.8',
        userAgent: 'Mozilla/5.0 Chrome/135.0.0.0 Windows NT 10.0',
      },
    );

    expect(result.code).toBe(0);
    expect(result.message).toBe('登录成功');
    expect(result.data.token).toBe('access-token');
    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.refreshToken).toBe('refresh-token');
    expect(loginGeoService.resolveLoginAddress).toHaveBeenCalledWith(
      '192.168.1.8',
    );
    expect(prisma.loginRecord.create).toHaveBeenCalledWith({
      data: {
        account: 'login-user@weather.com',
        loginAddress: '网络节点 192.168.1.8',
        loginDevice: 'Chrome/135.0.0.0 / Windows NT 10.0',
        userId: 'user-1',
      },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('should record local loopback login address when geo resolver marks dev environment', async () => {
    loginGeoService.resolveLoginAddress.mockResolvedValue(
      '本地网络 / 开发环境',
    );
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-local',
      email: 'local@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '本地用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.loginRecord.create.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    await service.login(
      { email: 'local@weather.com', password: '123456' },
      { ipAddress: '127.0.0.1' },
    );

    expect(prisma.loginRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loginAddress: '本地网络 / 开发环境',
      }),
    });
  });

  it('should persist enhanced geo address for public ip lookups', async () => {
    loginGeoService.resolveLoginAddress.mockResolvedValue(
      '武汉市 / 湖北省 / 湖北电信',
    );
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-public',
      email: 'public@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '公网用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.loginRecord.create.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    await service.login(
      { email: 'public@weather.com', password: '123456' },
      { ipAddress: '8.8.8.8' },
    );

    expect(prisma.loginRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loginAddress: '武汉市 / 湖北省 / 湖北电信',
      }),
    });
  });

  it('should keep login success when geo lookup falls back to network node', async () => {
    loginGeoService.resolveLoginAddress.mockResolvedValue('网络节点 8.8.8.8');
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-fallback',
      email: 'fallback@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '降级用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.loginRecord.create.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      { email: 'fallback@weather.com', password: '123456' },
      { ipAddress: '8.8.8.8' },
    );

    expect(result.code).toBe(0);
    expect(prisma.loginRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loginAddress: '网络节点 8.8.8.8',
      }),
    });
  });

  it('should login with legacy sha256 password and upgrade it to bcrypt', async () => {
    const legacyPasswordHash = createHash('sha256')
      .update('123456')
      .digest('hex');
    prisma.user.findUnique.mockResolvedValue({
      userId: 'legacy-user',
      email: 'legacy@weather.com',
      passwordHash: legacyPasswordHash,
      nickname: '旧用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.user.update.mockImplementation(async ({ data }) => ({
      userId: 'legacy-user',
      email: 'legacy@weather.com',
      passwordHash: data.passwordHash,
      nickname: '旧用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    }));
    prisma.loginRecord.create.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login({
      email: 'legacy@weather.com',
      password: '123456',
    });

    expect(result.code).toBe(0);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'legacy-user' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
    });
    expect(prisma.loginRecord.create).toHaveBeenCalled();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('should throw unauthorized when legacy password does not match', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'legacy-user',
      email: 'legacy@weather.com',
      passwordHash: createHash('sha256').update('123456').digest('hex'),
      nickname: '旧用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });

    await expect(
      service.login({
        email: 'legacy@weather.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(new UnauthorizedException('密码错误'));

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should refresh tokens with a valid refresh token', async () => {
    authTokenService.verifyRefreshToken.mockReturnValue({
      sub: 'user-1',
      email: 'demo@weather.com',
      type: 'refresh',
      tokenId: 'token-1',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      tokenId: 'token-1',
      tokenHash: createHash('sha256').update('refresh-token').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      userId: 'user-1',
    });
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: 'hash',
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.refresh({ refreshToken: 'refresh-token' });

    expect(result.code).toBe(0);
    expect(result.data.accessToken).toBe('access-token');
    expect(prisma.refreshToken.update).toHaveBeenCalled();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('should get profile from current user payload', () => {
    const profileRes = service.getProfile({
      userId: 'user-1',
      email: 'demo@weather.com',
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(profileRes.code).toBe(0);
    expect(profileRes.message).toBe('获取成功');
    expect(profileRes.data.email).toBe('demo@weather.com');
  });

  it('should update profile fields', async () => {
    prisma.user.update.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: 'hash',
      nickname: '新昵称',
      phone: '13800138000',
      qq: '12345678',
      wechat: 'wx-demo',
      avatarUrl: '',
    });

    const updateRes = await service.updateProfile('user-1', {
      nickname: '新昵称',
      phone: '13800138000',
      qq: '12345678',
      wechat: 'wx-demo',
    });

    expect(updateRes.code).toBe(0);
    expect(updateRes.message).toBe('保存成功');
    expect(updateRes.data.nickname).toBe('新昵称');
  });

  it('should update avatar url', async () => {
    prisma.user.update.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: 'hash',
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: 'http://localhost:3000/uploads/avatars/demo.png',
    });

    const avatarRes = await service.updateAvatar(
      'user-1',
      'http://localhost:3000/uploads/avatars/demo.png',
    );

    expect(avatarRes.code).toBe(0);
    expect(avatarRes.message).toBe('头像上传成功');
    expect(avatarRes.data.avatarUrl).toBe(
      'http://localhost:3000/uploads/avatars/demo.png',
    );
  });

  it('should change password and revoke active refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.changePassword('user-1', {
      currentPassword: '123456',
      newPassword: 'newPassword123',
    });

    expect(result.code).toBe(0);
    expect(result.message).toBe('密码修改成功');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('should throw unauthorized when current password is incorrect during password change', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong-password',
        newPassword: 'newPassword123',
      }),
    ).rejects.toThrow(new UnauthorizedException('当前密码错误'));
  });

  it('should reject same password during password change', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      passwordHash: await hash('123456', 10),
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });

    await expect(
      service.changePassword('user-1', {
        currentPassword: '123456',
        newPassword: '123456',
      }),
    ).rejects.toThrow(new BadRequestException('新密码不能与当前密码相同'));
  });

  it('should destroy account by deleting current user', async () => {
    authTokenService.verifyRefreshToken.mockReturnValue({ sub: 'user-1' });
    prisma.user.delete.mockResolvedValue({});

    const result = await service.destroyAccount('user-1', {
      refreshToken: 'valid-refresh-token',
    });

    expect(result.code).toBe(0);
    expect(result.message).toBe('账号已注销');
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('should return login records in descending order', async () => {
    prisma.loginRecord.findMany.mockResolvedValue([
      {
        recordId: 'record-1',
        account: 'demo@weather.com',
        loginTime: new Date('2026-04-07T10:00:00.000Z'),
        loginAddress: '本地网络 / 开发环境',
        loginDevice: 'Chrome/135.0.0.0 / Windows NT 10.0',
        userId: 'user-1',
      },
    ]);

    const recordsRes = await service.getLoginRecords('user-1');

    expect(recordsRes.code).toBe(0);
    expect(recordsRes.message).toBe('获取成功');
    expect(recordsRes.data[0].loginTime).toBe('2026-04-07T10:00:00.000Z');
  });

  it('should throw unauthorized when refresh token is invalid', async () => {
    authTokenService.verifyRefreshToken.mockImplementation(() => {
      throw new UnauthorizedException('刷新令牌无效');
    });

    await expect(
      service.refresh({ refreshToken: 'invalid-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw readable database error when prisma query fails during login', async () => {
    prisma.user.findUnique.mockRejectedValue(
      new Prisma.PrismaClientInitializationError('db init failed', '6.17.1'),
    );

    await expect(
      service.login({
        email: 'demo@weather.com',
        password: '123456',
      }),
    ).rejects.toThrow(
      new InternalServerErrorException(
        '数据库连接异常，请检查后端服务或数据库配置',
      ),
    );
  });

  it('should throw not found when account is not registered', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'not-exists@weather.com',
        password: '123456',
      }),
    ).rejects.toThrow(new NotFoundException('账号未注册'));
  });

  it('should repair demo account to bcrypt when existing password hash is legacy', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'demo-user',
      passwordHash: createHash('sha256').update('123456').digest('hex'),
    });
    prisma.user.update.mockResolvedValue({});

    await service.onModuleInit();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'demo-user' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
    });
  });

  it('should reset demo account to the expected bcrypt password when hash drifts', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      userId: 'demo-user',
      passwordHash: await hash('not-123456', 10),
    });
    prisma.user.update.mockResolvedValue({});

    await service.onModuleInit();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'demo-user' },
      data: { passwordHash: expect.stringMatching(/^\$2[aby]\$/) },
    });
  });
});
