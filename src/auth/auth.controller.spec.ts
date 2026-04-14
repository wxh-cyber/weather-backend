import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { Request } from 'express';

const createAuthServiceMock = () => ({
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
  getLoginRecords: jest.fn(),
  updateProfile: jest.fn(),
  updateAvatar: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let service: ReturnType<typeof createAuthServiceMock>;

  beforeEach(() => {
    service = createAuthServiceMock();
    controller = new AuthController(service as unknown as AuthService);
  });

  it('should call register and return success payload', async () => {
    const payload = {
      email: 'controller-register@weather.com',
      password: '123456',
      nickname: '控制器注册',
    };
    service.register.mockResolvedValue({
      code: 0,
      message: '注册成功',
      data: {
        userId: 'user-1',
        email: payload.email,
        nickname: payload.nickname,
      },
    });

    const result = await controller.register(payload);

    expect(service.register).toHaveBeenCalledWith(payload);
    expect(result.code).toBe(0);
  });

  it('should call login and return success payload', async () => {
    const payload = {
      email: 'controller-login@weather.com',
      password: '123456',
    };
    const request = {
      headers: {},
      get: jest.fn().mockReturnValue('Mozilla/5.0 Chrome/135.0.0.0'),
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    service.login.mockResolvedValue({
      code: 0,
      message: '登录成功',
      data: {
        token: 'access-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          userId: 'user-1',
          email: payload.email,
          nickname: '控制器登录',
        },
      },
    });

    const result = await controller.login(payload, request);

    expect(service.login).toHaveBeenCalledWith(payload, {
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Chrome/135.0.0.0',
    });
    expect(result.code).toBe(0);
  });

  it('should call refresh and return refreshed tokens', async () => {
    service.refresh.mockResolvedValue({
      code: 0,
      message: '刷新成功',
      data: {
        token: 'access-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          userId: 'user-1',
          email: 'demo@weather.com',
        },
      },
    });

    const result = await controller.refresh({ refreshToken: 'refresh-token' });

    expect(service.refresh).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
    });
    expect(result.code).toBe(0);
  });

  it('should call getProfile and return profile payload', () => {
    const user = {
      userId: 'user-1',
      email: 'demo@weather.com',
      nickname: '演示账号',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    service.getProfile.mockReturnValue({
      code: 0,
      message: '获取成功',
      data: {
        userId: 'user-1',
        email: 'demo@weather.com',
        nickname: '演示账号',
        phone: '',
        qq: '',
        wechat: '',
        avatarUrl: '',
      },
    });

    const result = controller.getProfile(user);

    expect(service.getProfile).toHaveBeenCalledWith(user);
    expect(result.code).toBe(0);
  });
});
