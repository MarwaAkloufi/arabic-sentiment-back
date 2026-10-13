import { Injectable } from '@nestjs/common';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import type { AxiosResponse } from 'axios';
import { SentimentLog } from './sentiment-log.entity';
import type {
  BatchAnalysisResult,
  DailyStat,
  FileAnalysisResult,
  PagedLogs,
  StatsResponse,
} from './sentiment.dto';

interface AiPredictResponse {
  text: string;
  cleaned_text: string;
  label: 'pos' | 'neg';
  confidence: number;
  probabilities?: {
    pos: number;
    neg: number;
  };
}

interface DailyRow {
  date: string;
  total: string;
  pos: string;
  neg: string;
}

@Injectable()
export class SentimentService {
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ??
    'https://arabic-sentiment-ai.vercel.app/predict';
  private readonly batchConcurrency = 5;

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(SentimentLog)
    private readonly sentimentRepository: Repository<SentimentLog>,
  ) {}

  async analyzeSentiment(text: string): Promise<SentimentLog> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('Text cannot be empty');
    }

    let response: AxiosResponse<AiPredictResponse>;
    try {
      response = await firstValueFrom(
        this.httpService.post<AiPredictResponse>(this.aiServiceUrl, { text }),
      );
    } catch {
      throw new HttpException(
        'Failed to connect to AI Service',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const { cleaned_text, label, confidence, probabilities } = response.data;

    try {
      const log = this.sentimentRepository.create({
        text,
        cleanedText: cleaned_text,
        label,
        confidence,
        posProbability: probabilities?.pos ?? null,
        negProbability: probabilities?.neg ?? null,
      });
      return await this.sentimentRepository.save(log);
    } catch {
      throw new HttpException(
        'Failed to save data to database',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeBatch(texts: string[]): Promise<BatchAnalysisResult> {
    const results: BatchAnalysisResult['results'] = [];
    const failed: BatchAnalysisResult['failed'] = [];
    let skipped = 0;
    const normalized = texts
      .map((t) => String(t).trim())
      .filter((t) => {
        if (t) return true;
        skipped += 1;
        return false;
      });

    const concurrency = Math.min(this.batchConcurrency, normalized.length);

    let index = 0;
    const worker = async () => {
      while (index < normalized.length) {
        const current = index++;
        const text = normalized[current];
        try {
          const log = await this.analyzeSentiment(text);
          results.push({
            text: log.text,
            cleanedText: log.cleanedText,
            label: log.label,
            confidence: log.confidence,
            posProbability: log.posProbability,
            negProbability: log.negProbability,
            createdAt: log.createdAt,
          });
        } catch {
          failed.push({ text, error: 'Failed to analyze text' });
        }
      }
    };

    const workers = Array.from({ length: Math.max(concurrency, 1) }, () =>
      worker(),
    );
    await Promise.all(workers);

    return {
      succeeded: results.length,
      failedCount: failed.length,
      skipped,
      results,
      failed,
    };
  }

  async analyzeFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<FileAnalysisResult> {
    const texts = this.parseTextsFromBuffer(buffer, fileName);
    if (texts.length === 0) {
      throw new BadRequestException(
        'No text rows found. Expected a column named "text", "comment", "review" or "نص".',
      );
    }

    const result = await this.analyzeBatch(texts);
    return { ...result, fileName, totalRows: texts.length };
  }

  private parseTextsFromBuffer(buffer: Buffer, fileName: string): string[] {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (!['csv', 'xlsx', 'xls', 'txt'].includes(extension)) {
      throw new BadRequestException(
        'Unsupported file type. Use CSV, XLSX or XLS.',
      );
    }

    let workbook: XLSX.WorkBook;
    if (extension === 'csv' || extension === 'txt') {
      const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
      workbook = XLSX.read(content, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: '',
    });

    if (rows.length === 0) return [];

    const header = (rows[0] ?? []).map((cell) => this.cellToString(cell));
    const headerRegex =
      /^(text|comment|review|tweet|body|نص|مراجعة|تغريدة|المراجعة|التغريدة|التعليق)$/i;
    const headerIndex = header.findIndex((h) => headerRegex.test(h));

    const textColumn = headerIndex >= 0 ? headerIndex : 0;
    const firstDataRow = headerIndex >= 0 ? 1 : 0;

    const texts: string[] = [];
    for (let i = firstDataRow; i < rows.length; i++) {
      const row = rows[i] ?? [];
      let value = this.cellToString(row[textColumn]);
      if (!value) {
        for (const cell of row) {
          value = this.cellToString(cell);
          if (value) break;
        }
      }
      if (value) texts.push(value);
    }

    return texts;
  }

  private cellToString(cell: unknown): string {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string') return cell.trim();
    if (typeof cell === 'number' || typeof cell === 'boolean') {
      return String(cell);
    }
    if (cell instanceof Date) return cell.toISOString();
    return '';
  }

  async getStats(): Promise<StatsResponse> {
    const [totalLogs, positiveCount, negativeCount, averageConfidence] =
      await Promise.all([
        this.sentimentRepository.count(),
        this.sentimentRepository.count({ where: { label: 'pos' } }),
        this.sentimentRepository.count({ where: { label: 'neg' } }),
        this.sentimentRepository.average('confidence'),
      ]);

    const positivePercentage =
      totalLogs > 0
        ? Number(((positiveCount / totalLogs) * 100).toFixed(2))
        : 0;
    const negativePercentage =
      totalLogs > 0
        ? Number(((negativeCount / totalLogs) * 100).toFixed(2))
        : 0;

    const driverType = this.sentimentRepository.manager.connection.options.type;
    const dateExpression =
      driverType === 'postgres'
        ? `to_char(log.createdAt, 'YYYY-MM-DD')`
        : `strftime('%Y-%m-%d', log.createdAt)`;

    const dailyRows = await this.sentimentRepository
      .createQueryBuilder('log')
      .select(dateExpression, 'date')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN log.label = 'pos' THEN 1 ELSE 0 END)`, 'pos')
      .addSelect(`SUM(CASE WHEN log.label = 'neg' THEN 1 ELSE 0 END)`, 'neg')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<DailyRow>();

    const dailyDistribution: DailyStat[] = dailyRows.map((row) => ({
      date: row.date,
      total: Number(row.total),
      pos: Number(row.pos),
      neg: Number(row.neg),
    }));

    return {
      totalLogs,
      positiveCount,
      negativeCount,
      positivePercentage,
      negativePercentage,
      averageConfidence: averageConfidence
        ? Number(averageConfidence.toFixed(4))
        : 0,
      dailyDistribution,
    };
  }

  async getLogs(
    page = 1,
    limit = 20,
    label?: string,
    search?: string,
  ): Promise<PagedLogs> {
    const where: FindOptionsWhere<SentimentLog> = {};

    if (label === 'pos' || label === 'neg') {
      where.label = label;
    }

    if (search && search.trim()) {
      where.text = Like(`%${search.trim()}%`);
    }

    const [data, total] = await this.sentimentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    ///////////////////////////
    return { data, total, page, limit };
  }

  async deleteLog(id: number): Promise<{ deleted: boolean }> {
    const result = await this.sentimentRepository.delete(id);
    return { deleted: (result.affected ?? 0) > 0 };
  }

  async deleteAllLogs(): Promise<{ deleted: number }> {
    const total = await this.sentimentRepository.count();
    await this.sentimentRepository.clear();
    return { deleted: total };
  }
}
