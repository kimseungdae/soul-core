import type { EmotionType } from "./emotions";

export interface Wound {
  id: string;
  label: string;
  trigger: string;
  sensitivity: number;
  healing: number;
  emotionalResponse: EmotionType;
  intensityMultiplier: number;
}

export interface WoundLayer {
  wounds: Wound[];
}

export function createDefaultWoundLayer(): WoundLayer {
  return { wounds: [] };
}
