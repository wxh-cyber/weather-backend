import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { OptionalAuthGuard } from './optional-auth.guard';

const createTokenServiceMock = () => ({
  verifyAccessToken: jest.fn(),
});

const createPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
  },
});

const createExecutionContext = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;
  let authTokenService: ReturnType<typeof createTokenServiceMock>;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    authTokenService = createTokenServiceMock();
    prisma = createPrismaMock();
    guard = new OptionalAuthGuard(authTokenService as never, prisma as never);
  });

  it('should allow anonymous requests without authorization header', async () => {
    await expect(
      guard.canActivate(createExecutionContext({})),
    ).resolves.toBe(true);
    expect(authTokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('should attach user for valid bearer token', async () => {
    const request = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };
    authTokenService.verifyAccessToken.mockReturnValue({
      sub: 'user-1',
      email: 'demo@weather.com',
      type: 'access',
    });
    prisma.user.findUnique.mockResolvedValue({
      userId: 'user-1',
      email: 'demo@weather.com',
      nickname: '演示用户',
      phone: '',
      qq: '',
      wechat: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });

  it('should reject invalid authorization header', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          authorization: 'invalid-token',
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
