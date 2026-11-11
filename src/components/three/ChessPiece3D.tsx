import React, { useRef, useMemo, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Color, PieceSymbol, Square } from 'chess.js';
import { squareToWorld } from '../../utils/boardCoords';
import { get2DPieceTexture } from '../../utils/proceduralTextures';

const GLTF_URL = '/models/ABeautifulGame/ABeautifulGame.gltf';
const PIECE_SCALE = 16.4;
const NOOP_RAYCAST = () => null;
const DEFAULT_MESH_RAYCAST = THREE.Mesh.prototype.raycast;

export interface ChessPiece3DProps {
  square: Square;
  type: PieceSymbol;
  color: Color;
  isSelected: boolean;
  isKingInCheck: boolean;
  isKingCheckmated?: boolean;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  isLegalCaptureTarget?: boolean;
  animationsEnabled?: boolean;
  is2DMode?: boolean;
  interactive?: boolean;
  dragWorldPos?: React.MutableRefObject<[number, number] | null>;
  highQuality: boolean;
  onSelect: (square: Square) => void;
  onDragStart?: (square: Square, e: ThreeEvent<PointerEvent>) => void;
}

export const ChessPiece3D: React.FC<ChessPiece3DProps> = ({
  square,
  type,
  color,
  isSelected,
  isKingInCheck,
  isKingCheckmated = false,
  isDragging = false,
  isAnyDragging = false,
  isLegalCaptureTarget = false,
  animationsEnabled = true,
  is2DMode = false,
  interactive = true,
  dragWorldPos,
  highQuality,
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
  const piece2DTex = useMemo(
    () => (is2DMode && interactive ? get2DPieceTexture(type, color) : null),
    [is2DMode, interactive, type, color]
  );
  const initializedRef = useRef(false);

  useFrame((state, delta) => {
    if (!interactive || !groupRef.current) return;

    // 1. Active 3D / 2D Dragging across the board plane
    if (isDragging && dragWorldPos?.current) {
      const [dx, dz] = dragWorldPos.current;
      if (is2DMode) {
        groupRef.current.position.set(dx, targetPos[1] + 0.05, dz);
        return;
      }
      if (!animationsEnabled) {
        groupRef.current.position.set(dx, targetPos[1] + 0.35, dz);
        return;
      }
      const dragSpeed = Math.min(1, delta * 26);
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

    // 2. Instantaneous snap when animations are disabled
    if (!animationsEnabled) {
      const snapY = is2DMode
        ? targetPos[1] + (isSelected ? 0.03 : 0.01)
        : isSelected
        ? targetPos[1] + 0.08
        : targetPos[1];
      groupRef.current.position.set(targetPos[0], snapY, targetPos[2]);
      if (tiltGroupRef.current) {
        tiltGroupRef.current.rotation.set(0, 0, isKingCheckmated && !is2DMode ? Math.PI / 2.25 : 0);
      }
      initializedRef.current = true;
      return;
    }

    // 3. Smooth Animated Interpolation & Parabolic Arc
    const hoverLift = !is2DMode && hovered && !isSelected ? 0.04 : 0;
    const targetY = is2DMode
      ? targetPos[1] + (isSelected ? 0.03 : 0.01)
      : isSelected
      ? targetPos[1] + 0.1 + Math.sin(state.clock.elapsedTime * 4.5) * 0.02
      : targetPos[1] + hoverLift;

    if (!initializedRef.current) {
      groupRef.current.position.set(targetPos[0], targetY, targetPos[2]);
      initializedRef.current = true;
      return;
    }

    const speed = Math.min(1, delta * 13);
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetPos[0],
      speed
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      targetPos[2],
      speed
    );

    const distXZ = Math.hypot(
      groupRef.current.position.x - targetPos[0],
      groupRef.current.position.z - targetPos[2]
    );
    const arcBoost =
      !is2DMode && distXZ > 0.05 ? Math.sin(Math.min(1, distXZ / 2.4) * Math.PI) * 0.55 : 0;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY + arcBoost,
      speed * 1.25
    );

    if (tiltGroupRef.current) {
      const targetTipZ = isKingCheckmated && !is2DMode ? Math.PI / 2.25 : 0;
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
  const pieceRotationY = isWhite ? 0 : Math.PI;
  const { nodes, materials } = gltf;

  // Disable raycasting on piece meshes when ANY piece is being dragged (so the y=0.18 drag plane gets 100% of events)
  // or when rendered as a non-interactive trophy piece in CapturedGraveyard3D.
  // IMPORTANT: Always restore DEFAULT_MESH_RAYCAST (never pass undefined) so Three.js mesh.raycast stays a function!
  const customRaycast = !interactive || isAnyDragging ? NOOP_RAYCAST : DEFAULT_MESH_RAYCAST;

  return (
    <group
      ref={groupRef}
      position={!interactive ? targetPos : undefined}
      rotation={[0, is2DMode ? 0 : pieceRotationY, 0]}
      onPointerDown={
        interactive
          ? (e) => {
              // Support both left-mouse (button 0) and touch contact
              if (e.button === 0 || e.pointerType === 'touch') {
                e.stopPropagation();
                if (isLegalCaptureTarget) {
                  onSelect(square);
                } else if (onDragStart) {
                  onDragStart(square, e);
                } else {
                  onSelect(square);
                }
              }
            }
          : undefined
      }
      onPointerOver={
        interactive
          ? (e) => {
              if (isAnyDragging) return;
              e.stopPropagation();
              setHovered(true);
              document.body.style.cursor = isLegalCaptureTarget ? 'pointer' : 'grab';
            }
          : undefined
      }
      onPointerOut={
        interactive
          ? () => {
              setHovered(false);
              document.body.style.cursor = 'auto';
            }
          : undefined
      }
    >
      {/* Selection / Hover / Check Base Halo Ring */}
      {interactive && (isSelected || isKingInCheck || hovered) && (
        <mesh
          position={[0, is2DMode ? 0.032 : 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={NOOP_RAYCAST}
        >
          <ringGeometry args={is2DMode ? [0.45, 0.53, 48] : [0.41, 0.49, 48]} />
          <meshBasicMaterial
            color={isKingInCheck ? '#ef4444' : isSelected ? '#fbbf24' : '#f59e0b'}
            transparent
            opacity={isKingInCheck || isSelected ? 0.95 : 0.48}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 2D TOP-DOWN MODE HIGH-LEGIBILITY STAUNTON MEDALLION */}
      {is2DMode && interactive && piece2DTex ? (
        <mesh
          position={[0, 0.025, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={customRaycast}
        >
          <circleGeometry args={[0.48, 48]} />
          <meshBasicMaterial
            map={piece2DTex}
            transparent
            alphaTest={0.05}
            toneMapped={false}
          />
        </mesh>
      ) : (
        /* 3D SCULPTED KHRONOS GLTF MESHES */
        <group ref={tiltGroupRef} scale={[PIECE_SCALE, PIECE_SCALE, PIECE_SCALE]}>
          {type === 'k' && (
            <mesh
              geometry={(isWhite ? nodes.King_W : nodes.King_B)?.geometry}
              material={isWhite ? materials.King_White : materials.King_Black}
              castShadow={highQuality}
              receiveShadow={highQuality}
              raycast={customRaycast}
            />
          )}

          {type === 'q' && (
            <mesh
              geometry={(isWhite ? nodes.Queen_W : nodes.Queen_B)?.geometry}
              material={isWhite ? materials.Queen_White : materials.Queen_Black}
              castShadow={highQuality}
              receiveShadow={highQuality}
              raycast={customRaycast}
            />
          )}

          {type === 'b' && (
            <mesh
              geometry={(isWhite ? nodes.Bishop_W1 : nodes.Bishop_B1)?.geometry}
              material={isWhite ? materials.Bishop_White : materials.Bishop_Black}
              castShadow={highQuality}
              receiveShadow={highQuality}
              raycast={customRaycast}
            />
          )}

          {type === 'n' && (
            <mesh
              geometry={(isWhite ? nodes.Knight_W1 : nodes.Knight_B1)?.geometry}
              material={isWhite ? materials.Knight_White : materials.Knight_Black}
              castShadow={highQuality}
              receiveShadow={highQuality}
              raycast={customRaycast}
            />
          )}

          {type === 'r' && (
            <mesh
              geometry={(isWhite ? nodes.Castle_W1 : nodes.Castle_B1)?.geometry}
              material={isWhite ? materials.Castle_White : materials.Castle_Black}
              castShadow={highQuality}
              receiveShadow={highQuality}
              raycast={customRaycast}
            />
          )}

          {type === 'p' && (
            <group>
              <mesh
                geometry={(isWhite ? nodes.Pawn_Body_W1 : nodes.Pawn_Body_B1)?.geometry}
                material={isWhite ? materials.Pawn_Body_White : materials.Pawn_Body_Black}
                castShadow={highQuality}
                receiveShadow={highQuality}
                raycast={customRaycast}
              />
              <mesh
                position={[-0.03125, 0, 0.03125]}
                geometry={(isWhite ? nodes.Pawn_Top_W1 : nodes.Pawn_Top_B1)?.geometry}
                material={isWhite ? materials.Pawn_Top_White : materials.Pawn_Top_Black}
                castShadow={highQuality}
                receiveShadow={highQuality}
                raycast={customRaycast}
              />
            </group>
          )}
        </group>
      )}
    </group>
  );
};

useGLTF.preload(GLTF_URL);
