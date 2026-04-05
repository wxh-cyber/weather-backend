import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService],
    }).compile();

    controller = moduleRef.get<AuthController>(AuthController);
    service = moduleRef.get<AuthService>(AuthService);
  });

  it('should call register and return success payload', () => {
    const spy = jest.spyOn(service, 'register');
    const payload = {
      email: 'controller-register@weather.com',
      password: '123456',
      nickname: '控制器注册',
    };

    const result = controller.register(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(result.code).toBe(0);
    expect(result.message).toBe('注册成功');
  });

  it('should call login and return success payload', () => {
    service.register({
      email: 'controller-login@weather.com',
      password: '123456',
      nickname: '控制器登录',
    });
    const spy = jest.spyOn(service, 'login');
    const payload = { email: 'controller-login@weather.com', password: '123456' };

    const result = controller.login(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(result.code).toBe(0);
    expect(result.message).toBe('登录成功');
  });

  it('should call getProfile and return profile payload', () => {
    const loginResult = service.login({
      email: 'demo@weather.com',
      password: '123456',
    });
    const tokenHeader = `Bearer ${loginResult.data.token}`;
    const spy = jest.spyOn(service, 'getProfile');

    const result = controller.getProfile(tokenHeader);

    expect(spy).toHaveBeenCalledWith(tokenHeader);
    expect(result.code).toBe(0);
    expect(result.message).toBe('获取成功');
  });

  it('should call updateProfile and return updated payload', () => {
    const loginResult = service.login({
      email: 'demo@weather.com',
      password: '123456',
    });
    const tokenHeader = `Bearer ${loginResult.data.token}`;
    const payload = { nickname: '控制器新昵称', phone: '13800138000' };
    const spy = jest.spyOn(service, 'updateProfile');

    const result = controller.updateProfile(tokenHeader, payload);

    expect(spy).toHaveBeenCalledWith(tokenHeader, payload);
    expect(result.code).toBe(0);
    expect(result.message).toBe('保存成功');
  });
});
