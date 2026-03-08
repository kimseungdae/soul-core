import type { EntityId, Tick } from "../types/common";

export type RelationshipTag =
  | "family"
  | "friend"
  | "rival"
  | "lover"
  | "mentor"
  | "student"
  | "ally"
  | "enemy"
  | "stranger"
  | "acquaintance"
  | "custom";

export interface Relationship {
  targetId: EntityId;
  tags: RelationshipTag[];
  trust: number;
  familiarity: number;
  affection: number;
  respect: number;
  fear: number;
  admiration: number;
  resentment: number;
  loyalty: number;
  obligation: number;
  rivalry: number;
  comfort: number;
  dependency: number;
  perceivedStatus: number;
  lastInteraction: Tick;
}

export interface SocialLayer {
  relationships: Relationship[];
}

export function createDefaultSocialLayer(): SocialLayer {
  return { relationships: [] };
}

export function createRelationship(
  targetId: EntityId,
  tick: Tick,
): Relationship {
  return {
    targetId,
    tags: ["stranger"],
    trust: 0,
    familiarity: 0,
    affection: 0,
    respect: 0,
    fear: 0,
    admiration: 0,
    resentment: 0,
    loyalty: 0,
    obligation: 0,
    rivalry: 0,
    comfort: 0,
    dependency: 0,
    perceivedStatus: 0,
    lastInteraction: tick,
  };
}
