import { create } from 'zustand';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { AIDifficulty, evaluateBoard } from '../engine/chessAI';
import { aiWorkerClient } from '../engine/aiWorkerClient';
import { detectOpening } from '../engine/openingBook';
import { soundEngine } from '../audio/soundEngine';
import { multiplayerService, RoomData, ChatMessage } from '../services/multiplayerService';
import { TACTICAL_PUZZLES } from '../engine/tacticalPuzzles';

export type { AIDifficulty };
export type GameMode = 'ai' | 'local' | 'online' | 'puzzles';
export type CameraPreset = 'orbital' | 'white' | 'black' | 'top';
export type ArenaTheme = 'citadel' | 'sanctuary' | 'inferno';
export type PuzzleStatus = 'playing' | 'solved' | 'wrong';

export interface CaptureEffect {
  id: string;
  square: Square;
  color: Color;
  piece: PieceSymbol;
  timestamp: number;
}

export interface MoveRecord {
  moveNumber: number;
  white?: string;
  whitePly?: number;
  black?: string;
  blackPly?: number;
}

export interface PlySnapshot {
  ply: number;
  fen: string;
  lastMove: { from: Square; to: Square; san?: string } | null;
  capturedWhite: PieceSymbol[];
  capturedBlack: PieceSymbol[];
  evalScore: number;
}

export interface AITelemetry {
  nodesEvaluated: number;
  timeMs: number;
  depthReached: number;
  isBookMove: boolean;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
}

const INITIAL_FEN = new Chess().fen();

function buildInitialSnapshot(fen = INITIAL_FEN): PlySnapshot {
  return {
    ply: 0,
    fen,
    lastMove: null,
    capturedWhite: [],
    capturedBlack: [],
    evalScore: 0,
  };
}

function buildTimelineFromChess(chess: Chess): {
  capturedWhite: PieceSymbol[];
  capturedBlack: PieceSymbol[];
  moveHistory: MoveRecord[];
  sanList: string[];
  currentOpening: string | null;
  plySnapshots: PlySnapshot[];
} {
  const verboseHistory = chess.history({ verbose: true });
  const capturedWhite: PieceSymbol[] = [];
  const capturedBlack: PieceSymbol[] = [];
  const moveHistory: MoveRecord[] = [];
  const sanList: string[] = [];

  const replayChess = new Chess();
  const plySnapshots: PlySnapshot[] = [buildInitialSnapshot(replayChess.fen())];

  verboseHistory.forEach((m, index) => {
    const ply = index + 1;
    sanList.push(m.san);
    replayChess.move(m);

    if (m.captured) {
      if (m.color === 'w') {
        capturedBlack.push(m.captured);
      } else {
        capturedWhite.push(m.captured);
      }
    }

    plySnapshots.push({
      ply,
      fen: replayChess.fen(),
      lastMove: { from: m.from as Square, to: m.to as Square, san: m.san },
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      evalScore: evaluateBoard(replayChess),
    });

    if (index % 2 === 0) {
      moveHistory.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: m.san,
        whitePly: ply,
      });
    } else {
      const current = moveHistory[moveHistory.length - 1];
      if (current) {
        current.black = m.san;
        current.blackPly = ply;
      }
    }
  });

  const detected = detectOpening(sanList);
  const currentOpening = detected ? `${detected.eco} • ${detected.name}` : null;

  return {
    capturedWhite,
    capturedBlack,
    moveHistory,
    sanList,
    currentOpening,
    plySnapshots,
  };
}

interface GameState {
  chess: Chess;
  fen: string;
  turn: Color;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  playerColor: Color;
  isAIThinking: boolean;
  currentOpening: string | null;
  aiTelemetry: AITelemetry | null;

  // Replay Timeline State
  plySnapshots: PlySnapshot[];
  viewingPly: number | null; // null = live latest state

  isMainMenuOpen: boolean;
  highQuality: boolean;
  autoRotateCamera: boolean;
  immersiveMode: boolean;
  timeControlMinutes: number;

  selectedSquare: Square | null;
  legalMoves: { to: Square; isCapture: boolean; isPromotion: boolean }[];
  lastMove: { from: Square; to: Square; san?: string } | null;
  hintMove: { from: Square; to: Square; san: string } | null;

  capturedWhite: PieceSymbol[];
  capturedBlack: PieceSymbol[];
  evalScore: number;
  moveHistory: MoveRecord[];

  inCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  winner: Color | 'draw' | null;

  pendingPromotion: PendingPromotion | null;
  captureEffects: CaptureEffect[];
  lastCaptureTime: number;

  // 3D Drag & Drop + Tactical Arrows State
  draggingSquare: Square | null;
  dragHoverSquare: Square | null;
  tacticalArrows: { from: Square; to: Square }[];
  tacticalHighlights: Square[];

  // Tactical Puzzles State
  activePuzzleIndex: number;
  puzzleStep: number;
  puzzleStatus: PuzzleStatus;
  puzzleFeedback: string | null;
  solvedPuzzleIds: string[];

  cameraPreset: CameraPreset;
  arenaTheme: ArenaTheme;
  soundEnabled: boolean;
  ambientSoundEnabled: boolean;

  // Timers (in seconds)
  whiteTime: number;
  blackTime: number;

  // Online Multiplayer State
  onlineRoom: RoomData | null;
  onlineColor: Color | null;
  chatMessages: ChatMessage[];
  playerName: string;
  multiplayerError: string | null;

  // Actions
  selectSquare: (square: Square) => void;
  startDragPiece: (square: Square) => void;
  setDragHoverSquare: (square: Square | null) => void;
  endDragPiece: (targetSquare: Square | null) => void;
  addOrToggleTacticalArrow: (from: Square, to: Square) => void;
  clearTacticalAnnotations: () => void;
  executeMove: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
  completePromotion: (piece: PieceSymbol) => void;
  cancelPromotion: () => void;
  resetGame: () => void;
  startBattleFromMenu: () => void;
  setMainMenuOpen: (open: boolean) => void;
  undoMove: () => void;
  requestHint: () => Promise<void>;

  // Replay & PGN Actions
  jumpToPly: (ply: number | null) => void;
  stepReplayFirst: () => void;
  stepReplayPrev: () => void;
  stepReplayNext: () => void;
  stepReplayLatest: () => void;
  exportPgnString: () => string;
  importPgnOrFen: (rawInput: string) => { ok: boolean; error?: string };

  setMode: (mode: GameMode) => void;
  setAIDifficulty: (diff: AIDifficulty) => void;
  setPlayerColor: (color: Color) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setArenaTheme: (theme: ArenaTheme) => void;
  setHighQuality: (hq: boolean) => void;
  setAutoRotateCamera: (auto: boolean) => void;
  setImmersiveMode: (immersive: boolean) => void;
  setTimeControlMinutes: (mins: number) => void;
  toggleSound: () => void;
  toggleAmbientSound: () => void;
  tickTimer: () => void;

  // Online Actions
  setPlayerName: (name: string) => void;
  createOnlineRoom: () => Promise<void>;
  joinOnlineRoom: (code: string) => Promise<void>;
  leaveOnlineRoom: () => void;
  sendChat: (text: string) => Promise<void>;

  // Puzzle Actions
  loadPuzzle: (index: number) => void;
  nextPuzzle: () => void;
  retryPuzzle: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  chess: new Chess(),
  fen: INITIAL_FEN,
  turn: 'w',
  mode: 'ai',
  aiDifficulty: 2,
  playerColor: 'w',
  isAIThinking: false,
  currentOpening: null,
  aiTelemetry: null,

  plySnapshots: [buildInitialSnapshot()],
  viewingPly: null,

  isMainMenuOpen: false,
  highQuality: true,
  autoRotateCamera: true,
  immersiveMode: false,
  timeControlMinutes: 10,

  selectedSquare: null,
  legalMoves: [],
  lastMove: null,
  hintMove: null,

  capturedWhite: [],
  capturedBlack: [],
  evalScore: 0,
  moveHistory: [],

  inCheck: false,
  isCheckmate: false,
  isDraw: false,
  winner: null,

  pendingPromotion: null,
  captureEffects: [],
  lastCaptureTime: 0,

  draggingSquare: null,
  dragHoverSquare: null,
  tacticalArrows: [],
  tacticalHighlights: [],

  activePuzzleIndex: 0,
  puzzleStep: 0,
  puzzleStatus: 'playing',
  puzzleFeedback: null,
  solvedPuzzleIds: [],

  cameraPreset: 'orbital',
  arenaTheme: 'citadel',
  soundEnabled: true,
  ambientSoundEnabled: false,

  whiteTime: 600,
  blackTime: 600,

  onlineRoom: null,
  onlineColor: null,
  chatMessages: [],
  playerName: 'Lorde Arcano',
  multiplayerError: null,

  selectSquare: (square: Square) => {
    const state = get();
    // If inspecting historical replay, block board moves until returning to live state
    if (
      state.viewingPly !== null ||
      state.isMainMenuOpen ||
      state.isCheckmate ||
      state.isDraw ||
      state.isAIThinking
    ) {
      return;
    }

    if (state.mode === 'ai' && state.turn !== state.playerColor) return;
    if (state.mode === 'online') {
      if (!state.onlineRoom || state.onlineRoom.status !== 'playing') return;
      if (state.turn !== state.onlineColor) return;
    }

    if (state.selectedSquare) {
      const targetLegal = state.legalMoves.find((m) => m.to === square);
      if (targetLegal) {
        if (targetLegal.isPromotion) {
          set({
            pendingPromotion: {
              from: state.selectedSquare,
              to: square,
              color: state.turn,
            },
          });
          return;
        }
        state.executeMove(state.selectedSquare, square);
        return;
      }
    }

    const piece = state.chess.get(square);
    if (piece && piece.color === state.turn) {
      soundEngine.playSelect();
      const verboseMoves = state.chess.moves({ square, verbose: true });
      const legalMoves = Array.from(
        new Map(
          verboseMoves.map((m) => [
            m.to,
            {
              to: m.to as Square,
              isCapture: Boolean(m.captured || m.flags.includes('e')),
              isPromotion: Boolean(m.promotion || m.flags.includes('p')),
            },
          ])
        ).values()
      );
      set({
        selectedSquare: square,
        legalMoves,
        hintMove: null,
        tacticalArrows: [],
        tacticalHighlights: [],
      });
    } else {
      set({
        selectedSquare: null,
        legalMoves: [],
        tacticalArrows: [],
        tacticalHighlights: [],
      });
    }
  },

  startDragPiece: (square: Square) => {
    const state = get();
    if (
      state.viewingPly !== null ||
      state.isMainMenuOpen ||
      state.isCheckmate ||
      state.isDraw ||
      state.isAIThinking
    ) {
      return;
    }
    if (state.mode === 'ai' && state.turn !== state.playerColor) return;
    if (state.mode === 'online') {
      if (!state.onlineRoom || state.onlineRoom.status !== 'playing') return;
      if (state.turn !== state.onlineColor) return;
    }

    const piece = state.chess.get(square);
    if (!piece || piece.color !== state.turn) return;

    soundEngine.playSelect();
    const verboseMoves = state.chess.moves({ square, verbose: true });
    const legalMoves = Array.from(
      new Map(
        verboseMoves.map((m) => [
          m.to,
          {
            to: m.to as Square,
            isCapture: Boolean(m.captured || m.flags.includes('e')),
            isPromotion: Boolean(m.promotion || m.flags.includes('p')),
          },
        ])
      ).values()
    );

    set({
      selectedSquare: square,
      draggingSquare: square,
      dragHoverSquare: square,
      legalMoves,
      hintMove: null,
      tacticalArrows: [],
      tacticalHighlights: [],
    });
  },

  setDragHoverSquare: (square: Square | null) => {
    if (get().dragHoverSquare !== square) {
      set({ dragHoverSquare: square });
    }
  },

  endDragPiece: (targetSquare: Square | null) => {
    const state = get();
    const fromSquare = state.draggingSquare;
    set({ draggingSquare: null, dragHoverSquare: null });

    if (!fromSquare || !targetSquare || fromSquare === targetSquare) return;

    const targetLegal = state.legalMoves.find((m) => m.to === targetSquare);
    if (targetLegal) {
      if (targetLegal.isPromotion) {
        set({
          pendingPromotion: {
            from: fromSquare,
            to: targetSquare,
            color: state.turn,
          },
        });
        return;
      }
      state.executeMove(fromSquare, targetSquare);
    }
  },

  addOrToggleTacticalArrow: (from: Square, to: Square) => {
    const state = get();
    soundEngine.playArrow();
    if (from === to) {
      const exists = state.tacticalHighlights.includes(from);
      set({
        tacticalHighlights: exists
          ? state.tacticalHighlights.filter((s) => s !== from)
          : [...state.tacticalHighlights, from],
      });
      return;
    }
    const exists = state.tacticalArrows.some((a) => a.from === from && a.to === to);
    set({
      tacticalArrows: exists
        ? state.tacticalArrows.filter((a) => !(a.from === from && a.to === to))
        : [...state.tacticalArrows, { from, to }],
    });
  },

  clearTacticalAnnotations: () => {
    set({ tacticalArrows: [], tacticalHighlights: [] });
  },

  executeMove: (from: Square, to: Square, promotion: PieceSymbol = 'q') => {
    const state = get();
    const game = state.chess;

    try {
      const moveResult = game.move({ from, to, promotion });
      if (!moveResult) return false;

      const isCheckmate = game.isCheckmate();
      const isDraw = game.isDraw() || game.isStalemate() || game.isThreefoldRepetition();
      const inCheck = game.inCheck();
      const nextTurn = game.turn();
      const winner: Color | 'draw' | null = isCheckmate
        ? moveResult.color
        : isDraw
        ? 'draw'
        : null;

      let newEffects = state.captureEffects;
      const isCastle = moveResult.flags.includes('k') || moveResult.flags.includes('q');

      if (moveResult.captured) {
        soundEngine.playCapture();
        const effect: CaptureEffect = {
          id: 'fx_' + Date.now() + '_' + Math.random(),
          square: to,
          color: moveResult.color === 'w' ? 'b' : 'w',
          piece: moveResult.captured,
          timestamp: Date.now(),
        };
        newEffects = [...state.captureEffects.slice(-4), effect];
      } else {
        soundEngine.playMove(isCastle);
      }

      if (isCheckmate) {
        soundEngine.playVictory();
      } else if (inCheck) {
        soundEngine.playCheck();
      }

      const {
        capturedWhite,
        capturedBlack,
        moveHistory,
        sanList,
        currentOpening,
        plySnapshots,
      } = buildTimelineFromChess(game);
      const evalScore = evaluateBoard(game);

      const nextCameraPreset =
        state.mode === 'local' && state.autoRotateCamera
          ? nextTurn === 'w'
            ? 'white'
            : 'black'
          : state.cameraPreset;

      set({
        fen: game.fen(),
        turn: nextTurn,
        viewingPly: null,
        plySnapshots,
        selectedSquare: null,
        legalMoves: [],
        lastMove: { from, to, san: moveResult.san },
        hintMove: null,
        pendingPromotion: null,
        capturedWhite,
        capturedBlack,
        moveHistory,
        currentOpening: currentOpening || state.currentOpening,
        evalScore,
        inCheck,
        isCheckmate,
        isDraw,
        winner,
        captureEffects: newEffects,
        lastCaptureTime: moveResult.captured ? Date.now() : state.lastCaptureTime,
        tacticalArrows: [],
        tacticalHighlights: [],
        cameraPreset: nextCameraPreset,
      });

      if (state.mode === 'online' && state.onlineRoom) {
        multiplayerService.pushMove(state.onlineRoom.roomId, {
          fen: game.fen(),
          pgn: game.pgn(),
          turn: nextTurn,
          lastMove: { from, to, captured: moveResult.captured, san: moveResult.san },
          status: isCheckmate || isDraw ? 'finished' : 'playing',
          winner,
        });
      }

      if (state.mode === 'puzzles') {
        const puzzle = TACTICAL_PUZZLES[state.activePuzzleIndex];
        if (puzzle && state.puzzleStatus === 'playing') {
          const expected = puzzle.solution[state.puzzleStep];
          if (expected && expected.from === from && expected.to === to) {
            const nextStep = state.puzzleStep + 1;
            if (nextStep >= puzzle.solution.length) {
              soundEngine.playVictory();
              const solvedIds = state.solvedPuzzleIds.includes(puzzle.id)
                ? state.solvedPuzzleIds
                : [...state.solvedPuzzleIds, puzzle.id];
              set({
                puzzleStep: nextStep,
                puzzleStatus: 'solved',
                puzzleFeedback: 'Desafio Concluído com Maestria!',
                solvedPuzzleIds: solvedIds,
              });
            } else {
              // Auto-play the opponent's forced reply after a brief pause
              set({
                puzzleStep: nextStep,
                puzzleFeedback: 'Lance Brilhante! Continue a sequência...',
              });
              setTimeout(() => {
                const reply = puzzle.solution[nextStep];
                if (reply) {
                  set({ puzzleStep: nextStep + 1 });
                  get().executeMove(
                    reply.from as Square,
                    reply.to as Square,
                    (reply.promotion as PieceSymbol) || 'q'
                  );
                }
              }, 480);
            }
          } else if (expected && moveResult.color === puzzle.playerColor) {
            soundEngine.playCheck();
            set({
              puzzleStatus: 'wrong',
              puzzleFeedback: 'Lance impreciso — procure o golpe tático forçado!',
            });
          }
        }
        return true;
      }

      if (state.mode === 'ai' && !isCheckmate && !isDraw && nextTurn !== state.playerColor) {
        set({ isAIThinking: true });
        const fenSnapshot = game.fen();
        const diffSnapshot = state.aiDifficulty;

        setTimeout(async () => {
          const currentState = get();
          if (currentState.mode !== 'ai' || currentState.turn === currentState.playerColor) {
            set({ isAIThinking: false });
            return;
          }

          const aiDecision = await aiWorkerClient.requestMoveAsync(
            fenSnapshot,
            diffSnapshot,
            sanList
          );

          set({
            isAIThinking: false,
            aiTelemetry: aiDecision
              ? {
                  nodesEvaluated: aiDecision.nodesEvaluated,
                  timeMs: aiDecision.timeMs,
                  depthReached: aiDecision.depthReached,
                  isBookMove: aiDecision.isBookMove,
                }
              : null,
          });

          if (aiDecision) {
            get().executeMove(
              aiDecision.from,
              aiDecision.to,
              (aiDecision.promotion as PieceSymbol) || 'q'
            );
          }
        }, 280);
      }

      return true;
    } catch {
      return false;
    }
  },

  completePromotion: (piece: PieceSymbol) => {
    const pending = get().pendingPromotion;
    if (!pending) return;
    get().executeMove(pending.from, pending.to, piece);
  },

  cancelPromotion: () => {
    set({ pendingPromotion: null });
  },

  resetGame: () => {
    const state = get();
    const fresh = new Chess();
    const initialSecs = state.timeControlMinutes > 0 ? state.timeControlMinutes * 60 : 0;

    set({
      chess: fresh,
      fen: fresh.fen(),
      turn: 'w',
      plySnapshots: [buildInitialSnapshot(fresh.fen())],
      viewingPly: null,
      selectedSquare: null,
      legalMoves: [],
      lastMove: null,
      hintMove: null,
      capturedWhite: [],
      capturedBlack: [],
      evalScore: 0,
      moveHistory: [],
      currentOpening: null,
      aiTelemetry: null,
      inCheck: false,
      isCheckmate: false,
      isDraw: false,
      winner: null,
      pendingPromotion: null,
      isAIThinking: false,
      whiteTime: initialSecs,
      blackTime: initialSecs,
    });

    if (state.mode === 'ai' && state.playerColor === 'b' && !state.isMainMenuOpen) {
      set({ isAIThinking: true });
      setTimeout(async () => {
        const s = get();
        const aiMove = await aiWorkerClient.requestMoveAsync(s.fen, s.aiDifficulty, []);
        set({
          isAIThinking: false,
          aiTelemetry: aiMove
            ? {
                nodesEvaluated: aiMove.nodesEvaluated,
                timeMs: aiMove.timeMs,
                depthReached: aiMove.depthReached,
                isBookMove: aiMove.isBookMove,
              }
            : null,
        });
        if (aiMove) {
          get().executeMove(aiMove.from, aiMove.to, 'q');
        }
      }, 350);
    }
  },

  startBattleFromMenu: () => {
    const state = get();
    soundEngine.playBattleStart();
    const targetCam: CameraPreset =
      state.mode === 'ai'
        ? state.playerColor === 'b'
          ? 'black'
          : 'orbital'
        : state.mode === 'local'
        ? 'white'
        : state.onlineColor === 'b'
        ? 'black'
        : 'white';

    set({ isMainMenuOpen: false, cameraPreset: targetCam });

    if (state.moveHistory.length === 0) {
      get().resetGame();
    }
  },

  setMainMenuOpen: (open: boolean) => {
    soundEngine.playSelect();
    set({ isMainMenuOpen: open });
  },

  undoMove: () => {
    const state = get();
    if (state.mode === 'online' || state.isAIThinking) return;

    const game = state.chess;
    if (state.mode === 'ai') {
      game.undo();
      game.undo();
    } else {
      game.undo();
    }

    const { capturedWhite, capturedBlack, moveHistory, currentOpening, plySnapshots } =
      buildTimelineFromChess(game);
    soundEngine.playSelect();

    set({
      fen: game.fen(),
      turn: game.turn(),
      plySnapshots,
      viewingPly: null,
      selectedSquare: null,
      legalMoves: [],
      lastMove: plySnapshots[plySnapshots.length - 1]?.lastMove || null,
      hintMove: null,
      capturedWhite,
      capturedBlack,
      moveHistory,
      currentOpening,
      evalScore: evaluateBoard(game),
      inCheck: game.inCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
      winner: null,
    });
  },

  requestHint: async () => {
    const state = get();
    if (state.viewingPly !== null || state.isCheckmate || state.isDraw || state.isAIThinking) return;
    if (state.mode === 'puzzles') {
      const puzzle = TACTICAL_PUZZLES[state.activePuzzleIndex];
      const nextStep = puzzle?.solution[state.puzzleStep];
      if (puzzle && nextStep) {
        soundEngine.playSelect();
        set({
          hintMove: {
            from: nextStep.from as Square,
            to: nextStep.to as Square,
            san: 'Lance Vencedor',
          },
          selectedSquare: nextStep.from as Square,
          puzzleFeedback: puzzle.hintText,
        });
      }
      return;
    }
    const sanList = state.chess.history();
    const suggestion = await aiWorkerClient.requestMoveAsync(state.fen, 4, sanList);
    if (suggestion) {
      soundEngine.playSelect();
      set({
        hintMove: {
          from: suggestion.from,
          to: suggestion.to,
          san: suggestion.san,
        },
        selectedSquare: suggestion.from,
      });
    }
  },

  // Replay Navigation Actions
  jumpToPly: (ply: number | null) => {
    const state = get();
    const maxPly = state.plySnapshots.length - 1;
    soundEngine.playSelect();

    if (ply === null || ply >= maxPly) {
      set({ viewingPly: null, selectedSquare: null, legalMoves: [] });
      return;
    }

    const clamped = Math.max(0, Math.min(maxPly, ply));
    set({ viewingPly: clamped, selectedSquare: null, legalMoves: [] });
  },

  stepReplayFirst: () => {
    const state = get();
    if (state.plySnapshots.length <= 1) return;
    get().jumpToPly(0);
  },

  stepReplayPrev: () => {
    const state = get();
    const maxPly = state.plySnapshots.length - 1;
    if (maxPly === 0) return;
    const current = state.viewingPly === null ? maxPly : state.viewingPly;
    get().jumpToPly(Math.max(0, current - 1));
  },

  stepReplayNext: () => {
    const state = get();
    if (state.viewingPly === null) return;
    const maxPly = state.plySnapshots.length - 1;
    const next = state.viewingPly + 1;
    get().jumpToPly(next >= maxPly ? null : next);
  },

  stepReplayLatest: () => {
    get().jumpToPly(null);
  },

  exportPgnString: () => {
    const state = get();
    const headers = [
      `[Event "Arcane Gambit 3D"]`,
      `[Site "Salão Medieval 3D"]`,
      `[Date "${new Date().toISOString().split('T')[0].replace(/-/g, '.')}"]`,
      `[White "${state.mode === 'ai' && state.playerColor === 'b' ? `Oráculo IA (Nv.${state.aiDifficulty})` : 'Ordem da Luz'}"]`,
      `[Black "${state.mode === 'ai' && state.playerColor === 'w' ? `Oráculo IA (Nv.${state.aiDifficulty})` : 'Legião Obsidiana'}"]`,
      state.currentOpening ? `[Opening "${state.currentOpening}"]` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const pgnMoves = state.chess.pgn();
    return `${headers}\n\n${pgnMoves || '*'}`;
  },

  importPgnOrFen: (rawInput: string) => {
    const cleaned = rawInput.trim();
    if (!cleaned) return { ok: false, error: 'Insira um código PGN ou FEN válido.' };

    const testChess = new Chess();

    // Try loading as PGN first
    try {
      testChess.loadPgn(cleaned);
      if (testChess.history().length > 0) {
        const {
          capturedWhite,
          capturedBlack,
          moveHistory,
          currentOpening,
          plySnapshots,
        } = buildTimelineFromChess(testChess);
        soundEngine.playBattleStart();
        set({
          chess: testChess,
          fen: testChess.fen(),
          turn: testChess.turn(),
          plySnapshots,
          viewingPly: null,
          selectedSquare: null,
          legalMoves: [],
          lastMove: plySnapshots[plySnapshots.length - 1]?.lastMove || null,
          hintMove: null,
          capturedWhite,
          capturedBlack,
          moveHistory,
          currentOpening,
          evalScore: evaluateBoard(testChess),
          inCheck: testChess.inCheck(),
          isCheckmate: testChess.isCheckmate(),
          isDraw: testChess.isDraw(),
          winner: testChess.isCheckmate() ? (testChess.turn() === 'w' ? 'b' : 'w') : null,
          isMainMenuOpen: false,
        });
        return { ok: true };
      }
    } catch {
      // Fallback to FEN check
    }

    // Try loading as FEN string
    try {
      const fenChess = new Chess(cleaned);
      const snap = buildInitialSnapshot(fenChess.fen());
      soundEngine.playBattleStart();
      set({
        chess: fenChess,
        fen: fenChess.fen(),
        turn: fenChess.turn(),
        plySnapshots: [snap],
        viewingPly: null,
        selectedSquare: null,
        legalMoves: [],
        lastMove: null,
        hintMove: null,
        capturedWhite: [],
        capturedBlack: [],
        moveHistory: [],
        currentOpening: null,
        evalScore: evaluateBoard(fenChess),
        inCheck: fenChess.inCheck(),
        isCheckmate: fenChess.isCheckmate(),
        isDraw: fenChess.isDraw(),
        winner: null,
        isMainMenuOpen: false,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Formato PGN ou FEN inválido. Verifique a notação.' };
    }
  },

  setMode: (mode: GameMode) => {
    const state = get();
    if (state.mode === 'online' && mode !== 'online') {
      multiplayerService.cleanupSubscriptions();
    }
    set({ mode, onlineRoom: null, multiplayerError: null });
    if (mode === 'puzzles') {
      get().loadPuzzle(state.activePuzzleIndex);
    } else {
      get().resetGame();
    }
  },

  setAIDifficulty: (aiDifficulty: AIDifficulty) => {
    set({ aiDifficulty });
  },

  setPlayerColor: (playerColor: Color) => {
    set({ playerColor, cameraPreset: playerColor === 'b' ? 'black' : 'orbital' });
    get().resetGame();
  },

  setCameraPreset: (cameraPreset: CameraPreset) => {
    set({ cameraPreset });
  },

  setArenaTheme: (arenaTheme: ArenaTheme) => {
    set({ arenaTheme });
  },

  setHighQuality: (highQuality: boolean) => set({ highQuality }),

  setAutoRotateCamera: (autoRotateCamera: boolean) => set({ autoRotateCamera }),

  setImmersiveMode: (immersiveMode: boolean) => set({ immersiveMode }),

  setTimeControlMinutes: (timeControlMinutes: number) => {
    const secs = timeControlMinutes > 0 ? timeControlMinutes * 60 : 0;
    set({ timeControlMinutes, whiteTime: secs, blackTime: secs });
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    soundEngine.enabled = next;
    if (!next) {
      soundEngine.stopAmbientDrone();
    } else if (get().ambientSoundEnabled) {
      soundEngine.toggleAmbient(true);
    }
    set({ soundEnabled: next });
  },

  toggleAmbientSound: () => {
    const next = soundEngine.toggleAmbient();
    set({ ambientSoundEnabled: next });
  },

  tickTimer: () => {
    const state = get();
    if (state.isMainMenuOpen || state.timeControlMinutes === 0 || state.viewingPly !== null) return;
    if (state.isCheckmate || state.isDraw) return;
    if (state.mode === 'online' && (!state.onlineRoom || state.onlineRoom.status !== 'playing')) {
      return;
    }
    if (state.moveHistory.length === 0 && state.turn === 'w') return;

    if (state.turn === 'w') {
      const nextWhite = Math.max(0, state.whiteTime - 1);
      if (nextWhite === 0) {
        soundEngine.playVictory();
        set({ whiteTime: 0, isCheckmate: true, winner: 'b' });
      } else {
        set({ whiteTime: nextWhite });
      }
    } else {
      const nextBlack = Math.max(0, state.blackTime - 1);
      if (nextBlack === 0) {
        soundEngine.playVictory();
        set({ blackTime: 0, isCheckmate: true, winner: 'w' });
      } else {
        set({ blackTime: nextBlack });
      }
    }
  },

  setPlayerName: (playerName: string) => set({ playerName }),

  createOnlineRoom: async () => {
    try {
      const state = get();
      state.resetGame();
      const room = await multiplayerService.createRoom(state.playerName, new Chess().fen());
      set({
        mode: 'online',
        onlineRoom: room,
        onlineColor: 'w',
        cameraPreset: 'white',
        isMainMenuOpen: false,
        multiplayerError: null,
        chatMessages: [],
      });

      multiplayerService.subscribeToRoom(
        room.roomId,
        (updatedRoom) => {
          const curr = get();
          if (updatedRoom.fen !== curr.fen) {
            const syncedChess = new Chess(updatedRoom.fen);
            if (updatedRoom.pgn) {
              try {
                syncedChess.loadPgn(updatedRoom.pgn);
              } catch {}
            }
            const {
              capturedWhite,
              capturedBlack,
              moveHistory,
              currentOpening,
              plySnapshots,
            } = buildTimelineFromChess(syncedChess);
            if (updatedRoom.lastMove?.captured) {
              soundEngine.playCapture();
            } else {
              soundEngine.playMove();
            }
            set({
              chess: syncedChess,
              fen: updatedRoom.fen,
              turn: updatedRoom.turn,
              plySnapshots,
              viewingPly: null,
              lastMove: updatedRoom.lastMove
                ? {
                    from: updatedRoom.lastMove.from as Square,
                    to: updatedRoom.lastMove.to as Square,
                    san: updatedRoom.lastMove.san,
                  }
                : null,
              capturedWhite,
              capturedBlack,
              moveHistory,
              currentOpening,
              evalScore: evaluateBoard(syncedChess),
              inCheck: syncedChess.inCheck(),
              isCheckmate: syncedChess.isCheckmate(),
              isDraw: syncedChess.isDraw(),
              winner: updatedRoom.winner,
              onlineRoom: updatedRoom,
            });
          } else {
            set({ onlineRoom: updatedRoom });
          }
        },
        (msgs) => set({ chatMessages: msgs })
      );
    } catch (err) {
      set({ multiplayerError: (err as Error).message });
    }
  },

  joinOnlineRoom: async (code: string) => {
    try {
      const state = get();
      const { room, assignedColor } = await multiplayerService.joinRoom(code, state.playerName);
      const syncedChess = new Chess(room.fen);
      if (room.pgn) {
        try {
          syncedChess.loadPgn(room.pgn);
        } catch {}
      }
      const {
        capturedWhite,
        capturedBlack,
        moveHistory,
        currentOpening,
        plySnapshots,
      } = buildTimelineFromChess(syncedChess);

      soundEngine.playBattleStart();
      set({
        mode: 'online',
        chess: syncedChess,
        fen: room.fen,
        turn: room.turn,
        plySnapshots,
        viewingPly: null,
        onlineRoom: room,
        onlineColor: assignedColor,
        cameraPreset: assignedColor === 'b' ? 'black' : 'white',
        isMainMenuOpen: false,
        capturedWhite,
        capturedBlack,
        moveHistory,
        currentOpening,
        evalScore: evaluateBoard(syncedChess),
        multiplayerError: null,
      });

      multiplayerService.subscribeToRoom(
        room.roomId,
        (updatedRoom) => {
          const curr = get();
          if (updatedRoom.fen !== curr.fen) {
            const nextChess = new Chess(updatedRoom.fen);
            if (updatedRoom.pgn) {
              try {
                nextChess.loadPgn(updatedRoom.pgn);
              } catch {}
            }
            const extracted = buildTimelineFromChess(nextChess);
            if (updatedRoom.lastMove?.captured) {
              soundEngine.playCapture();
            } else {
              soundEngine.playMove();
            }
            set({
              chess: nextChess,
              fen: updatedRoom.fen,
              turn: updatedRoom.turn,
              plySnapshots: extracted.plySnapshots,
              viewingPly: null,
              lastMove: updatedRoom.lastMove
                ? {
                    from: updatedRoom.lastMove.from as Square,
                    to: updatedRoom.lastMove.to as Square,
                    san: updatedRoom.lastMove.san,
                  }
                : null,
              capturedWhite: extracted.capturedWhite,
              capturedBlack: extracted.capturedBlack,
              moveHistory: extracted.moveHistory,
              currentOpening: extracted.currentOpening,
              evalScore: evaluateBoard(nextChess),
              inCheck: nextChess.inCheck(),
              isCheckmate: nextChess.isCheckmate(),
              isDraw: nextChess.isDraw(),
              winner: updatedRoom.winner,
              onlineRoom: updatedRoom,
            });
          } else {
            set({ onlineRoom: updatedRoom });
          }
        },
        (msgs) => set({ chatMessages: msgs })
      );
    } catch (err) {
      set({ multiplayerError: (err as Error).message });
    }
  },

  leaveOnlineRoom: () => {
    multiplayerService.cleanupSubscriptions();
    set({ onlineRoom: null, onlineColor: null, chatMessages: [], multiplayerError: null });
    get().resetGame();
  },

  sendChat: async (text: string) => {
    const state = get();
    if (!state.onlineRoom) return;
    await multiplayerService.sendChatMessage(state.onlineRoom.roomId, state.playerName, text);
  },

  loadPuzzle: (index: number) => {
    const clampedIdx = Math.max(0, Math.min(TACTICAL_PUZZLES.length - 1, index));
    const puzzle = TACTICAL_PUZZLES[clampedIdx];
    const puzzleChess = new Chess(puzzle.fen);
    const snap = buildInitialSnapshot(puzzle.fen);
    soundEngine.playBattleStart();

    set({
      mode: 'puzzles',
      activePuzzleIndex: clampedIdx,
      puzzleStep: 0,
      puzzleStatus: 'playing',
      puzzleFeedback: null,
      chess: puzzleChess,
      fen: puzzleChess.fen(),
      turn: puzzleChess.turn(),
      playerColor: puzzle.playerColor,
      plySnapshots: [snap],
      viewingPly: null,
      selectedSquare: null,
      legalMoves: [],
      lastMove: null,
      hintMove: null,
      capturedWhite: [],
      capturedBlack: [],
      moveHistory: [],
      currentOpening: `${puzzle.theme} (${puzzle.rating} ELO)`,
      evalScore: evaluateBoard(puzzleChess),
      inCheck: puzzleChess.inCheck(),
      isCheckmate: false,
      isDraw: false,
      winner: null,
      pendingPromotion: null,
      isAIThinking: false,
      tacticalArrows: [],
      tacticalHighlights: [],
    });
  },

  nextPuzzle: () => {
    const state = get();
    const nextIdx = (state.activePuzzleIndex + 1) % TACTICAL_PUZZLES.length;
    get().loadPuzzle(nextIdx);
  },

  retryPuzzle: () => {
    const state = get();
    get().loadPuzzle(state.activePuzzleIndex);
  },
}));
