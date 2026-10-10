import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SentimentModule } from './sentiment/sentiment.module';
import { SentimentLog } from './sentiment/sentiment-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: {
              rejectUnauthorized: false,
            },
            extra: {
              ssl: {
                rejectUnauthorized: false,
              },
              connectionTimeoutMillis: 5000,
            },
            entities: [SentimentLog],
            synchronize: true, // يفضل إيقافها في Production لاحقاً
          };
        }

        return {
          type: 'better-sqlite3',
          database: process.env.SQLITE_PATH ?? 'database.sqlite',
          entities: [SentimentLog],
          synchronize: true,
        };
      },
    }),
    SentimentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}