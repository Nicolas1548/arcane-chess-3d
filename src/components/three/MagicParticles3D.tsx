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
  const pos = useMemo(() => squareToWorld(effect.square, 0.14), [effect.square]);

  // 26 3D Shattered Piece Shards (spawned across the vertical height of the captured piece)
  const shards = useMemo(() => {
    return Array.from({ length: 26 }, (_, i) => {
      const angle = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radialSpeed = 1.1 + Math.random() * 2.4;
      const startY = 0.08 + Math.random() * 1.15;
      return {
        startX: (Math.random() - 0.5) * 0.25,
        startY,
        startZ: (Math.random() - 0.5) * 0.25,
        vx: Math.cos(angle) * radialSpeed,
        vy: 1.4 + Math.random() * 2.4,
        vz: Math.sin(angle) * radialSpeed,
        rx: (Math.random() - 0.5) * 14,
        ry: (Math.random() - 0.5) * 14,
        rz: (Math.random() - 0.5) * 14,
        scaleX: 0.05 + Math.random() * 0.07,
        scaleY: 0.06 + Math.random() * 0.11,
        scaleZ: 0.04 + Math.random() * 0.07,
        isGoldTrim: i % 5 === 0,
      };
    });
  }, []);

  const startTime = useRef<number | null>(null);

  useFrame((state) => {
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - startTime.current;
    const duration = 1.35;

    if (elapsed > duration) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const progress = elapsed / duration;

    if (ringRef.current) {
      const ringScale = 0.25 + progress * 2.4;
      ringRef.current.scale.set(ringScale, ringScale, 1);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1 - progress * 1.25));
    }

    if (groupRef.current) {
      groupRef.current.children.forEach((child, idx) => {
        if (idx === 0) return;
        const s = shards[idx - 1];
        if (!s) return;

        const gravity = 9.2;
        let y = s.startY + s.vy * elapsed - 0.5 * gravity * elapsed * elapsed;
        // Bounce once off the board surface (y = 0.02)
        if (y < 0.02) {
          y = 0.02 + Math.abs(y - 0.02) * 0.35;
        }

        child.position.set(
          s.startX + s.vx * elapsed,
          y,
          s.startZ + s.vz * elapsed
        );
        child.rotation.set(s.rx * elapsed, s.ry * elapsed, s.rz * elapsed);

        const fade = progress < 0.7 ? 1 : Math.max(0.001, (1 - progress) / 0.3);
        child.scale.set(s.scaleX * fade, s.scaleY * fade, s.scaleZ * fade);
      });
    }
  });

  const isWhitePiece = effect.color === 'w';
  const primaryShardColor = isWhitePiece ? '#e8dfd1' : '#262936';
  const accentShardColor = '#d4af37';

  return (
    <group ref={groupRef} position={pos}>
      {/* Golden Impact Shockwave Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.33, 36]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D Tumbling Carved Stone/Metal Shards */}
      {shards.map((s, idx) => (
        <mesh key={idx} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={s.isGoldTrim ? accentShardColor : primaryShardColor}
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
