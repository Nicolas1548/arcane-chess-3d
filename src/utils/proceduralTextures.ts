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

/**
 * Generates an ultra-crisp 512x512 2D Staunton Chess Piece Medallion texture for 2D Mode.
 * Uses vector Path2D silhouettes with high-contrast tournament styling (like Lichess / Chess.com).
 */
export function get2DPieceTexture(
  type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k',
  color: 'w' | 'b'
): THREE.CanvasTexture {
  const key = `piece_2d_staunton_v3_${type}_${color}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const size = 512;
  const cx = size / 2;
  const cy = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const isWhite = color === 'w';

  // 1. Soft Outer Drop Shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 224, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.filter = 'blur(10px)';
  ctx.fill();
  ctx.restore();

  // 2. Medallion Circular Disc Base
  const bgGrad = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 226);
  if (isWhite) {
    bgGrad.addColorStop(0, '#fffdf9');
    bgGrad.addColorStop(0.75, '#f5efe2');
    bgGrad.addColorStop(1, '#dfd3bd');
  } else {
    bgGrad.addColorStop(0, '#323642');
    bgGrad.addColorStop(0.7, '#1c1f28');
    bgGrad.addColorStop(1, '#0f1117');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 222, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Outer Border Ring
  ctx.lineWidth = 14;
  ctx.strokeStyle = isWhite ? '#443729' : '#d4af37';
  ctx.stroke();

  // Subtle Inner Accent Ring
  ctx.beginPath();
  ctx.arc(cx, cy, 198, 0, Math.PI * 2);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = isWhite ? 'rgba(180, 130, 50, 0.55)' : 'rgba(251, 191, 36, 0.35)';
  ctx.stroke();

  // 3. Draw Classic Staunton Vector Silhouette centered in the medallion
  ctx.save();
  // Transform from 45x45 SVG coordinate space into 512x512 canvas space
  const scale = 7.4;
  const offsetX = cx - (45 * scale) / 2;
  const offsetY = cy - (45 * scale) / 2 + 4;
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const pieceFill = isWhite ? '#ffffff' : '#181920';
  const pieceStroke = isWhite ? '#1c1917' : '#f8f3e8';
  const innerDetailStroke = isWhite ? '#1c1917' : '#fbbf24';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.fillStyle = pieceFill;
  ctx.strokeStyle = pieceStroke;

  const drawPath = (d: string, fill = true, stroke = true) => {
    const p = new Path2D(d);
    if (fill) ctx.fill(p);
    if (stroke) ctx.stroke(p);
  };

  if (type === 'p') {
    // Classic Staunton Pawn
    drawPath(
      'M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17.5,21 15.5,24 15.5,29 L 29.5,29 C 29.5,24 27.5,21 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z'
    );
    drawPath('M 12.5,37 L 32.5,37 C 32.5,33 29.5,30.5 22.5,30.5 C 15.5,30.5 12.5,33 12.5,37 z');
    ctx.strokeStyle = innerDetailStroke;
    drawPath('M 11,38.5 L 34,38.5', false, true);
  } else if (type === 'r') {
    // Classic Staunton Rook (Castle Battlements)
    drawPath(
      'M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14'
    );
    ctx.strokeStyle = innerDetailStroke;
    ctx.lineWidth = 1.6;
    drawPath('M 12,35.5 L 33,35.5 M 14,16.5 L 31,16.5', false, true);
  } else if (type === 'n') {
    // Classic Staunton Knight (Warhorse Profile)
    drawPath(
      'M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18'
    );
    drawPath(
      'M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10'
    );
    ctx.fillStyle = innerDetailStroke;
    ctx.beginPath();
    ctx.arc(15.2, 14.2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'b') {
    // Classic Staunton Bishop (Mitre + Cross Slit)
    drawPath(
      'M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.06 9,36 9,36 z'
    );
    drawPath(
      'M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z'
    );
    drawPath('M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z');
    ctx.strokeStyle = innerDetailStroke;
    ctx.lineWidth = 2.0;
    drawPath('M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18', false, true);
  } else if (type === 'q') {
    // Classic Staunton Queen (5-Pointed Royal Coronet)
    drawPath(
      'M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z'
    );
    drawPath(
      'M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z'
    );
    // Crown Pearls
    [
      [6, 12],
      [14, 9],
      [22.5, 8],
      [31, 9],
      [39, 12],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.strokeStyle = innerDetailStroke;
    ctx.lineWidth = 1.8;
    drawPath('M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5', false, true);
  } else if (type === 'k') {
    // Classic Staunton King (Imperial Cross + Sovereign Crown)
    drawPath('M 22.5,11.63 L 22.5,6 M 20,8 L 25,8', false, true);
    drawPath(
      'M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25'
    );
    drawPath(
      'M 11.5,37 C 17,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 11.5,29.5 11.5,29.5 L 11.5,37 z'
    );
    ctx.strokeStyle = innerDetailStroke;
    ctx.lineWidth = 1.8;
    drawPath(
      'M 11.5,30 C 17,27 27,27 32.5,30 M 11.5,33.5 C 17,30.5 27,30.5 32.5,33.5 M 11.5,37 C 17,34 27,34 32.5,37',
      false,
      true
    );
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}
