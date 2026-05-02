import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const uploadRoot = join(
    process.cwd(),
    configService.get<string>('UPLOAD_ROOT', 'uploads'),
  );
  mkdirSync(uploadRoot, { recursive: true });
  app.useStaticAssets(uploadRoot, {
    prefix: '/uploads',
  });

  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('小慕天气后端接口文档')
    .setDescription('毕业设计天气系统后端 API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const configuredPort = Number(configService.get<string>('PORT', '3000'));
  const maxPortRetry = Number(
    configService.get<string>('PORT_RETRY_COUNT', '5'),
  );
  const basePort = Number.isFinite(configuredPort) ? configuredPort : 3000;

  let currentPort = basePort;
  for (let attempt = 0; attempt <= maxPortRetry; attempt += 1) {
    try {
      await app.listen(currentPort);
      return;
    } catch (error) {
      const isAddressInUse =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EADDRINUSE';
      const shouldRetry = isAddressInUse && attempt < maxPortRetry;
      if (!shouldRetry) {
        throw error;
      }
      currentPort += 1;
    }
  }
}
void bootstrap();
