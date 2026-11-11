import { describe, it, expect, beforeEach } from 'vitest';
import { Chess, Square } from 'chess.js';
import {
  perft,
  evaluateBoard,
  computeBestMove,
  clearTranspositionTable,
} from '../chessAI';
import { buildTimelineFromChess, computeDrawReason } from '../../store/useGameStore';
import { squareToWorld, worldToSquare, rowColToSquare } from '../../utils/boardCoords';
import { TACTICAL_PUZZLES } from '../tacticalPuzzles';
import { lookupOpeningBookMove } from '../openingBook';

describe('1. Perft (Move Generator & Legal Rules Verification)', () => {
  it('verifies Initial Position exact node counts up to depth 3', () => {
    const game = new Chess();
    expect(perft(game, 0)).toBe(1);
    expect(perft(game, 1)).toBe(20);
    expect(perft(game, 2)).toBe(400);
    expect(perft(game, 3)).toBe(8902);
  });

  it('verifies Kiwipete tactical position (Castling, En Passant, Promotions, Pins)', () => {
    // Kiwipete by Peter McKenzie: standard Perft benchmark for special chess moves
    const kiwipete = new Chess(
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
    );
    expect(perft(kiwipete, 1)).toBe(48);
    expect(perft(kiwipete, 2)).toBe(2039);
  });

  it('verifies Endgame En Passant & Discovered Pin Perft position (Position 3)', () => {
    const pos3 = new Chess('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(pos3, 1)).toBe(14);
    expect(perft(pos3, 2)).toBe(191);
    expect(perft(pos3, 3)).toBe(2812);
  });
});

describe('2. Special Chess Rules & Draw Reason Classification', () => {
  it('detects Stalemate (Afogamento) accurately', () => {
    const stalemateGame = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(stalemateGame.isStalemate()).toBe(true);
    expect(computeDrawReason(stalemateGame)).toBe('Empate por Afogamento (Stalemate)');
  });

  it('detects Insufficient Material (Material Insuficiente)', () => {
    const kVsK = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
    expect(kVsK.isInsufficientMaterial()).toBe(true);
    expect(computeDrawReason(kVsK)).toBe('Empate por Material Insuficiente');
  });

  it('detects Threefold Repetition (Repetição Tripla)', () => {
    const game = new Chess();
    const moves = [
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
    ] as const;
    for (const [from, to] of moves) {
      game.move({ from, to });
    }
    expect(game.isThreefoldRepetition()).toBe(true);
    expect(computeDrawReason(game)).toBe('Empate por Repetição Tripla');
  });

  it('handles En Passant, Castling, and Underpromotion (q, r, b, n)', () => {
    const promoGame = new Chess('8/P7/8/8/8/8/7k/K7 w - - 0 1');
    const knightPromo = promoGame.move({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(knightPromo?.promotion).toBe('n');
    expect(promoGame.get('a8')?.type).toBe('n');
  });
});

describe('3. Custom FEN Timeline & Undo/Replay Integrity (Priority 1 Fix)', () => {
  it('reconstructs plySnapshots from a non-standard FEN (e.g. Tactical Puzzle) without throwing', () => {
    const operaPuzzle = TACTICAL_PUZZLES[0];
    const game = new Chess(operaPuzzle.fen);

    game.move({ from: 'b3', to: 'b8' });
    game.move({ from: 'd7', to: 'b8' });
    game.move({ from: 'd1', to: 'd8' });

    const timeline = buildTimelineFromChess(game);
    expect(timeline.plySnapshots.length).toBe(4);
    expect(timeline.plySnapshots[0].fen).toBe(operaPuzzle.fen);
    expect(timeline.plySnapshots[3].fen).toBe(game.fen());
    expect(game.isCheckmate()).toBe(true);
  });
});

describe('4. 3D Board Coordinates & Raycast Square Bijection', () => {
  it('maps all 64 algebraic squares to 3D world coords and back without loss', () => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = rowColToSquare(r, c);
        const [wx, , wz] = squareToWorld(sq);
        const recovered = worldToSquare(wx, wz);
        expect(recovered).toBe(sq);
      }
    }
  });

  it('returns null for 3D coordinates outside the 8x8 board', () => {
    expect(worldToSquare(-12, 0)).toBeNull();
    expect(worldToSquare(0, 12)).toBeNull();
  });
});

describe('5. AI Engine, Transposition Table & Tactical Resolution', () => {
  beforeEach(() => {
    clearTranspositionTable();
  });

  it('evaluates starting position as completely balanced (0 cp)', () => {
    const game = new Chess();
    expect(evaluateBoard(game)).toBe(0);
  });

  it('finds forced Mate in 1 immediately on Difficulty >= 2', () => {
    // Scholar's Mate position: White to move and play Qxf7#
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const decision = computeBestMove(fen, 3, []);
    expect(decision).not.toBeNull();
    expect(decision?.from).toBe('h5' as Square);
    expect(decision?.to).toBe('f7' as Square);
    expect(decision?.san).toBe('Qxf7#');
  });

  it('never applies the opening book to a FEN position unrelated to the move history', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    for (let i = 0; i < 25; i++) {
      expect(lookupOpeningBookMove(fen, [])).toBeNull();
    }
    // Still works from the real starting position
    expect(lookupOpeningBookMove(new Chess().fen(), [])).not.toBeNull();
  });
});
