import type { EntityId, Tick } from "../types/common";
import type { PersonaState } from "../state/index";
import type { PersonaSeed } from "../seed/persona-seed";
import type { ActionResult } from "../types/response";

// --- Tile System ---

export type TileType =
  | "grass"
  | "path"
  | "water"
  | "forest"
  | "wall"
  | "floor"
  | "door"
  | "bridge"
  | "mountain"
  | "dungeon_floor"
  | "dungeon_wall"
  | "cave_entrance"
  | "fence"
  | "plaza"
  | "market_stall";

export interface WorldTile {
  type: TileType;
  walkable: boolean;
  locationId?: string;
}

// --- Location System ---

export type LocationType =
  | "tavern"
  | "blacksmith"
  | "market"
  | "library"
  | "church"
  | "barracks"
  | "house"
  | "plaza"
  | "gate"
  | "forest"
  | "dungeon"
  | "wilderness";

export interface WorldLocation {
  id: string;
  name: string;
  nameKo: string;
  type: LocationType;
  bounds: { x: number; y: number; w: number; h: number };
  entrance: { x: number; y: number };
  safeZone: boolean;
}

// --- Agent System ---

export interface ScheduleEntry {
  startHour: number;
  endHour: number;
  locationId: string;
  activity: string;
  activityKo: string;
}

export interface WorldAgent {
  id: EntityId;
  personaKey: string;
  seed: PersonaSeed;
  state: PersonaState;
  x: number;
  y: number;
  path: { x: number; y: number }[];
  pathIndex: number;
  currentGoal: string;
  currentGoalKo: string;
  homeLocationId: string;
  workLocationId: string;
  schedule: ScheduleEntry[];
  lastAction?: ActionResult;
  emoji: string;
  nameKo: string;
  color: string;
  sleeping: boolean;
}

// --- Monster System ---

export type MonsterType = "wolf" | "goblin" | "skeleton" | "bandit";

export interface Monster {
  id: string;
  type: MonsterType;
  nameKo: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  strength: number;
  territory: { cx: number; cy: number; radius: number };
  alive: boolean;
  respawnTick: number;
}

// --- World Config ---

export interface WorldConfig {
  width: number;
  height: number;
  ticksPerDay: number;
  simSpeed: number;
}

// --- World State ---

export interface WorldState {
  config: WorldConfig;
  tiles: WorldTile[][];
  locations: WorldLocation[];
  agents: WorldAgent[];
  monsters: Monster[];
  currentTick: Tick;
  eventLog: WorldEvent[];
  paused: boolean;
  selectedAgentId: EntityId | null;
}

export interface WorldEvent {
  tick: Tick;
  hour: number;
  agentId: EntityId;
  agentName: string;
  description: string;
  descriptionKo: string;
  type: "move" | "social" | "combat" | "routine" | "rest" | "explore";
}

// --- Helpers ---

export function tickToHour(tick: Tick, ticksPerDay: number): number {
  return ((tick % ticksPerDay) / ticksPerDay) * 24;
}

export function hourToTimeString(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function getTimeOfDayLabel(hour: number): string {
  if (hour < 5) return "night";
  if (hour < 7) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 14) return "noon";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function getTimeOfDayLabelKo(hour: number): string {
  if (hour < 5) return "심야";
  if (hour < 7) return "새벽";
  if (hour < 12) return "오전";
  if (hour < 14) return "정오";
  if (hour < 18) return "오후";
  if (hour < 21) return "저녁";
  return "밤";
}
