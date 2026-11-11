import { computeBestMove, AIDifficulty } from './chessAI';

export interface AIWorkerRequest {
  id: number;
  fen: string;
  difficulty: AIDifficulty;
  sanHistory: string[];
}

self.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  const { id, fen, difficulty, sanHistory } = event.data;
  const result = computeBestMove(fen, difficulty, sanHistory);
  self.postMessage({ id, result });
};
