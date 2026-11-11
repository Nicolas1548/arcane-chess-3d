import { Square } from 'chess.js';

export const SQUARE_SIZE = 1.15;

/**
 * Converts algebraic square (e.g., "e4") to 3D world coordinates [x, y, z]
 * White is at +Z (rank 1 -> row 7), Black is at -Z (rank 8 -> row 0)
 */
export function squareToWorld(square: Square, yOffset = 0): [number, number, number] {
  const file = square.charCodeAt(0) - 97; // 'a' -> 0 .. 'h' -> 7
  const rank = parseInt(square[1], 10); // '1' -> 1 .. '8' -> 8
  const row = 8 - rank; // rank 8 -> 0, rank 1 -> 7

  const x = (file - 3.5) * SQUARE_SIZE;
  const z = (row - 3.5) * SQUARE_SIZE;
  return [x, yOffset, z];
}

export function rowColToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = 8 - row;
  return `${file}${rank}` as Square;
}

/**
 * Converts 3D world [x, z] coordinates on the board plane to an algebraic Square, or null if out of bounds.
 */
export function worldToSquare(x: number, z: number): Square | null {
  const col = Math.round(x / SQUARE_SIZE + 3.5);
  const row = Math.round(z / SQUARE_SIZE + 3.5);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return rowColToSquare(row, col);
}
