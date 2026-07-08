import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { ApiService, AskResult } from './api.service';
import { buildChart, type ChartModel } from './chart';

interface ViewState {
  loading: boolean;
  result?: AskResult;
  error?: string;
  chart: ChartModel;
}

const NO_CHART: ChartModel = { kind: 'none' };

@Component({
  selector: 'app-root',
  imports: [FormsModule, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  question = '';

  private readonly ask$ = new Subject<string>();

  // RxJS: each submitted question maps to an HTTP call, surfaced as a loading -> result/error
  // stream. The chart model is picked by result shape (stat/line/bar/none) as the result lands.
  readonly state$: Observable<ViewState> = this.ask$.pipe(
    switchMap((q) =>
      this.api.ask(q).pipe(
        map(
          (result): ViewState => ({
            loading: false,
            result,
            chart: result.answered && result.result ? buildChart(result.result) : NO_CHART,
          }),
        ),
        catchError(
          (e): Observable<ViewState> =>
            of({ loading: false, error: String(e?.message ?? e), chart: NO_CHART }),
        ),
        startWith<ViewState>({ loading: true, chart: NO_CHART }),
      ),
    ),
    startWith<ViewState>({ loading: false, chart: NO_CHART }),
  );

  constructor(private readonly api: ApiService) {}

  submit(): void {
    const q = this.question.trim();
    if (q) this.ask$.next(q);
  }
}
