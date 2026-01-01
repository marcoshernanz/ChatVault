export interface SearchResult {
  doc_id: string;
  content: string;
  sender?: string;
  date?: string;
  score: number;
}

export interface UploadStatus {
  filename: string;
  status: "pending" | "processing" | "completed" | "error";
  progress?: {
    current: number;
    total: number;
    percent: number;
    etr: string;
    startTime: number;
  };
  error?: string;
}

export interface InitProgress {
  percent: number;
  status: string;
}
