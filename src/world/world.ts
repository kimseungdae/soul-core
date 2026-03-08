import type {
  WorldState,
  WorldAgent,
  Monster,
  WorldConfig,
  WorldEvent,
  WorldLocation,
} from "./types";
import { tickToHour, getTimeOfDayLabel } from "./types";
import type { PersonaSeed } from "../seed/persona-seed";
import type { BehaviorRequest, EventCategory } from "../types/request";
import { hydratePersona } from "../seed/hydrate";
import { processBehavior } from "../core/pipeline";
import { createVillageMap } from "./tilemap";
import { findPath, distance, isAdjacent, type Point } from "./pathfinding";

const DEFAULT_CONFIG: WorldConfig = {
  width: 64,
  height: 64,
  ticksPerDay: 48,
  simSpeed: 1,
};

export function createWorldState(
  agentDefs: AgentDef[],
  config: Partial<WorldConfig> = {},
): WorldState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const mapData = createVillageMap();
  const agents = agentDefs.map((def) => createAgent(def, mapData.locations));
  const monsters = createMonsters();

  // Start at midnight → agents should be sleeping at home
  for (const agent of agents) {
    agent.sleeping = true;
    agent.currentGoal = "sleeping";
    agent.currentGoalKo = "수면 중";
    agent.emoji = "💤";
  }

  return {
    config: cfg,
    tiles: mapData.tiles,
    locations: mapData.locations,
    agents,
    monsters,
    currentTick: 0,
    eventLog: [],
    paused: false,
    selectedAgentId: null,
  };
}

// --- Agent Definition ---

export interface AgentDef {
  seed: PersonaSeed;
  nameKo: string;
  color: string;
  emoji: string;
  homeLocationId: string;
  workLocationId: string;
  schedule: WorldAgent["schedule"];
}

function createAgent(def: AgentDef, locations: WorldLocation[]): WorldAgent {
  const home = locations.find((l) => l.id === def.homeLocationId);
  const startPos = home ? home.entrance : { x: 31, y: 30 };

  return {
    id: def.seed.id,
    personaKey: def.seed.id,
    seed: def.seed,
    state: hydratePersona(def.seed),
    x: startPos.x,
    y: startPos.y,
    path: [],
    pathIndex: 0,
    currentGoal: "idle",
    currentGoalKo: "대기 중",
    homeLocationId: def.homeLocationId,
    workLocationId: def.workLocationId,
    schedule: def.schedule,
    emoji: def.emoji,
    nameKo: def.nameKo,
    color: def.color,
    sleeping: false,
  };
}

// --- Monsters ---

function createMonsters(): Monster[] {
  return [
    {
      id: "wolf-1",
      type: "wolf",
      nameKo: "늑대",
      x: 12,
      y: 7,
      hp: 30,
      maxHp: 30,
      strength: 0.4,
      territory: { cx: 12, cy: 7, radius: 5 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "wolf-2",
      type: "wolf",
      nameKo: "늑대",
      x: 48,
      y: 7,
      hp: 30,
      maxHp: 30,
      strength: 0.4,
      territory: { cx: 48, cy: 7, radius: 5 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "wolf-3",
      type: "wolf",
      nameKo: "늑대",
      x: 12,
      y: 57,
      hp: 30,
      maxHp: 30,
      strength: 0.4,
      territory: { cx: 12, cy: 57, radius: 5 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "goblin-1",
      type: "goblin",
      nameKo: "고블린",
      x: 28,
      y: 10,
      hp: 40,
      maxHp: 40,
      strength: 0.5,
      territory: { cx: 30, cy: 9, radius: 6 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "goblin-2",
      type: "goblin",
      nameKo: "고블린",
      x: 34,
      y: 10,
      hp: 40,
      maxHp: 40,
      strength: 0.5,
      territory: { cx: 34, cy: 9, radius: 6 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "skeleton-1",
      type: "skeleton",
      nameKo: "스켈레톤",
      x: 31,
      y: 6,
      hp: 50,
      maxHp: 50,
      strength: 0.6,
      territory: { cx: 31, cy: 6, radius: 3 },
      alive: true,
      respawnTick: -1,
    },
    {
      id: "bandit-1",
      type: "bandit",
      nameKo: "산적",
      x: 50,
      y: 56,
      hp: 45,
      maxHp: 45,
      strength: 0.55,
      territory: { cx: 50, cy: 56, radius: 5 },
      alive: true,
      respawnTick: -1,
    },
  ];
}

// --- World Tick ---

export function worldTick(world: WorldState): WorldEvent[] {
  if (world.paused) return [];

  world.currentTick++;
  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  const timeOfDay = getTimeOfDayLabel(hour);
  const events: WorldEvent[] = [];

  // Respawn dead monsters
  for (const m of world.monsters) {
    if (!m.alive && world.currentTick >= m.respawnTick) {
      m.alive = true;
      m.hp = m.maxHp;
      m.x = m.territory.cx;
      m.y = m.territory.cy;
    }
  }

  // Move monsters randomly within territory
  for (const m of world.monsters) {
    if (!m.alive) continue;
    if (Math.random() < 0.3) {
      const dx = Math.floor(Math.random() * 3) - 1;
      const dy = Math.floor(Math.random() * 3) - 1;
      const nx = m.x + dx;
      const ny = m.y + dy;
      if (
        nx >= 0 &&
        nx < world.config.width &&
        ny >= 0 &&
        ny < world.config.height &&
        world.tiles[ny][nx].walkable &&
        distance({ x: nx, y: ny }, { x: m.territory.cx, y: m.territory.cy }) <=
          m.territory.radius
      ) {
        m.x = nx;
        m.y = ny;
      }
    }
  }

  // Process each agent
  for (const agent of world.agents) {
    const agentEvents = processAgent(world, agent, hour, timeOfDay);
    events.push(...agentEvents);
  }

  // Trim event log
  world.eventLog.push(...events);
  if (world.eventLog.length > 200) {
    world.eventLog = world.eventLog.slice(-200);
  }

  return events;
}

function processAgent(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
  timeOfDay: string,
): WorldEvent[] {
  const events: WorldEvent[] = [];

  // 1. Determine goal from schedule
  updateGoal(world, agent, hour);

  // 2. Check for nearby monsters (combat)
  const nearbyMonster = world.monsters.find(
    (m) =>
      m.alive && isAdjacent({ x: agent.x, y: agent.y }, { x: m.x, y: m.y }),
  );

  if (nearbyMonster && !isInVillage(world, agent)) {
    const combatEvent = handleCombat(world, agent, nearbyMonster);
    events.push(combatEvent);
    return events;
  }

  // 3. Check for nearby agents (social interaction)
  const nearbyAgent = world.agents.find(
    (a) =>
      a.id !== agent.id &&
      !a.sleeping &&
      isAdjacent({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }),
  );

  if (nearbyAgent && Math.random() < 0.15 && !agent.sleeping) {
    const socialEvent = handleSocial(world, agent, nearbyAgent);
    events.push(socialEvent);
    return events;
  }

  // 4. Move toward goal
  if (agent.path.length > 0 && agent.pathIndex < agent.path.length) {
    const next = agent.path[agent.pathIndex];
    agent.x = next.x;
    agent.y = next.y;
    agent.pathIndex++;

    // Arrived at home → start sleeping
    if (
      agent.currentGoal === "going_home" &&
      agent.pathIndex >= agent.path.length
    ) {
      agent.currentGoal = "sleeping";
      agent.currentGoalKo = "수면 중";
      agent.sleeping = true;
    }
  } else if (agent.currentGoal === "going_home") {
    // Already at home location → sleep immediately
    agent.currentGoal = "sleeping";
    agent.currentGoalKo = "수면 중";
    agent.sleeping = true;
  } else if (!agent.sleeping) {
    // Arrived at destination or no path - do routine behavior
    const routineEvent = handleRoutine(world, agent, hour, timeOfDay);
    if (routineEvent) events.push(routineEvent);
  }

  // Enforce state emoji
  if (agent.sleeping) {
    agent.emoji = "💤";
  } else if (agent.currentGoal === "going_home") {
    agent.emoji = "🏠";
  }

  return events;
}

function updateGoal(world: WorldState, agent: WorldAgent, hour: number) {
  const scheduled = agent.schedule.find(
    (s) => hour >= s.startHour && hour < s.endHour,
  );

  if (!scheduled) {
    // Default: go home and sleep at night
    if (hour >= 22 || hour < 5) {
      if (
        agent.currentGoal !== "sleeping" &&
        agent.currentGoal !== "going_home"
      ) {
        agent.currentGoal = "going_home";
        agent.currentGoalKo = "귀가 중";
        agent.sleeping = false;
        navigateTo(world, agent, agent.homeLocationId);
      }
    } else {
      if (
        agent.currentGoal === "sleeping" ||
        agent.currentGoal === "going_home"
      ) {
        agent.sleeping = false;
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
      }
    }
    return;
  }

  // Wake up if sleeping and schedule starts
  if (agent.sleeping || agent.currentGoal === "going_home") {
    agent.sleeping = false;
  }

  if (agent.currentGoal !== scheduled.activity) {
    agent.currentGoal = scheduled.activity;
    agent.currentGoalKo = scheduled.activityKo;
    navigateTo(world, agent, scheduled.locationId);
  }
}

function navigateTo(world: WorldState, agent: WorldAgent, locationId: string) {
  const location = world.locations.find((l) => l.id === locationId);
  if (!location) return;

  const path = findPath(
    world.tiles,
    { x: agent.x, y: agent.y },
    location.entrance,
  );
  agent.path = path;
  agent.pathIndex = 0;
}

function isInVillage(world: WorldState, agent: WorldAgent): boolean {
  const tile = world.tiles[agent.y]?.[agent.x];
  if (!tile) return false;
  if (tile.locationId) {
    const loc = world.locations.find((l) => l.id === tile.locationId);
    return loc?.safeZone ?? false;
  }
  return agent.x >= 17 && agent.x <= 46 && agent.y >= 15 && agent.y <= 48;
}

function getAgentLocation(
  world: WorldState,
  agent: WorldAgent,
): WorldLocation | undefined {
  const tile = world.tiles[agent.y]?.[agent.x];
  if (tile?.locationId) {
    return world.locations.find((l) => l.id === tile.locationId);
  }
  return undefined;
}

// --- Event Handlers ---

function handleCombat(
  world: WorldState,
  agent: WorldAgent,
  monster: Monster,
): WorldEvent {
  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  const nearbyAllies = world.agents.filter(
    (a) =>
      a.id !== agent.id &&
      isAdjacent({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }),
  );

  const request: BehaviorRequest = {
    personaId: agent.id,
    tick: world.currentTick,
    type: "event",
    event: {
      category: "combat" as EventCategory,
      action: "attacked_by",
      source: monster.id,
      context: {
        severity: monster.strength,
        location: "wilderness",
        monsterType: monster.type,
      },
    },
    worldState: {
      nearbyEntities: [monster.id, ...nearbyAllies.map((a) => a.id)],
      safeZone: false,
      timeOfDay: getTimeOfDayLabel(hour),
    },
  };

  const response = processBehavior(agent.state, request, { mutateState: true });
  agent.lastAction = response.action;

  // Combat resolution
  const actionType = response.action.type;
  let descKo: string;
  if (
    actionType.includes("attack") ||
    actionType.includes("fight") ||
    actionType.includes("retaliat")
  ) {
    monster.hp -= Math.floor(response.action.intensity * 30);
    if (monster.hp <= 0) {
      monster.alive = false;
      monster.respawnTick = world.currentTick + 20;
      descKo = `${agent.nameKo}이(가) ${monster.nameKo}을(를) 처치했다!`;
    } else {
      descKo = `${agent.nameKo}이(가) ${monster.nameKo}과(와) 전투 중 (HP: ${monster.hp}/${monster.maxHp})`;
    }
    agent.emoji = "⚔️";
  } else if (actionType.includes("flee") || actionType.includes("escape")) {
    navigateTo(world, agent, agent.homeLocationId);
    descKo = `${agent.nameKo}이(가) ${monster.nameKo}에게서 도망쳤다`;
    agent.emoji = "🏃";
  } else {
    descKo = `${agent.nameKo}이(가) ${monster.nameKo}과(와) 조우했다`;
    agent.emoji = "⚠️";
  }

  return {
    tick: world.currentTick,
    hour,
    agentId: agent.id,
    agentName: agent.nameKo,
    description: `${agent.seed.name} encounters ${monster.type}`,
    descriptionKo: descKo,
    type: "combat",
  };
}

function handleSocial(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
): WorldEvent {
  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  const location = getAgentLocation(world, agent);
  const locName = location?.nameKo ?? "마을";

  const actions = [
    "greeted_by",
    "talked_with",
    "helped_by",
    "complimented_by",
    "asked_favor_by",
  ];
  const action = actions[Math.floor(Math.random() * actions.length)];

  const request: BehaviorRequest = {
    personaId: agent.id,
    tick: world.currentTick,
    type: "event",
    event: {
      category: "social" as EventCategory,
      action,
      source: other.id,
      context: {
        severity: 0.3 + Math.random() * 0.4,
        location: location?.id ?? "village",
        witnesses: world.agents
          .filter(
            (a) =>
              a.id !== agent.id &&
              a.id !== other.id &&
              isAdjacent({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }),
          )
          .map((a) => a.id),
      },
    },
    worldState: {
      nearbyEntities: world.agents
        .filter(
          (a) =>
            a.id !== agent.id &&
            distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) <= 5,
        )
        .map((a) => a.id),
      safeZone: location?.safeZone ?? true,
      timeOfDay: getTimeOfDayLabel(hour),
    },
  };

  const response = processBehavior(agent.state, request, { mutateState: true });
  agent.lastAction = response.action;

  const socialLabels: Record<string, string> = {
    greeted_by: "인사",
    talked_with: "대화",
    helped_by: "도움",
    complimented_by: "칭찬",
    asked_favor_by: "부탁",
  };

  agent.emoji = "💬";
  const descKo = `${agent.nameKo}이(가) ${other.nameKo}와(과) ${locName}에서 ${socialLabels[action] ?? action}`;

  return {
    tick: world.currentTick,
    hour,
    agentId: agent.id,
    agentName: agent.nameKo,
    description: `${agent.seed.name} ${action} ${other.seed.name}`,
    descriptionKo: descKo,
    type: "social",
  };
}

function handleRoutine(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
  _timeOfDay: string,
): WorldEvent | null {
  const location = getAgentLocation(world, agent);
  if (!location) return null;

  // Determine routine action based on location
  const routineActions: Record<
    string,
    { action: string; category: EventCategory; descKo: string; emoji: string }
  > = {
    tavern: {
      action: "eating",
      category: "routine",
      descKo: "식사 중",
      emoji: "🍺",
    },
    blacksmith: {
      action: "working",
      category: "routine",
      descKo: "대장장이 작업 중",
      emoji: "🔨",
    },
    market: {
      action: "trading",
      category: "routine",
      descKo: "거래 중",
      emoji: "💰",
    },
    library: {
      action: "studying",
      category: "cognitive",
      descKo: "공부 중",
      emoji: "📖",
    },
    church: {
      action: "praying",
      category: "routine",
      descKo: "기도 중",
      emoji: "🙏",
    },
    barracks: {
      action: "training",
      category: "combat",
      descKo: "훈련 중",
      emoji: "🗡️",
    },
    plaza: {
      action: "wandering",
      category: "routine",
      descKo: "산책 중",
      emoji: "🚶",
    },
  };

  const routine = routineActions[location.type];
  if (!routine) {
    agent.emoji = agent.sleeping ? "💤" : "🏠";
    return null;
  }

  agent.emoji = routine.emoji;

  // Only generate events occasionally for routines
  if (Math.random() > 0.2) return null;

  const request: BehaviorRequest = {
    personaId: agent.id,
    tick: world.currentTick,
    type: "tick_update",
    worldState: {
      nearbyEntities: world.agents
        .filter(
          (a) =>
            a.id !== agent.id &&
            distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) <= 5,
        )
        .map((a) => a.id),
      safeZone: location.safeZone,
      timeOfDay: getTimeOfDayLabel(hour),
      environment: { location: location.id, activity: routine.action },
    },
  };

  const response = processBehavior(agent.state, request, { mutateState: true });
  agent.lastAction = response.action;

  return {
    tick: world.currentTick,
    hour,
    agentId: agent.id,
    agentName: agent.nameKo,
    description: `${agent.seed.name} ${routine.action} at ${location.name}`,
    descriptionKo: `${agent.nameKo}: ${location.nameKo}에서 ${routine.descKo}`,
    type: "routine",
  };
}
