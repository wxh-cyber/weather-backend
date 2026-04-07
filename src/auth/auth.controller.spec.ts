import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            getProfile: jest.fn(),
            getLoginRecords: jest.fn(),
            updateProfile: jest.fn(),
            updateAvatar: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<AuthController>(AuthController);
    service = moduleRef.get(AuthService);
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
      data: { userId: 'user-1', email: payload.email, nickname: payload.nickname },
    });

    const result = await controller.register(payload);

    expect(service.register).toHaveBeenCalledWith(payload);
    expect(result.code).toBe(0);
  });

  it('should call login and return success payload', async () => {
    const payload = { email: 'controller-login@weather.com', password: '123456' };
    const request = {
      headers: {},
      get: jest.fn().mockReturnValue('Mozilla/5.0 Chrome/135.0.0.0'),
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    service.login.mockResolvedValue({
      code: 0,
      message: '登录成功',
      data: {
        token: 'mock-token-user-1',
        user: { userId: 'user-1', email: payload.email, nickname: '控制器登录' },
      },
    });

    const result = await controller.login(payload, request);

    expect(service.login).toHaveBeenCalledWith(payload, {
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Chrome/135.0.0.0',
    });
    expect(result.code).toBe(0);
  });

  it('should call getProfile and return profile payload', async () => {
    service.getProfile.mockResolvedValue({
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

    const result = await controller.getProfile('Bearer mock-token-user-1');

    expect(service.getProfile).toHaveBeenCalledWith('Bearer mock-token-user-1');
    expect(result.code).toBe(0);
  });

  it('should call updateProfile and return updated payload', async () => {
    const payload = { nickname: '控制器新昵称', phone: '13800138000' };
    service.updateProfile.mockResolvedValue({
      code: 0,
      message: '保存成功',
      data: {
        userId: 'user-1',
        email: 'demo@weather.com',
        nickname: '控制器新昵称',
        phone: '13800138000',
        qq: '',
        wechat: '',
        avatarUrl: '',
      },
    });

    const result = await controller.updateProfile('Bearer mock-token-user-1', payload);

    expect(service.updateProfile).toHaveBeenCalledWith('Bearer mock-token-user-1', payload);
    expect(result.code).toBe(0);
  });

  it('should call getLoginRecords and return records payload', async () => {
    service.getLoginRecords.mockResolvedValue({
      code: 0,
      message: '获取成功',
      data: [
        {
          recordId: 'record-1',
          account: 'demo@weather.com',
          loginTime: '2026-04-07T10:00:00.000Z',
          loginAddress: '本地网络 / 开发环境',
          loginDevice: 'Chrome/135.0.0.0 / Windows NT 10.0',
        },
      ],
    });

    const result = await controller.getLoginRecords('Bearer mock-token-user-1');

    expect(service.getLoginRecords).toHaveBeenCalledWith('Bearer mock-token-user-1');
    expect(result.code).toBe(0);
    expect(Array.isArray(result.data)).toBe(true);
  });
});
