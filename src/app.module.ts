import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import pg from 'pg';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SentimentModule } from './sentiment/sentiment.module';
import { SentimentLog } from './sentiment/sentiment-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...typeOrmOptions(),
      entities: [SentimentLog],
      synchronize: true,
    }),
    SentimentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

function typeOrmOptions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      type: 'postgres' as const,
      driver: pg,
      url: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      extra: {
        connectionTimeoutMillis: 15000,
      },
    };
  }

  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is missing in Vercel Environment Variables');
  }

  return {
    type: 'better-sqlite3' as const,
    database: process.env.SQLITE_PATH ?? 'database.sqlite',
  };
}