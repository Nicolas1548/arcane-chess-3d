import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CaptureEffect } from '../../store/useGameStore';
import { squareToWorld } from '../../utils/boardCoords';

interface CaptureBurstProps {
  effect: CaptureEffect;
}

const SingleCaptureBurst: React.FC<CaptureBurstProps> = ({ effect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const secondaryRingRef = useRef<THREE.Mesh>(null);
  const verticalSlashRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => squareToWorld(effect.square, 0.14), [effect.square]);

  // 32 3D Shattered Piece Shards with dynamic explosion velocities
  const shards = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radialSpeed = 1.3 + Math.random() * 2.8;
      const startY = 0.08 + Math.random() * 1.25;
      return {
        startX: (Math.random() - 0.5) * 0.28,
        startY,
        startZ: (Math.random() - 0.5) * 0.28,
        vx: Math.cos(angle) * radialSpeed,
        vy: 1.8 + Math.random() * 2.6,
        vz: Math.sin(angle) * radialSpeed,
        rx: (Math.random() - 0.5) * 16,
        ry: (Math.random() - 0.5) * 16,
        rz: (Math.random() - 0.5) * 16,
        scaleX: 0.05 + Math.random() * 0.08,
        scaleY: 0.06 + Math.random() * 0.12,
        scaleZ: 0.04 + Math.random() * 0.08,
        isGoldTrim: i % 4 === 0,
        isEmber: i % 7 === 0,
      };
    });
  }, []);

  const startTime = useRef<number | null>(null);

  useFrame((state) => {
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - startTime.current;
    const duration = 1.45;

    if (elapsed > duration) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const progress = elapsed / duration;

    // Primary Shockwave Ring
    if (ringRef.current) {
      const ringScale = 0.25 + progress * 2.8;
      ringRef.current.scale.set(ringScale, ringScale, 1);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 * (1 - progress * 1.3));
    }

    // Secondary Outer Radiant Halo Ring
    if (secondaryRingRef.current) {
      const ringScale2 = 0.1 + progress * 3.4;
      secondaryRingRef.current.scale.set(ringScale2, ringScale2, 1);
      const mat = secondaryRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 * (1 - progress * 1.1));
    }

    // Vertical Arc Slash Flare (lasts first 350ms of strike)
    if (verticalSlashRef.current) {
      if (elapsed < 0.35) {
        verticalSlashRef.current.visible = true;
        const slashP = elapsed / 0.35;
        verticalSlashRef.current.scale.set(1 + slashP * 1.2, 1 + slashP * 2.4, 1);
        verticalSlashRef.current.position.y = 0.5 + slashP * 0.4;
        const mat = verticalSlashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - slashP) * 0.95;
      } else {
        verticalSlashRef.current.visible = false;
      }
    }

    if (groupRef.current) {
      // Offset by 3 to skip the 2 rings and the vertical slash
      groupRef.current.children.forEach((child, idx) => {
        if (idx < 3) return;
        const s = shards[idx - 3];
        if (!s) return;

        const gravity = 8.8;
        let y = s.startY + s.vy * elapsed - 0.5 * gravity * elapsed * elapsed;
        if (y < 0.02) {
          y = 0.02 + Math.abs(y - 0.02) * 0.35;
        }

        child.position.set(
          s.startX + s.vx * elapsed,
          y,
          s.startZ + s.vz * elapsed
        );
        child.rotation.set(s.rx * elapsed, s.ry * elapsed, s.rz * elapsed);

        const fade = progress < 0.65 ? 1 : Math.max(0.001, (1 - progress) / 0.35);
        child.scale.set(s.scaleX * fade, s.scaleY * fade, s.scaleZ * fade);
      });
    }
  });

  const isWhitePiece = effect.color === 'w';
  const primaryShardColor = isWhitePiece ? '#f2ece1' : '#1e2029';
  const accentShardColor = '#f59e0b';
  const emberShardColor = '#ef4444';

  return (
    <group ref={groupRef} position={pos}>
      {/* Golden Primary Shockwave Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.35, 48]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Amber Outer Radiant Ripple */}
      <mesh ref={secondaryRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.44, 48]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical Combat Blade Slash Flare */}
      <mesh ref={verticalSlashRef} position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[0.09, 1.4]} />
        <meshBasicMaterial color="#fef08a" transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D Tumbling Carved Stone/Metal Shards */}
      {shards.map((s, idx) => (
        <mesh key={idx} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={s.isEmber ? emberShardColor : s.isGoldTrim ? accentShardColor : primaryShardColor}
            emissive={s.isEmber ? '#b91c1c' : s.isGoldTrim ? '#d97706' : '#000000'}
            emissiveIntensity={s.isEmber ? 0.85 : s.isGoldTrim ? 0.45 : 0}
            roughness={s.isGoldTrim ? 0.2 : 0.35}
            metalness={s.isGoldTrim ? 0.9 : isWhitePiece ? 0.1 : 0.45}
          />
        </mesh>
      ))}
    </group>
  );
};

export const MagicParticles3D: React.FC<{ effects: CaptureEffect[]; themeColor: string }> = ({
  effects,
}) => {
  return (
    <group>
      {effects.map((fx) => (
        <SingleCaptureBurst key={fx.id} effect={fx} />
      ))}
    </group>
  );
};
