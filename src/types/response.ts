import type { EntityId, Tick } from "./common";
import type { EmotionType } from "../state/emotions";

export interface ActionResult {
  type: string;
  target?: EntityId;
  intensity: number;
  params: Record<string, unknown>;
}

export interface EmotionChange {
  type: EmotionType;
  intensity: number;
  source: string;
}

export interface RelationshipUpdate {
  targetId: EntityId;
  trust?: number;
  affection?: number;
  respect?: number;
  familiarity?: number;
}

export interface NeedChange {
  id: string;
  delta: number;
}

export interface MemoryFormed {
  description: string;
  emotionalValence: number;
  importance: number;
}

export interface InternalStateChanges {
  emotions: EmotionChange[];
  relationshipUpdates: RelationshipUpdate[];
  needChanges: NeedChange[];
  memoryFormed?: MemoryFormed;
  woundActivated?: string;
  habitFired?: string;
}

export interface ConflictResolution {
  a: string;
  b: string;
  winner: string;
  reason: string;
}

export interface AlternativeConsidered {
  action: string;
  score: number;
  rejected: string;
}

export interface ResponseTrace {
  appraisal: string;
  dominantMotive: string;
  conflictsResolved: ConflictResolution[];
  alternativesConsidered: AlternativeConsidered[];
}

export interface BehaviorResponse {
  personaId: EntityId;
  tick: Tick;
  action: ActionResult;
  internalStateChanges: InternalStateChanges;
  trace: ResponseTrace;
}
