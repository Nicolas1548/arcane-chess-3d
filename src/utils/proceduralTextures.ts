import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Generates a realistic aged limestone / travertine stone texture (like the white pieces in the reference photo)
 * with natural pores, subtle weathered patina, and bump map detail.
 */
export function getCarvedSurfaceTexture(
  baseHex: string,
  veinHex: string,
  style: 'marble' | 'obsidian' | 'wood' = 'marble'
): THREE.CanvasTexture {
  const key = `v2_${baseHex}_${veinHex}_${style}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (style === 'wood') {
    // Rich rustic walnut/oak wood grain fibers
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = veinHex;
      ctx.globalAlpha = 0.04 + Math.sin(y * 0.08) * 0.03 + Math.random() * 0.04;
      ctx.fillRect(0, y, size, 2);
    }

    // Organic wood grain rings & streaks
    ctx.strokeStyle = veinHex;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.globalAlpha = 0.06 + Math.random() * 0.09;
      let x = Math.random() * size;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= size; y += 32) {
        x += Math.sin(y * 0.02 + i) * 6 + (Math.random() - 0.5) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    // Soft clouds / antique patina shading
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 20 + Math.random() * 70;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, veinHex);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.035;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine stone pores and weathered pits (matching the carved limestone look)
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.5 + Math.random() * 1.8;
      ctx.fillStyle = veinHex;
      ctx.globalAlpha = 0.04 + Math.random() * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle natural hairline veins
    ctx.strokeStyle = veinHex;
    for (let v = 0; v < 12; v++) {
      ctx.beginPath();
      ctx.lineWidth = 0.6 + Math.random() * 1.4;
      ctx.globalAlpha = 0.07 + Math.random() * 0.08;
      let x = Math.random() * size;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 1; s <= 16; s++) {
        y = (s / 16) * size;
        x += (Math.random() - 0.5) * 28;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Subtle recessed bevel around tile edges
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = veinHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a wide rustic wooden table texture with horizontal plank seams like the reference photo.
 */
export function getRusticTableWoodTexture(): THREE.CanvasTexture {
  const key = 'rustic_table_wood_v2';
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2d1d12';
  ctx.fillRect(0, 0, size, size);

  // Wood fibers
  for (let i = 0; i < 320; i++) {
    const y = Math.random() * size;
    ctx.fillStyle = i % 2 === 0 ? '#1e120a' : '#3d281a';
    ctx.globalAlpha = 0.12 + Math.random() * 0.15;
    ctx.fillRect(0, y, size, 1 + Math.random() * 3);
  }

  // Plank grooves
  [128, 256, 384].forEach((py) => {
    ctx.fillStyle = '#0f0905';
    ctx.globalAlpha = 0.65;
    ctx.fillRect(0, py, size, 3);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}
