import Phaser from 'phaser';
import { DPR } from '../config';

/** Multiply each RGB channel by `factor` (>1 lightens, <1 darkens). */
export function shade(color: number, factor: number): number {
  const r = Phaser.Math.Clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255);
  const g = Phaser.Math.Clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255);
  const b = Phaser.Math.Clamp(Math.round((color & 0xff) * factor), 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** Linear blend between two colors (t=0 → a, t=1 → b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const lerp = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

/** Hex color → CSS rgba() string for canvas drawing. */
export function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${alpha})`;
}

/**
 * Create (once) a texture drawn with the Canvas 2D API at device-pixel
 * resolution, so it stays crisp under the DPR camera zoom. Draw in game units;
 * display the result with `setScale(1 / DPR)` or `setDisplaySize(w, h)`.
 */
export function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(
    key,
    Math.ceil(width * DPR),
    Math.ceil(height * DPR)
  )!;
  const ctx = tex.getContext();
  ctx.scale(DPR, DPR);
  draw(ctx);
  tex.refresh();
  return key;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Deterministic PRNG so tiling scenery looks the same every run. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Soft rounded card with a light top bevel and darker bottom lip. */
export function drawBeveledPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  baseColor: number,
  baseAlpha: number,
  radius: number,
  outlineColor = shade(baseColor, 0.7)
): void {
  const bevelH = Math.max(3, Math.round(height * 0.18));
  // Stacked rounded shapes (dark lip → light top → face). Thin strips with a
  // large corner radius render with spikes, so each layer is a full panel.
  const r = Math.min(radius, height / 2);
  const faceR = Math.min(radius, (height - bevelH * 2) / 2);

  gfx.fillStyle(shade(baseColor, 0.86), baseAlpha);
  gfx.fillRoundedRect(x, y, width, height, r);

  gfx.fillStyle(shade(baseColor, 1.12), baseAlpha);
  gfx.fillRoundedRect(x, y, width, height - bevelH, Math.min(r, (height - bevelH) / 2));

  gfx.fillStyle(baseColor, baseAlpha);
  gfx.fillRoundedRect(x, y + bevelH, width, height - bevelH * 2, faceR);

  gfx.lineStyle(2, outlineColor, 0.35);
  gfx.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, radius);
}
