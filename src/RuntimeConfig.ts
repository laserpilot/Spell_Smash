import { PHYSICS, LAYOUT, BLOCK } from './config';

interface RuntimeConfigShape {
  launchAngle: number;
  launchForce: number;
  blockDensity: number;
  blockFriction: number;
  restitution: number;
  blockWidth: number;
  blockHeight: number;
  buildingBlockCount: number;
  inputY: number;
  inputX: number;
  difficultyMin: number;
  difficultyMax: number;
  sessionLength: number;
  showWord: boolean;
  isSillyMode: boolean;
}

const DEFAULTS: RuntimeConfigShape = {
  launchAngle: 15, // degrees — flat trajectory
  launchForce: 16, // magnitude
  blockDensity: 0.012,
  blockFriction: 0.2,
  restitution: PHYSICS.restitution,
  blockWidth: 35,
  blockHeight: 20,
  buildingBlockCount: 50,
  inputY: 360, // moved from 620 to vertical middle
  inputX: LAYOUT.inputX + 30,
  difficultyMin: 1,   // Short=1, Medium=2, Long=3
  difficultyMax: 2,   // Short=2, Medium=4, Long=5
  sessionLength: 8,   // 4-24, step by 2
  showWord: true,     // false = audio-only mode
  isSillyMode: false, // true = silly words + fart sounds
};

export const runtimeConfig: RuntimeConfigShape = { ...DEFAULTS };

export function getLaunchVelocity(): { x: number; y: number } {
  const rad = runtimeConfig.launchAngle * (Math.PI / 180);
  return {
    x: Math.cos(rad) * runtimeConfig.launchForce,
    y: -Math.sin(rad) * runtimeConfig.launchForce,
  };
}

export function resetRuntimeConfig(): void {
  Object.assign(runtimeConfig, DEFAULTS);
}
