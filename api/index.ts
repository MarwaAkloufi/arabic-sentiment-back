import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';

const server = express();
let isAppInitialized = false;

export const createNestServer = async (expressInstance: express.Express) => {
  if (!isAppInitialized) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressInstance),
    );
    app.enableCors();
    await app.init();
    isAppInitialized = true;
  }
};

void createNestServer(server);

export default server;