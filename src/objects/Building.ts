import Phaser from 'phaser';
import { COLORS } from '../config';
import { BuildingConfig, CollisionCategory } from '../types';
import { runtimeConfig } from '../RuntimeConfig';

interface Block {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Graphics;
}

export class Building {
  private scene: Phaser.Scene;
  private blocks: Block[] = [];
  private config: BuildingConfig;
  private effectiveGroundY: number;
  private pedestalBody: MatterJS.BodyType | null = null;
  private pedestalVisual: Phaser.GameObjects.Rectangle | null = null;
  private totalRows = 0;
  private frozen = false;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.scene = scene;
    this.config = config;
    this.effectiveGroundY = config.groundY - config.pedestalHeight;
    this.generatePedestal();
    this.totalRows = this.calculateTotalRows();
    this.generate();
    this.freezeBlocks();
  }

  private generatePedestal(): void {
    if (this.config.pedestalHeight <= 0) return;

    const { x, groundY, pedestalHeight, columns, blockWidth } = this.config;
    const pedW = columns * blockWidth * 1.5 + 20;
    const pedH = pedestalHeight;
    const pedY = groundY - pedH / 2;

    this.pedestalVisual = this.scene.add.rectangle(
      x,
      pedY,
      pedW,
      pedH,
      COLORS.neutral,
      0.15
    );

    this.pedestalBody = this.scene.matter.add.rectangle(x, pedY, pedW, pedH, {
      isStatic: true,
      label: 'pedestal',
      collisionFilter: {
        category: CollisionCategory.Ground,
        mask:
          CollisionCategory.Default |
          CollisionCategory.BuildingBlock |
          CollisionCategory.Rubble,
      },
    });
  }

  private generate(): void {
    switch (this.config.pattern) {
      case 'pyramid':
        this.generatePyramid();
        break;
      case 'tower':
        this.generateTower();
        break;
      case 'offset':
        this.generateOffset();
        break;
      case 'bridge':
        this.generateBridge();
        break;
      case 'castle':
        this.generateCastle();
        break;
      case 'overhang':
        this.generateOverhang();
        break;
      case 'wall':
        this.generateWall();
        break;
      case 'stack':
      default:
        this.generateStack();
        break;
    }
  }

  private generateStack(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    let blockCount = 0;
    let row = 0;

    while (blockCount < totalBlocks) {
      const useDoubleWide = row < 2; // bottom 2 rows get double-wide blocks
      let col = 0;
      while (col < columns && blockCount < totalBlocks) {
        const canDouble = useDoubleWide && col % 2 === 0 && col + 1 < columns;
        const bw = canDouble ? blockWidth * 2 : blockWidth;
        const bx = canDouble
          ? x + (col + 0.5 - (columns - 1) / 2) * blockWidth
          : x + (col - (columns - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, bw, blockHeight, row, col);
        if (canDouble) {
          blockCount += 2;
          col += 2;
        } else {
          blockCount++;
          col++;
        }
      }
      row++;
    }
  }

  private generatePyramid(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    let blockCount = 0;
    let rowCols = columns;
    let row = 0;

    while (blockCount < totalBlocks) {
      for (let col = 0; col < rowCols && blockCount < totalBlocks; col++) {
        const bx = x + (col - (rowCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
      row++;
      rowCols--;
      // Cycle back to full width when pyramid narrows to 0 (stepped ziggurat)
      if (rowCols <= 0) {
        rowCols = columns;
      }
    }
  }

  private generateTower(): void {
    const { totalBlocks, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    const cols = Math.min(2, this.config.columns);
    let blockCount = 0;
    let row = 0;

    while (blockCount < totalBlocks) {
      for (let col = 0; col < cols && blockCount < totalBlocks; col++) {
        const bx = x + (col - (cols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
      row++;
    }
  }

  private generateOffset(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    const rows = Math.ceil(totalBlocks / columns);
    let blockCount = 0;

    for (let row = 0; row < rows && blockCount < totalBlocks; row++) {
      const offsetX = row % 2 === 1 ? blockWidth * 0.5 : 0;
      for (let col = 0; col < columns && blockCount < totalBlocks; col++) {
        const bx = x + (col - (columns - 1) / 2) * blockWidth + offsetX;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
    }
  }

  /** Two pillars with a span of double-wide blocks across the top. */
  private generateBridge(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    const pillarWidth = 2;
    const spanCols = Math.max(columns, pillarWidth * 2 + 2);

    // Distribute blocks: span rows on top, rest in pillars
    const spanRows = Math.max(1, Math.floor(totalBlocks * 0.15));
    const pillarBlocks = totalBlocks - spanRows * spanCols;
    const pillarRows = Math.ceil(pillarBlocks / (pillarWidth * 2));

    let blockCount = 0;

    // Build pillars
    for (let row = 0; row < pillarRows && blockCount < totalBlocks - spanRows * spanCols; row++) {
      // Left pillar
      for (let col = 0; col < pillarWidth && blockCount < totalBlocks - spanRows * spanCols; col++) {
        const bx = x + (col - (spanCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
      // Right pillar
      for (let col = spanCols - pillarWidth; col < spanCols && blockCount < totalBlocks - spanRows * spanCols; col++) {
        const bx = x + (col - (spanCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
    }

    // Build span across top — use double-wide blocks
    for (let row = 0; row < spanRows; row++) {
      const spanRow = pillarRows + row;
      let col = 0;
      while (col < spanCols && blockCount < totalBlocks) {
        const canDouble = col % 2 === 0 && col + 1 < spanCols;
        const bw = canDouble ? blockWidth * 2 : blockWidth;
        const bx = canDouble
          ? x + (col + 0.5 - (spanCols - 1) / 2) * blockWidth
          : x + (col - (spanCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - spanRow * blockHeight;
        this.addBlock(bx, by, bw, blockHeight, spanRow, col);
        if (canDouble) {
          blockCount += 2;
          col += 2;
        } else {
          blockCount++;
          col++;
        }
      }
    }
  }

  /** Alternating tall/short columns creating a battlement profile.
   *  Base wall uses double-wide blocks for a fortress feel. */
  private generateCastle(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;

    // Base wall height: ~40% of estimated total rows
    const estRows = Math.ceil(totalBlocks / columns);
    const baseRows = Math.max(2, Math.floor(estRows * 0.4));
    const turretRows = estRows - baseRows;

    let blockCount = 0;

    // Base wall: full width with double-wide blocks
    for (let row = 0; row < baseRows && blockCount < totalBlocks; row++) {
      let col = 0;
      while (col < columns && blockCount < totalBlocks) {
        const canDouble = col % 2 === 0 && col + 1 < columns;
        const bw = canDouble ? blockWidth * 2 : blockWidth;
        const bx = canDouble
          ? x + (col + 0.5 - (columns - 1) / 2) * blockWidth
          : x + (col - (columns - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, bw, blockHeight, row, col);
        if (canDouble) {
          blockCount += 2;
          col += 2;
        } else {
          blockCount++;
          col++;
        }
      }
    }

    // Turrets: every other column extends higher
    for (let row = baseRows; row < baseRows + turretRows && blockCount < totalBlocks; row++) {
      for (let col = 0; col < columns && blockCount < totalBlocks; col++) {
        // Only place blocks on even columns (turrets)
        if (col % 2 === 0) {
          const bx = x + (col - (columns - 1) / 2) * blockWidth;
          const by = groundY - blockHeight / 2 - row * blockHeight;
          this.addBlock(bx, by, blockWidth, blockHeight, row, col);
          blockCount++;
        }
      }
    }
  }

  /** Inverted structure: narrow base, wider top. Precarious and satisfying to topple. */
  private generateOverhang(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;

    const minCols = Math.min(2, columns);
    const avgCols = (minCols + columns) / 2;
    const estRows = Math.ceil(totalBlocks / avgCols);
    let blockCount = 0;
    let row = 0;

    while (blockCount < totalBlocks) {
      const progress = Math.min(1, row / Math.max(1, estRows - 1));
      const rowCols = Math.round(minCols + (columns - minCols) * progress);

      for (let col = 0; col < rowCols && blockCount < totalBlocks; col++) {
        const bx = x + (col - (rowCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
      row++;
    }
  }

  /** Tall thin wall: 1 block wide, many rows. Easy to topple sideways. */
  private generateWall(): void {
    const { totalBlocks, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    // Cap rows to keep wall on-screen (leave 20px top margin)
    const maxRows = Math.floor((groundY - 20) / blockHeight);
    const rows = Math.min(totalBlocks, maxRows);
    let blockCount = 0;

    for (let row = 0; row < rows && blockCount < totalBlocks; row++) {
      const bx = x;
      const by = groundY - blockHeight / 2 - row * blockHeight;
      this.addBlock(bx, by, blockWidth, blockHeight, row, 0);
      blockCount++;
    }
  }

  private addBlock(
    bx: number,
    by: number,
    blockWidth: number,
    blockHeight: number,
    row: number,
    col: number
  ): void {
    const colorPool = [COLORS.secondary, COLORS.support, COLORS.primary];
    const color = colorPool[(row + col) % colorPool.length];

    const visual = this.createBlockVisual(blockWidth - 2, blockHeight - 2, color);
    visual.setPosition(bx, by);

    // Subtle visual distinction for double-wide blocks
    if (blockWidth > this.config.blockWidth) {
      visual.setAlpha(0.85);
    }

    // Row-based density: bottom rows heavier, top rows lighter
    const densityScale = this.totalRows > 1
      ? 1.0 + 0.3 * (1 - row / (this.totalRows - 1))
      : 1.0;

    const body = this.scene.matter.add.rectangle(
      bx,
      by,
      blockWidth - 2,
      blockHeight - 2,
      {
        density: runtimeConfig.blockDensity * densityScale,
        friction: runtimeConfig.blockFriction,
        restitution: runtimeConfig.restitution,
        label: 'building_block',
        collisionFilter: {
          category: CollisionCategory.BuildingBlock,
          mask:
            CollisionCategory.Default |
            CollisionCategory.WordLetter |
            CollisionCategory.BuildingBlock |
            CollisionCategory.Ground,
        },
      }
    );

    this.blocks.push({ body, visual });
  }

  /** Calculate the number of rows for this building configuration. */
  private calculateTotalRows(): number {
    const { totalBlocks, columns, blockHeight, pattern } = this.config;
    let rows = 0;

    switch (pattern) {
      case 'pyramid': {
        let remaining = totalBlocks;
        let rowCols = columns;
        while (remaining > 0) {
          const placed = Math.min(rowCols, remaining);
          rows++;
          remaining -= placed;
          rowCols--;
          if (rowCols <= 0) {
            rowCols = columns;
          }
        }
        break;
      }
      case 'tower': {
        const cols = Math.min(2, columns);
        rows = Math.ceil(totalBlocks / cols);
        break;
      }
      case 'bridge': {
        const pillarWidth = 2;
        const spanCols = Math.max(columns, pillarWidth * 2 + 2);
        const spanRows = Math.max(1, Math.floor(totalBlocks * 0.15));
        const pillarBlocks = totalBlocks - spanRows * spanCols;
        const pillarRows = Math.ceil(pillarBlocks / (pillarWidth * 2));
        rows = pillarRows + spanRows;
        break;
      }
      case 'castle': {
        const estRows = Math.ceil(totalBlocks / columns);
        const baseRows = Math.max(2, Math.floor(estRows * 0.4));
        const baseBlocks = baseRows * columns;
        const turretBlocks = totalBlocks - baseBlocks;
        const turretCols = Math.ceil(columns / 2);
        const turretRows = turretBlocks > 0 ? Math.ceil(turretBlocks / turretCols) : 0;
        rows = baseRows + turretRows;
        break;
      }
      case 'overhang': {
        const minCols = Math.min(2, columns);
        const avgCols = (minCols + columns) / 2;
        const estRows = Math.ceil(totalBlocks / avgCols);
        let remaining = totalBlocks;
        let r = 0;
        while (remaining > 0) {
          const progress = Math.min(1, r / Math.max(1, estRows - 1));
          const rowCols = Math.round(minCols + (columns - minCols) * progress);
          remaining -= Math.min(rowCols, remaining);
          r++;
        }
        rows = r;
        break;
      }
      case 'wall': {
        const maxRows = Math.floor((this.effectiveGroundY - 20) / blockHeight);
        rows = Math.min(totalBlocks, maxRows);
        break;
      }
      default:
        // stack, offset
        rows = Math.ceil(totalBlocks / columns);
    }

    return rows;
  }

  /** Compute the initial height from the config (before physics settles).
   *  Includes pedestal height since height is measured from actual ground. */
  getInitialHeight(): number {
    return this.totalRows * this.config.blockHeight + this.config.pedestalHeight;
  }

  getCurrentHeight(): number {
    if (this.blocks.length === 0) return 0;
    const highestY = Math.min(...this.blocks.map((b) => b.body.position.y));
    return this.config.groundY - highestY;
  }

  isDestroyed(threshold: number): boolean {
    return this.getCurrentHeight() < threshold;
  }

  /** Shift all block bodies and visuals by dx (used after camera scroll reset). */
  offsetAllBlocks(dx: number): void {
    const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;
    for (const block of this.blocks) {
      MatterBody.setPosition(block.body, {
        x: block.body.position.x + dx,
        y: block.body.position.y,
      });
      block.visual.x = block.body.position.x;
    }

    // Shift pedestal too — use Matter.Body.setPosition for static bodies
    // (direct manipulation doesn't update bounds, breaking collision detection)
    if (this.pedestalBody) {
      MatterBody.setPosition(this.pedestalBody, {
        x: this.pedestalBody.position.x + dx,
        y: this.pedestalBody.position.y,
      });
    }
    if (this.pedestalVisual) {
      this.pedestalVisual.x += dx;
    }
  }

  update(): void {
    // Blocks that fall below the pedestal surface get reduced friction
    // so subsequent hits slide them easily instead of feeling "stuck"
    const fallenThreshold = this.effectiveGroundY + 5;

    for (const block of this.blocks) {
      block.visual.setPosition(block.body.position.x, block.body.position.y);
      block.visual.setRotation(block.body.angle);

      if (block.body.position.y > fallenThreshold && block.body.friction > 0.05) {
        block.body.friction = 0.05;
      }
    }
  }

  freezeBlocks(): void {
    if (this.frozen) return;
    this.frozen = true;
    const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;
    for (const block of this.blocks) {
      MatterBody.setStatic(block.body, true);
    }
  }

  releaseBlocks(): void {
    if (!this.frozen) return;
    this.frozen = false;
    const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;
    for (const block of this.blocks) {
      MatterBody.setStatic(block.body, false);
    }
  }

  destroy(): void {
    for (const block of this.blocks) {
      this.scene.matter.world.remove(block.body);
      block.visual.destroy();
    }
    this.blocks = [];

    if (this.pedestalBody) {
      this.scene.matter.world.remove(this.pedestalBody);
      this.pedestalBody = null;
    }
    if (this.pedestalVisual) {
      this.pedestalVisual.destroy();
      this.pedestalVisual = null;
    }
  }

  private createBlockVisual(
    width: number,
    height: number,
    baseColor: number
  ): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics();

    const lighter = this.tintColor(baseColor, 1.15);
    const darker = this.tintColor(baseColor, 0.82);
    const outline = this.tintColor(baseColor, 0.7);

    const x = -width / 2;
    const y = -height / 2;
    const bevelH = Math.max(4, Math.round(height * 0.22));

    // Base fill
    gfx.fillStyle(baseColor, 1);
    gfx.fillRect(x, y, width, height);

    // Top bevel
    gfx.fillStyle(lighter, 0.9);
    gfx.fillRect(x, y, width, bevelH);

    // Bottom bevel
    gfx.fillStyle(darker, 0.9);
    gfx.fillRect(x, y + height - bevelH, width, bevelH);

    // Edge outline
    gfx.lineStyle(2, outline, 0.7);
    gfx.strokeRect(x + 1, y + 1, width - 2, height - 2);

    return gfx;
  }

  private tintColor(color: number, factor: number): number {
    const r = Phaser.Math.Clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255);
    const g = Phaser.Math.Clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255);
    const b = Phaser.Math.Clamp(Math.round((color & 0xff) * factor), 0, 255);
    return (r << 16) | (g << 8) | b;
  }
}
