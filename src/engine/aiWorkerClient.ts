import { AIDifficulty, AIDecisionResult, computeBestMove } from './chessAI';

class AIWorkerClient {
  private worker: Worker | null = null;
  private reqId = 0;
  private pending = new Map<number, (res: AIDecisionResult | null) => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'Worker' in window) {
      try {
        this.worker = new Worker(new URL('./ai.worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = (ev: MessageEvent<{ id: number; result: AIDecisionResult | null }>) => {
          const { id, result } = ev.data;
          const resolver = this.pending.get(id);
          if (resolver) {
            this.pending.delete(id);
            resolver(result);
          }
        };
      } catch {
        this.worker = null;
      }
    }
  }

  public requestMoveAsync(
    fen: string,
    difficulty: AIDifficulty,
    sanHistory: string[]
  ): Promise<AIDecisionResult | null> {
    if (!this.worker) {
      return Promise.resolve(computeBestMove(fen, difficulty, sanHistory));
    }

    return new Promise((resolve) => {
      const id = ++this.reqId;
      this.pending.set(id, resolve);
      this.worker!.postMessage({ id, fen, difficulty, sanHistory });
    });
  }
}

export const aiWorkerClient = new AIWorkerClient();
