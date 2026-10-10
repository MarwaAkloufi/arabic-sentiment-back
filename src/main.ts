import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useBodyParser('json', { limit: '25mb' });
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // تشغيل السيرفر على البورت عند التطوير المحلي أو إذا توفر البورت
  if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
    await app.listen(process.env.PORT ?? 3000);
  } else {
    await app.init();
  }
}

void bootstrap();
