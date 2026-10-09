import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SentimentController } from './sentiment.controller';
import { SentimentService } from './sentiment.service';
import { SentimentLog } from './sentiment-log.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([SentimentLog])],
  controllers: [SentimentController],
  providers: [SentimentService],
})
export class SentimentModule {}
