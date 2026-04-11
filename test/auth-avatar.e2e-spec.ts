import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';

describe('AuthAvatar (e2e)', () => {
  let app: INestApplication<App>;
  let token = '';
  const uploadsRoot = join(process.cwd(), 'uploads');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'demo@weather.com',
        password: '123456',
      });
    token = loginRes.body?.data?.token || '';
  });

  afterAll(async () => {
    await app.close();
    rmSync(uploadsRoot, { recursive: true, force: true });
  });

  it('should upload avatar successfully', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);

    const res = await request(app.getHttpServer())
      .post('/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', pngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.message).toBe('头像上传成功');
    expect(res.body.data.avatarUrl).toContain('/uploads/avatars/');
  });

  it('should reject non-image file', async () => {
    const txtBuffer = Buffer.from('not-image');
    const res = await request(app.getHttpServer())
      .post('/auth/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', txtBuffer, {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('should return unauthorized when token is missing', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const res = await request(app.getHttpServer())
      .post('/auth/avatar')
      .attach('avatar', pngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
  });
});
