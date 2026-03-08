import type { Tick, EntityId } from "../types/common";

export type EmotionType =
  | "joy"
  | "distress"
  | "hope"
  | "fear"
  | "pride"
  | "shame"
  | "admiration"
  | "reproach"
  | "gratitude"
  | "anger"
  | "love"
  | "hate"
  | "satisfaction"
  | "disappointment"
  | "relief"
  | "guilt"
  | "frustration"
  | "affection"
  | "envy"
  | "loneliness"
  | "contempt"
  | "determination"
  | "anxiety";

export interface Emotion {
  type: EmotionType;
  intensity: number;
  decay: number;
  source?: EntityId;
  timestamp: Tick;
}

export interface Mood {
  valence: number;
  arousal: number;
}

export interface EmotionLayer {
  active: Emotion[];
  mood: Mood;
  temperament: Mood;
}

export function createDefaultEmotionLayer(): EmotionLayer {
  return {
    active: [],
    mood: { valence: 0, arousal: 0.3 },
    temperament: { valence: 0, arousal: 0.3 },
  };
}
