import { ConfigService } from '@nestjs/config';
import { LoginGeoService } from './login-geo.service';

describe('LoginGeoService', () => {
  let service: LoginGeoService;
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          LOGIN_GEO_LOOKUP_ENABLED: 'true',
          LOGIN_GEO_LOOKUP_BASE_URL: 'https://geo.example.com/lookup?ip={ip}',
          LOGIN_GEO_LOOKUP_API_KEY: '',
          LOGIN_GEO_LOOKUP_TIMEOUT_MS: '1500',
        };
        return values[key] ?? defaultValue;
      }),
    };
    service = new LoginGeoService(configService as never);
    jest.restoreAllMocks();
  });

  it('returns dev environment label for loopback addresses', async () => {
    await expect(service.resolveLoginAddress('127.0.0.1')).resolves.toBe(
      '本地网络 / 开发环境',
    );
    await expect(service.resolveLoginAddress('::1')).resolves.toBe(
      '本地网络 / 开发环境',
    );
  });

  it('returns lan label for private network addresses', async () => {
    await expect(service.resolveLoginAddress('192.168.1.20')).resolves.toBe(
      '局域网 / 内网环境',
    );
    await expect(service.resolveLoginAddress('10.0.0.15')).resolves.toBe(
      '局域网 / 内网环境',
    );
  });

  it('formats public ip address from geo lookup response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        city: '武汉市',
        province: '湖北省',
        isp: '湖北电信',
      }),
    } as Response);

    await expect(service.resolveLoginAddress('8.8.8.8')).resolves.toBe(
      '武汉市 / 湖北省 / 湖北电信',
    );
  });

  it('falls back to network node when lookup fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('lookup failed'));

    await expect(service.resolveLoginAddress('8.8.8.8')).resolves.toBe(
      '网络节点 8.8.8.8',
    );
  });

  it('falls back to network node when lookup payload is empty', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await expect(service.resolveLoginAddress('1.1.1.1')).resolves.toBe(
      '网络节点 1.1.1.1',
    );
  });

  it('skips external lookup when geo lookup is disabled', async () => {
    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'LOGIN_GEO_LOOKUP_ENABLED') {
        return 'false';
      }
      return defaultValue;
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.resolveLoginAddress('8.8.4.4')).resolves.toBe(
      '网络节点 8.8.4.4',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
