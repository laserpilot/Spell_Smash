import Phaser from 'phaser';
import { COLORS } from '../config';
import { BuildingConfig, CollisionCategory } from '../types';
import { runtimeConfig } from '../RuntimeConfig';

interface Block {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Rectangle;
}

export class Building {
  private scene: Phaser.Scene;
  private blocks: Block[] = [];
  private config: BuildingConfig;
  private effectiveGroundY: number;
  private pedestalBody: MatterJS.BodyType | null = null;
  private pedestalVisual: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.scene = scene;
    this.config = config;
    this.effectiveGroundY = config.groundY - config.pedestalHeight;
    this.generatePedestal();
    this.generate();
  }

  private generatePedestal(): void {
    if (this.config.pedestalHeight <= 0) return;

    const { x, groundY, pedestalHeight, columns, blockWidth } = this.config;
    const pedW = columns * blockWidth + 20;
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
      case 'stack':
      default:
        this.generateStack();
        break;
    }
  }

  private generateStack(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    const rows = Math.ceil(totalBlocks / columns);
    let blockCount = 0;

    for (let row = 0; row < rows && blockCount < totalBlocks; row++) {
      for (let col = 0; col < columns && blockCount < totalBlocks; col++) {
        const bx = x + (col - (columns - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
    }
  }

  private generatePyramid(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;
    let blockCount = 0;
    let rowCols = columns;
    let row = 0;

    while (blockCount < totalBlocks && rowCols > 0) {
      for (let col = 0; col < rowCols && blockCount < totalBlocks; col++) {
        const bx = x + (col - (rowCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
      }
      row++;
      rowCols--;
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

  /** Two pillars with a span of blocks across the top. */
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

    // Build span across top
    for (let row = 0; row < spanRows; row++) {
      const spanRow = pillarRows + row;
      for (let col = 0; col < spanCols && blockCount < totalBlocks; col++) {
        const bx = x + (col - (spanCols - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - spanRow * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, spanRow, col);
        blockCount++;
      }
    }
  }

  /** Alternating tall/short columns creating a battlement profile. */
  private generateCastle(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x } = this.config;
    const groundY = this.effectiveGroundY;

    // Base wall height: ~40% of estimated total rows
    const estRows = Math.ceil(totalBlocks / columns);
    const baseRows = Math.max(2, Math.floor(estRows * 0.4));
    const turretRows = estRows - baseRows;

    let blockCount = 0;

    // Base wall: full width
    for (let row = 0; row < baseRows && blockCount < totalBlocks; row++) {
      for (let col = 0; col < columns && blockCount < totalBlocks; col++) {
        const bx = x + (col - (columns - 1) / 2) * blockWidth;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
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

    const visual = this.scene.add.rectangle(
      bx,
      by,
      blockWidth - 2,
      blockHeight - 2,
      color
    );

    const body = this.scene.matter.add.rectangle(
      bx,
      by,
      blockWidth - 2,
      blockHeight - 2,
      {
        density: runtimeConfig.blockDensity,
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

  /** Compute the initial height from the config (before physics settles).
   *  Includes pedestal height since height is measured from actual ground. */
  getInitialHeight(): number {
    const { totalBlocks, columns, blockHeight, pattern, pedestalHeight } =
      this.config;
    let rows = 0;

    switch (pattern) {
      case 'pyramid': {
        let remaining = totalBlocks;
        let rowCols = columns;
        while (remaining > 0 && rowCols > 0) {
          rows++;
          remaining -= rowCols;
          rowCols--;
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
      default:
        // stack, offset
        rows = Math.ceil(totalBlocks / columns);
    }

    return rows * blockHeight + pedestalHeight;
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
      const b = block.body as any;
      b.position.x += dx;
      b.positionPrev.x += dx;
      for (const vert of b.vertices) {
        vert.x += dx;
      }
      block.visual.x = b.position.x;
    }

    // Shift pedestal too — use Matter.Body.setPosition for static bodies
    // (direct manipulation doesn't update bounds, breaking collision detection)
    if (this.pedestalBody) {
      const MatterBody = (Phaser.Physics.Matter as any).Matter.Body;
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
    for (const block of this.blocks) {
      block.visual.setPosition(block.body.position.x, block.body.position.y);
      block.visual.setRotation(block.body.angle);
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
