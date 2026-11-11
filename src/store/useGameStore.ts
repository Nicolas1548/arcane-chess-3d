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
  attackerPiece?: PieceSymbol;
  timestamp: number;
}

export type MoveClassification = 'brilliant' | 'great' | 'best' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveRecord {
  moveNumber: number;
  white?: string;
  whitePly?: number;
  whiteClass?: MoveClassification;
  black?: string;
  blackPly?: number;
  blackClass?: MoveClassification;
}

export interface PlySnapshot {
  ply: number;
  fen: string;
  lastMove: { from: Square; to: Square; san?: string } | null;
  capturedWhite: PieceSymbol[];
  capturedBlack: PieceSymbol[];
  evalScore: number;
  classification?: MoveClassification;
}

export interface AITelemetry {
  nodesEvaluated: number;
  timeMs: number;
  depthReached: number;
  isBookMove: boolean;
}

export interface QueuedMove {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: Color;
}

const INITIAL_FEN = new Chess().fen();
const STORAGE_KEY = 'arcane_chess_state_v1';

interface PersistedStorageState {
  pgn?: string;
  fen?: string;
  mode?: GameMode;
  aiDifficulty?: AIDifficulty;
  playerColor?: Color;
  highQuality?: boolean;
  animationsEnabled?: boolean;
  is2DMode?: boolean;
  autoRotateCamera?: boolean;
  timeControlMinutes?: number;
  whiteTime?: number;
  blackTime?: number;
  arenaTheme?: ArenaTheme;
  soundEnabled?: boolean;
  ambientSoundEnabled?: boolean;
  playerName?: string;
  activePuzzleIndex?: number;
  solvedPuzzleIds?: string[];
}

function loadPersistedState(): PersistedStorageState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedStorageState;
  } catch {
    return {};
  }
}

function savePersistedState(state: Partial<GameState>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedStorageState = {
      pgn: state.chess ? state.chess.pgn() : undefined,
      fen: state.fen,
      mode: state.mode === 'online' ? 'ai' : state.mode,
      aiDifficulty: state.aiDifficulty,
      playerColor: state.playerColor,
      highQuality: state.highQuality,
      animationsEnabled: state.animationsEnabled,
      is2DMode: state.is2DMode,
      autoRotateCamera: state.autoRotateCamera,
      timeControlMinutes: state.timeControlMinutes,
      whiteTime: state.whiteTime,
      blackTime: state.blackTime,
      arenaTheme: state.arenaTheme,
      soundEnabled: state.soundEnabled,
      ambientSoundEnabled: state.ambientSoundEnabled,
      playerName: state.playerName,
      activePuzzleIndex: state.activePuzzleIndex,
      solvedPuzzleIds: state.solvedPuzzleIds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeDrawReason(game: Chess): string | null {
  if (game.isStalemate()) return 'Empate por Afogamento (Stalemate)';
  if (game.isThreefoldRepetition()) return 'Empate por Repetição Tripla';
  if (game.isInsufficientMaterial()) return 'Empate por Material Insuficiente';
  if (game.isDraw()) return 'Empate pela Regra dos 50 Lances';
  return null;
}

function buildInitialSnapshot(fen = INITIAL_FEN): PlySnapshot {
  let evalScore = 0;
  try {
    evalScore = evaluateBoard(new Chess(fen));
  } catch {
    evalScore = 0;
  }
  return {
    ply: 0,
    fen,
    lastMove: null,
    capturedWhite: [],
    capturedBlack: [],
    evalScore,
  };
}

/**
 * Classifies a move using centipawn evaluation swing (Chess.com style)
 */
function classifyMoveDelta(
  prevEval: number,
  currEval: number,
  isWhiteMove: boolean,
  isCheckmate: boolean
): MoveClassification {
  if (isCheckmate) return 'brilliant';
  // Delta in favor of the player who moved
  const delta = isWhiteMove ? currEval - prevEval : prevEval - currEval;
  if (delta >= 180) return 'brilliant';
  if (delta >= 40) return 'great';
  if (delta >= -35) return 'best';
  if (delta >= -110) return 'inaccuracy';
  if (delta >= -240) return 'mistake';
  return 'blunder';
}

/**
 * Safely reconstructs full timeline from any starting FEN (standard, imported FEN, or tactical puzzle).
 */
export function buildTimelineFromChess(chess: Chess): {
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

  const startFen = verboseHistory.length > 0 ? verboseHistory[0].before : chess.fen();
  const replayChess = new Chess(startFen);
  const plySnapshots: PlySnapshot[] = [buildInitialSnapshot(replayChess.fen())];

  verboseHistory.forEach((m, index) => {
    const ply = index + 1;
    sanList.push(m.san);
    const prevEval = plySnapshots[plySnapshots.length - 1]?.evalScore ?? 0;
    replayChess.move({ from: m.from, to: m.to, promotion: m.promotion });
    const currEval = evaluateBoard(replayChess);

    if (m.captured) {
      if (m.color === 'w') {
        capturedBlack.push(m.captured);
      } else {
        capturedWhite.push(m.captured);
      }
    }

    const classification = classifyMoveDelta(
      prevEval,
      currEval,
      m.color === 'w',
      replayChess.isCheckmate()
    );

    plySnapshots.push({
      ply,
      fen: replayChess.fen(),
      lastMove: { from: m.from as Square, to: m.to as Square, san: m.san },
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      evalScore: currEval,
      classification,
    });

    if (index % 2 === 0) {
      moveHistory.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: m.san,
        whitePly: ply,
        whiteClass: classification,
      });
    } else {
      const current = moveHistory[moveHistory.length - 1];
      if (current) {
        current.black = m.san;
        current.blackPly = ply;
        current.blackClass = classification;
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

export interface GameState {
  chess: Chess;
  fen: string;
  turn: Color;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  playerColor: Color;
  isAIThinking: boolean;
  currentOpening: string | null;
  aiTelemetry: AITelemetry | null;

  // Replay & Undo/Redo Timeline State
  plySnapshots: PlySnapshot[];
  viewingPly: number | null;
  redoStack: QueuedMove[];

  isMainMenuOpen: boolean;
  highQuality: boolean;
  animationsEnabled: boolean;
  is2DMode: boolean;
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
  drawReason: string | null;
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
  executeMove: (from: Square, to: Square, promotion?: PieceSymbol, isRedo?: boolean) => boolean;
  completePromotion: (piece: PieceSymbol) => void;
  cancelPromotion: () => void;
  resetGame: () => void;
  startBattleFromMenu: () => void;
  setMainMenuOpen: (open: boolean) => void;
  undoMove: () => void;
  redoMove: () => void;
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
  setAnimationsEnabled: (enabled: boolean) => void;
  setIs2DMode: (is2D: boolean) => void;
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

// Hydrate initial chess instance and timeline from localStorage if available
const persisted = loadPersistedState();
const hydratedChess = new Chess();
if (persisted.mode === 'puzzles') {
  const pz = TACTICAL_PUZZLES[persisted.activePuzzleIndex ?? 0] || TACTICAL_PUZZLES[0];
  try {
    hydratedChess.load(pz.fen);
  } catch {}
} else if (persisted.pgn) {
  try {
    hydratedChess.loadPgn(persisted.pgn);
  } catch {
    if (persisted.fen) {
      try {
        hydratedChess.load(persisted.fen);
      } catch {}
    }
  }
} else if (persisted.fen) {
  try {
    hydratedChess.load(persisted.fen);
  } catch {}
}

const hydratedTimeline = buildTimelineFromChess(hydratedChess);
if (persisted.soundEnabled !== undefined) {
  soundEngine.enabled = persisted.soundEnabled;
}

export const useGameStore = create<GameState>((set, get) => ({
  chess: hydratedChess,
  fen: hydratedChess.fen(),
  turn: hydratedChess.turn(),
  mode: persisted.mode ?? 'ai',
  aiDifficulty: persisted.aiDifficulty ?? 2,
  playerColor: persisted.playerColor ?? 'w',
  isAIThinking: false,
  currentOpening: hydratedTimeline.currentOpening,
  aiTelemetry: null,

  plySnapshots: hydratedTimeline.plySnapshots,
  viewingPly: null,
  redoStack: [],

  isMainMenuOpen: false,
  highQuality: persisted.highQuality ?? true,
  animationsEnabled: persisted.animationsEnabled ?? true,
  is2DMode: persisted.is2DMode ?? false,
  autoRotateCamera: persisted.autoRotateCamera ?? true,
  immersiveMode: false,
  timeControlMinutes: persisted.timeControlMinutes ?? 10,

  selectedSquare: null,
  legalMoves: [],
  lastMove:
    hydratedTimeline.plySnapshots[hydratedTimeline.plySnapshots.length - 1]?.lastMove ?? null,
  hintMove: null,

  capturedWhite: hydratedTimeline.capturedWhite,
  capturedBlack: hydratedTimeline.capturedBlack,
  evalScore: evaluateBoard(hydratedChess),
  moveHistory: hydratedTimeline.moveHistory,

  inCheck: hydratedChess.inCheck(),
  isCheckmate: hydratedChess.isCheckmate(),
  isDraw: hydratedChess.isDraw(),
  drawReason: computeDrawReason(hydratedChess),
  winner: hydratedChess.isCheckmate()
    ? hydratedChess.turn() === 'w'
      ? 'b'
      : 'w'
    : hydratedChess.isDraw()
    ? 'draw'
    : null,

  pendingPromotion: null,
  captureEffects: [],
  lastCaptureTime: 0,

  draggingSquare: null,
  dragHoverSquare: null,
  tacticalArrows: [],
  tacticalHighlights: [],

  activePuzzleIndex: persisted.activePuzzleIndex ?? 0,
  puzzleStep: 0,
  puzzleStatus: 'playing',
  puzzleFeedback: null,
  solvedPuzzleIds: persisted.solvedPuzzleIds ?? [],

  cameraPreset: persisted.is2DMode ? 'top' : 'orbital',
  arenaTheme: persisted.arenaTheme ?? 'citadel',
  soundEnabled: persisted.soundEnabled ?? true,
  ambientSoundEnabled: false,

  whiteTime: persisted.whiteTime ?? 600,
  blackTime: persisted.blackTime ?? 600,

  onlineRoom: null,
  onlineColor: null,
  chatMessages: [],
  playerName: persisted.playerName ?? 'Lorde Arcano',
  multiplayerError: null,

  selectSquare: (square: Square) => {
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

    // If a friendly piece is already selected and the user taps an enemy piece that is a legal capture,
    // let selectSquare handle the capture immediately!
    if (state.selectedSquare && state.legalMoves.some((m) => m.to === square)) {
      return;
    }

    const piece = state.chess.get(square);
    if (!piece || piece.color !== state.turn) return;

    const alreadySelected = state.selectedSquare === square;
    if (!alreadySelected) {
      soundEngine.playSelect();
    }
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

  executeMove: (from: Square, to: Square, promotion: PieceSymbol = 'q', isRedo = false) => {
    const state = get();
    if (
      state.mode === 'online' &&
      (!state.onlineRoom ||
        state.onlineRoom.status !== 'playing' ||
        state.turn !== state.onlineColor)
    ) {
      return false;
    }

    const game = state.chess;
    const previousFen = game.fen();
    const previousPgn = game.pgn();

    try {
      const moveResult = game.move({ from, to, promotion });
      if (!moveResult) return false;

      const isCheckmate = game.isCheckmate();
      const drawReason = computeDrawReason(game);
      const isDraw = Boolean(drawReason);
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
        soundEngine.playCapture(moveResult.piece);
        soundEngine.triggerHaptic('medium');
        if (state.animationsEnabled) {
          const effect: CaptureEffect = {
            id: 'fx_' + Date.now() + '_' + Math.random(),
            square: to,
            color: moveResult.color === 'w' ? 'b' : 'w',
            piece: moveResult.captured,
            attackerPiece: moveResult.piece,
            timestamp: Date.now(),
          };
          newEffects = [...state.captureEffects.slice(-4), effect];
        }
      } else {
        soundEngine.playMove(isCastle);
        soundEngine.triggerHaptic('light');
      }

      if (isCheckmate) {
        soundEngine.playVictory();
        soundEngine.triggerHaptic('heavy');
      } else if (inCheck) {
        soundEngine.playCheck();
        soundEngine.triggerHaptic('warning');
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

      const nextCameraPreset = (state.is2DMode || state.cameraPreset === 'top')
        ? 'top'
        : state.mode === 'local' && state.autoRotateCamera
        ? nextTurn === 'w'
          ? 'white'
          : 'black'
        : state.cameraPreset;

      set({
        fen: game.fen(),
        turn: nextTurn,
        viewingPly: null,
        plySnapshots,
        redoStack: isRedo ? state.redoStack : [],
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
        drawReason,
        winner,
        captureEffects: newEffects,
        lastCaptureTime:
          moveResult.captured && state.animationsEnabled ? Date.now() : state.lastCaptureTime,
        tacticalArrows: [],
        tacticalHighlights: [],
        cameraPreset: nextCameraPreset,
      });

      savePersistedState(get());

      if (state.mode === 'online' && state.onlineRoom) {
        const attemptedFen = game.fen();
        void multiplayerService.pushMove(state.onlineRoom.roomId, {
          fen: game.fen(),
          pgn: game.pgn(),
          turn: nextTurn,
          lastMove: { from, to, captured: moveResult.captured, san: moveResult.san },
          status: isCheckmate || isDraw ? 'finished' : 'playing',
          winner,
        }).catch((err: unknown) => {
          const current = get();
          if (current.mode !== 'online' || current.fen !== attemptedFen) return;

          const restoredChess = new Chess();
          try {
            if (previousPgn) {
              restoredChess.loadPgn(previousPgn);
            } else {
              restoredChess.load(previousFen);
            }
          } catch {
            restoredChess.load(previousFen);
          }

          const restoredTimeline = buildTimelineFromChess(restoredChess);
          set({
            chess: restoredChess,
            fen: restoredChess.fen(),
            turn: restoredChess.turn(),
            plySnapshots: restoredTimeline.plySnapshots,
            viewingPly: null,
            selectedSquare: null,
            legalMoves: [],
            lastMove: restoredTimeline.plySnapshots[restoredTimeline.plySnapshots.length - 1]?.lastMove ?? null,
            capturedWhite: restoredTimeline.capturedWhite,
            capturedBlack: restoredTimeline.capturedBlack,
            moveHistory: restoredTimeline.moveHistory,
            currentOpening: restoredTimeline.currentOpening,
            evalScore: evaluateBoard(restoredChess),
            inCheck: restoredChess.inCheck(),
            isCheckmate: restoredChess.isCheckmate(),
            isDraw: restoredChess.isDraw(),
            drawReason: computeDrawReason(restoredChess),
            winner: restoredChess.isCheckmate()
              ? restoredChess.turn() === 'w'
                ? 'b'
                : 'w'
              : restoredChess.isDraw()
                ? 'draw'
                : null,
            multiplayerError: err instanceof Error
              ? err.message
              : 'Não foi possível sincronizar a jogada.',
          });
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
              savePersistedState(get());
            } else {
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
              }, 420);
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

      if (
        state.mode === 'ai' &&
        !isRedo &&
        !isCheckmate &&
        !isDraw &&
        nextTurn !== state.playerColor
      ) {
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
        }, 250);
      }

      return true;
    } catch {
      return false;
    }
  },

  completePromotion: (piece: PieceSymbol) => {
    const pending = get().pendingPromotion;
    if (!pending) return;
    soundEngine.playPromotion();
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
      redoStack: [],
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
      drawReason: null,
      winner: null,
      pendingPromotion: null,
      isAIThinking: false,
      whiteTime: initialSecs,
      blackTime: initialSecs,
    });

    savePersistedState(get());

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
      }, 320);
    }
  },

  startBattleFromMenu: () => {
    const state = get();
    soundEngine.playBattleStart();
    const targetCam: CameraPreset = state.is2DMode
      ? 'top'
      : state.mode === 'ai'
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
    const undoneMoves: QueuedMove[] = [];

    if (state.mode === 'ai') {
      const m1 = game.undo();
      if (m1) {
        undoneMoves.push({
          from: m1.from as Square,
          to: m1.to as Square,
          promotion: m1.promotion as PieceSymbol | undefined,
        });
      }
      const m2 = game.undo();
      if (m2) {
        undoneMoves.push({
          from: m2.from as Square,
          to: m2.to as Square,
          promotion: m2.promotion as PieceSymbol | undefined,
        });
      }
    } else {
      const m1 = game.undo();
      if (m1) {
        undoneMoves.push({
          from: m1.from as Square,
          to: m1.to as Square,
          promotion: m1.promotion as PieceSymbol | undefined,
        });
      }
    }

    if (undoneMoves.length === 0) return;

    const { capturedWhite, capturedBlack, moveHistory, currentOpening, plySnapshots } =
      buildTimelineFromChess(game);
    soundEngine.playSelect();

    set({
      fen: game.fen(),
      turn: game.turn(),
      plySnapshots,
      viewingPly: null,
      redoStack: [...state.redoStack, ...undoneMoves],
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
      drawReason: computeDrawReason(game),
      winner: null,
      puzzleStatus: 'playing',
      puzzleFeedback: null,
    });

    savePersistedState(get());
  },

  redoMove: () => {
    const state = get();
    if (state.mode === 'online' || state.isAIThinking || state.redoStack.length === 0) return;

    const nextRedoStack = [...state.redoStack];
    if (state.mode === 'ai' && nextRedoStack.length >= 2) {
      const playerMove = nextRedoStack.pop()!;
      const aiReply = nextRedoStack.pop()!;
      set({ redoStack: nextRedoStack });
      state.executeMove(playerMove.from, playerMove.to, playerMove.promotion || 'q', true);
      get().executeMove(aiReply.from, aiReply.to, aiReply.promotion || 'q', true);
    } else {
      const nextMove = nextRedoStack.pop()!;
      set({ redoStack: nextRedoStack });
      state.executeMove(nextMove.from, nextMove.to, nextMove.promotion || 'q', true);
    }
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
      `[White "${
        state.mode === 'ai' && state.playerColor === 'b'
          ? `Oráculo IA (Nv.${state.aiDifficulty})`
          : 'Ordem da Luz'
      }"]`,
      `[Black "${
        state.mode === 'ai' && state.playerColor === 'w'
          ? `Oráculo IA (Nv.${state.aiDifficulty})`
          : 'Legião Obsidiana'
      }"]`,
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
          redoStack: [],
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
          drawReason: computeDrawReason(testChess),
          winner: testChess.isCheckmate() ? (testChess.turn() === 'w' ? 'b' : 'w') : null,
          isMainMenuOpen: false,
        });
        savePersistedState(get());
        return { ok: true };
      }
    } catch {
      // Fallback to FEN check
    }

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
        redoStack: [],
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
        drawReason: computeDrawReason(fenChess),
        winner: null,
        isMainMenuOpen: false,
      });
      savePersistedState(get());
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
    savePersistedState(get());
  },

  setPlayerColor: (playerColor: Color) => {
    set({
      playerColor,
      cameraPreset: get().is2DMode ? 'top' : playerColor === 'b' ? 'black' : 'orbital',
    });
    get().resetGame();
  },

  setCameraPreset: (cameraPreset: CameraPreset) => {
    set({ cameraPreset, is2DMode: false });
    savePersistedState(get());
  },

  setArenaTheme: (arenaTheme: ArenaTheme) => {
    set({ arenaTheme });
    savePersistedState(get());
  },

  setHighQuality: (highQuality: boolean) => {
    set({ highQuality });
    savePersistedState(get());
  },

  setAnimationsEnabled: (animationsEnabled: boolean) => {
    set({ animationsEnabled });
    savePersistedState(get());
  },

  setIs2DMode: (is2DMode: boolean) => {
    set({
      is2DMode,
      cameraPreset: is2DMode ? 'top' : 'orbital',
    });
    savePersistedState(get());
  },

  setAutoRotateCamera: (autoRotateCamera: boolean) => {
    set({ autoRotateCamera });
    savePersistedState(get());
  },

  setImmersiveMode: (immersiveMode: boolean) => set({ immersiveMode }),

  setTimeControlMinutes: (timeControlMinutes: number) => {
    const secs = timeControlMinutes > 0 ? timeControlMinutes * 60 : 0;
    set({ timeControlMinutes, whiteTime: secs, blackTime: secs });
    savePersistedState(get());
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
    savePersistedState(get());
  },

  toggleAmbientSound: () => {
    const next = soundEngine.toggleAmbient();
    set({ ambientSoundEnabled: next });
    savePersistedState(get());
  },

  tickTimer: () => {
    const state = get();
    if (
      state.isMainMenuOpen ||
      state.timeControlMinutes === 0 ||
      state.viewingPly !== null ||
      state.mode === 'puzzles'
    ) {
      return;
    }
    if (state.isCheckmate || state.isDraw) return;
    if (state.mode === 'online' && (!state.onlineRoom || state.onlineRoom.status !== 'playing')) {
      return;
    }
    if (state.moveHistory.length === 0 && state.turn === 'w') return;

    if (state.turn === 'w') {
      const nextWhite = Math.max(0, state.whiteTime - 1);
      if (nextWhite === 0) {
        soundEngine.playVictory();
        soundEngine.triggerHaptic('heavy');
        set({ whiteTime: 0, isCheckmate: true, winner: 'b' });
      } else {
        if (nextWhite <= 30 && nextWhite % 2 === 0) {
          soundEngine.playTensionPulse();
          soundEngine.triggerHaptic('light');
        }
        set({ whiteTime: nextWhite });
      }
    } else {
      const nextBlack = Math.max(0, state.blackTime - 1);
      if (nextBlack === 0) {
        soundEngine.playVictory();
        soundEngine.triggerHaptic('heavy');
        set({ blackTime: 0, isCheckmate: true, winner: 'w' });
      } else {
        if (nextBlack <= 30 && nextBlack % 2 === 0) {
          soundEngine.playTensionPulse();
          soundEngine.triggerHaptic('light');
        }
        set({ blackTime: nextBlack });
      }
    }
  },

  setPlayerName: (playerName: string) => {
    set({ playerName });
    savePersistedState(get());
  },

  createOnlineRoom: async () => {
    try {
      const state = get();
      state.resetGame();
      const room = await multiplayerService.createRoom(state.playerName, new Chess().fen());
      set({
        mode: 'online',
        onlineRoom: room,
        onlineColor: 'w',
        cameraPreset: state.is2DMode ? 'top' : 'white',
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
              drawReason: computeDrawReason(syncedChess),
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
        cameraPreset: state.is2DMode ? 'top' : assignedColor === 'b' ? 'black' : 'white',
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
              drawReason: computeDrawReason(nextChess),
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
      redoStack: [],
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
      drawReason: null,
      winner: null,
      pendingPromotion: null,
      isAIThinking: false,
      tacticalArrows: [],
      tacticalHighlights: [],
    });

    savePersistedState(get());
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
