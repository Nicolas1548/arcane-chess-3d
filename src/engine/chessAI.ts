import { Chess, Move, Square } from 'chess.js';
import { lookupOpeningBookMove, detectOpening } from './openingBook';

export type AIDifficulty = 1 | 2 | 3 | 4;

export interface AIDecisionResult {
  from: Square;
  to: Square;
  promotion?: string;
  san: string;
  evalScore: number;
  nodesEvaluated: number;
  timeMs: number;
  depthReached: number;
  isBookMove: boolean;
  openingName?: string;
}

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 27, 27, 10,  5,  5],
  [0,  0,  0, 22, 22,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 12, 16, 16, 12,  0,-30],
  [-30,  5, 16, 22, 22, 16,  5,-30],
  [-30,  0, 16, 22, 22, 16,  0,-30],
  [-30,  5, 12, 16, 16, 12,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  8, 12, 12,  8,  0,-10],
  [-10,  6,  8, 12, 12,  8,  6,-10],
  [-10,  0, 12, 12, 12, 12,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  6,  0,  0,  0,  0,  6,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [8, 14, 14, 14, 14, 14, 14,  8],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  6,  6,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MIDGAME_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const KING_ENDGAME_PST = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]
];

const PST_MAP: Record<string, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MIDGAME_PST,
};

let nodesCounter = 0;
const transpositionTable = new Map<string, { depth: number; score: number }>();

/**
 * Evaluates board position in centipawns from White's perspective (+ favors White, - favors Black).
 */
export function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -99999 : 99999;
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0;
  }

  const board = game.board();
  let score = 0;
  let nonPawnMaterial = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (piece.type !== 'p' && piece.type !== 'k') {
        nonPawnMaterial += PIECE_VALUES[piece.type] || 0;
      }
      if (piece.type === 'b') {
        if (piece.color === 'w') whiteBishops++;
        else blackBishops++;
      }
    }
  }

  const isEndgame = nonPawnMaterial <= 2600;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseValue = PIECE_VALUES[piece.type] || 0;
      const table =
        piece.type === 'k'
          ? isEndgame
            ? KING_ENDGAME_PST
            : KING_MIDGAME_PST
          : PST_MAP[piece.type];

      const positionalValue = table
        ? piece.color === 'w'
          ? table[r][c]
          : table[7 - r][c]
        : 0;

      if (piece.color === 'w') {
        score += baseValue + positionalValue;
      } else {
        score -= baseValue + positionalValue;
      }
    }
  }

  // Bishop Pair Bonus
  if (whiteBishops >= 2) score += 35;
  if (blackBishops >= 2) score -= 35;

  if (game.inCheck()) {
    score += game.turn() === 'w' ? -35 : 35;
  }

  return score;
}

function scoreMoveForOrdering(move: Move): number {
  let score = 0;
  if (move.captured) {
    const victim = PIECE_VALUES[move.captured] || 100;
    const attacker = PIECE_VALUES[move.piece] || 100;
    score += 12 * victim - attacker;
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion] || 900;
  }
  if (move.san.includes('+')) {
    score += 160;
  }
  if (move.flags.includes('k') || move.flags.includes('q')) {
    score += 90; // Castling priority
  }
  return score;
}

/**
 * Quiescence Search to resolve tactical capture sequences at leaf nodes and prevent horizon blunders.
 */
function quiescence(
  game: Chess,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  qDepth = 0
): number {
  nodesCounter++;
  const standPat = evaluateBoard(game);

  if (qDepth >= 3 || game.isGameOver()) {
    return standPat;
  }

  if (maximizingPlayer) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }

  // Only consider captures and promotions in quiescence
  const tacticalMoves = game
    .moves({ verbose: true })
    .filter((m) => m.captured || m.promotion)
    .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  if (maximizingPlayer) {
    for (const move of tacticalMoves) {
      game.move(move);
      const score = quiescence(game, alpha, beta, false, qDepth + 1);
      game.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    for (const move of tacticalMoves) {
      game.move(move);
      const score = quiescence(game, alpha, beta, true, qDepth + 1);
      game.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  useQuiescence: boolean
): number {
  nodesCounter++;

  if (depth === 0 || game.isGameOver()) {
    return useQuiescence
      ? quiescence(game, alpha, beta, maximizingPlayer)
      : evaluateBoard(game);
  }

  const fenKey = game.fen();
  const cached = transpositionTable.get(fenKey);
  if (cached && cached.depth >= depth) {
    return cached.score;
  }

  const moves = game
    .moves({ verbose: true })
    .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, false, useQuiescence);
      game.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    if (transpositionTable.size < 25000) {
      transpositionTable.set(fenKey, { depth, score: maxEval });
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, true, useQuiescence);
      game.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    if (transpositionTable.size < 25000) {
      transpositionTable.set(fenKey, { depth, score: minEval });
    }
    return minEval;
  }
}

export function computeBestMove(
  fen: string,
  difficulty: AIDifficulty,
  sanHistory: string[] = []
): AIDecisionResult | null {
  const startTime = performance.now();
  nodesCounter = 0;

  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  // 1. Consult Classical Opening Book on Difficulty >= 2
  if (difficulty >= 2 && sanHistory.length <= 10) {
    const bookMove = lookupOpeningBookMove(fen, sanHistory);
    if (bookMove) {
      game.move({ from: bookMove.from, to: bookMove.to, promotion: bookMove.promotion || 'q' });
      const evalScore = evaluateBoard(game);
      return {
        from: bookMove.from,
        to: bookMove.to,
        promotion: bookMove.promotion || 'q',
        san: bookMove.san,
        evalScore,
        nodesEvaluated: 1,
        timeMs: Math.max(1, Math.round(performance.now() - startTime)),
        depthReached: 0,
        isBookMove: true,
        openingName: `${bookMove.eco} • ${bookMove.openingName}`,
      };
    }
  }

  // 2. Difficulty 1 (Escudeiro): Shallow search with slight human-like inaccuracy
  if (difficulty === 1 && Math.random() < 0.3) {
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    game.move(randomMove);
    return {
      from: randomMove.from as Square,
      to: randomMove.to as Square,
      promotion: randomMove.promotion,
      san: randomMove.san,
      evalScore: evaluateBoard(game),
      nodesEvaluated: legalMoves.length,
      timeMs: Math.max(1, Math.round(performance.now() - startTime)),
      depthReached: 1,
      isBookMove: false,
      openingName: detectOpening([...sanHistory, randomMove.san])?.name,
    };
  }

  const depthMap: Record<AIDifficulty, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 3, // Depth 3 + Quiescence Tactical Extension (effective depth 6 on captures)
  };

  const searchDepth = depthMap[difficulty];
  const useQuiescence = difficulty >= 3;
  const isWhite = game.turn() === 'w';
  const orderedMoves = [...legalMoves].sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  let bestMove: Move = orderedMoves[0];
  let bestValue = isWhite ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of orderedMoves) {
    game.move(move);
    const boardValue = minimax(game, searchDepth - 1, alpha, beta, !isWhite, useQuiescence);
    game.undo();

    const jitter = difficulty < 3 ? (Math.random() - 0.5) * (3 - difficulty) * 14 : 0;
    const totalValue = boardValue + jitter;

    if (isWhite) {
      if (totalValue > bestValue) {
        bestValue = totalValue;
        bestMove = move;
      }
      alpha = Math.max(alpha, totalValue);
    } else {
      if (totalValue < bestValue) {
        bestValue = totalValue;
        bestMove = move;
      }
      beta = Math.min(beta, totalValue);
    }
  }

  const elapsed = Math.max(1, Math.round(performance.now() - startTime));
  const detected = detectOpening([...sanHistory, bestMove.san]);

  return {
    from: bestMove.from as Square,
    to: bestMove.to as Square,
    promotion: bestMove.promotion || 'q',
    san: bestMove.san,
    evalScore: Math.round(bestValue),
    nodesEvaluated: nodesCounter,
    timeMs: elapsed,
    depthReached: useQuiescence ? searchDepth + 2 : searchDepth,
    isBookMove: false,
    openingName: detected ? `${detected.eco} • ${detected.name}` : undefined,
  };
}
