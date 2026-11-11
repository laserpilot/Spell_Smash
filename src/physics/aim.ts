import { PHYSICS } from '../config';

/** Matter's defaults: gravity scale and air friction on the letter bodies. */
const GRAVITY_SCALE = 0.001;
const FRICTION_AIR = 0.01;
const STEP_MS = 1000 / 60;

/** Downward speed gained per physics step, in px/step. */
const STEP_GRAVITY = PHYSICS.gravity.y * GRAVITY_SCALE * STEP_MS * STEP_MS;

/**
 * Height (y) a shot reaches when it gets to `targetX`, launched from
 * (x0, y0) at `angleDeg` above horizontal with `speed` px/step.
 * Returns null if it never gets that far (falls into the ground first).
 */
function heightAt(x0: number, y0: number, targetX: number, angleDeg: number, speed: number, groundY: number): number | null {
  const rad = (angleDeg * Math.PI) / 180;
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;
  let x = x0;
  let y = y0;
  for (let step = 0; step < 400; step++) {
    vx *= 1 - FRICTION_AIR;
    vy = vy * (1 - FRICTION_AIR) + STEP_GRAVITY;
    x += vx;
    y += vy;
    if (x >= targetX) return y;
    if (y > groundY) return null;
  }
  return null;
}

/**
 * Launch angle (degrees) that sends a shot from (x0, y0) through
 * (targetX, targetY). Prefers the flattest angle that works.
 */
export function solveLaunchAngle(
  x0: number,
  y0: number,
  targetX: number,
  targetY: number,
  speed: number,
  groundY: number
): number {
  let best = 15;
  let bestErr = Infinity;
  for (let a = -10; a <= 60; a += 0.25) {
    const y = heightAt(x0, y0, targetX, a, speed, groundY);
    if (y === null) continue;
    const err = Math.abs(y - targetY);
    if (err < bestErr - 0.5) {
      best = a;
      bestErr = err;
    }
  }
  return best;
}
