import type { Tick } from "../types/common";

export type NarrativeArc =
  | "redemption"
  | "contamination"
  | "growth"
  | "stability"
  | "decline"
  | "quest"
  | "custom";

export interface NarrativeTheme {
  arc: NarrativeArc;
  description: string;
  strength: number;
}

export interface LifeChapter {
  id: string;
  title: string;
  summary: string;
  startTick: Tick;
  endTick?: Tick;
  significance: number;
}

export interface NarrativeLayer {
  currentArc: NarrativeTheme;
  chapters: LifeChapter[];
  beliefAboutSelf: string;
  beliefAboutWorld: string;
}

export function createDefaultNarrativeLayer(): NarrativeLayer {
  return {
    currentArc: { arc: "stability", description: "", strength: 0.5 },
    chapters: [],
    beliefAboutSelf: "",
    beliefAboutWorld: "",
  };
}
