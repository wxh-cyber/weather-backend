import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  it('should register a new account', () => {
    const result = service.register({
      email: 'new-user@weather.com',
      password: '123456',
      nickname: '新用户',
    });

    expect(result.code).toBe(0);
    expect(result.message).toBe('注册成功');
    expect(result.data.email).toBe('new-user@weather.com');
  });

  it('should throw conflict for duplicate email', () => {
    service.register({
      email: 'repeat@weather.com',
      password: '123456',
      nickname: '用户A',
    });

    expect(() =>
      service.register({
        email: 'repeat@weather.com',
        password: '123456',
        nickname: '用户B',
      }),
    ).toThrow(ConflictException);
  });

  it('should login with correct credentials', () => {
    service.register({
      email: 'login-user@weather.com',
      password: '123456',
      nickname: '用户',
    });

    const result = service.login({
      email: 'login-user@weather.com',
      password: '123456',
    });

    expect(result.code).toBe(0);
    expect(result.message).toBe('登录成功');
    expect(result.data.token).toContain('mock-token-');
  });

  it('should throw unauthorized when credentials are invalid', () => {
    expect(() =>
      service.login({
        email: 'not-exists@weather.com',
        password: '123456',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('should get profile with valid token', () => {
    const loginRes = service.login({
      email: 'demo@weather.com',
      password: '123456',
    });
    const profileRes = service.getProfile(`Bearer ${loginRes.data.token}`);

    expect(profileRes.code).toBe(0);
    expect(profileRes.message).toBe('获取成功');
    expect(profileRes.data.email).toBe('demo@weather.com');
  });

  it('should update profile fields', () => {
    const loginRes = service.login({
      email: 'demo@weather.com',
      password: '123456',
    });
    const tokenHeader = `Bearer ${loginRes.data.token}`;

    const updateRes = service.updateProfile(tokenHeader, {
      nickname: '新昵称',
      phone: '13800138000',
      qq: '12345678',
      wechat: 'wx-demo',
    });

    expect(updateRes.code).toBe(0);
    expect(updateRes.message).toBe('保存成功');
    expect(updateRes.data.nickname).toBe('新昵称');
    expect(updateRes.data.phone).toBe('13800138000');
    expect(updateRes.data.qq).toBe('12345678');
    expect(updateRes.data.wechat).toBe('wx-demo');
  });

  it('should throw unauthorized when token is missing', () => {
    expect(() => service.getProfile(undefined)).toThrow(UnauthorizedException);
  });
});
