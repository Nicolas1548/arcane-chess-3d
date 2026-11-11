import React, { useMemo } from 'react';
import { PieceSymbol, Color, Square } from 'chess.js';
import { ChessPiece3D } from './ChessPiece3D';

interface CapturedGraveyard3DProps {
  capturedWhite: PieceSymbol[]; // White pieces captured by Black
  capturedBlack: PieceSymbol[]; // Black pieces captured by White
  highQuality: boolean;
  frameTrimColor: string;
  trayBaseColor: string;
}

const PIECE_ORDER: Record<PieceSymbol, number> = {
  q: 1,
  r: 2,
  b: 3,
  n: 4,
  p: 5,
  k: 0,
};

export const CapturedGraveyard3D: React.FC<CapturedGraveyard3DProps> = ({
  capturedWhite,
  capturedBlack,
  highQuality,
  frameTrimColor,
  trayBaseColor,
}) => {
  const sortedWhite = useMemo(
    () => [...capturedWhite].sort((a, b) => PIECE_ORDER[a] - PIECE_ORDER[b]),
    [capturedWhite]
  );

  const sortedBlack = useMemo(
    () => [...capturedBlack].sort((a, b) => PIECE_ORDER[a] - PIECE_ORDER[b]),
    [capturedBlack]
  );

  return (
    <group>
      {/* LEFT SANCTUM TROPHY TRAY (Captured White Pieces) */}
      <group position={[-6.45, -0.18, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[1.65, 0.24, 8.6]} />
          <meshStandardMaterial color={trayBaseColor} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[1.45, 0.1, 8.4]} />
          <meshStandardMaterial color={frameTrimColor} roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[1.32, 0.05, 8.25]} />
          <meshStandardMaterial color="#0f141d" roughness={0.5} metalness={0.2} />
        </mesh>
      </group>

      {/* RIGHT SANCTUM TROPHY TRAY (Captured Black Pieces) */}
      <group position={[6.45, -0.18, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[1.65, 0.24, 8.6]} />
          <meshStandardMaterial color={trayBaseColor} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[1.45, 0.1, 8.4]} />
          <meshStandardMaterial color={frameTrimColor} roughness={0.28} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[1.32, 0.05, 8.25]} />
          <meshStandardMaterial color="#0f141d" roughness={0.5} metalness={0.2} />
        </mesh>
      </group>

      {/* Rendered Captured White Pieces on Left Tray */}
      {sortedWhite.slice(0, 16).map((type, idx) => {
        const col = Math.floor(idx / 8);
        const row = idx % 8;
        // Since ChessPiece3D places 'a1' at [-4.025, 0.12, 4.025], we offset its parent group
        const worldTargetX = -6.18 - col * 0.54;
        const worldTargetZ = (row - 3.5) * 1.02;
        const a1X = -3.5 * 1.15;
        const a1Z = 3.5 * 1.15;

        return (
          <group
            key={`cap-w-${idx}-${type}`}
            position={[worldTargetX - a1X * 0.65, -0.12, worldTargetZ - a1Z * 0.65]}
            scale={[0.65, 0.65, 0.65]}
          >
            <ChessPiece3D
              square={'a1' as Square}
              type={type}
              color="w"
              isSelected={false}
              isKingInCheck={false}
              interactive={false}
              highQuality={highQuality}
              onSelect={() => {}}
            />
          </group>
        );
      })}

      {/* Rendered Captured Black Pieces on Right Tray */}
      {sortedBlack.slice(0, 16).map((type, idx) => {
        const col = Math.floor(idx / 8);
        const row = idx % 8;
        const worldTargetX = 6.18 + col * 0.54;
        const worldTargetZ = (row - 3.5) * 1.02;
        const a1X = -3.5 * 1.15;
        const a1Z = 3.5 * 1.15;

        return (
          <group
            key={`cap-b-${idx}-${type}`}
            position={[worldTargetX - a1X * 0.65, -0.12, worldTargetZ - a1Z * 0.65]}
            scale={[0.65, 0.65, 0.65]}
          >
            <ChessPiece3D
              square={'a1' as Square}
              type={type}
              color="b"
              isSelected={false}
              isKingInCheck={false}
              interactive={false}
              highQuality={highQuality}
              onSelect={() => {}}
            />
          </group>
        );
      })}
    </group>
  );
};
