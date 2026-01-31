import Phaser from 'phaser';
import { COLORS, PHYSICS } from '../config';
import { BuildingConfig, CollisionCategory } from '../types';

interface Block {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Rectangle;
}

export class Building {
  private scene: Phaser.Scene;
  private blocks: Block[] = [];
  private config: BuildingConfig;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.scene = scene;
    this.config = config;
    this.generate();
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
      case 'stack':
      default:
        this.generateStack();
        break;
    }
  }

  private generateStack(): void {
    const { totalBlocks, columns, blockWidth, blockHeight, x, groundY } =
      this.config;
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
    const { totalBlocks, columns, blockWidth, blockHeight, x, groundY } =
      this.config;
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
    const { totalBlocks, blockWidth, blockHeight, x, groundY } = this.config;
    // Tower: 1-2 columns wide, tall
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
    const { totalBlocks, columns, blockWidth, blockHeight, x, groundY } =
      this.config;
    const rows = Math.ceil(totalBlocks / columns);
    let blockCount = 0;

    for (let row = 0; row < rows && blockCount < totalBlocks; row++) {
      // Alternate rows are offset by half a block width
      const offsetX = row % 2 === 1 ? blockWidth * 0.5 : 0;
      for (let col = 0; col < columns && blockCount < totalBlocks; col++) {
        const bx = x + (col - (columns - 1) / 2) * blockWidth + offsetX;
        const by = groundY - blockHeight / 2 - row * blockHeight;
        this.addBlock(bx, by, blockWidth, blockHeight, row, col);
        blockCount++;
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
        density: PHYSICS.blockDensity,
        friction: PHYSICS.blockFriction,
        restitution: PHYSICS.restitution,
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

  getCurrentHeight(): number {
    if (this.blocks.length === 0) return 0;
    const highestY = Math.min(...this.blocks.map((b) => b.body.position.y));
    return this.config.groundY - highestY;
  }

  isDestroyed(threshold: number): boolean {
    return this.getCurrentHeight() < threshold;
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
  }
}
