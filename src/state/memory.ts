import type { EntityId, Tick } from "../types/common";

export interface EpisodicMemory {
  type: "episodic";
  id: string;
  description: string;
  participants: EntityId[];
  emotionalValence: number;
  importance: number;
  tick: Tick;
  decayRate: number;
}

export interface SemanticMemory {
  type: "semantic";
  id: string;
  fact: string;
  confidence: number;
  source: string;
  tick: Tick;
}

export type Memory = EpisodicMemory | SemanticMemory;

export interface MemoryLayer {
  memories: Memory[];
  capacity: number;
}

export function createDefaultMemoryLayer(): MemoryLayer {
  return {
    memories: [],
    capacity: 200,
  };
}
