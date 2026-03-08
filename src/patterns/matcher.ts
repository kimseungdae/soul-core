import type { PersonaState } from "../state/index";
import type { AppraisalResult } from "../core/appraisal/appraiser";
import type {
  BehaviorPattern,
  PatternConditions,
  PatternAction,
} from "./types";
import type { EmotionType } from "../state/emotions";

export interface PatternMatch {
  pattern: BehaviorPattern;
  score: number;
  selectedAction: PatternAction;
}

export function matchPatterns(
  state: PersonaState,
  appraisal: AppraisalResult,
  candidates: BehaviorPattern[],
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const pattern of candidates) {
    const score = evaluateConditions(state, appraisal, pattern.conditions);
    if (score > 0) {
      const selectedAction = selectWeightedAction(pattern.actions);
      matches.push({
        pattern,
        score: score * pattern.priority,
        selectedAction,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function evaluateConditions(
  state: PersonaState,
  appraisal: AppraisalResult,
  conditions: PatternConditions,
): number {
  let score = 1;
  let checks = 0;
  let passed = 0;

  // Trait conditions
  if (conditions.traits) {
    const allTraits: Record<string, number> = {
      ...(state.traits.core as unknown as Record<string, number>),
      openness: state.traits.bigFive.openness,
      conscientiousness: state.traits.bigFive.conscientiousness,
      extraversion: state.traits.bigFive.extraversion,
      agreeableness: state.traits.bigFive.agreeableness,
      neuroticism: state.traits.bigFive.neuroticism,
    };

    for (const [trait, condition] of Object.entries(conditions.traits)) {
      checks++;
      const value = allTraits[trait];
      if (value === undefined) continue;
      if (condition.min !== undefined && value < condition.min) return 0;
      if (condition.max !== undefined && value > condition.max) return 0;
      passed++;
      const range = (condition.max ?? 1) - (condition.min ?? 0);
      if (range > 0) {
        score *= 1 + (1 - range);
      }
    }
  }

  // Emotion conditions
  if (conditions.emotions) {
    for (const [emotionType, condition] of Object.entries(
      conditions.emotions,
    )) {
      if (!condition) continue;
      checks++;
      const emotion = state.emotions.active.find(
        (e) => e.type === (emotionType as EmotionType),
      );
      const intensity = emotion?.intensity ?? 0;
      if (condition.min !== undefined && intensity < condition.min) return 0;
      if (condition.max !== undefined && intensity > condition.max) return 0;
      passed++;
    }
  }

  // Appraisal tag conditions
  if (conditions.appraisalTags && conditions.appraisalTags.length > 0) {
    checks++;
    const matched = conditions.appraisalTags.filter((tag) =>
      appraisal.tags.includes(tag),
    );
    if (matched.length === 0) return 0;
    passed++;
    score *= matched.length / conditions.appraisalTags.length;
  }

  // Context conditions
  if (conditions.context) {
    for (const [key, value] of Object.entries(conditions.context)) {
      checks++;
      // Context is loosely matched — skip if not checkable
      passed++;
    }
  }

  // Need thresholds
  if (conditions.needsBelow) {
    for (const [needId, threshold] of Object.entries(conditions.needsBelow)) {
      checks++;
      const need = state.needs.needs.find((n) => n.id === needId);
      if (!need || need.current >= threshold) return 0;
      passed++;
      score *= 1 + (threshold - need.current);
    }
  }

  if (conditions.needsAbove) {
    for (const [needId, threshold] of Object.entries(conditions.needsAbove)) {
      checks++;
      const need = state.needs.needs.find((n) => n.id === needId);
      if (!need || need.current <= threshold) return 0;
      passed++;
      score *= 1 + (need.current - threshold);
    }
  }

  if (checks === 0) return 0;
  return score * (passed / checks);
}

function selectWeightedAction(actions: PatternAction[]): PatternAction {
  if (actions.length === 1) return actions[0];

  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
  // Deterministic: pick highest weight
  let best = actions[0];
  for (const action of actions) {
    if (action.weight / totalWeight > best.weight / totalWeight) {
      best = action;
    }
  }
  return best;
}
