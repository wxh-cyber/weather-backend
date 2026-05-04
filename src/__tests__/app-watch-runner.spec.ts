const {
  assessManagedPortState,
  isHealthyRootResponse,
} = require('../../scripts/dev/app-watch-runner.js');

describe('app-watch-runner', () => {
  it('recognizes a healthy existing weather app instance', async () => {
    const probe = jest
      .fn()
      .mockResolvedValueOnce({ status: 'healthy', port: 3000 });

    await expect(
      assessManagedPortState({
        basePort: 3000,
        maxPort: 3005,
        probe,
      }),
    ).resolves.toEqual({
      status: 'healthy-existing',
      port: 3000,
    });
  });

  it('reports blocked port when listener is occupied but not healthy', async () => {
    const probe = jest
      .fn()
      .mockResolvedValueOnce({ status: 'occupied', port: 3000 })
      .mockResolvedValueOnce({ status: 'free', port: 3001 })
      .mockResolvedValueOnce({ status: 'free', port: 3002 })
      .mockResolvedValueOnce({ status: 'free', port: 3003 })
      .mockResolvedValueOnce({ status: 'free', port: 3004 })
      .mockResolvedValueOnce({ status: 'free', port: 3005 });

    await expect(
      assessManagedPortState({
        basePort: 3000,
        maxPort: 3005,
        probe,
      }),
    ).resolves.toEqual({
      status: 'occupied-unhealthy',
      port: 3000,
    });
  });

  it('returns free when no occupied dev ports are found', async () => {
    const probe = jest.fn().mockResolvedValue({ status: 'free', port: 3000 });

    await expect(
      assessManagedPortState({
        basePort: 3000,
        maxPort: 3002,
        probe,
      }),
    ).resolves.toEqual({
      status: 'free',
      port: null,
    });
  });

  it('treats the Hello World success payload as healthy', () => {
    expect(
      isHealthyRootResponse(
        200,
        JSON.stringify({
          code: 0,
          message: 'success',
          data: 'Hello World!',
        }),
      ),
    ).toBe(true);
  });

  it('rejects unrelated 200 responses as unhealthy', () => {
    expect(
      isHealthyRootResponse(
        200,
        JSON.stringify({
          code: 0,
          message: 'success',
          data: 'Different App',
        }),
      ),
    ).toBe(false);
  });
});
