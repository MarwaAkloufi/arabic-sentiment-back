import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import express from 'express';
import { AppModule } from '../src/app.module';

let cachedServer: express.Express | undefined;

async function getServer(): Promise<express.Express> {
  if (!cachedServer) {
    const expressInstance = express();

    const app = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(expressInstance),
    );

    app.useBodyParser('json', { limit: '25mb' });
    app.enableCors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await app.init();
    cachedServer = expressInstance;
  }

  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await getServer();
  server(req, res);
}