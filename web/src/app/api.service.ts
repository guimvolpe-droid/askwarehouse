import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export interface AskResult {
  answered: boolean;
  sql?: string;
  result?: QueryResult;
  attempts: number;
  refused?: 'ambiguous' | 'failed';
  message?: string;
}

// One answered turn, sent back as follow-up context (the Worker is stateless).
export interface Turn {
  question: string;
  sql: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Point at the deployed Worker, or `wrangler dev` (localhost:8787). Override at runtime via
  // `window.AW_API = 'https://your-worker...'` in index.html.
  private readonly base: string =
    (globalThis as unknown as { AW_API?: string }).AW_API ?? 'http://localhost:8787';

  constructor(private readonly http: HttpClient) {}

  ask(question: string, history: Turn[] = []): Observable<AskResult> {
    return this.http.post<AskResult>(`${this.base}/ask`, { question, history });
  }
}
