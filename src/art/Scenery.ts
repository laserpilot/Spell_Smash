import Phaser from 'phaser';
import { DPR, GAME_WIDTH, GAME_HEIGHT, LAYOUT } from '../config';
import { canvasTexture, css, mix, seededRandom } from './draw';
import { SCENE } from './palette';
import { CLOUD_KEYS } from './textures';

const W = GAME_WIDTH;

interface ParallaxLayer {
  images: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  factor: number;
}

interface Cloud {
  image: Phaser.GameObjects.Image;
  baseX: number;
  speed: number;
  factor: number;
}

/**
 * Painted backdrop: sky, sun, distant city, hills, drifting clouds and
 * grassy ground. Layers tile horizontally and scroll at different speeds
 * (parallax) as the camera pans between buildings.
 */
export class Scenery {
  private scene: Phaser.Scene;
  private layers: ParallaxLayer[] = [];
  private clouds: Cloud[] = [];
  /** World distance covered by finished camera pans (camera snaps back to 0 after each). */
  private travel = 0;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    scene.add
      .image(0, 0, createSky(scene))
      .setOrigin(0, 0)
      .setScale(1 / DPR)
      .setScrollFactor(0)
      .setDepth(-20);

    this.createClouds();
    this.addLayer(createSkyline(scene), LAYOUT.groundY - 300, 0.12, -18);
    this.addLayer(createHills(scene, 'hills-far', 200, SCENE.hillsFar, 11, false), LAYOUT.groundY - 190, 0.25, -17);
    this.addLayer(createHills(scene, 'hills-near', 140, SCENE.hillsNear, 23, true), LAYOUT.groundY - 125, 0.45, -16);
    this.addLayer(createGround(scene), LAYOUT.groundY - 8, 1, -15);

    this.update(0);
  }

  /** Call after the camera's scrollX is reset by `dx` so layers don't jump. */
  commitScroll(dx: number): void {
    this.travel += dx;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs / 1000;
    const scrollX = this.travel + this.scene.cameras.main.scrollX;

    for (const layer of this.layers) {
      const offset = scrollX * layer.factor;
      const x = -(((offset % W) + W) % W);
      layer.images[0].x = x;
      layer.images[1].x = x + W;
    }

    const span = W + 300;
    for (const c of this.clouds) {
      const raw = c.baseX - scrollX * c.factor - this.elapsed * c.speed;
      c.image.x = (((raw + 250) % span) + span) % span - 250;
    }
  }

  private addLayer(key: string, y: number, factor: number, depth: number): void {
    const make = () =>
      this.scene.add
        .image(0, y, key)
        .setOrigin(0, 0)
        .setScale(1 / DPR)
        .setScrollFactor(0)
        .setDepth(depth);
    this.layers.push({ images: [make(), make()], factor });
  }

  private createClouds(): void {
    const rand = seededRandom(Date.now() & 0xffff);
    const count = 5;
    for (let i = 0; i < count; i++) {
      const scale = 0.55 + rand() * 0.5;
      const image = this.scene.add
        // Kept below the top HUD row
        .image(0, 140 + rand() * 100, CLOUD_KEYS[i % CLOUD_KEYS.length])
        .setOrigin(0, 0.5)
        .setScale(scale / DPR)
        .setAlpha(0.92)
        .setScrollFactor(0)
        .setDepth(-19);
      this.clouds.push({
        image,
        baseX: (i / count) * (W + 300) + rand() * 120,
        speed: 3 + rand() * 6,
        factor: 0.15 + scale * 0.1,
      });
    }
  }
}

function createSky(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'sky', W, GAME_HEIGHT, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, css(SCENE.skyTop));
    g.addColorStop(0.55, css(SCENE.skyMid));
    g.addColorStop(0.9, css(SCENE.skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GAME_HEIGHT);

    // Sun with soft glow
    const sx = 1060;
    const sy = 165;
    const glow = ctx.createRadialGradient(sx, sy, 20, sx, sy, 170);
    glow.addColorStop(0, css(SCENE.sunGlow, 0.55));
    glow.addColorStop(1, css(SCENE.sunGlow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 170, sy - 170, 340, 340);

    const disc = ctx.createRadialGradient(sx - 10, sy - 12, 4, sx, sy, 44);
    disc.addColorStop(0, '#fffdf0');
    disc.addColorStop(1, css(SCENE.sun));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, 42, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Distant city silhouettes, two rows for depth. */
function createSkyline(scene: Phaser.Scene): string {
  const h = 300;
  return canvasTexture(scene, 'skyline', W, h, (ctx) => {
    const rows = [
      { color: mix(SCENE.skyline, SCENE.skyMid, 0.6), minH: 120, maxH: 260, seed: 3 },
      { color: SCENE.skyline, minH: 60, maxH: 190, seed: 9 },
    ];
    for (const row of rows) {
      const rand = seededRandom(row.seed);
      let x = 0;
      while (x < W) {
        const bw = 36 + Math.floor(rand() * 70);
        const bh = row.minH + rand() * (row.maxH - row.minH);
        const roof = rand();
        for (const dx of [-W, 0, W]) {
          drawSkylineTower(ctx, x + dx, h, bw, bh, row.color, roof);
        }
        x += bw + Math.floor(rand() * 24) - 6;
      }
    }
  });
}

function drawSkylineTower(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  color: number,
  roof: number
): void {
  const top = baseY - h;
  ctx.fillStyle = css(color);
  ctx.fillRect(x, top, w, h);

  if (roof < 0.2) {
    // Antenna
    ctx.fillRect(x + w / 2 - 1, top - 26, 2, 26);
    ctx.beginPath();
    ctx.arc(x + w / 2, top - 27, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (roof < 0.35) {
    // Dome
    ctx.beginPath();
    ctx.arc(x + w / 2, top, w * 0.32, Math.PI, 0);
    ctx.fill();
  } else if (roof < 0.5) {
    // Stepped top
    ctx.fillRect(x + w * 0.2, top - 14, w * 0.6, 14);
  }

  // Window grid
  ctx.fillStyle = css(mix(color, 0xffffff, 0.22));
  for (let wy = top + 12; wy < baseY - 10; wy += 16) {
    for (let wx = x + 7; wx < x + w - 10; wx += 13) {
      ctx.fillRect(wx, wy, 5, 7);
    }
  }
}

/**
 * Rolling hills that tile seamlessly (each wave has a whole number of
 * periods across the width). Optionally dotted with round trees.
 */
function createHills(
  scene: Phaser.Scene,
  key: string,
  h: number,
  color: number,
  seed: number,
  trees: boolean
): string {
  const rand = seededRandom(seed);
  const waves = [
    { freq: 1 + Math.floor(rand() * 2), amp: h * 0.14, phase: rand() * Math.PI * 2 },
    { freq: 3, amp: h * 0.08, phase: rand() * Math.PI * 2 },
    { freq: 7, amp: h * 0.03, phase: rand() * Math.PI * 2 },
  ];
  const base = h * 0.42;
  const yAt = (x: number) =>
    base + waves.reduce((s, w) => s + w.amp * Math.sin((x / W) * Math.PI * 2 * w.freq + w.phase), 0);

  return canvasTexture(scene, key, W, h, (ctx) => {
    if (trees) {
      const tr = seededRandom(seed * 7);
      for (let i = 0; i < 9; i++) {
        const tx = tr() * W;
        const size = 10 + tr() * 8;
        for (const dx of [-W, 0, W]) drawTree(ctx, tx + dx, yAt(tx) + 6, size);
      }
    }

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, yAt(x));
    ctx.lineTo(W, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - h * 0.25, 0, h);
    g.addColorStop(0, css(mix(color, 0xffffff, 0.12)));
    g.addColorStop(1, css(mix(color, 0x3a6b3a, 0.15)));
    ctx.fillStyle = g;
    ctx.fill();
  });
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number): void {
  ctx.fillStyle = css(SCENE.treeTrunk);
  ctx.fillRect(x - 1.5, groundY - size * 1.2, 3, size * 1.2);
  ctx.fillStyle = css(SCENE.treeLeaf);
  ctx.beginPath();
  ctx.arc(x, groundY - size * 1.5, size * 0.75, 0, Math.PI * 2);
  ctx.arc(x - size * 0.45, groundY - size * 1.1, size * 0.55, 0, Math.PI * 2);
  ctx.arc(x + size * 0.45, groundY - size * 1.1, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(0xffffff, 0.18);
  ctx.beginPath();
  ctx.arc(x - size * 0.25, groundY - size * 1.75, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Grass strip with tufts over a band of soil and pebbles. */
function createGround(scene: Phaser.Scene): string {
  const h = GAME_HEIGHT - LAYOUT.groundY + 8;
  return canvasTexture(scene, 'ground', W, h, (ctx) => {
    const grassTop = 8;
    const grassBottom = 24;

    // Soil
    const soil = ctx.createLinearGradient(0, grassBottom, 0, h);
    soil.addColorStop(0, css(SCENE.soil));
    soil.addColorStop(1, css(SCENE.soilDark));
    ctx.fillStyle = soil;
    ctx.fillRect(0, grassBottom - 2, W, h - grassBottom + 2);

    // Pebbles
    const rand = seededRandom(42);
    for (let i = 0; i < 70; i++) {
      const px = rand() * W;
      const py = grassBottom + 6 + rand() * (h - grassBottom - 10);
      const pr = 1.5 + rand() * 3;
      ctx.fillStyle = css(rand() < 0.5 ? SCENE.pebble : SCENE.soilDark, 0.7);
      for (const dx of [-W, 0, W]) {
        ctx.beginPath();
        ctx.ellipse(px + dx, py, pr * 1.4, pr, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Grass band
    const grass = ctx.createLinearGradient(0, grassTop, 0, grassBottom);
    grass.addColorStop(0, css(SCENE.grass));
    grass.addColorStop(1, css(SCENE.grassDark));
    ctx.fillStyle = grass;
    ctx.fillRect(0, grassTop, W, grassBottom - grassTop);

    // Scalloped grass edge hanging over the soil
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      ctx.moveTo(x + 8, grassBottom);
      ctx.arc(x + 8, grassBottom - 1, 8, 0, Math.PI);
    }
    ctx.fillStyle = css(SCENE.grassDark);
    ctx.fill();

    // Blade tufts poking up
    ctx.fillStyle = css(SCENE.grass);
    const br = seededRandom(5);
    for (let x = 2; x < W; x += 6 + br() * 10) {
      const bh = 3 + br() * 6;
      ctx.beginPath();
      ctx.moveTo(x - 2, grassTop + 1);
      ctx.lineTo(x + (br() - 0.5) * 3, grassTop - bh);
      ctx.lineTo(x + 2, grassTop + 1);
      ctx.fill();
    }

    // Light edge on top of the grass
    ctx.fillStyle = css(0xffffff, 0.25);
    ctx.fillRect(0, grassTop, W, 2);
  });
}
