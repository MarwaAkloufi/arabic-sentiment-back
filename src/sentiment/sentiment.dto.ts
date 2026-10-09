export interface SingleTextRequest {
  text: string;
}

export interface BatchTextRequest {
  texts: string[];
}

export interface SentimentResult {
  text: string;
  label: 'pos' | 'neg';
  confidence: number;
}

export interface BatchItemResult {
  text: string;
  cleanedText: string;
  label: string;
  confidence: number;
  posProbability: number | null;
  negProbability: number | null;
  createdAt: Date;
}

export interface BatchItemError {
  text: string;
  error: string;
}

export interface BatchAnalysisResult {
  succeeded: number;
  failedCount: number;
  skipped: number;
  results: BatchItemResult[];
  failed: BatchItemError[];
}

export interface DailyStat {
  date: string;
  total: number;
  pos: number;
  neg: number;
}

export interface StatsResponse {
  totalLogs: number;
  positiveCount: number;
  negativeCount: number;
  positivePercentage: number;
  negativePercentage: number;
  averageConfidence: number;
  dailyDistribution: DailyStat[];
}

export interface PagedLogs {
  data: SentimentLogView[];
  total: number;
  page: number;
  limit: number;
}

export interface SentimentLogView {
  id: number;
  text: string;
  cleanedText: string;
  label: string;
  confidence: number;
  posProbability: number | null;
  negProbability: number | null;
  createdAt: Date;
}

export interface FileAnalysisResult extends BatchAnalysisResult {
  fileName: string;
  totalRows: number;
}
