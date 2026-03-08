import type { BehaviorPattern, PatternCategory } from "./types";

const categoryStore = new Map<PatternCategory, BehaviorPattern[]>();

export function registerPattern(pattern: BehaviorPattern): void {
  const list = categoryStore.get(pattern.category) ?? [];
  list.push(pattern);
  categoryStore.set(pattern.category, list);
}

export function registerPatterns(patterns: BehaviorPattern[]): void {
  for (const p of patterns) {
    registerPattern(p);
  }
}

export function getPatternsByCategory(
  category: PatternCategory,
): BehaviorPattern[] {
  return categoryStore.get(category) ?? [];
}

export function getAllPatterns(): BehaviorPattern[] {
  const all: BehaviorPattern[] = [];
  for (const patterns of categoryStore.values()) {
    all.push(...patterns);
  }
  return all;
}

export function clearPatterns(): void {
  categoryStore.clear();
}

export function getPatternById(id: string): BehaviorPattern | undefined {
  for (const patterns of categoryStore.values()) {
    const found = patterns.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}
