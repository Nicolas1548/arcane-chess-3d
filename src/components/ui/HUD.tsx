import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  RotateCcw,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  Music,
  Camera,
  Copy,
  Check,
  Send,
  ShieldAlert,
  Bot,
  Users,
  Globe,
  Swords,
  Maximize2,
  Minimize2,
  ScrollText,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  Upload,
  SlidersHorizontal,
  Trophy,
  Eraser,
} from 'lucide-react';
import { PieceSymbol } from 'chess.js';
import { useGameStore, AIDifficulty, ArenaTheme, CameraPreset } from '../../store/useGameStore';
import { AI_PERSONAS, TACTICAL_PUZZLES } from '../../engine/tacticalPuzzles';

const FAMOUS_GAMES: { title: string; subtitle: string; pgn: string }[] = [
  {
    title: 'A Partida da Ópera (Morphy, 1858)',
    subtitle: 'Defesa Philidor • Sacrifício Real de Dama em b8',
    pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
  },
  {
    title: 'A Imortal de Anderssen (1851)',
    subtitle: 'Gambito do Rei Aceito • Duplo Sacrifício de Torre e Dama',
    pgn: '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#',
  },
];

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const PIECE_GLYPHS: Record<PieceSymbol, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
  k: '♚',
};

const CLASSIFICATION_BADGES: Record<
  string,
  { symbol: string; label: string; bg: string; text: string }
> = {
  brilliant: { symbol: '!!', label: 'Brilhante', bg: 'bg-cyan-500/20 border-cyan-500/40', text: 'text-cyan-300' },
  great: { symbol: '!', label: 'Ótimo', bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-300' },
  best: { symbol: '★', label: 'Melhor', bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300' },
  inaccuracy: { symbol: '?!', label: 'Imprecisão', bg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-300' },
  mistake: { symbol: '?', label: 'Erro', bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-400' },
  blunder: { symbol: '??', label: 'Erro Crasso', bg: 'bg-red-500/25 border-red-500/50', text: 'text-red-400 font-bold' },
};

function formatClock(seconds: number, unlimited = false): string {
  if (unlimited) return '∞';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HUD: React.FC = () => {
  const {
    turn,
    mode,
    aiDifficulty,
    playerColor,
    isAIThinking,
    aiTelemetry,
    currentOpening,
    plySnapshots,
    viewingPly,
    redoStack,
    isMainMenuOpen,
    highQuality,
    animationsEnabled,
    is2DMode,
    autoRotateCamera,
    timeControlMinutes,
    capturedWhite,
    capturedBlack,
    evalScore,
    moveHistory,
    inCheck,
    isCheckmate,
    isDraw,
    drawReason,
    winner,
    pendingPromotion,
    hintMove,
    tacticalArrows,
    tacticalHighlights,
    activePuzzleIndex,
    puzzleStatus,
    puzzleFeedback,
    solvedPuzzleIds,
    cameraPreset,
    arenaTheme,
    soundEnabled,
    ambientSoundEnabled,
    whiteTime,
    blackTime,
    onlineRoom,
    onlineColor,
    chatMessages,
    playerName,
    multiplayerError,
    completePromotion,
    cancelPromotion,
    resetGame,
    setMainMenuOpen,
    undoMove,
    redoMove,
    requestHint,
    clearTacticalAnnotations,
    jumpToPly,
    stepReplayFirst,
    stepReplayPrev,
    stepReplayNext,
    stepReplayLatest,
    exportPgnString,
    importPgnOrFen,
    setMode,
    setAIDifficulty,
    setPlayerColor,
    setCameraPreset,
    setArenaTheme,
    setHighQuality,
    setAnimationsEnabled,
    setIs2DMode,
    setAutoRotateCamera,
    setTimeControlMinutes,
    toggleSound,
    toggleAmbientSound,
    tickTimer,
    setPlayerName,
    createOnlineRoom,
    joinOnlineRoom,
    leaveOnlineRoom,
    sendChat,
    loadPuzzle,
    nextPuzzle,
    retryPuzzle,
  } = useGameStore();

  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [pgnInputText, setPgnInputText] = useState('');
  const [pgnImportError, setPgnImportError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [tickTimer]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Global Keyboard Shortcuts (Replay <- / ->, H for Hint, Z for Undo, C for Camera, M for Mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepReplayPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepReplayNext();
      } else if (e.key.toLowerCase() === 'h' && !isMainMenuOpen) {
        e.preventDefault();
        requestHint();
      } else if (e.key.toLowerCase() === 'z' && !isMainMenuOpen) {
        e.preventDefault();
        undoMove();
      } else if (e.key.toLowerCase() === 'y' && !isMainMenuOpen) {
        e.preventDefault();
        redoMove();
      } else if (e.key === '2' && !isMainMenuOpen) {
        e.preventDefault();
        setIs2DMode(!is2DMode);
      } else if (e.key.toLowerCase() === 'c' && !isMainMenuOpen) {
        e.preventDefault();
        const order: CameraPreset[] = ['orbital', 'white', 'black', 'top'];
        const next = order[(order.indexOf(cameraPreset) + 1) % order.length];
        setCameraPreset(next);
      } else if (e.key.toLowerCase() === 'm' && !isMainMenuOpen) {
        e.preventDefault();
        toggleSound();
      } else if (e.key === 'Escape') {
        setMainMenuOpen(false);
        setShowPgnModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    stepReplayPrev,
    stepReplayNext,
    requestHint,
    undoMove,
    redoMove,
    is2DMode,
    setIs2DMode,
    cameraPreset,
    setCameraPreset,
    toggleSound,
    isMainMenuOpen,
    setMainMenuOpen,
  ]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const cycleCameraPreset = () => {
    const order: CameraPreset[] = ['orbital', 'white', 'black', 'top'];
    const next = order[(order.indexOf(cameraPreset) + 1) % order.length];
    setCameraPreset(next);
  };

  const maxPly = plySnapshots.length - 1;
  const activePly = viewingPly === null ? maxPly : viewingPly;
  const activeEval =
    viewingPly !== null && plySnapshots[viewingPly]
      ? plySnapshots[viewingPly].evalScore
      : evalScore;

  const clampedEval = Math.max(-1200, Math.min(1200, activeEval));
  const whiteAdvantagePct = 50 + (clampedEval / 1200) * 45;
  const evalPawnsFormatted = useMemo(() => {
    const pawns = activeEval / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
  }, [activeEval]);

  // Material Advantage Calculation
  const { whiteMatDiff, blackMatDiff } = useMemo(() => {
    const whiteCapturesScore = capturedBlack.reduce((acc, p) => acc + PIECE_VALUES[p], 0);
    const blackCapturesScore = capturedWhite.reduce((acc, p) => acc + PIECE_VALUES[p], 0);
    const diff = whiteCapturesScore - blackCapturesScore;
    return {
      whiteMatDiff: diff > 0 ? `+${diff}` : null,
      blackMatDiff: diff < 0 ? `+${Math.abs(diff)}` : null,
    };
  }, [capturedWhite, capturedBlack]);

  const activePersona = AI_PERSONAS[aiDifficulty];
  const activePuzzle = TACTICAL_PUZZLES[activePuzzleIndex];
  const hasAnnotations = tacticalArrows.length > 0 || tacticalHighlights.length > 0;

  const handleCopyRoomCode = () => {
    if (!onlineRoom) return;
    navigator.clipboard.writeText(onlineRoom.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(exportPgnString());
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const handleDownloadPgn = () => {
    const pgn = exportPgnString();
    const blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xadrez-medieval-${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = importPgnOrFen(pgnInputText);
    if (res.ok) {
      setPgnImportError(null);
      setPgnInputText('');
      setShowPgnModal(false);
    } else {
      setPgnImportError(res.error || 'Erro ao importar.');
    }
  };

  const handleLoadFamousGame = (pgn: string) => {
    const res = importPgnOrFen(pgn);
    if (res.ok) {
      jumpToPly(0);
      setShowPgnModal(false);
      setShowHistoryDrawer(true);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput);
    setChatInput('');
  };

  const unlimitedTime = timeControlMinutes === 0 || mode === 'puzzles';
  const cameraLabels: Record<CameraPreset, string> = {
    orbital: '3D Livre',
    white: 'Brancas',
    black: 'Pretas',
    top: 'Topo',
  };

  const whiteName =
    mode === 'ai'
      ? playerColor === 'w'
        ? 'Você (Luz)'
        : `${activePersona.name}`
      : mode === 'puzzles'
      ? 'Desafiante'
      : 'Brancas';

  const blackName =
    mode === 'ai'
      ? playerColor === 'b'
        ? 'Você (Obsidiana)'
        : `${activePersona.name} (${activePersona.elo})`
      : mode === 'puzzles'
      ? 'Defesa Real'
      : 'Pretas';

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-3 sm:p-5 z-10">
      {/* =====================================================================
          FLOATING TOP BAR (3 Sleek Glass Pills + Active Opening / Telemetry)
         ===================================================================== */}
      <header className="flex items-start justify-between gap-2">
        {/* 1. TOP-LEFT PILL: Settings Trigger, Active Mode & Opening Badge */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 bg-stone-950/85 backdrop-blur-md border border-amber-700/35 rounded-full px-3.5 py-1.5 shadow-xl">
            <button
              onClick={() => setMainMenuOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold text-amber-100 hover:text-amber-300 transition pr-2.5 border-r border-stone-800"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
              <span>Modo & Opções</span>
            </button>
            <button
              onClick={() => setMainMenuOpen(true)}
              className="text-[11px] font-medium text-stone-300 hover:text-amber-200 pl-1 flex items-center gap-1.5 transition"
            >
              {mode === 'ai' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {activePersona.name} • {activePersona.elo}
                  </span>
                </>
              ) : mode === 'puzzles' ? (
                <>
                  <Swords className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Desafio #{activePuzzleIndex + 1} ({solvedPuzzleIds.length}/
                    {TACTICAL_PUZZLES.length})
                  </span>
                </>
              ) : mode === 'local' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>2 Jogadores</span>
                </>
              ) : onlineRoom ? (
                <span>Sala {onlineRoom.roomId}</span>
              ) : (
                <span>Online</span>
              )}
            </button>
          </div>

          {currentOpening && (
            <div className="bg-stone-950/75 backdrop-blur-sm border border-stone-800/80 rounded-full px-3 py-1 text-[11px] text-amber-200/90 shadow-md max-w-[260px] truncate flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">{currentOpening}</span>
            </div>
          )}

          {mode === 'ai' && aiTelemetry && (
            <div className="hidden sm:flex items-center gap-2 bg-stone-950/65 backdrop-blur-sm border border-stone-800/60 rounded-full px-3 py-0.5 text-[10px] font-mono text-stone-400 max-w-fit">
              <span>
                {aiTelemetry.isBookMove
                  ? 'Livro ECO'
                  : `Prof.${aiTelemetry.depthReached} • ${aiTelemetry.nodesEvaluated.toLocaleString()} nós (${aiTelemetry.timeMs}ms)`}
              </span>
            </div>
          )}
        </div>

        {/* 2. TOP-CENTER PILL: Royal Match Scoreboard, Material Balance & Evaluation Bar */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 bg-stone-950/88 backdrop-blur-md border border-amber-700/35 rounded-full px-4 py-1.5 shadow-2xl">
            {/* White Player Side */}
            <div
              className={`flex items-center gap-2 transition-opacity ${
                turn === 'w' ? 'opacity-100' : 'opacity-55'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full bg-[#f5efe2] ${
                  turn === 'w' ? 'ring-2 ring-amber-400 shadow-[0_0_8px_#fbbf24]' : ''
                }`}
              />
              <span className="text-xs font-semibold text-stone-100 hidden md:inline max-w-[120px] truncate">
                {whiteName}
              </span>
              {whiteMatDiff && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                  {whiteMatDiff}
                </span>
              )}
              <span className="font-mono text-xs font-bold text-amber-200">
                {formatClock(whiteTime, unlimitedTime)}
              </span>
            </div>

            <div className="h-4 w-[1px] bg-stone-800" />

            {/* Black Player Side */}
            <div
              className={`flex items-center gap-2 transition-opacity ${
                turn === 'b' ? 'opacity-100' : 'opacity-55'
              }`}
            >
              <span className="font-mono text-xs font-bold text-stone-300">
                {formatClock(blackTime, unlimitedTime)}
              </span>
              {blackMatDiff && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
                  {blackMatDiff}
                </span>
              )}
              <span className="text-xs font-semibold text-stone-300 hidden md:inline max-w-[140px] truncate">
                {blackName}
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full bg-[#2c2520] border border-stone-500 ${
                  turn === 'b' ? 'ring-2 ring-amber-400 shadow-[0_0_8px_#fbbf24]' : ''
                }`}
              />
            </div>
          </div>

          {/* Live Evaluation Bar + Numerical Pawn Advantage */}
          <div className="flex items-center gap-2">
            <div className="w-40 sm:w-48 h-1.5 rounded-full bg-stone-800/90 border border-stone-700/60 overflow-hidden flex shadow-inner">
              <div
                className="bg-gradient-to-r from-[#d6c7b2] to-[#f8f3e8] transition-all duration-500"
                style={{ width: `${whiteAdvantagePct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-stone-300 bg-stone-950/80 border border-stone-800 px-1.5 py-0.2 rounded-full">
              {evalPawnsFormatted}
            </span>
          </div>

          {/* TACTICAL PUZZLE MODE INTERACTIVE BANNER */}
          {mode === 'puzzles' && activePuzzle && (
            <div className="mt-1 bg-stone-950/92 backdrop-blur-md border border-amber-600/45 rounded-2xl px-4 py-2.5 shadow-2xl max-w-md w-full flex flex-col items-center gap-1.5 text-center">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{activePuzzle.title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200">
                  {activePuzzle.rating} ELO
                </span>
              </div>
              <p className="text-[11px] text-stone-300">{activePuzzle.subtitle}</p>

              {puzzleFeedback && (
                <div
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    puzzleStatus === 'solved'
                      ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-200'
                      : puzzleStatus === 'wrong'
                      ? 'bg-red-950/90 border border-red-500/50 text-red-200'
                      : 'bg-amber-950/90 border border-amber-500/40 text-amber-200'
                  }`}
                >
                  {puzzleFeedback}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {puzzleStatus === 'wrong' && (
                  <button
                    onClick={retryPuzzle}
                    className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition"
                  >
                    Tentar Novamente
                  </button>
                )}
                {puzzleStatus === 'solved' && (
                  <button
                    onClick={nextPuzzle}
                    className="px-3.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-bold transition"
                  >
                    Próximo Desafio →
                  </button>
                )}
                <button
                  onClick={nextPuzzle}
                  className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] transition"
                >
                  Pular
                </button>
              </div>
            </div>
          )}

          {/* Status Alerts (Check, AI Thinking, Hint) */}
          {inCheck && viewingPly === null && !isCheckmate && (
            <div className="mt-0.5 px-3.5 py-1 rounded-full bg-red-950/95 border border-red-500/60 text-red-100 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> XEQUE AO REI!
            </div>
          )}
          {isAIThinking && (
            <div className="mt-0.5 px-3 py-0.5 rounded-full bg-stone-900/90 border border-amber-700/40 text-amber-200 text-[11px] flex items-center gap-1.5 shadow-lg">
              <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
              <span>{activePersona.name} está calculando...</span>
            </div>
          )}
          {hintMove && viewingPly === null && mode !== 'puzzles' && (
            <div className="mt-0.5 px-3 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-[11px] font-mono shadow-lg">
              Oráculo sugere: {hintMove.from.toUpperCase()} → {hintMove.to.toUpperCase()} (
              {hintMove.san})
            </div>
          )}
        </div>

        {/* 3. TOP-RIGHT PILL: Camera, History Drawer Toggle, Ambient Music, Audio & Fullscreen */}
        <div className="pointer-events-auto flex items-center gap-1 bg-stone-950/85 backdrop-blur-md border border-amber-700/35 rounded-full p-1 shadow-xl">
          <button
            onClick={() => setIs2DMode(!is2DMode)}
            title="Alternar Modo 2D Plano / 3D Esculpido (Atalho: 2)"
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
              is2DMode
                ? 'bg-amber-500 text-stone-950'
                : 'text-amber-300 hover:bg-stone-800'
            }`}
          >
            {is2DMode ? '2D' : '3D'}
          </button>

          <button
            onClick={cycleCameraPreset}
            title="Alternar Ângulo de Câmera (Atalho: C)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-stone-200 hover:bg-stone-800 transition"
          >
            <Camera className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline text-[11px]">{cameraLabels[cameraPreset]}</span>
          </button>

          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            title="Histórico de Lances, Replay e Salas Online"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition ${
              showHistoryDrawer
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'text-stone-200 hover:bg-stone-800'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">
              {mode === 'online' ? 'Sala' : `Lances (${moveHistory.length})`}
            </span>
          </button>

          <button
            onClick={toggleAmbientSound}
            title={
              ambientSoundEnabled
                ? 'Desativar Ambiência Medieval'
                : 'Ativar Ambiência Musical Medieval'
            }
            className={`p-1.5 rounded-full transition ${
              ambientSoundEnabled
                ? 'bg-amber-500/25 text-amber-300'
                : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar Efeitos (Atalho: M)' : 'Ativar Som (Atalho: M)'}
            className="p-1.5 rounded-full text-stone-300 hover:bg-stone-800 transition"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-stone-600" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            title="Tela Cheia"
            className="p-1.5 rounded-full text-stone-300 hover:bg-stone-800 transition"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* =====================================================================
          SLIDE-OVER RIGHT DRAWER (Move History, Captured Pieces & Online Room)
         ===================================================================== */}
      {showHistoryDrawer && (
        <aside className="pointer-events-auto fixed right-4 top-16 bottom-16 w-72 sm:w-80 bg-stone-950/94 backdrop-blur-md border border-amber-700/35 rounded-2xl p-4 shadow-2xl flex flex-col justify-between z-30">
          {mode === 'online' ? (
            <div className="flex flex-col h-full justify-between space-y-3 overflow-hidden">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-500" /> Partida Online
                  </h2>
                  <button
                    onClick={() => setShowHistoryDrawer(false)}
                    className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!onlineRoom ? (
                  <div className="space-y-2.5 pt-1">
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-stone-100"
                      placeholder="Seu nome..."
                    />
                    <button
                      onClick={createOnlineRoom}
                      className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition"
                    >
                      Criar Sala Online
                    </button>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="ARC-XXXX"
                        className="flex-1 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-xs font-mono uppercase text-amber-100"
                      />
                      <button
                        onClick={() => joinOnlineRoom(joinCode)}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 font-bold text-xs"
                      >
                        Entrar
                      </button>
                    </div>
                    {multiplayerError && (
                      <p className="text-xs text-red-400">{multiplayerError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-amber-700/40 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase block">Sala</span>
                        <span className="font-mono text-sm font-bold text-amber-200">
                          {onlineRoom.roomId}
                        </span>
                      </div>
                      <button
                        onClick={handleCopyRoomCode}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 text-xs"
                      >
                        {copiedCode ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedCode ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-stone-400">
                        Você joga de:{' '}
                        <strong className="text-amber-200">
                          {onlineColor === 'w' ? 'Brancas' : 'Pretas'}
                        </strong>
                      </span>
                      <button
                        onClick={leaveOnlineRoom}
                        className="text-red-400 hover:underline text-[11px]"
                      >
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {onlineRoom && (
                <div className="flex-1 flex flex-col bg-stone-900/70 border border-stone-800 rounded-xl p-2.5 overflow-hidden">
                  <div className="flex-1 overflow-y-auto py-1 space-y-1.5 text-xs">
                    {chatMessages.map((m) => (
                      <div key={m.id} className="bg-stone-950/80 rounded-lg px-2.5 py-1.5">
                        <span className="font-bold text-amber-400 mr-1.5">{m.senderName}:</span>
                        <span className="text-stone-200">{m.text}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-1.5 pt-1.5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Mensagem..."
                      className="flex-1 px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
                    />
                    <button type="submit" className="p-1.5 rounded-lg bg-amber-600 text-stone-950">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between overflow-hidden">
              <div className="space-y-2 pb-2 border-b border-stone-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                    Histórico & Capturas
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowPgnModal(true)}
                      className="text-[11px] px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-200 transition"
                    >
                      PGN / FEN
                    </button>
                    <button
                      onClick={() => setShowHistoryDrawer(false)}
                      className="p-1 rounded-lg hover:bg-stone-800 text-stone-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Captured Pieces Mini Tray inside Drawer */}
                {(capturedBlack.length > 0 || capturedWhite.length > 0) && (
                  <div className="bg-stone-900/80 rounded-xl p-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">Brancas capturaram:</span>
                      <span className="text-amber-300 tracking-tighter">
                        {capturedBlack.map((p, i) => (
                          <span key={i}>{PIECE_GLYPHS[p]}</span>
                        ))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">Pretas capturaram:</span>
                      <span className="text-stone-300 tracking-tighter">
                        {capturedWhite.map((p, i) => (
                          <span key={i}>{PIECE_GLYPHS[p]}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Advantage Swing Timeline Sparkline */}
                {plySnapshots.length > 2 && (
                  <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span>Oscilação da Partida</span>
                      <span className="font-mono text-amber-300">{evalPawnsFormatted}</span>
                    </div>
                    <div className="h-9 w-full flex items-end gap-[2px] bg-stone-950/80 rounded p-1">
                      {plySnapshots.map((snap) => {
                        // Clamp evaluation between -800 and +800 centipawns
                        const normalized = Math.max(-800, Math.min(800, snap.evalScore));
                        const pct = ((normalized + 800) / 1600) * 100;
                        const isSelected = activePly === snap.ply;
                        return (
                          <button
                            key={snap.ply}
                            onClick={() => jumpToPly(snap.ply === maxPly ? null : snap.ply)}
                            title={`Lance ${snap.ply}: ${snap.evalScore > 0 ? '+' : ''}${(snap.evalScore / 100).toFixed(1)}`}
                            className="flex-1 h-full flex flex-col justify-end group/bar relative"
                          >
                            <div
                              style={{ height: `${Math.max(10, pct)}%` }}
                              className={`w-full rounded-t-sm transition-all ${
                                isSelected
                                  ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                                  : snap.evalScore >= 0
                                  ? 'bg-stone-300 group-hover/bar:bg-amber-300'
                                  : 'bg-stone-600 group-hover/bar:bg-amber-500'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto my-2 pr-1">
                {moveHistory.length === 0 ? (
                  <p className="text-xs text-stone-500 text-center py-12">
                    Nenhum lance registrado ainda.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-stone-900 font-mono">
                      {moveHistory.map((row) => (
                        <tr key={row.moveNumber}>
                          <td className="py-1 pl-1 text-stone-500 w-8">{row.moveNumber}.</td>
                          <td className="py-1">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  row.whitePly &&
                                  jumpToPly(row.whitePly === maxPly ? null : row.whitePly)
                                }
                                className={`px-2 py-0.5 rounded transition ${
                                  activePly === row.whitePly
                                    ? 'bg-amber-600 text-stone-950 font-bold'
                                    : 'text-stone-200 hover:bg-stone-800'
                                }`}
                              >
                                {row.white}
                              </button>
                              {row.whiteClass && CLASSIFICATION_BADGES[row.whiteClass] && (
                                <span
                                  title={CLASSIFICATION_BADGES[row.whiteClass].label}
                                  className={`text-[9px] font-bold px-1 py-0.2 rounded border ${CLASSIFICATION_BADGES[row.whiteClass].bg} ${CLASSIFICATION_BADGES[row.whiteClass].text}`}
                                >
                                  {CLASSIFICATION_BADGES[row.whiteClass].symbol}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1">
                            {row.black ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    row.blackPly &&
                                    jumpToPly(row.blackPly === maxPly ? null : row.blackPly)
                                  }
                                  className={`px-2 py-0.5 rounded transition ${
                                    activePly === row.blackPly
                                      ? 'bg-amber-600 text-stone-950 font-bold'
                                      : 'text-stone-400 hover:bg-stone-800'
                                  }`}
                                >
                                  {row.black}
                                </button>
                                {row.blackClass && CLASSIFICATION_BADGES[row.blackClass] && (
                                  <span
                                    title={CLASSIFICATION_BADGES[row.blackClass].label}
                                    className={`text-[9px] font-bold px-1 py-0.2 rounded border ${CLASSIFICATION_BADGES[row.blackClass].bg} ${CLASSIFICATION_BADGES[row.blackClass].text}`}
                                  >
                                    {CLASSIFICATION_BADGES[row.blackClass].symbol}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-700 px-2">...</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Replay Scrubber */}
              <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-1">
                <button
                  onClick={stepReplayFirst}
                  disabled={maxPly === 0 || activePly === 0}
                  className="p-1.5 rounded-lg bg-stone-900 text-stone-300 disabled:opacity-30"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={stepReplayPrev}
                  disabled={maxPly === 0 || activePly === 0}
                  className="p-1.5 rounded-lg bg-stone-900 text-stone-300 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-amber-200">
                  {activePly} / {maxPly}
                </span>
                <button
                  onClick={stepReplayNext}
                  disabled={viewingPly === null}
                  className="p-1.5 rounded-lg bg-stone-900 text-stone-300 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={stepReplayLatest}
                  disabled={viewingPly === null}
                  className="p-1.5 rounded-lg bg-stone-900 text-amber-300 disabled:opacity-30"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* =====================================================================
          FLOATING BOTTOM ACTION DOCK & SUBTLE 3D CONTROLS HELPER
         ===================================================================== */}
      <footer className="flex flex-col items-center gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-stone-950/85 backdrop-blur-md border border-amber-700/35 rounded-full px-3.5 py-1.5 shadow-2xl">
          {viewingPly !== null ? (
            <>
              <span className="text-xs text-amber-300 font-medium px-2">
                Replay ({viewingPly}/{maxPly})
              </span>
              <button
                onClick={stepReplayPrev}
                className="p-1 rounded-full hover:bg-stone-800 text-stone-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={stepReplayNext}
                className="p-1 rounded-full hover:bg-stone-800 text-stone-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={stepReplayLatest}
                className="px-3 py-1 rounded-full bg-amber-600 text-stone-950 font-bold text-xs"
              >
                Voltar ao Jogo
              </button>
            </>
          ) : (
            <>
              <button
                onClick={requestHint}
                disabled={isCheckmate || isDraw}
                title="Sugestão do Oráculo (Atalho: H)"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-amber-200 hover:bg-stone-800 transition disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Dica</span>
              </button>

              <div className="h-3.5 w-[1px] bg-stone-800" />

              <button
                onClick={undoMove}
                disabled={mode === 'online' || moveHistory.length === 0}
                title="Voltar Lance (Atalho: Z)"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-stone-300 hover:bg-stone-800 transition disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>

              {redoStack.length > 0 && (
                <>
                  <div className="h-3.5 w-[1px] bg-stone-800" />
                  <button
                    onClick={redoMove}
                    disabled={mode === 'online'}
                    title="Refazer Lance (Atalho: Y)"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-amber-200 hover:bg-stone-800 transition disabled:opacity-40"
                  >
                    <Redo2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Refazer</span>
                  </button>
                </>
              )}

              {hasAnnotations && (
                <>
                  <div className="h-3.5 w-[1px] bg-stone-800" />
                  <button
                    onClick={clearTacticalAnnotations}
                    title="Limpar Setas Táticas"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-emerald-300 hover:bg-stone-800 transition"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Limpar Setas</span>
                  </button>
                </>
              )}

              <div className="h-3.5 w-[1px] bg-stone-800" />

              <button
                onClick={mode === 'puzzles' ? retryPuzzle : resetGame}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-stone-300 hover:bg-stone-800 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{mode === 'puzzles' ? 'Reiniciar Desafio' : 'Nova Partida'}</span>
              </button>
            </>
          )}
        </div>

        {/* Subtle 3D Micro-Tip */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] text-stone-400/80 bg-stone-950/50 backdrop-blur-sm px-3 py-0.5 rounded-full border border-stone-800/40">
          <span>Arraste peças com Botão Esq.</span>
          <span>•</span>
          <span>Setas táticas com Botão Dir.</span>
          <span>•</span>
          <span>Atalhos: [H] Dica [Z] Voltar [C] Câmera</span>
        </div>
      </footer>

      {/* =====================================================================
          ROYAL MATCH & MODE CONFIGURATION MODAL
         ===================================================================== */}
      {isMainMenuOpen && (
        <div className="pointer-events-auto fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-stone-950 border border-amber-700/45 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-base font-bold text-stone-100">
                    Salão Real • Modos & Configurações
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    Escolha seu adversário, desafios táticos ou personalize a mesa 3D
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMainMenuOpen(false)}
                className="p-1.5 rounded-lg bg-stone-900 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4 Game Modes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setMode('ai')}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'ai'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-100 shadow-lg'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Bot className="w-4 h-4 text-amber-500 mb-1" />
                <div className="text-xs font-bold">Contra IA</div>
                <div className="text-[10px] text-stone-400">4 Mestres</div>
              </button>

              <button
                onClick={() => setMode('puzzles')}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'puzzles'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-100 shadow-lg'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Swords className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="text-xs font-bold">Desafios 3D</div>
                <div className="text-[10px] text-stone-400">6 Puzzles</div>
              </button>

              <button
                onClick={() => setMode('local')}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'local'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-100 shadow-lg'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Users className="w-4 h-4 text-amber-500 mb-1" />
                <div className="text-xs font-bold">2 Jogadores</div>
                <div className="text-[10px] text-stone-400">Mesma Tela</div>
              </button>

              <button
                onClick={() => {
                  setMode('online');
                  setMainMenuOpen(false);
                  setShowHistoryDrawer(true);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'online'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-100 shadow-lg'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Globe className="w-4 h-4 text-amber-500 mb-1" />
                <div className="text-xs font-bold">Online</div>
                <div className="text-[10px] text-stone-400">Salas em Tempo Real</div>
              </button>
            </div>

            {/* AI Mode Persona Selector */}
            {mode === 'ai' && (
              <div className="space-y-3 bg-stone-900/70 p-4 rounded-2xl border border-stone-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-200">
                    Escolha seu Oponente na Cidadela
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400">Jogar com:</span>
                    <button
                      onClick={() => setPlayerColor('w')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        playerColor === 'w'
                          ? 'bg-[#e8dec8] text-stone-950 font-bold'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      Brancas
                    </button>
                    <button
                      onClick={() => setPlayerColor('b')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        playerColor === 'b'
                          ? 'bg-amber-600 text-stone-950 font-bold'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      Pretas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([1, 2, 3, 4] as AIDifficulty[]).map((lvl) => {
                    const p = AI_PERSONAS[lvl];
                    const selected = aiDifficulty === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setAIDifficulty(lvl)}
                        className={`p-3 rounded-xl border text-left transition ${
                          selected
                            ? 'bg-amber-500/15 border-amber-500 text-stone-100'
                            : 'bg-stone-950/70 border-stone-800 text-stone-400 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-100">{p.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-amber-300">
                            {p.elo} ELO
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-400/90 font-medium">{p.title}</div>
                        <div className="text-[10px] text-stone-400 mt-1">{p.style}</div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] italic text-stone-400 border-l-2 border-amber-600/60 pl-2.5">
                  “{activePersona.quote}”
                </p>
              </div>
            )}

            {/* Tactical Puzzles Selector */}
            {mode === 'puzzles' && (
              <div className="space-y-2.5 bg-stone-900/70 p-4 rounded-2xl border border-stone-800">
                <label className="text-xs font-bold text-emerald-300 block">
                  Selecione um Desafio Tático ({solvedPuzzleIds.length}/{TACTICAL_PUZZLES.length}{' '}
                  concluídos)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {TACTICAL_PUZZLES.map((pz, idx) => {
                    const isSolved = solvedPuzzleIds.includes(pz.id);
                    const isCurrent = activePuzzleIndex === idx;
                    return (
                      <button
                        key={pz.id}
                        onClick={() => {
                          loadPuzzle(idx);
                          setMainMenuOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          isCurrent
                            ? 'bg-emerald-600/20 border-emerald-500 text-stone-100'
                            : 'bg-stone-950/70 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span>
                              #{idx + 1} {pz.title}
                            </span>
                            {isSolved && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <div className="text-[10px] text-stone-400">{pz.theme}</div>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-emerald-300">
                          {pz.rating}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'local' && (
              <div className="flex items-center justify-between bg-stone-900/70 p-3.5 rounded-2xl border border-stone-800">
                <span className="text-xs text-stone-200">
                  Girar câmera automaticamente a cada lance
                </span>
                <button
                  onClick={() => setAutoRotateCamera(!autoRotateCamera)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    autoRotateCamera ? 'bg-amber-600 text-stone-950' : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {autoRotateCamera ? 'Sim' : 'Não'}
                </button>
              </div>
            )}

            {/* Environment, Clock & Graphics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Iluminação & Salão</label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['citadel', 'Nogueira'],
                      ['sanctuary', 'Esmeralda'],
                      ['inferno', 'Brasa Real'],
                    ] as [ArenaTheme, string][]
                  ).map(([th, label]) => (
                    <button
                      key={th}
                      onClick={() => setArenaTheme(th)}
                      className={`py-1.5 rounded-lg text-[11px] ${
                        arenaTheme === th
                          ? 'bg-amber-600/30 text-amber-200 border border-amber-600/50 font-semibold'
                          : 'bg-stone-900 text-stone-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Tempo por Jogador</label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    [5, '5m'],
                    [10, '10m'],
                    [15, '15m'],
                    [0, '∞'],
                  ].map(([mins, label]) => (
                    <button
                      key={mins}
                      onClick={() => setTimeControlMinutes(Number(mins))}
                      className={`py-1.5 rounded-lg text-[11px] ${
                        timeControlMinutes === Number(mins)
                          ? 'bg-amber-600/30 text-amber-200 border border-amber-600/50 font-semibold'
                          : 'bg-stone-900 text-stone-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Qualidade & Visão</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setHighQuality(!highQuality)}
                    className={`py-1.5 rounded-lg text-[11px] ${
                      highQuality
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-600/50 font-semibold'
                        : 'bg-stone-900 text-stone-400'
                    }`}
                  >
                    {highQuality ? 'Ultra' : 'Leve'}
                  </button>
                  <button
                    onClick={() => setAnimationsEnabled(!animationsEnabled)}
                    className={`py-1.5 rounded-lg text-[11px] ${
                      animationsEnabled
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-600/50 font-semibold'
                        : 'bg-stone-900 text-stone-400'
                    }`}
                  >
                    {animationsEnabled ? 'Animado' : 'Rápido'}
                  </button>
                  <button
                    onClick={() => setIs2DMode(!is2DMode)}
                    className={`py-1.5 rounded-lg text-[11px] ${
                      is2DMode
                        ? 'bg-amber-600/30 text-amber-200 border border-amber-600/50 font-semibold'
                        : 'bg-stone-900 text-stone-400'
                    }`}
                  >
                    {is2DMode ? 'Visão 2D' : 'Visão 3D'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => {
                  setMainMenuOpen(false);
                  setShowPgnModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs text-stone-200 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Partidas Históricas & PGN
              </button>
              <button
                onClick={() => setMainMenuOpen(false)}
                className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-lg"
              >
                Jogar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT / IMPORT PGN MODAL */}
      {showPgnModal && (
        <div className="pointer-events-auto fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-stone-950 border border-amber-700/40 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-200">
                Exportar / Importar PGN & Partidas Imortais
              </h3>
              <button
                onClick={() => setShowPgnModal(false)}
                className="p-1 rounded-lg bg-stone-900 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">PGN da Partida Atual</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCopyPgn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 text-amber-200 text-xs"
                  >
                    {copiedPgn ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedPgn ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={handleDownloadPgn}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-600/40 text-amber-200 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> .PGN
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={exportPgnString()}
                rows={3}
                className="w-full p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-[11px] font-mono text-stone-300"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-stone-800">
              <span className="text-xs text-stone-400 block">
                Carregar Partida Histórica para Replay 3D:
              </span>
              {FAMOUS_GAMES.map((fg, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadFamousGame(fg.pgn)}
                  className="w-full p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-left flex items-center justify-between transition"
                >
                  <div>
                    <div className="text-xs font-bold text-amber-100">{fg.title}</div>
                    <div className="text-[11px] text-stone-400">{fg.subtitle}</div>
                  </div>
                  <span className="text-xs font-bold text-amber-400">Assistir →</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-2 pt-2 border-t border-stone-800">
              <textarea
                value={pgnInputText}
                onChange={(e) => setPgnInputText(e.target.value)}
                placeholder="Cole um código PGN ou FEN aqui..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-stone-900 border border-stone-700 text-xs font-mono text-amber-100"
              />
              {pgnImportError && <p className="text-xs text-red-400">{pgnImportError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 text-stone-950 font-bold text-xs"
                >
                  Carregar no Tabuleiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAWN PROMOTION MODAL: THE CONSECRATION OF THE CHAMPION */}
      {pendingPromotion && (
        <div className="pointer-events-auto fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 border-2 border-amber-500/70 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center space-y-6 relative overflow-hidden">
            {/* Golden Radiant Backlight */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-1 relative">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shadow-inner">
                <Crown className="w-8 h-8 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-amber-200 tracking-wide font-serif pt-2">
                Consagração Heroica
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                O peão atingiu o posto de glória suprema. Escolha o novo senhor que liderará o reino:
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
              {(
                [
                  {
                    piece: 'q' as PieceSymbol,
                    title: 'Dama Real',
                    symbol: '♛',
                    desc: 'Domínio absoluto das fileiras e diagonais',
                    power: 'Poder Máximo',
                    glow: 'from-amber-600/30 to-amber-950/40 border-amber-500/50 hover:border-amber-400',
                  },
                  {
                    piece: 'n' as PieceSymbol,
                    title: 'Paladino',
                    symbol: '♞',
                    desc: 'Golpe tático capaz de saltar sobre oponentes',
                    power: 'Garfos Mortais',
                    glow: 'from-emerald-600/25 to-stone-950/40 border-emerald-500/40 hover:border-emerald-400',
                  },
                  {
                    piece: 'r' as PieceSymbol,
                    title: 'Bastião',
                    symbol: '♜',
                    desc: 'Força bruta e controle total de colunas abertas',
                    power: 'Fortaleza',
                    glow: 'from-sky-600/25 to-stone-950/40 border-sky-500/40 hover:border-sky-400',
                  },
                  {
                    piece: 'b' as PieceSymbol,
                    title: 'Prelado',
                    symbol: '♝',
                    desc: 'Visão veloz através dos corredores do salão',
                    power: 'Sniper Veloz',
                    glow: 'from-purple-600/25 to-stone-950/40 border-purple-500/40 hover:border-purple-400',
                  },
                ]
              ).map((card) => (
                <button
                  key={card.piece}
                  onClick={() => completePromotion(card.piece)}
                  className={`group relative p-4 rounded-2xl bg-gradient-to-b ${card.glow} border text-stone-100 flex flex-col items-center justify-between gap-2.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(245,158,11,0.2)] active:scale-95`}
                >
                  <span className="text-4xl sm:text-5xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform duration-200">
                    {card.symbol}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-amber-100 group-hover:text-amber-300 transition-colors">
                      {card.title}
                    </h4>
                    <span className="inline-block text-[10px] uppercase font-semibold tracking-wider text-amber-400/80 mt-0.5">
                      {card.power}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight hidden sm:block">
                    {card.desc}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={cancelPromotion}
              className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-4 decoration-stone-600 hover:decoration-stone-300"
            >
              Cancelar Movimento
            </button>
          </div>
        </div>
      )}

      {/* CHECKMATE / DRAW VICTORY BANNER WITH MATCH TELEMETRY */}
      {(isCheckmate || isDraw) && viewingPly === null && mode !== 'puzzles' && (
        <div className="pointer-events-auto fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-stone-950/95 border border-amber-600/60 rounded-3xl p-7 max-w-md w-full shadow-2xl text-center space-y-4">
            <Crown className="w-12 h-12 text-amber-500 mx-auto drop-shadow-[0_0_16px_rgba(245,158,11,0.5)]" />
            <div>
              <h2 className="text-xl font-bold text-stone-100">
                {isCheckmate
                  ? winner === 'w'
                    ? 'Vitória das Brancas!'
                    : 'Vitória das Pretas!'
                  : 'Partida Empatada!'}
              </h2>
              <p className="text-xs text-amber-300/90 mt-1">
                {isCheckmate
                  ? 'Xeque-Mate no Tabuleiro Real'
                  : drawReason || 'Empate Técnico'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-stone-900/80 border border-stone-800 rounded-2xl p-3 text-xs">
              <div>
                <span className="text-[10px] text-stone-400 block">Lances</span>
                <span className="font-mono font-bold text-stone-100">{moveHistory.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 block">Capturas</span>
                <span className="font-mono font-bold text-amber-300">
                  {capturedWhite.length + capturedBlack.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 block">Modo</span>
                <span className="font-bold text-stone-200">
                  {mode === 'ai' ? activePersona.name : mode === 'local' ? 'Local' : 'Online'}
                </span>
              </div>
            </div>

            {currentOpening && (
              <p className="text-[11px] text-stone-400">
                Abertura: <strong className="text-amber-200">{currentOpening}</strong>
              </p>
            )}

            <div className="flex justify-center gap-2.5 pt-2">
              <button
                onClick={resetGame}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-lg transition"
              >
                Jogar Revanche
              </button>
              <button
                onClick={() => {
                  stepReplayFirst();
                  setShowHistoryDrawer(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition"
              >
                Analisar Replay 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
