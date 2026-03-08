export type EntityId = string;
export type Tick = number;

export interface Range {
  min: number;
  max: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function clampBipolar(value: number): number {
  return clamp(value, -1, 1);
}

let _idCounter = 0;
export function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}
