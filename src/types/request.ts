import type { EntityId, Tick } from "./common";

export type EventCategory =
  | "social"
  | "combat"
  | "survival"
  | "emotional"
  | "cognitive"
  | "moral"
  | "routine";

export interface EventContext {
  location?: string;
  witnesses?: EntityId[];
  severity?: number;
  [key: string]: unknown;
}

export interface BehaviorEvent {
  category: EventCategory;
  action: string;
  source?: EntityId;
  target?: EntityId;
  context: EventContext;
}

export interface WorldState {
  nearbyEntities: EntityId[];
  timeOfDay?: string;
  safeZone?: boolean;
  environment?: Record<string, unknown>;
}

export type RequestType = "event" | "query" | "tick_update";

export interface BehaviorRequest {
  personaId: EntityId;
  tick: Tick;
  type: RequestType;
  event?: BehaviorEvent;
  worldState: WorldState;
}
