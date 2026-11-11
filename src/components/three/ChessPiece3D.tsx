import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Color, PieceSymbol, Square } from 'chess.js';
import { squareToWorld } from '../../utils/boardCoords';

const GLTF_URL = '/models/ABeautifulGame/ABeautifulGame.gltf';
const PIECE_SCALE = 16.4;

export interface ChessPiece3DProps {
  square: Square;
  type: PieceSymbol;
  color: Color;
  isSelected: boolean;
  isKingInCheck: boolean;
  isKingCheckmated?: boolean;
  isDragging?: boolean;
  dragWorldPos?: React.MutableRefObject<[number, number] | null>;
  highQuality: boolean;
  onSelect: (square: Square) => void;
  onDragStart?: (square: Square) => void;
}

export const ChessPiece3D: React.FC<ChessPiece3DProps> = ({
  square,
  type,
  color,
  isSelected,
  isKingInCheck,
  isKingCheckmated = false,
  isDragging = false,
  dragWorldPos,
  onSelect,
  onDragStart,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const tiltGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const gltf = useGLTF(GLTF_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };

  const targetPos = useMemo(() => squareToWorld(square, 0.12), [square]);
  const initializedRef = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // If this piece is actively being dragged across the 3D board plane
    if (isDragging && dragWorldPos?.current) {
      const [dx, dz] = dragWorldPos.current;
      const dragSpeed = Math.min(1, delta * 24);
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, dx, dragSpeed);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, dz, dragSpeed);
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetPos[1] + 0.52,
        dragSpeed
      );
      if (tiltGroupRef.current) {
        const vx = (dx - groupRef.current.position.x) * 0.35;
        const vz = (dz - groupRef.current.position.z) * 0.35;
        tiltGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          tiltGroupRef.current.rotation.z,
          THREE.MathUtils.clamp(-vx, -0.25, 0.25),
          dragSpeed
        );
        tiltGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          tiltGroupRef.current.rotation.x,
          THREE.MathUtils.clamp(vz, -0.25, 0.25),
          dragSpeed
        );
      }
      return;
    }

    const hoverLift = hovered && !isSelected ? 0.06 : 0;
    const targetY = isSelected
      ? targetPos[1] + 0.32 + Math.sin(state.clock.elapsedTime * 4.5) * 0.04
      : targetPos[1] + hoverLift;

    if (!initializedRef.current) {
      groupRef.current.position.set(targetPos[0], targetY, targetPos[2]);
      initializedRef.current = true;
      return;
    }

    const speed = Math.min(1, delta * 12);
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetPos[0], speed);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetPos[2], speed);

    const distXZ = Math.hypot(
      groupRef.current.position.x - targetPos[0],
      groupRef.current.position.z - targetPos[2]
    );
    const arcBoost = distXZ > 0.05 ? Math.sin(Math.min(1, distXZ / 2.4) * Math.PI) * 0.55 : 0;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY + arcBoost,
      speed * 1.25
    );

    // Defeated King Slow-Motion Tip-Over Animation on Checkmate (or smooth return to upright)
    if (tiltGroupRef.current) {
      const targetTipZ = isKingCheckmated ? Math.PI / 2.25 : 0;
      const tipSpeed = isKingCheckmated ? Math.min(1, delta * 2.4) : Math.min(1, delta * 10);
      tiltGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        tiltGroupRef.current.rotation.z,
        targetTipZ,
        tipSpeed
      );
      tiltGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        tiltGroupRef.current.rotation.x,
        0,
        tipSpeed
      );
    }
  });

  const isWhite = color === 'w';
  // Raw Knight mesh in ABeautifulGame faces -Z (toward Black's rank 8), so White uses 0 and Black uses Math.PI
  const pieceRotationY = isWhite ? 0 : Math.PI;

  const { nodes, materials } = gltf;

  return (
    <group
      ref={groupRef}
      rotation={[0, pieceRotationY, 0]}
      onPointerDown={(e) => {
        if (e.button === 0 && onDragStart) {
          e.stopPropagation();
          onDragStart(square);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(square);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Selection / Hover / Check Base Halo Ring */}
      {(isSelected || isKingInCheck || hovered) && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.41, 0.49, 48]} />
          <meshBasicMaterial
            color={isKingInCheck ? '#ef4444' : isSelected ? '#fbbf24' : '#f59e0b'}
            transparent
            opacity={isKingInCheck || isSelected ? 0.92 : 0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Sculpted High-Poly glTF Mesh Group with Tilt & Scale */}
      <group ref={tiltGroupRef} scale={[PIECE_SCALE, PIECE_SCALE, PIECE_SCALE]}>
        {type === 'k' && (
          <mesh
            geometry={(isWhite ? nodes.King_W : nodes.King_B)?.geometry}
            material={isWhite ? materials.King_White : materials.King_Black}
            castShadow
            receiveShadow
          />
        )}

        {type === 'q' && (
          <mesh
            geometry={(isWhite ? nodes.Queen_W : nodes.Queen_B)?.geometry}
            material={isWhite ? materials.Queen_White : materials.Queen_Black}
            castShadow
            receiveShadow
          />
        )}

        {type === 'b' && (
          <mesh
            geometry={(isWhite ? nodes.Bishop_W1 : nodes.Bishop_B1)?.geometry}
            material={isWhite ? materials.Bishop_White : materials.Bishop_Black}
            castShadow
            receiveShadow
          />
        )}

        {type === 'n' && (
          <mesh
            geometry={(isWhite ? nodes.Knight_W1 : nodes.Knight_B1)?.geometry}
            material={isWhite ? materials.Knight_White : materials.Knight_Black}
            castShadow
            receiveShadow
          />
        )}

        {type === 'r' && (
          <mesh
            geometry={(isWhite ? nodes.Castle_W1 : nodes.Castle_B1)?.geometry}
            material={isWhite ? materials.Castle_White : materials.Castle_Black}
            castShadow
            receiveShadow
          />
        )}

        {type === 'p' && (
          <group>
            <mesh
              geometry={(isWhite ? nodes.Pawn_Body_W1 : nodes.Pawn_Body_B1)?.geometry}
              material={isWhite ? materials.Pawn_Body_White : materials.Pawn_Body_Black}
              castShadow
              receiveShadow
            />
            <mesh
              position={[-0.03125, 0, 0.03125]}
              geometry={(isWhite ? nodes.Pawn_Top_W1 : nodes.Pawn_Top_B1)?.geometry}
              material={isWhite ? materials.Pawn_Top_White : materials.Pawn_Top_Black}
              castShadow
              receiveShadow
            />
          </group>
        )}
      </group>
    </group>
  );
};

useGLTF.preload(GLTF_URL);
