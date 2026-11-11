import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Lightformer,
  Sparkles,
} from '@react-three/drei';
import * as THREE from 'three';
import { Square } from 'chess.js';
import { useGameStore, CameraPreset } from '../../store/useGameStore';
import { Board3D } from './Board3D';
import { MagicParticles3D } from './MagicParticles3D';
import { getRusticTableWoodTexture } from '../../utils/proceduralTextures';
import { squareToWorld } from '../../utils/boardCoords';

const CameraRig: React.FC<{
  preset: CameraPreset;
  is2DMode: boolean;
  animationsEnabled: boolean;
  lastCaptureTime: number;
  isCheckmate: boolean;
}> = ({ preset, is2DMode, animationsEnabled, lastCaptureTime, isCheckmate }) => {
  const { camera, size } = useThree();
  const controls = useThree(
    (s) => s.controls as unknown as { target: THREE.Vector3; update: () => void } | null
  );
  const { chess, turn, viewingPly } = useGameStore();
  const targetVec = useRef(new THREE.Vector3(2.4, 7.2, 9.4));
  const lookAtVec = useRef(new THREE.Vector3(0, 0.15, 0));
  const transitioning = useRef(false);

  // Mobile Portrait Automatic Distance Multiplier so all 8 files (A-H) fit on narrow screens
  const aspect = size.width / Math.max(1, size.height);
  const portraitScale = aspect < 1 ? Math.min(1.85, 1 / Math.pow(aspect, 0.72)) : 1;
  const isTopDown = is2DMode || preset === 'top';

  // Top-down/2D: narrow FOV (near-orthographic, no trapezoid distortion) and default 36° otherwise
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = isTopDown ? 20 : 36;
    persp.updateProjectionMatrix();
  }, [isTopDown, camera]);

  useEffect(() => {
    transitioning.current = true;
    lookAtVec.current.set(0, 0.15, 0);

    if (isTopDown) {
      // Fit the 8x8 board + coordinate labels (≈11.2 units) with comfortable margin so coordinates are 100% visible
      const BOARD_EXTENT = 11.2;
      const MARGIN = 1.25; // room for top bar & bottom HUD
      const halfFov = THREE.MathUtils.degToRad(20) / 2;
      const distForHeight = BOARD_EXTENT / 2 / Math.tan(halfFov);
      const distForWidth = BOARD_EXTENT / 2 / (Math.tan(halfFov) * aspect);
      const dist = Math.max(distForHeight, distForWidth) * MARGIN;
      // Tiny +z keeps "up" stable for OrbitControls while looking straight down (White at bottom)
      targetVec.current.set(0, 0.15 + dist, 0.0001);
    } else if (preset === 'orbital') {
      targetVec.current.set(2.4 * portraitScale, 7.2 * portraitScale, 9.4 * portraitScale);
    } else if (preset === 'white') {
      targetVec.current.set(0, 6.9 * portraitScale, 9.8 * portraitScale);
    } else if (preset === 'black') {
      targetVec.current.set(0, 6.9 * portraitScale, -9.8 * portraitScale);
    }

    const snapToTarget = () => {
      camera.position.copy(targetVec.current);
      camera.lookAt(lookAtVec.current);
      if (controls) {
        controls.target.copy(lookAtVec.current);
        controls.update();
      }
      transitioning.current = false;
    };

    if (!animationsEnabled) {
      snapToTarget();
      return;
    }

    // At the end of the animation snap EXACTLY to the target so the 2D view is pixel-centered
    const timer = setTimeout(snapToTarget, 850);
    return () => clearTimeout(timer);
  }, [preset, isTopDown, aspect, portraitScale, animationsEnabled, camera, controls]);

  // Dramatic Slow-Motion Camera Zoom on Checkmate toward Defeated King (when 3D & animations enabled)
  useEffect(() => {
    if (!isCheckmate || viewingPly !== null || is2DMode || !animationsEnabled) return;
    const board = chess.board();
    let kingSq: Square | null = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = board[r][c];
        if (cell && cell.type === 'k' && cell.color === turn) {
          kingSq = cell.square as Square;
        }
      }
    }
    if (kingSq) {
      const [kx, , kz] = squareToWorld(kingSq, 0);
      transitioning.current = true;
      lookAtVec.current.set(kx, 0.55, kz);
      const zOffset = (turn === 'w' ? 4.4 : -4.4) * portraitScale;
      targetVec.current.set(kx + 2.2 * portraitScale, 3.8 * portraitScale, kz + zOffset);
      const timer = setTimeout(() => {
        transitioning.current = false;
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [isCheckmate, chess, turn, viewingPly, is2DMode, animationsEnabled, portraitScale]);

  useFrame((_, delta) => {
    // Subtle Camera Impact Shake on Capture (first 320ms)
    if (animationsEnabled && !is2DMode) {
      const sinceCapture = Date.now() - lastCaptureTime;
      if (sinceCapture >= 0 && sinceCapture < 320) {
        const decay = 1 - sinceCapture / 320;
        const intensity = 0.048 * decay * decay;
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
      }
    }

    if (!transitioning.current) return;
    const speed = isCheckmate ? Math.min(1, delta * 2.2) : Math.min(1, delta * 5.5);
    camera.position.lerp(targetVec.current, speed);
    camera.lookAt(lookAtVec.current);
  });

  return null;
};

/**
 * Dynamic Warm Medieval Candlelight Rig with Organic Flame Flicker
 */
const CandleLightRig: React.FC<{ accentColor: string; animationsEnabled: boolean }> = ({
  accentColor,
  animationsEnabled,
}) => {
  const leftLightRef = useRef<THREE.PointLight>(null);
  const rightLightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!animationsEnabled) return;
    const t = clock.elapsedTime;
    if (leftLightRef.current) {
      leftLightRef.current.intensity =
        1.15 + Math.sin(t * 7.3) * 0.08 + Math.cos(t * 13.1) * 0.05;
    }
    if (rightLightRef.current) {
      rightLightRef.current.intensity =
        1.05 + Math.cos(t * 6.7) * 0.08 + Math.sin(t * 11.9) * 0.05;
    }
  });

  return (
    <group>
      <pointLight
        ref={leftLightRef}
        position={[-7.5, 3.6, 4.5]}
        color="#ffedd5"
        intensity={1.15}
        distance={22}
        decay={2}
      />
      <pointLight
        ref={rightLightRef}
        position={[7.5, 3.6, -4.5]}
        color={accentColor}
        intensity={1.05}
        distance={22}
        decay={2}
      />
    </group>
  );
};

const StudioTable: React.FC<{ trimColor: string; highQuality: boolean }> = ({
  trimColor,
  highQuality,
}) => {
  const woodTex = useMemo(() => getRusticTableWoodTexture(), []);

  return (
    <group position={[0, -0.58, 0]}>
      {/* Luxury Dark Walnut Pedestal Table */}
      <mesh receiveShadow={highQuality} position={[0, -0.35, 0]}>
        <cylinderGeometry args={[17.5, 18.2, 0.7, highQuality ? 64 : 32]} />
        <meshPhysicalMaterial
          map={woodTex}
          bumpMap={highQuality ? woodTex : undefined}
          bumpScale={0.015}
          color="#261810"
          roughness={0.4}
          metalness={0.06}
          clearcoat={highQuality ? 0.38 : 0}
          clearcoatRoughness={0.28}
        />
      </mesh>
      {/* Inner & Outer Brushed Gold Table Inlays */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.4, 8.52, 64]} />
        <meshStandardMaterial color={trimColor} roughness={0.2} metalness={0.92} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[11.2, 11.28, 64]} />
        <meshStandardMaterial color={trimColor} roughness={0.25} metalness={0.88} />
      </mesh>
    </group>
  );
};

/**
 * Mirrors the entire studio lighting rig (lights + HDRI lightformers) 180° around the Y axis
 * depending on which side of the board the camera is on. The rig was tuned for the Black-side
 * view; without mirroring, the White-side camera stares straight into the specular reflections
 * of the back lights, blowing out the glossy marble board and table.
 */
const SideAwareLightingRig: React.FC<{ children: (side: 'black' | 'white') => React.ReactNode }> = ({
  children,
}) => {
  const { camera } = useThree();
  const [side, setSide] = React.useState<'black' | 'white'>(() =>
    camera.position.z > 0 ? 'white' : 'black'
  );
  const sideRef = useRef(side);

  useFrame(() => {
    const z = camera.position.z;
    // Hysteresis so the rig doesn't flicker when the camera is near the top-down position
    let next = sideRef.current;
    if (z > 0.6) next = 'white';
    else if (z < -0.6) next = 'black';
    if (next !== sideRef.current) {
      sideRef.current = next;
      setSide(next);
    }
  });

  return (
    <group rotation={[0, side === 'white' ? Math.PI : 0, 0]}>{children(side)}</group>
  );
};

export const Scene3D: React.FC = () => {
  const {
    cameraPreset,
    is2DMode,
    animationsEnabled,
    captureEffects,
    lastCaptureTime,
    isCheckmate,
    inCheck,
    draggingSquare,
    arenaTheme,
    highQuality,
  } = useGameStore();

  const studioPalette = {
    citadel: {
      bg: '#0b0a0e',
      fog: '#0b0a0e',
      keyLight: '#fff8eb',
      rimLight: '#fbbf24',
      sparkleColor: '#fde68a',
      trimColor: '#d4af37',
    },
    sanctuary: {
      bg: '#08100d',
      fog: '#08100d',
      keyLight: '#f8fafc',
      rimLight: '#34d399',
      sparkleColor: '#6ee7b7',
      trimColor: '#10b981',
    },
    inferno: {
      bg: '#120908',
      fog: '#120908',
      keyLight: '#fff1e0',
      rimLight: '#f97316',
      sparkleColor: '#fdba74',
      trimColor: '#ea580c',
    },
  }[arenaTheme];

  return (
    <div className="w-full h-full relative touch-none">
      <Canvas
        shadows={highQuality}
        dpr={highQuality ? [1, 2] : [1, 1.15]}
        camera={{ position: [2.4, 7.2, 9.4], fov: 36, near: 0.1, far: 90 }}
        gl={{
          antialias: highQuality,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.22,
        }}
      >
        <color attach="background" args={[studioPalette.bg]} />
        <fog attach="fog" args={[studioPalette.fog, 18, 42]} />

        <CameraRig
          preset={cameraPreset}
          is2DMode={is2DMode}
          animationsEnabled={animationsEnabled}
          lastCaptureTime={lastCaptureTime}
          isCheckmate={isCheckmate}
        />

        {/* SIDE-AWARE STUDIO LIGHTING: identical look from White's and Black's side */}
        <SideAwareLightingRig>
          {(side) => (
            <>
        {/* PROCEDURAL HDRI STUDIO ENVIRONMENT FOR REAL SPECULAR REFLECTIONS */}
        {/* Environment renders through a portal, so its lightformers are mirrored explicitly
            and the component is remounted (key) to re-bake the cube map when the side changes */}
        <Environment key={`env-${side}`} resolution={highQuality ? 256 : 128} frames={1}>
          <group rotation={[0, side === 'white' ? Math.PI : 0, 0]}>
          <group rotation={[-Math.PI / 4, -0.3, 0]}>
            <Lightformer
              intensity={2.9}
              rotation-x={Math.PI / 2}
              position={[0, 6, -1]}
              scale={[10, 6, 1]}
              color="#fff7e6"
            />
            <Lightformer
              intensity={2.3}
              rotation-y={Math.PI / 2}
              position={[-6, 3, 2]}
              scale={[8, 4, 1]}
              color="#ffedd5"
            />
            <Lightformer
              intensity={1.9}
              rotation-y={-Math.PI / 2}
              position={[6, 3, -2]}
              scale={[8, 4, 1]}
              color="#e2e8f0"
            />
            <Lightformer
              intensity={2.6}
              position={[0, 2, -7]}
              scale={[12, 2, 1]}
              color={studioPalette.rimLight}
            />
          </group>
          </group>
        </Environment>

        {/* Direct Shadow-Casting Studio Lights: balanced natural illumination */}
        <ambientLight intensity={is2DMode ? 0.62 : 0.42} color="#f8fafc" />
        <directionalLight
          position={[6, 12, 7]}
          intensity={is2DMode ? 2.1 : 1.9}
          color={studioPalette.keyLight}
          castShadow={highQuality && !is2DMode}
          shadow-mapSize-width={highQuality ? 2048 : 1024}
          shadow-mapSize-height={highQuality ? 2048 : 1024}
          shadow-bias={-0.0002}
          shadow-camera-far={30}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight
          position={[-7, 8, -8]}
          intensity={is2DMode ? 1.25 : 1.0}
          color={studioPalette.rimLight}
        />

        {/* Dynamic Flickering Candlelight Accents */}
        <CandleLightRig accentColor={studioPalette.rimLight} animationsEnabled={animationsEnabled} />
            </>
          )}
        </SideAwareLightingRig>

        {/* Atmospheric Floating Golden Dust Motes in 3D Space */}
        {highQuality && animationsEnabled && !is2DMode && (
          <Sparkles
            count={60}
            scale={[14, 4.5, 14]}
            position={[0, 2.0, 0]}
            size={1.6}
            speed={0.22}
            opacity={0.35}
            color={studioPalette.sparkleColor}
          />
        )}

        <StudioTable trimColor={studioPalette.trimColor} highQuality={highQuality} />
        <Suspense fallback={null}>
          <Board3D />
        </Suspense>
        {animationsEnabled && (
          <MagicParticles3D effects={captureEffects} themeColor={studioPalette.trimColor} />
        )}

        {highQuality && !is2DMode && (
          <ContactShadows
            position={[0, -0.55, 0]}
            opacity={0.8}
            scale={17}
            blur={1.6}
            far={3.2}
          />
        )}

        <OrbitControls
          makeDefault
          enabled={draggingSquare === null}
          enableRotate={!is2DMode}
          enablePan={false}
          enableDamping
          dampingFactor={0.07}
          minPolarAngle={is2DMode || cameraPreset === 'top' ? 0 : 0.15}
          maxPolarAngle={is2DMode ? 0.01 : Math.PI / 2 - 0.06}
          minDistance={5.5}
          maxDistance={28}
          target={[0, 0.15, 0]}
        />
      </Canvas>

      {/* Post-Processing Optical Bloom & Check Tension Vignette Overlay */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          background: is2DMode
            ? inCheck
              ? 'radial-gradient(circle at center, transparent 65%, rgba(185, 28, 28, 0.22) 100%)'
              : 'none'
            : inCheck
            ? 'radial-gradient(circle at center, transparent 52%, rgba(185, 28, 28, 0.28) 88%, rgba(15, 5, 5, 0.78) 100%)'
            : 'radial-gradient(circle at center, rgba(251, 191, 36, 0.03) 0%, transparent 58%, rgba(6, 5, 8, 0.68) 100%)',
        }}
      />
    </div>
  );
};
