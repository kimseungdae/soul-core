export type {
  BehaviorPattern,
  PatternCategory,
  PatternConditions,
  PatternAction,
  PatternStateEffect,
  TraitCondition,
  EmotionCondition,
} from "./types";

export {
  registerPattern,
  registerPatterns,
  getPatternsByCategory,
  getAllPatterns,
  clearPatterns,
  getPatternById,
} from "./registry";

export { matchPatterns } from "./matcher";
export type { PatternMatch } from "./matcher";

export {
  loadPrototypePatterns,
  resetPatternLoader,
  getPrototypePatterns,
} from "./loader";
