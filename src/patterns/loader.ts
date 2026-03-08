import type { BehaviorPattern, PatternCategory } from "./types";
import { registerPatterns } from "./registry";

// Built-in prototype patterns embedded at build time
// In production, these would be loaded from data/patterns/*.json files
// For now, we embed prototypes directly for zero-config usage

import socialInsult from "./categories/social";
import socialBetrayal from "./categories/social-betrayal";
import combat from "./categories/combat";
import survival from "./categories/survival";
import emotional from "./categories/emotional";
import cognitive from "./categories/cognitive";
import moral from "./categories/moral";
import routine from "./categories/routine";

const ALL_PROTOTYPES: BehaviorPattern[] = [
  ...socialInsult,
  ...socialBetrayal,
  ...combat,
  ...survival,
  ...emotional,
  ...cognitive,
  ...moral,
  ...routine,
];

let loaded = false;

export function loadPrototypePatterns(): void {
  if (loaded) return;
  registerPatterns(ALL_PROTOTYPES);
  loaded = true;
}

export function resetPatternLoader(): void {
  loaded = false;
}

export function getPrototypePatterns(): BehaviorPattern[] {
  return ALL_PROTOTYPES;
}
