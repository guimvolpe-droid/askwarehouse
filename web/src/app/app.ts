import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { ApiService, AskResult } from './api.service';

interface ViewState {
  loading: boolean;
  result?: AskResult;
  error?: string;
}

interface Bar {
  label: string;
  value: number;
  pct: number;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  question = '';

  private readonly ask$ = new Subject<string>();

  // RxJS: each submitted question maps to an HTTP call, surfaced as a loading -> result/error stream.
  readonly state$: Observable<ViewState> = this.ask$.pipe(
    switchMap((q) =>
      this.api.ask(q).pipe(
        map((result): ViewState => ({ loading: false, result })),
        catchError((e): Observable<ViewState> => of({ loading: false, error: String(e?.message ?? e) })),
        startWith<ViewState>({ loading: true }),
      ),
    ),
    startWith<ViewState>({ loading: false }),
  );

  constructor(private readonly api: ApiService) {}

  submit(): void {
    const q = this.question.trim();
    if (q) this.ask$.next(q);
  }

  // Build a simple bar-chart model from the first two columns (label, value) of the result.
  chart(result: AskResult): Bar[] {
    const r = result.result;
    if (!r || r.columns.length < 2) return [];
    const values = r.rows.map((row) => Number(row[1])).filter((n) => !Number.isNaN(n));
    if (values.length === 0) return [];
    const max = Math.max(1, ...values);
    return r.rows
      .map((row): Bar => ({ label: String(row[0]), value: Number(row[1]), pct: (Number(row[1]) / max) * 100 }))
      .filter((b) => !Number.isNaN(b.value));
  }
}
