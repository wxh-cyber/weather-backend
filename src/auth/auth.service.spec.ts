import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';

const createPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  loginRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

const hashPassword = (password: string) =>
  createHash('sha256').update(password).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuthService(prisma as never);
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
      passwordHash: hashPassword('123456'),
      nickname: '用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });
    prisma.loginRecord.create.mockResolvedValue({});

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
    expect(result.data.token).toBe('mock-token-user-1');
    expect(prisma.loginRecord.create).toHaveBeenCalled();
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

  it('should throw unauthorized when password is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'login-user@weather.com',
      passwordHash: hashPassword('abcdef'),
      nickname: '用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
    });

    await expect(
      service.login({
        email: 'login-user@weather.com',
        password: '123456',
      }),
    ).rejects.toThrow(new UnauthorizedException('密码错误'));
  });

  it('should get profile with valid token', async () => {
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

    const profileRes = await service.getProfile('Bearer mock-token-user-1');

    expect(profileRes.code).toBe(0);
    expect(profileRes.message).toBe('获取成功');
    expect(profileRes.data.email).toBe('demo@weather.com');
  });

  it('should update profile fields', async () => {
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

    const updateRes = await service.updateProfile('Bearer mock-token-user-1', {
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
      'Bearer mock-token-user-1',
      'http://localhost:3000/uploads/avatars/demo.png',
    );

    expect(avatarRes.code).toBe(0);
    expect(avatarRes.message).toBe('头像上传成功');
    expect(avatarRes.data.avatarUrl).toBe(
      'http://localhost:3000/uploads/avatars/demo.png',
    );
  });

  it('should return login records in descending order', async () => {
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

    const recordsRes = await service.getLoginRecords(
      'Bearer mock-token-user-1',
    );

    expect(recordsRes.code).toBe(0);
    expect(recordsRes.message).toBe('获取成功');
    expect(recordsRes.data[0].loginTime).toBe('2026-04-07T10:00:00.000Z');
  });

  it('should throw unauthorized when token is missing', async () => {
    await expect(service.getProfile(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw unauthorized when login records token is invalid', async () => {
    await expect(
      service.getLoginRecords('Bearer invalid-token'),
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
});
