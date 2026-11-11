import Phaser from 'phaser';
import { BuildingConfig, CollisionCategory } from '../types';
import { runtimeConfig } from '../RuntimeConfig';
import { getTheme } from '../art/palette';
import {
  blockTexture,
  roofTexture,
  pedestalTexture,
  glassBlockTexture,
  stoneBlockTexture,
  crackTexture,
  BlockVariant,
} from '../art/textures';

export type Material = 'glass' | 'brick' | 'stone';

/** Hits each material takes before it breaks (tough buildings only). */
const MATERIAL_HP: Record<Material, number> = { glass: 1, brick: 2, stone: 3 };

/** Debris tint for each material when a block breaks. */
const GLASS_TINT = 0xbfe8f5;
const STONE_TINT = 0xb9b2a6;

/** Event the building emits on the scene when a block breaks. */
export const BLOCK_BROKEN_EVENT = 'block-broken';
export interface BlockBrokenInfo {
  x: number;
  y: number;
  color: number;
  material: Material;
}

/** Tough buildings: steady blocks that settle instead of bouncing apart. */
const TOUGH_PHYSICS = { friction: 0.6, frictionStatic: 0.9, restitution: 0.05 };

interface Block {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Image;
  w: number;
  h: number;
  /** Width in grid columns; used to weigh the smash percentage. */
  span: number;
  color: number;
  material: Material;
  hp: number;
  maxHp: number;
  /** Static until hit or until something under it moves. */
  frozen: boolean;
  broken: boolean;
  /** Where the block started, to tell whether it has been knocked loose. */
  home: { x: number; y: number };
  /** Blocks directly underneath that hold this one up. */
  supporters: Block[];
  cracks: Phaser.GameObjects.Image | null;
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
  private byBody = new Map<MatterJS.BodyType, Block>();
  private pendingBreaks = new Set<Block>();
  private totalUnits = 0;
  private brokenUnits = 0;

  constructor(scene: Phaser.Scene, config: BuildingConfig) {
    this.scene = scene;
    this.config = config;
    this.effectiveGroundY = config.groundY - config.pedestalHeight;
    this.generatePedestal();

    // Plan the layout first so the row count is known before blocks are weighted
    this.layout();
    this.totalRows = this.specs.reduce((max, s) => Math.max(max, s.row + 1), 0);
    for (const spec of this.specs) this.createBlock(spec);
    this.linkSupporters();
    this.specs = [];
    this.totalUnits = this.blocks.reduce((sum, b) => sum + b.span, 0);

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
    const { blockWidth, blockHeight, tough } = this.config;
    const theme = getTheme(this.config.theme);
    const w = blockWidth * spec.span - 2;
    const h = blockHeight - 2;
    const material = tough ? this.pickMaterial(spec) : 'brick';

    // Bottom rows are heavier, top rows lighter
    const densityScale = this.totalRows > 1
      ? 1.0 + 0.3 * (1 - spec.row / (this.totalRows - 1))
      : 1.0;
    const physics = {
      density: runtimeConfig.blockDensity * densityScale * (material === 'stone' ? 1.4 : 1),
      friction: runtimeConfig.blockFriction,
      restitution: runtimeConfig.restitution,
      ...(tough ? TOUGH_PHYSICS : {}),
      label: 'building_block',
      collisionFilter: BLOCK_COLLISION,
    };

    let body: MatterJS.BodyType;
    let visual: Phaser.GameObjects.Image;
    let color: number;

    if (spec.roof) {
      color = theme.roof;
      const verts = [
        { x: -w / 2, y: h / 2 },
        { x: w / 2, y: h / 2 },
        { x: 0, y: -h / 2 },
      ];
      body = this.scene.matter.add.fromVertices(spec.x, spec.y, verts, physics, true) as MatterJS.BodyType;
      // Matter positions a triangle by its centroid, which sits 2/3 of the way down
      visual = this.scene.add
        .image(body.position.x, body.position.y, roofTexture(this.scene, w, h, color))
        .setOrigin(0.5, 2 / 3);
    } else {
      let key: string;
      if (material === 'glass') {
        color = GLASS_TINT;
        key = glassBlockTexture(this.scene, w, h);
      } else if (material === 'stone') {
        color = STONE_TINT;
        key = stoneBlockTexture(this.scene, w, h);
      } else {
        color = theme.blocks[(spec.row + spec.col) % theme.blocks.length];
        const variant: BlockVariant = Math.random() < 0.35 ? 'lit' : 'dark';
        key = blockTexture(this.scene, w, h, color, variant);
      }
      body = this.scene.matter.add.rectangle(spec.x, spec.y, w, h, physics);
      visual = this.scene.add.image(spec.x, spec.y, key);
    }
    visual.setDisplaySize(w, h);

    const block: Block = {
      body,
      visual,
      w,
      h,
      span: spec.span,
      color,
      material,
      hp: MATERIAL_HP[material],
      maxHp: MATERIAL_HP[material],
      frozen: false,
      broken: false,
      home: { x: body.position.x, y: body.position.y },
      supporters: [],
      cracks: null,
    };
    this.blocks.push(block);
    this.byBody.set(body, block);
  }

  /** Stone is common low down, glass is sprinkled through; the rest is brick. */
  private pickMaterial(spec: BlockSpec): Material {
    if (spec.roof) return 'brick';
    const height = this.totalRows > 1 ? spec.row / (this.totalRows - 1) : 0;
    const stoneChance = 0.3 - 0.2 * height;
    const r = Math.random();
    if (r < stoneChance) return 'stone';
    if (r < stoneChance + 0.22) return 'glass';
    return 'brick';
  }

  /** Each block remembers which blocks in the row below it rests on. */
  private linkSupporters(): void {
    const { blockHeight } = this.config;
    for (const block of this.blocks) {
      const left = block.home.x - block.w / 2;
      const right = block.home.x + block.w / 2;
      block.supporters = this.blocks.filter((other) => {
        if (other === block) return false;
        const below = other.home.y - block.home.y;
        if (below < blockHeight * 0.5 || below > blockHeight * 1.5) return false;
        const overlap = Math.min(right, other.home.x + other.w / 2) - Math.max(left, other.home.x - other.w / 2);
        return overlap > 4;
      });
    }
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
      if (block.cracks) block.cracks.x = block.body.position.x;
      block.home.x += dx;
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
    for (const block of this.pendingBreaks) this.breakBlock(block);
    this.pendingBreaks.clear();

    // A frozen block wakes up once anything holding it up breaks or slides away
    for (const block of this.blocks) {
      if (!block.frozen) continue;
      const unsupported = block.supporters.some(
        (s) =>
          s.broken ||
          (!s.frozen && Math.hypot(s.body.position.x - s.home.x, s.body.position.y - s.home.y) > 3)
      );
      if (unsupported) this.release(block);
    }

    // Blocks that fall below the pedestal surface get reduced friction
    // so later hits slide them easily instead of feeling "stuck"
    const fallenThreshold = this.effectiveGroundY + 5;

    for (const block of this.blocks) {
      block.visual.setPosition(block.body.position.x, block.body.position.y);
      block.visual.setRotation(block.body.angle);
      block.cracks?.setPosition(block.body.position.x, block.body.position.y).setRotation(block.body.angle);

      if (block.body.position.y > fallenThreshold && block.body.friction > 0.05) {
        block.body.friction = 0.05;
      }
    }
  }

  freezeBlocks(): void {
    for (const block of this.blocks) this.freeze(block);
  }

  /** Classic mode: the first hit lets the whole building move. */
  releaseBlocks(): void {
    for (const block of this.blocks) this.release(block);
  }

  private freeze(block: Block): void {
    if (block.frozen) return;
    block.frozen = true;
    MatterBody.setStatic(block.body, true);
  }

  private release(block: Block): void {
    if (!block.frozen || block.broken) return;
    block.frozen = false;
    MatterBody.setStatic(block.body, false);
  }

  // ---------------------------------------------------------------------------
  // Tough buildings: blocks wake up where they're hit, crack, and break
  // ---------------------------------------------------------------------------

  /** Loosen the blocks right around an impact point. */
  releaseNear(x: number, y: number, radius: number): void {
    for (const block of this.blocks) {
      const d = Math.hypot(block.body.position.x - x, block.body.position.y - y);
      if (d <= radius) this.release(block);
    }
  }

  /** Feed Matter collision pairs in; letters and fast debris damage blocks. */
  handleCollisions(pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[]): void {
    if (!this.config.tough) return;
    for (const { bodyA, bodyB } of pairs) {
      const a = this.byBody.get(bodyA);
      const b = this.byBody.get(bodyB);
      if (a) this.onContact(a, bodyB, b);
      if (b) this.onContact(b, bodyA, a);
    }
  }

  private onContact(block: Block, other: MatterJS.BodyType, otherBlock?: Block): void {
    if (block.broken) return;
    const speed = Math.hypot(other.velocity.x, other.velocity.y);

    if (other.label === 'word_letter') {
      if (speed < 2) return;
      this.release(block);
      const power = (other as { shotPower?: number }).shotPower ?? 1;
      this.damage(block, power);
    } else if (otherBlock && !otherBlock.frozen && speed > 2.5) {
      // Knocked by a falling or flying block
      this.release(block);
      if (speed > 7) this.damage(block, 1);
    }
  }

  private damage(block: Block, amount: number): void {
    if (block.broken) return;
    block.hp -= amount;
    if (block.hp <= 0) {
      // Removing bodies mid-collision confuses Matter; break on the next update
      this.pendingBreaks.add(block);
      return;
    }
    const stage = Math.ceil((1 - block.hp / block.maxHp) * 2) as 1 | 2;
    const key = crackTexture(this.scene, Math.round(block.w), Math.round(block.h), stage);
    if (block.cracks) {
      block.cracks.setTexture(key);
    } else {
      block.cracks = this.scene.add.image(block.body.position.x, block.body.position.y, key);
      if (block.visual.originY !== 0.5) block.cracks.setOrigin(0.5, block.visual.originY);
    }
    block.cracks.setDisplaySize(block.w, block.h).setDepth(block.visual.depth);
  }

  private breakBlock(block: Block): void {
    if (block.broken) return;
    block.broken = true;
    const { x, y } = block.body.position;
    this.scene.matter.world.remove(block.body);
    block.visual.destroy();
    block.cracks?.destroy();
    this.byBody.delete(block.body);
    this.blocks.splice(this.blocks.indexOf(block), 1);
    this.brokenUnits += block.span;
    const info: BlockBrokenInfo = { x, y, color: block.color, material: block.material };
    this.scene.events.emit(BLOCK_BROKEN_EVENT, info);
  }
  /**
   * Share of the building that's been smashed: broken blocks plus blocks
   * that have tipped over or fallen well away. A block that just settles
   * down into a gap doesn't count. 0 → untouched, 1 → all gone.
   */
  getSmashedFraction(): number {
    if (this.totalUnits === 0) return 0;
    let units = this.brokenUnits;
    for (const block of this.blocks) {
      if (!block.frozen && this.isKnockedOut(block)) units += block.span;
    }
    return units / this.totalUnits;
  }

  private isKnockedOut(block: Block): boolean {
    const { x, y } = block.body.position;
    const moved = Math.hypot(x - block.home.x, y - block.home.y);
    const tipped = Math.abs(Phaser.Math.Angle.Wrap(block.body.angle)) > 0.6;
    const offPedestal = y > this.effectiveGroundY + 5;
    return moved > this.config.blockHeight * 2.5 || tipped || offPedestal;
  }

  /**
   * Somewhere on the left face of what's still standing, between the top
   * and the middle, so each shot chips away at the building.
   */
  getAimPoint(): { x: number; y: number } | null {
    const standing = this.blocks.filter((b) => !this.isKnockedOut(b));
    if (standing.length === 0) return null;
    const top = Math.min(...standing.map((b) => b.home.y - b.h / 2));
    const bottom = this.effectiveGroundY;
    // Mostly the upper part, so the building comes down a chunk at a time
    const y = top + (bottom - top) * (0.03 + Math.random() * 0.2);
    const atHeight = standing.filter((b) => Math.abs(b.home.y - y) < this.config.blockHeight * 1.5);
    const pool = atHeight.length > 0 ? atHeight : standing;
    const x = Math.min(...pool.map((b) => b.home.x - b.w / 2));
    return { x, y };
  }

  /** Finale: everything still standing comes down, and the glass shatters. */
  collapse(): void {
    const { x } = this.config;
    for (const block of [...this.blocks]) {
      if (block.material === 'glass' && Math.random() < 0.7) {
        this.breakBlock(block);
        continue;
      }
      this.release(block);
      const dir = Math.sign(block.body.position.x - x) || (Math.random() < 0.5 ? -1 : 1);
      MatterBody.setVelocity(block.body, {
        x: dir * (1 + Math.random() * 3),
        y: -1 - Math.random() * 3,
      });
      MatterBody.setAngularVelocity(block.body, (Math.random() - 0.5) * 0.2);
    }
  }

  destroy(): void {
    for (const block of this.blocks) {
      this.scene.matter.world.remove(block.body);
      block.visual.destroy();
      block.cracks?.destroy();
    }
    this.blocks = [];
    this.byBody.clear();
    this.pendingBreaks.clear();

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
