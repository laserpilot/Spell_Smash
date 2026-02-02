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
