import Phaser from 'phaser';
import { LETTER } from '../config';
import { canvasTexture, css, roundRectPath, shade, mix, seededRandom } from './draw';
import { GLASS, SCENE } from './palette';

export type TileStyle = 'normal' | 'fire' | 'super';

const TILE_COLORS: Record<TileStyle, { base: number; top: number; edge: number }> = {
  normal: { base: 0x3b4f8f, top: 0x5a70b8, edge: 0x232f5a },
  fire: { base: 0xff8a1f, top: 0xffbb55, edge: 0xc2520a },
  super: { base: 0xffc93a, top: 0xfff0a6, edge: 0xc99000 },
};

/** Letter color that reads well on each tile style. */
export const TILE_TEXT_COLOR: Record<TileStyle, string> = {
  normal: '#FFFFFF',
  fire: '#FFF8E1',
  super: '#6B3F00',
};

export function tileTextureKey(style: TileStyle): string {
  return `tile-${style}`;
}

export const CLOUD_KEYS = ['cloud-0', 'cloud-1', 'cloud-2'];

/** Generate the shared textures. Called once from BootScene. */
export function createSharedTextures(scene: Phaser.Scene): void {
  // Confetti: small rectangle
  canvasTexture(scene, 'particle', 8, 5, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 8, 5);
  });

  // Soft round dot (trails, sparkles)
  canvasTexture(scene, 'dot', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // Dust puff: lumpy soft blob
  canvasTexture(scene, 'puff', 40, 40, (ctx) => {
    const rand = seededRandom(7);
    for (let i = 0; i < 5; i++) {
      const cx = 20 + (rand() - 0.5) * 12;
      const cy = 20 + (rand() - 0.5) * 12;
      const r = 9 + rand() * 6;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Four-point sparkle for super shots
  canvasTexture(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.quadraticCurveTo(9, 7, 16, 8);
    ctx.quadraticCurveTo(9, 9, 8, 16);
    ctx.quadraticCurveTo(7, 9, 0, 8);
    ctx.quadraticCurveTo(7, 7, 8, 0);
    ctx.fill();
  });

  for (const style of Object.keys(TILE_COLORS) as TileStyle[]) {
    createLetterTile(scene, style);
  }

  CLOUD_KEYS.forEach((key, i) => createCloud(scene, key, 101 + i * 37));
}

/** Chunky rounded letter tile, like a toy alphabet block. */
function createLetterTile(scene: Phaser.Scene, style: TileStyle): void {
  const { base, top, edge } = TILE_COLORS[style];
  const w = LETTER.width;
  const h = LETTER.height;
  const lip = 5;

  canvasTexture(scene, tileTextureKey(style), w, h, (ctx) => {
    // Bottom lip (gives the tile thickness)
    roundRectPath(ctx, 0, 0, w, h, 8);
    ctx.fillStyle = css(edge);
    ctx.fill();

    // Face with vertical gradient
    roundRectPath(ctx, 0, 0, w, h - lip, 8);
    const g = ctx.createLinearGradient(0, 0, 0, h - lip);
    g.addColorStop(0, css(top));
    g.addColorStop(1, css(base));
    ctx.fillStyle = g;
    ctx.fill();

    // Inner border
    roundRectPath(ctx, 3, 3, w - 6, h - lip - 6, 6);
    ctx.strokeStyle = css(0xffffff, 0.28);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Gloss highlight
    ctx.fillStyle = css(0xffffff, 0.22);
    ctx.beginPath();
    ctx.ellipse(w * 0.38, 8, w * 0.28, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'super') {
      ctx.fillStyle = css(0xffffff, 0.9);
      sparkle(ctx, w - 8, 9, 4);
      sparkle(ctx, 7, h - lip - 9, 3);
    }
  });
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.3, y - r * 0.3);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.3, y + r * 0.3);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.3, y + r * 0.3);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.3, y - r * 0.3);
  ctx.closePath();
  ctx.fill();
}

/** Puffy cartoon cloud with a shaded underside. */
function createCloud(scene: Phaser.Scene, key: string, seed: number): void {
  const w = 220;
  const h = 90;
  const rand = seededRandom(seed);
  const puffs: { x: number; y: number; r: number }[] = [];
  const count = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const r = 18 + rand() * 16 + Math.sin(t * Math.PI) * 14;
    puffs.push({ x: 30 + t * (w - 60), y: h - 22 - r * 0.6 + rand() * 6, r });
  }

  canvasTexture(scene, key, w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 10, 0, h - 12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.65, '#ffffff');
    g.addColorStop(1, css(0xdbe9f6));
    ctx.fillStyle = g;

    roundRectPath(ctx, 22, h - 34, w - 44, 22, 11);
    ctx.fill();
    ctx.beginPath();
    for (const p of puffs) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

export type BlockVariant = 'lit' | 'dark' | 'plain';

/**
 * Texture for one building block: rounded brick with a highlight, a shaded
 * base and a row of little windows. Cached per size/color/variant.
 */
export function blockTexture(
  scene: Phaser.Scene,
  w: number,
  h: number,
  color: number,
  variant: BlockVariant
): string {
  const key = `blk-${w}x${h}-${color.toString(16)}-${variant}`;
  return canvasTexture(scene, key, w, h, (ctx) => {
    const r = Math.min(4, h / 4);
    roundRectPath(ctx, 0, 0, w, h, r);
    ctx.fillStyle = css(shade(color, 0.72));
    ctx.fill();

    roundRectPath(ctx, 1, 1, w - 2, h - 3, r - 1);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(shade(color, 1.12)));
    g.addColorStop(1, css(color));
    ctx.fillStyle = g;
    ctx.fill();

    // Top highlight
    ctx.fillStyle = css(0xffffff, 0.3);
    ctx.fillRect(r, 2, w - r * 2, 1.5);

    if (variant === 'plain') return;

    // Windows: one per ~17px of width
    const n = Math.max(1, Math.round(w / 17));
    const winW = Math.min(8, (w - 6) / n - 4);
    const winH = Math.max(4, h - 10);
    const gap = (w - n * winW) / (n + 1);
    const glass = variant === 'lit' ? GLASS.lit : GLASS.dark;
    for (let i = 0; i < n; i++) {
      const wx = gap + i * (winW + gap);
      const wy = (h - winH) / 2 - 0.5;
      ctx.fillStyle = css(shade(color, 0.7));
      ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
      ctx.fillStyle = css(glass);
      ctx.fillRect(wx, wy, winW, winH);
      // Glint
      ctx.fillStyle = css(0xffffff, 0.7);
      ctx.fillRect(wx + 1, wy + 1, Math.max(1, winW * 0.3), Math.max(1, winH * 0.35));
    }
  });
}

/** Roof piece: a triangle with tile stripes. */
export function roofTexture(scene: Phaser.Scene, w: number, h: number, color: number): string {
  const key = `roof-${w}x${h}-${color.toString(16)}`;
  return canvasTexture(scene, key, w, h, (ctx) => {
    const tri = (inset: number) => {
      ctx.beginPath();
      ctx.moveTo(inset * 1.6, h - inset);
      ctx.lineTo(w - inset * 1.6, h - inset);
      ctx.lineTo(w / 2, inset * 1.4);
      ctx.closePath();
    };
    tri(0);
    ctx.fillStyle = css(shade(color, 0.72));
    ctx.fill();
    tri(1.2);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(shade(color, 1.15)));
    g.addColorStop(1, css(color));
    ctx.fillStyle = g;
    ctx.fill();
    // Tile stripes
    ctx.save();
    tri(1.2);
    ctx.clip();
    ctx.strokeStyle = css(mix(color, 0x000000, 0.2), 0.5);
    ctx.lineWidth = 1;
    for (let y = h - 6; y > 2; y -= 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/** Stone plinth that each building stands on. */
export function pedestalTexture(scene: Phaser.Scene, w: number, h: number): string {
  const capH = 10;
  const overhang = 5;
  const tw = w + overhang * 2;
  const key = `pedestal-${w}x${h}`;
  return canvasTexture(scene, key, tw, h, (ctx) => {
    // Body
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(SCENE.stone));
    g.addColorStop(1, css(SCENE.stoneDark));
    ctx.fillStyle = g;
    ctx.fillRect(overhang, capH - 2, w, h - capH + 2);

    // Stone courses with staggered joints
    ctx.strokeStyle = css(SCENE.stoneDark, 0.8);
    ctx.lineWidth = 1.5;
    const rows = 3;
    const rowH = (h - capH) / rows;
    for (let r = 0; r < rows; r++) {
      const y = capH + r * rowH;
      ctx.beginPath();
      ctx.moveTo(overhang, y);
      ctx.lineTo(overhang + w, y);
      ctx.stroke();
      const stoneW = 42;
      for (let x = overhang + (r % 2 ? stoneW / 2 : stoneW); x < overhang + w - 6; x += stoneW) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowH);
        ctx.stroke();
      }
      // Soft highlight on each course
      ctx.fillStyle = css(0xffffff, 0.12);
      ctx.fillRect(overhang, y + 1.5, w, 2);
    }

    // Cap slab
    roundRectPath(ctx, 0, 0, tw, capH, 3);
    ctx.fillStyle = css(SCENE.stoneLight);
    ctx.fill();
    ctx.fillStyle = css(SCENE.stoneDark, 0.6);
    ctx.fillRect(1, capH - 2.5, tw - 2, 2.5);
  });
}

/** Glass block: pale see-through pane in a white frame, with a shine streak. */
export function glassBlockTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `glass-${w}x${h}`;
  return canvasTexture(scene, key, w, h, (ctx) => {
    const r = Math.min(4, h / 4);
    roundRectPath(ctx, 0, 0, w, h, r);
    ctx.fillStyle = css(0xffffff, 0.95);
    ctx.fill();

    roundRectPath(ctx, 2.5, 2.5, w - 5, h - 5, Math.max(1, r - 2));
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, css(0xd9f4ff, 0.85));
    g.addColorStop(1, css(0x8fd3ee, 0.85));
    ctx.fillStyle = g;
    ctx.fill();

    // Diagonal shine streaks
    ctx.save();
    roundRectPath(ctx, 2.5, 2.5, w - 5, h - 5, Math.max(1, r - 2));
    ctx.clip();
    ctx.strokeStyle = css(0xffffff, 0.75);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h);
    ctx.lineTo(w * 0.18 + h, 0);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.18 + 7, h);
    ctx.lineTo(w * 0.18 + 7 + h, 0);
    ctx.stroke();
    ctx.restore();
  });
}

/** Stone block: grey with a bevel and a few speckles. Takes the most hits. */
export function stoneBlockTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `stone-${w}x${h}`;
  return canvasTexture(scene, key, w, h, (ctx) => {
    const r = Math.min(3, h / 4);
    roundRectPath(ctx, 0, 0, w, h, r);
    ctx.fillStyle = css(shade(SCENE.stoneDark, 0.8));
    ctx.fill();

    roundRectPath(ctx, 1, 1, w - 2, h - 3, Math.max(1, r - 1));
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(SCENE.stoneLight));
    g.addColorStop(1, css(SCENE.stone));
    ctx.fillStyle = g;
    ctx.fill();

    const rand = seededRandom(w * 31 + h);
    for (let i = 0; i < Math.round(w / 5); i++) {
      ctx.fillStyle = css(SCENE.stoneDark, 0.35 + rand() * 0.3);
      ctx.beginPath();
      ctx.arc(3 + rand() * (w - 6), 3 + rand() * (h - 7), 0.6 + rand() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css(0xffffff, 0.35);
    ctx.fillRect(r, 2, w - r * 2, 1.5);
  });
}

/** Transparent overlay of cracks; stage 1 = a few, stage 2 = badly cracked. */
export function crackTexture(scene: Phaser.Scene, w: number, h: number, stage: 1 | 2): string {
  const key = `crack-${w}x${h}-${stage}`;
  return canvasTexture(scene, key, w, h, (ctx) => {
    const rand = seededRandom(w * 7 + h * 13 + stage);
    ctx.strokeStyle = 'rgba(30,30,40,0.6)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cx = w * (0.35 + rand() * 0.3);
    const cy = h * (0.35 + rand() * 0.3);
    const branches = stage === 1 ? 3 : 6;
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2 + rand() * 0.8;
      const len = (stage === 1 ? 0.35 : 0.6) * Math.max(w, h) * (0.6 + rand() * 0.5);
      ctx.lineWidth = stage === 1 ? 1.1 : 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let x = cx;
      let y = cy;
      const steps = 3;
      for (let s = 1; s <= steps; s++) {
        const a = angle + (rand() - 0.5) * 0.9;
        x += (Math.cos(a) * len) / steps;
        y += (Math.sin(a) * len) / steps;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (stage === 2) {
      // A chipped corner
      ctx.fillStyle = 'rgba(30,30,40,0.35)';
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w - 6 - rand() * 5, 0);
      ctx.lineTo(w, 5 + rand() * 4);
      ctx.closePath();
      ctx.fill();
    }
  });
}
