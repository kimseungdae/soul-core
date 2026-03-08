import type { EntityId, Tick } from "../types/common";
import type { PersonaState } from "../state/index";
import type { PersonaSeed } from "../seed/persona-seed";
import type { ActionResult } from "../types/response";

// --- Resource System ---

export type ResourceType = "wood" | "ore" | "food" | "herb";

export type CraftedItemType = "weapon" | "tool" | "potion" | "meal";

export type ItemType = ResourceType | CraftedItemType;

export interface ResourceNode {
  id: string;
  type: ResourceType;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  regenRate: number;
  emoji: string;
  nameKo: string;
}

export interface Recipe {
  id: CraftedItemType;
  inputs: Partial<Record<ResourceType, number>>;
  output: CraftedItemType;
  ticks: number;
  skill: "crafting" | "combat" | "gathering";
  nameKo: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "weapon",
    inputs: { ore: 2, wood: 1 },
    output: "weapon",
    ticks: 15,
    skill: "crafting",
    nameKo: "무기",
  },
  {
    id: "tool",
    inputs: { wood: 2 },
    output: "tool",
    ticks: 8,
    skill: "crafting",
    nameKo: "도구",
  },
  {
    id: "potion",
    inputs: { herb: 2 },
    output: "potion",
    ticks: 6,
    skill: "crafting",
    nameKo: "물약",
  },
  {
    id: "meal",
    inputs: { food: 1 },
    output: "meal",
    ticks: 3,
    skill: "crafting",
    nameKo: "식사",
  },
];

export const RESOURCE_PRICES: Record<ItemType, number> = {
  wood: 2,
  ore: 5,
  food: 3,
  herb: 4,
  weapon: 15,
  tool: 8,
  potion: 10,
  meal: 5,
};

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
  // Deep behavior system
  inventory: Record<ItemType, number>;
  gold: number;
  hunger: number; // 0~1 (0=starving, 1=full)
  hp: number; // 0~100
  skills: { combat: number; crafting: number; gathering: number };
  moveCooldown: number; // ticks until next move
  actionTicks: number; // remaining ticks for current action (gathering/crafting)
  maxActionTicks: number; // total ticks for progress bar calculation
  actionTarget?: string; // resource node id or recipe id
  toolUses: number; // durability tracker, tool breaks at 10
  weaponUses: number; // durability tracker, weapon breaks at 20
  stunTicks: number; // ticks remaining when knocked out (hp=0)
  fatigue: number; // 0~1 (0=rested, 1=exhausted)
  previousGoal: string; // for goal chaining
  debts: Record<string, number>; // agentId → gold owed
  huntPartyWith?: string; // agentId of hunt partner
  pendingTrade?: {
    partnerId: string;
    give: ResourceType;
    giveAmt: number;
    receive: ResourceType;
    receiveAmt: number;
  };
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
  resourceNodes: ResourceNode[];
  currentTick: Tick;
  eventLog: WorldEvent[];
  paused: boolean;
  selectedAgentId: EntityId | null;
  marketPrices: Record<ItemType, number>;
  villageProject?: {
    name: string;
    nameKo: string;
    requiredItem: ItemType;
    requiredAmount: number;
    contributed: number;
    contributors: string[];
    deadline: number; // tick
  };
}

export interface WorldEvent {
  tick: Tick;
  hour: number;
  agentId: EntityId;
  agentName: string;
  description: string;
  descriptionKo: string;
  type:
    | "move"
    | "social"
    | "combat"
    | "routine"
    | "rest"
    | "explore"
    | "gather"
    | "craft"
    | "trade"
    | "eat"
    | "cooperate"
    | "think";
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
