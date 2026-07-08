import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { ApiService, AskResult, Turn } from './api.service';
import { buildChart, type ChartModel } from './chart';

interface TurnView {
  question: string;
  result: AskResult;
  chart: ChartModel;
}

interface ViewState {
  loading: boolean;
  error?: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  question = '';

  // The conversation: one card-stack per turn. Answered turns feed the next question's
  // history as {question, sql} pairs — the Worker stays stateless.
  turns: TurnView[] = [];

  private readonly ask$ = new Subject<string>();

  // RxJS: each submitted question maps to an HTTP call, surfaced as a loading -> result/error
  // stream; the resolved turn is appended to the conversation as it lands.
  readonly state$: Observable<ViewState> = this.ask$.pipe(
    switchMap((q) =>
      this.api.ask(q, this.history()).pipe(
        map((result): ViewState => {
          this.turns = [
            ...this.turns,
            {
              question: q,
              result,
              chart: result.answered && result.result ? buildChart(result.result) : { kind: 'none' },
            },
          ];
          return { loading: false };
        }),
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
    this.question = '';
  }

  newConversation(): void {
    this.turns = [];
  }

  private history(): Turn[] {
    return this.turns
      .filter((t) => t.result.answered && t.result.sql)
      .map((t) => ({ question: t.question, sql: t.result.sql! }));
  }
}
