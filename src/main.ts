import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
      },
      trustProxy: true,
      genReqId: () => randomUUID(),
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const corsOrigins = configService.get<string[]>('cors.origins') || ['http://localhost:3000'];

  // ── Fastify Plugins ──
  await app.register(helmet as any, { contentSecurityPolicy: false });
  await app.register(compress as any);
  await app.register(rateLimit as any, { max: 100, timeWindow: '1 minute' });

  // ── CORS ──
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // ── Swagger ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Template NestJS API')
    .setDescription('NestJS + Fastify + Prisma + JWT + RBAC')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // ── Start ──
  await app.listen({ port, host: '0.0.0.0' });
  Logger.log(`🚀 Application running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚 Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();
