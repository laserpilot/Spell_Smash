import Phaser from 'phaser';
import { BuildingConfig, CollisionCategory } from '../types';
import { runtimeConfig } from '../RuntimeConfig';
import { getTheme } from '../art/palette';
import { blockTexture, roofTexture, pedestalTexture, BlockVariant } from '../art/textures';

interface Block {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Image;
}

/** Planned block position, produced by a layout pattern before any bodies exist. */
interface BlockSpec {
  x: number;
  y: number;
  /** Width in columns (1 = single block, 2 = double-wide, ...). */
  span: number;
  row: number;
  col: number;
  roof: boolean;
}

const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;

const BLOCK_COLLISION = {
  category: CollisionCategory.BuildingBlock,
  mask:
    CollisionCategory.Default |
    CollisionCategory.WordLetter |
    CollisionCategory.BuildingBlock |
    CollisionCategory.Ground,
};

export class Building {
  private scene: Phaser.Scene;
  private blocks: Block[] = [];
  private config: BuildingConfig;
  private effectiveGroundY: number;
  private pedestalBody: MatterJS.BodyType | null = null;
  private pedestalVisual: Phaser.GameObjects.Image | null = null;
  private specs: BlockSpec[] = [];
  private totalRows = 0;
  private frozen = false;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.scene = scene;
    this.config = config;
    this.effectiveGroundY = config.groundY - config.pedestalHeight;
    this.generatePedestal();

    // Plan the layout first so the row count is known before blocks are weighted
    this.layout();
    this.totalRows = this.specs.reduce((max, s) => Math.max(max, s.row + 1), 0);
    for (const spec of this.specs) this.createBlock(spec);
    this.specs = [];

    this.freezeBlocks();
  }

  private generatePedestal(): void {
    if (this.config.pedestalHeight <= 0) return;

    const { x, groundY, pedestalHeight, columns, blockWidth } = this.config;
    const pedW = Math.round(columns * blockWidth * 1.5 + 20);
    const pedH = pedestalHeight;
    const pedY = groundY - pedH / 2;

    const key = pedestalTexture(this.scene, pedW, pedH);
    this.pedestalVisual = this.scene.add.image(x, pedY, key);
    this.pedestalVisual.setDisplaySize(pedW + 10, pedH);

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

  // ---------------------------------------------------------------------------
  // Layout patterns. Each one fills `this.specs` with up to totalBlocks blocks.
  // ---------------------------------------------------------------------------

  private layout(): void {
    switch (this.config.pattern) {
      case 'pyramid': return this.layoutPyramid();
      case 'tower': return this.layoutTower();
      case 'offset': return this.layoutOffset();
      case 'bridge': return this.layoutPillarsWithSpan(0.15, 2);
      case 'span': return this.layoutPillarsWithSpan(0.12, 3);
      case 'arch': return this.layoutArch();
      case 'castle': return this.layoutCastle();
      case 'overhang': return this.layoutOverhang();
      case 'wall': return this.layoutWall();
      case 'stack':
      default:
        return this.layoutStack();
    }
  }

  /** Full-width rows; the bottom two rows use double-wide blocks. */
  private layoutStack(): void {
    const { totalBlocks, columns } = this.config;
    let count = 0;
    for (let row = 0; count < totalBlocks; row++) {
      count += this.fillRow(row, columns, row < 2 ? 2 : 1, totalBlocks - count);
    }
  }

  /** Narrowing rows; restarts at full width when it reaches the top (ziggurat). */
  private layoutPyramid(): void {
    const { totalBlocks, columns } = this.config;
    let count = 0;
    let rowCols = columns;
    for (let row = 0; count < totalBlocks; row++) {
      count += this.fillRow(row, rowCols, 1, totalBlocks - count);
      rowCols = rowCols > 1 ? rowCols - 1 : columns;
    }
  }

  /** Two blocks wide, tall. */
  private layoutTower(): void {
    const { totalBlocks } = this.config;
    const cols = Math.min(2, this.config.columns);
    let count = 0;
    for (let row = 0; count < totalBlocks; row++) {
      count += this.fillRow(row, cols, 1, totalBlocks - count);
    }
  }

  /** Brick-style rows, odd rows shifted half a block. */
  private layoutOffset(): void {
    const { totalBlocks, columns, blockWidth } = this.config;
    let count = 0;
    for (let row = 0; count < totalBlocks; row++) {
      const dx = row % 2 === 1 ? blockWidth * 0.5 : 0;
      for (let col = 0; col < columns && count < totalBlocks; col++) {
        this.place(row, col, columns, 1, dx);
        count++;
      }
    }
  }

  /** Two pillars joined by rows of wide blocks across the top (bridge / span). */
  private layoutPillarsWithSpan(spanFraction: number, maxSpan: number): void {
    const { totalBlocks, columns } = this.config;
    const pillarWidth = 2;
    const spanCols = Math.max(columns, pillarWidth * 2 + 2);
    const spanRows = Math.max(1, Math.floor(totalBlocks * spanFraction));
    const pillarBudget = totalBlocks - spanRows * spanCols;
    const pillarRows = Math.ceil(pillarBudget / (pillarWidth * 2));

    let count = this.placePillars(pillarRows, spanCols, pillarWidth, pillarBudget);
    for (let r = 0; r < spanRows; r++) {
      count += this.fillRow(pillarRows + r, spanCols, maxSpan, totalBlocks - count);
    }
  }

  /** Pillars with an open middle, a long lintel, and little roofs on top. */
  private layoutArch(): void {
    const { totalBlocks, columns } = this.config;
    const pillarWidth = 2;
    const spanCols = Math.max(columns, pillarWidth * 2 + 3);
    const pillarRows = Math.max(3, Math.floor((totalBlocks * 0.35) / pillarWidth));

    let count = this.placePillars(pillarRows, spanCols, pillarWidth, totalBlocks);
    count += this.fillRow(pillarRows, spanCols, 3, totalBlocks - count);

    for (let col = 0; col < spanCols && count < totalBlocks; col += 2) {
      this.place(pillarRows + 1, col, spanCols, 1, 0, true);
      count++;
    }
  }

  /** Double-wide base wall, turrets on every other column, roofs on the turrets. */
  private layoutCastle(): void {
    const { totalBlocks, columns } = this.config;
    const estRows = Math.ceil(totalBlocks / columns);
    const baseRows = Math.max(2, Math.floor(estRows * 0.4));
    const topRow = estRows;

    let count = 0;
    for (let row = 0; row < baseRows && count < totalBlocks; row++) {
      count += this.fillRow(row, columns, 2, totalBlocks - count);
    }
    for (let row = baseRows; row < topRow && count < totalBlocks; row++) {
      for (let col = 0; col < columns && count < totalBlocks; col += 2) {
        this.place(row, col, columns);
        count++;
      }
    }
    for (let col = 0; col < columns && count < totalBlocks; col += 2) {
      this.place(topRow, col, columns, 1, 0, true);
      count++;
    }
  }

  /** Narrow base widening toward the top. Precarious and satisfying to topple. */
  private layoutOverhang(): void {
    const { totalBlocks, columns } = this.config;
    const minCols = Math.min(2, columns);
    const estRows = Math.ceil(totalBlocks / ((minCols + columns) / 2));
    let count = 0;
    for (let row = 0; count < totalBlocks; row++) {
      const progress = Math.min(1, row / Math.max(1, estRows - 1));
      const rowCols = Math.round(minCols + (columns - minCols) * progress);
      count += this.fillRow(row, rowCols, 1, totalBlocks - count);
    }
  }

  /** One block wide, as tall as fits on screen. */
  private layoutWall(): void {
    const maxRows = Math.floor((this.effectiveGroundY - 20) / this.config.blockHeight);
    const rows = Math.min(this.config.totalBlocks, maxRows);
    for (let row = 0; row < rows; row++) this.place(row, 0, 1);
  }

  /**
   * Fill one row left to right using blocks up to `maxSpan` columns wide.
   * Returns how many single-block units were used (may exceed budget by one wide block).
   */
  private fillRow(row: number, cols: number, maxSpan: number, budget: number): number {
    let used = 0;
    let col = 0;
    while (col < cols && used < budget) {
      const span =
        maxSpan >= 3 && col % 3 === 0 && col + 2 < cols ? 3
        : maxSpan >= 2 && col % 2 === 0 && col + 1 < cols ? 2
        : 1;
      this.place(row, col, cols, span);
      used += span;
      col += span;
    }
    return used;
  }

  /** Stack two pillars at the outer edges of a `cols`-wide footprint. */
  private placePillars(rows: number, cols: number, pillarWidth: number, budget: number): number {
    const pillarCols: number[] = [];
    for (let c = 0; c < pillarWidth; c++) pillarCols.push(c);
    for (let c = cols - pillarWidth; c < cols; c++) pillarCols.push(c);

    let used = 0;
    for (let row = 0; row < rows && used < budget; row++) {
      for (const col of pillarCols) {
        if (used >= budget) break;
        this.place(row, col, cols);
        used++;
      }
    }
    return used;
  }

  /** Record a block at grid cell (row, col) in a row centered on the building. */
  private place(row: number, col: number, cols: number, span = 1, dx = 0, roof = false): void {
    const { x, blockWidth, blockHeight } = this.config;
    const centerCol = col + (span - 1) / 2;
    this.specs.push({
      x: x + (centerCol - (cols - 1) / 2) * blockWidth + dx,
      y: this.effectiveGroundY - blockHeight / 2 - row * blockHeight,
      span,
      row,
      col,
      roof,
    });
  }

  // ---------------------------------------------------------------------------
  // Block creation
  // ---------------------------------------------------------------------------

  private createBlock(spec: BlockSpec): void {
    const { blockWidth, blockHeight } = this.config;
    const theme = getTheme(this.config.theme);
    const w = blockWidth * spec.span - 2;
    const h = blockHeight - 2;

    // Bottom rows are heavier, top rows lighter
    const densityScale = this.totalRows > 1
      ? 1.0 + 0.3 * (1 - spec.row / (this.totalRows - 1))
      : 1.0;
    const physics = {
      density: runtimeConfig.blockDensity * densityScale,
      friction: runtimeConfig.blockFriction,
      restitution: runtimeConfig.restitution,
      label: 'building_block',
      collisionFilter: BLOCK_COLLISION,
    };

    let body: MatterJS.BodyType;
    let visual: Phaser.GameObjects.Image;

    if (spec.roof) {
      const verts = [
        { x: -w / 2, y: h / 2 },
        { x: w / 2, y: h / 2 },
        { x: 0, y: -h / 2 },
      ];
      body = this.scene.matter.add.fromVertices(spec.x, spec.y, verts, physics, true) as MatterJS.BodyType;
      // Matter positions a triangle by its centroid, which sits 2/3 of the way down
      visual = this.scene.add
        .image(body.position.x, body.position.y, roofTexture(this.scene, w, h, theme.roof))
        .setOrigin(0.5, 2 / 3);
    } else {
      const color = theme.blocks[(spec.row + spec.col) % theme.blocks.length];
      const variant: BlockVariant = Math.random() < 0.35 ? 'lit' : 'dark';
      body = this.scene.matter.add.rectangle(spec.x, spec.y, w, h, physics);
      visual = this.scene.add.image(spec.x, spec.y, blockTexture(this.scene, w, h, color, variant));
    }
    visual.setDisplaySize(w, h);

    this.blocks.push({ body, visual });
  }

  /** Initial height from ground, including the pedestal. */
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
    for (const block of this.blocks) {
      MatterBody.setPosition(block.body, {
        x: block.body.position.x + dx,
        y: block.body.position.y,
      });
      block.visual.x = block.body.position.x;
    }

    // Static bodies need Body.setPosition so their bounds (and collisions) update
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
    // so later hits slide them easily instead of feeling "stuck"
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
    for (const block of this.blocks) {
      MatterBody.setStatic(block.body, true);
    }
  }

  releaseBlocks(): void {
    if (!this.frozen) return;
    this.frozen = false;
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
}
