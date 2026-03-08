import type { EntityId, Tick } from "../types/common";
import type { PersonaState } from "../state/index";

export type TraceEventType =
  | "perception"
  | "appraisal"
  | "motive"
  | "conflict"
  | "decision"
  | "state_update"
  | "memory_formed"
  | "emotion_triggered"
  | "habit_fired"
  | "wound_activated";

export interface TraceEntry {
  id: string;
  tick: Tick;
  timestamp: number;
  personaId: EntityId;
  event: TraceEventType;
  data: Record<string, unknown>;
  parentId?: string;
}

export interface TraceLog {
  personaId: EntityId;
  startTick: Tick;
  endTick: Tick;
  entries: TraceEntry[];
}

export interface MotiveScore {
  label: string;
  score: number;
  source: string;
}

export interface ConflictRecord {
  motiveA: string;
  motiveB: string;
  resolution: string;
  winner: string;
}

export interface DecisionTrace {
  tick: Tick;
  personaId: EntityId;
  activeMotives: MotiveScore[];
  conflicts: ConflictRecord[];
  selectedAction: {
    actionId: string;
    confidence: number;
    reasoning: string;
  };
  stateDiffs: Array<{
    layer: keyof PersonaState;
    path: string;
    before: unknown;
    after: unknown;
  }>;
}
