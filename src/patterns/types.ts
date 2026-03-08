import type { AppraisalTag } from "../core/appraisal/appraiser";
import type { EmotionType } from "../state/emotions";

export type PatternCategory =
  | "social"
  | "combat"
  | "survival"
  | "emotional"
  | "cognitive"
  | "moral"
  | "routine";

export interface TraitCondition {
  min?: number;
  max?: number;
}

export interface EmotionCondition {
  min?: number;
  max?: number;
}

export interface PatternConditions {
  traits?: Record<string, TraitCondition>;
  emotions?: Partial<Record<EmotionType, EmotionCondition>>;
  appraisalTags?: AppraisalTag[];
  context?: Record<string, unknown>;
  needsBelow?: Record<string, number>;
  needsAbove?: Record<string, number>;
}

export interface PatternAction {
  type: string;
  weight: number;
  params?: Record<string, unknown>;
}

export interface PatternStateEffect {
  emotions?: Partial<Record<EmotionType, number>>;
  relationships?: {
    source?: Record<string, number>;
    target?: Record<string, number>;
  };
  needs?: Record<string, number>;
}

export interface BehaviorPattern {
  id: string;
  category: PatternCategory;
  subcategory: string;
  description: string;
  conditions: PatternConditions;
  actions: PatternAction[];
  stateEffects: PatternStateEffect;
  priority: number;
}
