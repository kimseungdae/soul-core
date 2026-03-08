import type { PersonaState } from "../state/index";

export interface StateSnapshot {
  tick: number;
  timestamp: number;
  personaId: string;
  state: PersonaState;
}

export interface StateDiff {
  layer: string;
  before: unknown;
  after: unknown;
}

export function takeSnapshot(state: PersonaState): StateSnapshot {
  return {
    tick: state.tick,
    timestamp: Date.now(),
    personaId: state.id,
    state: structuredClone(state),
  };
}

export function diffSnapshots(
  before: StateSnapshot,
  after: StateSnapshot,
): StateDiff[] {
  const diffs: StateDiff[] = [];
  const layers = [
    "traits",
    "values",
    "identity",
    "needs",
    "emotions",
    "social",
    "memory",
    "interest",
    "wounds",
    "habits",
    "narrative",
  ] as const;

  for (const layer of layers) {
    const b = JSON.stringify(before.state[layer]);
    const a = JSON.stringify(after.state[layer]);
    if (b !== a) {
      diffs.push({
        layer,
        before: before.state[layer],
        after: after.state[layer],
      });
    }
  }
  return diffs;
}
