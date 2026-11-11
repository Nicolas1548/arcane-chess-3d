import React, { useMemo, useRef, useState } from 'react';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Chess, Square } from 'chess.js';
import { useGameStore } from '../../store/useGameStore';
import { rowColToSquare, SQUARE_SIZE, squareToWorld, worldToSquare } from '../../utils/boardCoords';
import { getCarvedSurfaceTexture } from '../../utils/proceduralTextures';
import { ChessPiece3D } from './ChessPiece3D';
import { CapturedGraveyard3D } from './CapturedGraveyard3D';

const GLTF_URL = '/models/ABeautifulGame/ABeautifulGame.gltf';
const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/**
 * Renders a 3D tactical arrow on the chessboard surface from `from` square to `to` square
 */
const TacticalArrow3D: React.FC<{ from: Square; to: Square; color?: string }> = ({
  from,
  to,
  color = '#f59e0b',
}) => {
  const { midX, midZ, angle, shaftLen, headX, headZ } = useMemo(() => {
    const [x1, , z1] = squareToWorld(from, 0);
    const [x2, , z2] = squareToWorld(to, 0);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    const dirX = dx / (dist || 1);
    const dirZ = dz / (dist || 1);
    const headLength = 0.38;
    const startOffset = 0.22;
    const sLen = Math.max(0.1, dist - headLength - startOffset);

    const sx = x1 + dirX * (startOffset + sLen / 2);
    const sz = z1 + dirZ * (startOffset + sLen / 2);
    const hx = x2 - dirX * (headLength * 0.45);
    const hz = z2 - dirZ * (headLength * 0.45);
    const ang = Math.atan2(dx, dz);

    return { midX: sx, midZ: sz, angle: ang, shaftLen: sLen, headX: hx, headZ: hz };
  }, [from, to]);

  return (
    <group position={[0, 0.145, 0]}>
      {/* Arrow Shaft */}
      <mesh position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.16, 0.028, shaftLen]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Arrow Head */}
      <mesh position={[headX, 0, headZ]} rotation={[Math.PI / 2, 0, -angle]}>
        <coneGeometry args={[0.28, 0.42, 3]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.65}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  );
};

export const Board3D: React.FC = () => {
  const {
    chess,
    fen,
    plySnapshots,
    viewingPly,
    selectedSquare,
    legalMoves,
    lastMove,
    hintMove,
    capturedWhite,
    capturedBlack,
    inCheck,
    isCheckmate,
    turn,
    arenaTheme,
    highQuality,
    draggingSquare,
    dragHoverSquare,
    tacticalArrows,
    tacticalHighlights,
    selectSquare,
    startDragPiece,
    setDragHoverSquare,
    endDragPiece,
    addOrToggleTacticalArrow,
  } = useGameStore();

  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const dragWorldPosRef = useRef<[number, number] | null>(null);
  const rightClickStartRef = useRef<Square | null>(null);

  const gltf = useGLTF(GLTF_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };

  const activeSnapshot = useMemo(() => {
    if (viewingPly !== null && plySnapshots[viewingPly]) {
      return plySnapshots[viewingPly];
    }
    return null;
  }, [viewingPly, plySnapshots]);

  const activeFen = activeSnapshot ? activeSnapshot.fen : fen;
  const activeLastMove = activeSnapshot ? activeSnapshot.lastMove : lastMove;
  const activeCapturedWhite = activeSnapshot ? activeSnapshot.capturedWhite : capturedWhite;
  const activeCapturedBlack = activeSnapshot ? activeSnapshot.capturedBlack : capturedBlack;

  const pieces = useMemo(() => {
    const boardInstance = activeSnapshot ? new Chess(activeFen) : chess;
    const board = boardInstance.board();
    const list: { square: Square; type: any; color: any }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell) {
          list.push({
            square: cell.square as Square,
            type: cell.type,
            color: cell.color,
          });
        }
      }
    }
    return list;
  }, [chess, activeFen, activeSnapshot]);

  const palette = useMemo(() => {
    if (arenaTheme === 'sanctuary') {
      return {
        frameWood: '#16211c',
        frameTrim: '#d4af37',
      };
    }
    if (arenaTheme === 'inferno') {
      return {
        frameWood: '#21100d',
        frameTrim: '#e5a93c',
      };
    }
    return {
      frameWood: '#1c130d',
      frameTrim: '#d4af37',
    };
  }, [arenaTheme]);

  const frameWoodTex = useMemo(
    () => getCarvedSurfaceTexture(palette.frameWood, '#0d0704', 'wood'),
    [palette]
  );

  const legalMap = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    if (viewingPly === null) {
      legalMoves.forEach((m) => map.set(m.to, m));
    }
    return map;
  }, [legalMoves, viewingPly]);

  // Scale factor 18.4 maps ABeautifulGame's 0.0625 square size to our SQUARE_SIZE = 1.15
  const BOARD_GLTF_SCALE = 18.4;

  return (
    <group
      onContextMenu={(e) => {
        e.nativeEvent.preventDefault();
      }}
    >
      {/* Luxury Beveled Mahogany/Ebony Outer Cabinet */}
      <mesh position={[0, -0.34, 0]} receiveShadow castShadow>
        <boxGeometry args={[14.7, 0.5, 11.2]} />
        <meshPhysicalMaterial
          map={frameWoodTex}
          bumpMap={frameWoodTex}
          bumpScale={0.012}
          color={palette.frameWood}
          roughness={0.32}
          metalness={0.08}
          clearcoat={highQuality ? 0.65 : 0}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* REAL SCULPTED KHRONOS GLTF CHESSBOARD WITH 2K PBR TEXTURES */}
      {gltf.nodes.Chessboard && (
        <mesh
          position={[0, -0.22, 0]}
          scale={[BOARD_GLTF_SCALE, BOARD_GLTF_SCALE, BOARD_GLTF_SCALE]}
          geometry={gltf.nodes.Chessboard.geometry}
          material={gltf.materials.Chessboard}
          receiveShadow
          castShadow
        />
      )}

      {/* 3D Captured Pieces Trophy Trays on Left & Right of Board */}
      <CapturedGraveyard3D
        capturedWhite={activeCapturedWhite}
        capturedBlack={activeCapturedBlack}
        highQuality={highQuality}
        frameTrimColor={palette.frameTrim}
        trayBaseColor={palette.frameWood}
      />

      {/* Precision Engraved Gold Algebraic Coordinates */}
      {FILES.map((fileLabel, c) => {
        const x = (c - 3.5) * SQUARE_SIZE;
        return (
          <React.Fragment key={`file-${fileLabel}`}>
            <Text
              position={[x, 0.125, 5.02]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.22}
              color="#e5c158"
              anchorX="center"
              anchorY="middle"
            >
              {fileLabel}
            </Text>
            <Text
              position={[x, 0.125, -5.02]}
              rotation={[-Math.PI / 2, 0, Math.PI]}
              fontSize={0.22}
              color="#e5c158"
              anchorX="center"
              anchorY="middle"
            >
              {fileLabel}
            </Text>
          </React.Fragment>
        );
      })}

      {RANKS.map((rankLabel, r) => {
        const z = (r - 3.5) * SQUARE_SIZE;
        return (
          <React.Fragment key={`rank-${rankLabel}`}>
            <Text
              position={[-5.02, 0.125, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.22}
              color="#e5c158"
              anchorX="center"
              anchorY="middle"
            >
              {rankLabel}
            </Text>
            <Text
              position={[5.02, 0.125, z]}
              rotation={[-Math.PI / 2, 0, Math.PI]}
              fontSize={0.22}
              color="#e5c158"
              anchorX="center"
              anchorY="middle"
            >
              {rankLabel}
            </Text>
          </React.Fragment>
        );
      })}

      {/* Interactive 3D Drag-and-Drop Raycast Plane (Active while dragging a piece) */}
      {draggingSquare && (
        <mesh
          position={[0, 0.14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={(e) => {
            e.stopPropagation();
            dragWorldPosRef.current = [e.point.x, e.point.z];
            const sq = worldToSquare(e.point.x, e.point.z);
            setDragHoverSquare(sq);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            const sq = worldToSquare(e.point.x, e.point.z);
            dragWorldPosRef.current = null;
            document.body.style.cursor = 'auto';
            endDragPiece(sq);
          }}
        >
          <planeGeometry args={[28, 28]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* 8x8 Interactive Square Sensor & Highlight Overlays */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 8 }).map((__, c) => {
          const square = rowColToSquare(r, c);
          const [wx, , wz] = squareToWorld(square, 0);

          const isSelected = viewingPly === null && selectedSquare === square;
          const isHovered =
            viewingPly === null && (hoveredSquare === square || dragHoverSquare === square);
          const legalInfo = legalMap.get(square);
          const isLastMove =
            activeLastMove?.from === square || activeLastMove?.to === square;
          const isHint =
            viewingPly === null && (hintMove?.from === square || hintMove?.to === square);
          const isTacticalHighlight = tacticalHighlights.includes(square);

          let highlightColor = '#000000';
          let highlightOpacity = 0;

          if (isSelected) {
            highlightColor = '#eab308';
            highlightOpacity = 0.34;
          } else if (isDragTarget(isHovered, legalInfo)) {
            highlightColor = '#fde047';
            highlightOpacity = 0.38;
          } else if (isHint) {
            highlightColor = '#10b981';
            highlightOpacity = 0.38;
          } else if (isLastMove) {
            highlightColor = '#f59e0b';
            highlightOpacity = 0.24;
          }

          return (
            <group key={square} position={[wx, 0.122, wz]}>
              {/* Square Sensor & Luminous Overlay */}
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  selectSquare(square);
                }}
                onPointerDown={(e) => {
                  if (e.button === 2) {
                    e.stopPropagation();
                    rightClickStartRef.current = square;
                  }
                }}
                onPointerUp={(e) => {
                  if (e.button === 2 && rightClickStartRef.current) {
                    e.stopPropagation();
                    addOrToggleTacticalArrow(rightClickStartRef.current, square);
                    rightClickStartRef.current = null;
                  } else if (e.button === 0 && draggingSquare) {
                    e.stopPropagation();
                    dragWorldPosRef.current = null;
                    endDragPiece(square);
                  }
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredSquare(square);
                  if (legalInfo) document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHoveredSquare(null);
                  document.body.style.cursor = 'auto';
                }}
              >
                <planeGeometry args={[SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96]} />
                <meshBasicMaterial
                  color={highlightColor}
                  transparent
                  opacity={highlightOpacity}
                  depthWrite={false}
                />
              </mesh>

              {/* Right-Click Tactical Square Ring */}
              {isTacticalHighlight && (
                <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.42, 0.51, 36]} />
                  <meshBasicMaterial color="#10b981" transparent opacity={0.88} />
                </mesh>
              )}

              {/* Polished Gold Marker for Legal Moves */}
              {legalInfo && !legalInfo.isCapture && (
                <group position={[0, 0.006, 0]}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.13, 0.19, 32]} />
                    <meshStandardMaterial
                      color="#eab308"
                      emissive="#ca8a04"
                      emissiveIntensity={0.45}
                      metalness={0.9}
                      roughness={0.15}
                    />
                  </mesh>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.075, 24]} />
                    <meshStandardMaterial
                      color="#fef08a"
                      emissive="#eab308"
                      emissiveIntensity={0.55}
                    />
                  </mesh>
                </group>
              )}

              {/* Crimson Target Ring for Legal Captures */}
              {legalInfo && legalInfo.isCapture && (
                <group position={[0, 0.006, 0]}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.42, 0.5, 36]} />
                    <meshStandardMaterial
                      color="#ef4444"
                      emissive="#dc2626"
                      emissiveIntensity={0.7}
                    />
                  </mesh>
                </group>
              )}
            </group>
          );
        })
      )}

      {/* 3D Tactical Arrows Drawn with Right-Click Drag */}
      {tacticalArrows.map((arrow, idx) => (
        <TacticalArrow3D key={`${arrow.from}-${arrow.to}-${idx}`} from={arrow.from} to={arrow.to} />
      ))}

      {/* 3D AI Hint Arrow */}
      {viewingPly === null && hintMove && (
        <TacticalArrow3D from={hintMove.from} to={hintMove.to} color="#10b981" />
      )}

      {/* 3D Sculpted Chess Pieces */}
      {pieces.map((p) => {
        const isKingInCheck = viewingPly === null && inCheck && p.type === 'k' && p.color === turn;
        const isKingCheckmated =
          viewingPly === null && isCheckmate && p.type === 'k' && p.color === turn;
        const isPieceDragging = viewingPly === null && draggingSquare === p.square;

        return (
          <ChessPiece3D
            key={`${p.square}-${p.type}-${p.color}`}
            square={p.square}
            type={p.type}
            color={p.color}
            isSelected={viewingPly === null && selectedSquare === p.square}
            isKingInCheck={isKingInCheck}
            isKingCheckmated={isKingCheckmated}
            isDragging={isPieceDragging}
            dragWorldPos={dragWorldPosRef}
            highQuality={highQuality}
            onSelect={selectSquare}
            onDragStart={(sq) => {
              const [wx, , wz] = squareToWorld(sq, 0);
              dragWorldPosRef.current = [wx, wz];
              startDragPiece(sq);
            }}
          />
        );
      })}
    </group>
  );
};

function isDragTarget(
  isHovered: boolean,
  legalInfo?: { isCapture: boolean; isPromotion: boolean }
): boolean {
  return Boolean(isHovered && legalInfo);
}
