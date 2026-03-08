import type { Tick } from "../types/common";

export interface Habit {
  id: string;
  label: string;
  triggerCondition: string;
  actionId: string;
  strength: number;
  reinforcement: number;
  lastFired: Tick;
}

export interface HabitLayer {
  habits: Habit[];
}

export function createDefaultHabitLayer(): HabitLayer {
  return { habits: [] };
}
