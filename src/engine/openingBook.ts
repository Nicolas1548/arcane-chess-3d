import { Chess, Square } from 'chess.js';

export interface OpeningEntry {
  eco: string;
  name: string;
  moves: string[]; // Algebraic SAN sequence e.g. ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
}

export const OPENING_BOOK: OpeningEntry[] = [
  // Espanhola (Ruy Lopez)
  { eco: 'C60', name: 'Abertura Espanhola (Ruy Lopez)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy Lopez: Defesa Berlim', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C78', name: 'Ruy Lopez: Defesa Morphy', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'] },

  // Italiana (Giuoco Piano & Two Knights)
  { eco: 'C50', name: 'Abertura Italiana', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C53', name: 'Abertura Italiana (Giuoco Piano)', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4'] },
  { eco: 'C55', name: 'Defesa dos Dois Cavalos', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },

  // Escocesa & Gambito do Rei
  { eco: 'C44', name: 'Abertura Escocesa', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
  { eco: 'C30', name: 'Gambito do Rei', moves: ['e4', 'e5', 'f4', 'exf4', 'Nf3'] },
  { eco: 'C42', name: 'Defesa Russa (Petrov)', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },

  // Defesa Siciliana
  { eco: 'B20', name: 'Defesa Siciliana', moves: ['e4', 'c5'] },
  { eco: 'B50', name: 'Defesa Siciliana: Linha Aberta', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3'] },
  { eco: 'B90', name: 'Defesa Siciliana: Variante Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B70', name: 'Defesa Siciliana: Variante do Dragão', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B30', name: 'Defesa Siciliana: Clássica / Rossolimo', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'B22', name: 'Defesa Siciliana: Variante Alapin', moves: ['e4', 'c5', 'c3', 'Nf6', 'e5', 'Nd5'] },

  // Francesa, Caro-Kann, Escandinava, Pirc
  { eco: 'C00', name: 'Defesa Francesa', moves: ['e4', 'e6', 'd4', 'd5'] },
  { eco: 'C11', name: 'Defesa Francesa: Clássica', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'] },
  { eco: 'C02', name: 'Defesa Francesa: Variante do Avanço', moves: ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6'] },
  { eco: 'B10', name: 'Defesa Caro-Kann', moves: ['e4', 'c6', 'd4', 'd5'] },
  { eco: 'B18', name: 'Defesa Caro-Kann: Clássica', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'] },
  { eco: 'B01', name: 'Defesa Escandinava', moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'] },

  // Gambito da Dama & Aberturas de Peão da Dama
  { eco: 'D06', name: 'Gambito da Dama', moves: ['d4', 'd5', 'c4'] },
  { eco: 'D30', name: 'Gambito da Dama Recusado', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7'] },
  { eco: 'D20', name: 'Gambito da Dama Aceito', moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3'] },
  { eco: 'D10', name: 'Defesa Eslava', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3'] },
  { eco: 'D02', name: 'Sistema London', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3'] },
  { eco: 'A45', name: 'Sistema London ( vs Índia )', moves: ['d4', 'Nf6', 'Bf4', 'g6', 'e3', 'Bg7', 'Nf3'] },

  // Índia do Rei, Nimzo-Índia, Inglesa
  { eco: 'E60', name: 'Defesa Índia do Rei', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'] },
  { eco: 'E20', name: 'Defesa Nimzo-Índia', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'D80', name: 'Defesa Grünfeld', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'A10', name: 'Abertura Inglesa', moves: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6'] },
  { eco: 'A04', name: 'Abertura Réti', moves: ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2'] },
];

/**
 * Identifies the most specific classical opening matching the game's move history.
 */
export function detectOpening(sanHistory: string[]): { eco: string; name: string } | null {
  if (sanHistory.length === 0) return null;

  let bestMatch: OpeningEntry | null = null;
  let bestLength = 0;

  for (const entry of OPENING_BOOK) {
    const compareLen = Math.min(sanHistory.length, entry.moves.length);
    if (compareLen < 2 && sanHistory.length >= 2) continue;

    let matches = true;
    for (let i = 0; i < compareLen; i++) {
      if (sanHistory[i] !== entry.moves[i]) {
        matches = false;
        break;
      }
    }

    // If all moves up to the current game length or entry length match
    if (matches && compareLen >= bestLength) {
      if (sanHistory.length <= entry.moves.length || compareLen >= 2) {
        bestMatch = entry;
        bestLength = compareLen;
      }
    }
  }

  // Fallback for single first move
  if (!bestMatch && sanHistory.length === 1) {
    const first = sanHistory[0];
    if (first === 'e4') return { eco: 'B00', name: 'Abertura do Peão do Rei (1.e4)' };
    if (first === 'd4') return { eco: 'A40', name: 'Abertura do Peão da Dama (1.d4)' };
    if (first === 'c4') return { eco: 'A10', name: 'Abertura Inglesa (1.c4)' };
    if (first === 'Nf3') return { eco: 'A04', name: 'Abertura Réti (1.Cf3)' };
  }

  return bestMatch ? { eco: bestMatch.eco, name: bestMatch.name } : null;
}

/**
 * Looks up a candidate book move for the current SAN move history.
 */
export function lookupOpeningBookMove(
  fen: string,
  sanHistory: string[]
): { from: Square; to: Square; promotion?: string; san: string; eco: string; openingName: string } | null {
  if (sanHistory.length > 10) return null;

  // The book is keyed by SAN move sequences from the STANDARD starting position.
  // Guard against positions loaded from FEN (puzzles, imports) whose history is empty/unrelated:
  // replay the history from the start and require the resulting board to match `fen`.
  try {
    const replay = new Chess();
    for (const san of sanHistory) replay.move(san);
    if (replay.fen().split(' ')[0] !== fen.split(' ')[0]) return null;
  } catch {
    return null;
  }

  const candidates: { nextSan: string; entry: OpeningEntry }[] = [];

  for (const entry of OPENING_BOOK) {
    if (entry.moves.length <= sanHistory.length) continue;

    let prefixMatches = true;
    for (let i = 0; i < sanHistory.length; i++) {
      if (entry.moves[i] !== sanHistory[i]) {
        prefixMatches = false;
        break;
      }
    }

    if (prefixMatches) {
      candidates.push({
        nextSan: entry.moves[sanHistory.length],
        entry,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Pick a random matching Grandmaster book continuation for variety
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });
  const matchingMove = legalMoves.find((m) => m.san === chosen.nextSan);

  if (!matchingMove) return null;

  return {
    from: matchingMove.from as Square,
    to: matchingMove.to as Square,
    promotion: matchingMove.promotion,
    san: matchingMove.san,
    eco: chosen.entry.eco,
    openingName: chosen.entry.name,
  };
}
