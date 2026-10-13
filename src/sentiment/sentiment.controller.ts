import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  Param,
  Delete,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SentimentService } from './sentiment.service';
import { SentimentLog } from './sentiment-log.entity';
import type {
  BatchAnalysisResult,
  BatchTextRequest,
  FileAnalysisResult,
  PagedLogs,
  SingleTextRequest,
  StatsResponse,
} from './sentiment.dto';

@Controller('sentiment')
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  @Post('analyze')
  async analyze(@Body() body: SingleTextRequest): Promise<SentimentLog> {
    const text = body?.text?.trim();
    if (!text) {
      throw new BadRequestException('Text cannot be empty');
    }
    return await this.sentimentService.analyzeSentiment(text);
  }

  @Post('analyze-batch')
  async analyzeBatch(
    @Body() body: BatchTextRequest,
  ): Promise<BatchAnalysisResult> {
    const texts = Array.isArray(body?.texts) ? body.texts : [];
    const normalized = texts.map((t) => String(t).trim());

    if (normalized.length === 0) {
      throw new BadRequestException('texts must be a non-empty array');
    }
    if (normalized.some((t) => !t)) {
      throw new BadRequestException('texts must not contain empty strings');
    }

    return await this.sentimentService.analyzeBatch(normalized);
  }

  @Post('analyze-file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = /\.(csv|xlsx|xls|txt)$/i.test(file.originalname);
        if (allowed) {
          cb(null, true);
        } else {
          cb(
            new HttpException(
              'Only CSV, XLSX, XLS or TXT files are allowed',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
      },
    }),
  )
  async analyzeFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileAnalysisResult> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return await this.sentimentService.analyzeFile(
      file.buffer,
      file.originalname,
    );
  }

  @Get('stats')
  async getStats(): Promise<StatsResponse> {
    return await this.sentimentService.getStats();
  }

  @Get('logs')
  async getLogs(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('label') label?: string,
    @Query('search') search?: string,
  ): Promise<PagedLogs> {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return await this.sentimentService.getLogs(
      safePage,
      safeLimit,
      label,
      search,
    );
  }

  @Delete('logs/:id')
  async deleteLog(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: boolean }> {
    return await this.sentimentService.deleteLog(id);
  }

  @Delete('logs')
  async deleteAllLogs(): Promise<{ deleted: number }> {
    return await this.sentimentService.deleteAllLogs();
  }
}
