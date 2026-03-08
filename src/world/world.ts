import type {
  WorldState,
  WorldAgent,
  Monster,
  WorldConfig,
  WorldEvent,
  WorldLocation,
  ResourceNode,
  ItemType,
  ResourceType,
} from "./types";
import {
  tickToHour,
  getTimeOfDayLabel,
  RECIPES,
  RESOURCE_PRICES,
} from "./types";
import type { PersonaSeed } from "../seed/persona-seed";
import type { BehaviorRequest, EventCategory } from "../types/request";
import { hydratePersona } from "../seed/hydrate";
import { processBehavior } from "../core/pipeline";
import { createVillageMap } from "./tilemap";
import { findPath, distance, isAdjacent, type Point } from "./pathfinding";

const DEFAULT_CONFIG: WorldConfig = {
  width: 64,
  height: 64,
  ticksPerDay: 288,
  simSpeed: 1,
};

const MOVE_COOLDOWN = 3; // ticks between moves
const HUNGER_DECAY = 0.003; // per tick
const HUNGER_THRESHOLD = 0.3; // urgent eat
const GATHER_TICKS: Record<ResourceType, number> = {
  wood: 8,
  ore: 10,
  food: 6,
  herb: 4,
};
const MONSTER_RESPAWN_TICKS = 120;

function emptyInventory(): Record<ItemType, number> {
  return {
    wood: 0,
    ore: 0,
    food: 0,
    herb: 0,
    weapon: 0,
    tool: 0,
    potion: 0,
    meal: 0,
  };
}

export function createWorldState(
  agentDefs: AgentDef[],
  config: Partial<WorldConfig> = {},
): WorldState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const mapData = createVillageMap();
  const agents = agentDefs.map((def) => createAgent(def, mapData.locations));
  const monsters = createMonsters();

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
    resourceNodes: mapData.resourceNodes,
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
  initialGold?: number;
  initialSkills?: Partial<WorldAgent["skills"]>;
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
    inventory: emptyInventory(),
    gold: def.initialGold ?? 10,
    hunger: 0.8,
    skills: {
      combat: 0.3,
      crafting: 0.3,
      gathering: 0.3,
      ...def.initialSkills,
    },
    moveCooldown: 0,
    actionTicks: 0,
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

  // Regenerate resource nodes
  for (const node of world.resourceNodes) {
    if (node.amount < node.maxAmount) {
      node.amount = Math.min(node.maxAmount, node.amount + node.regenRate);
    }
  }

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
    if (Math.random() < 0.15) {
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

// --- Agent Processing ---

function processAgent(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
  timeOfDay: string,
): WorldEvent[] {
  const events: WorldEvent[] = [];

  // Hunger decay (only while awake)
  if (!agent.sleeping) {
    agent.hunger = Math.max(0, agent.hunger - HUNGER_DECAY);
  }

  // If performing an action (gathering/crafting), continue it
  if (agent.actionTicks > 0) {
    agent.actionTicks--;
    if (agent.actionTicks === 0) {
      const actionEvent = completeAction(world, agent, hour);
      if (actionEvent) events.push(actionEvent);
    }
    return events;
  }

  // Determine goal (need-driven autonomous behavior)
  updateGoalAutonomous(world, agent, hour);

  // Check for nearby monsters (combat)
  const nearbyMonster = world.monsters.find(
    (m) =>
      m.alive && isAdjacent({ x: agent.x, y: agent.y }, { x: m.x, y: m.y }),
  );

  if (nearbyMonster && !isInVillage(world, agent)) {
    const combatEvent = handleCombat(world, agent, nearbyMonster);
    events.push(combatEvent);
    return events;
  }

  // Check for nearby agents (social/trade/cooperate)
  if (!agent.sleeping) {
    const nearbyAgent = world.agents.find(
      (a) =>
        a.id !== agent.id &&
        !a.sleeping &&
        isAdjacent({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }),
    );

    if (nearbyAgent) {
      // Try trade first
      if (Math.random() < 0.08) {
        const tradeEvent = tryTrade(world, agent, nearbyAgent, hour);
        if (tradeEvent) {
          events.push(tradeEvent);
          return events;
        }
      }
      // Cooperate/help
      if (Math.random() < 0.06) {
        const coopEvent = tryCooperate(world, agent, nearbyAgent, hour);
        if (coopEvent) {
          events.push(coopEvent);
          return events;
        }
      }
      // Regular social
      if (Math.random() < 0.1) {
        const socialEvent = handleSocial(world, agent, nearbyAgent);
        events.push(socialEvent);
        return events;
      }
    }
  }

  // Movement with cooldown
  if (agent.path.length > 0 && agent.pathIndex < agent.path.length) {
    if (agent.moveCooldown > 0) {
      agent.moveCooldown--;
    } else {
      const next = agent.path[agent.pathIndex];
      agent.x = next.x;
      agent.y = next.y;
      agent.pathIndex++;
      agent.moveCooldown =
        agent.hunger < 0.1 ? MOVE_COOLDOWN + 2 : MOVE_COOLDOWN;

      // Arrived at home → start sleeping
      if (
        agent.currentGoal === "going_home" &&
        agent.pathIndex >= agent.path.length
      ) {
        agent.currentGoal = "sleeping";
        agent.currentGoalKo = "수면 중";
        agent.sleeping = true;
      }

      // Arrived at resource node → start gathering
      if (
        agent.currentGoal === "gathering" &&
        agent.pathIndex >= agent.path.length
      ) {
        const node = world.resourceNodes.find(
          (n) => n.id === agent.actionTarget,
        );
        if (node && node.amount >= 1) {
          agent.actionTicks = GATHER_TICKS[node.type];
          agent.emoji = node.emoji;
          const ev = makeEvent(
            world,
            agent,
            hour,
            "gather",
            `${agent.nameKo}이(가) ${node.nameKo}을(를) 채집 중`,
          );
          events.push(ev);
        } else {
          agent.currentGoal = "idle";
          agent.currentGoalKo = "자유 시간";
          agent.actionTarget = undefined;
        }
      }

      // Arrived at crafting location → start crafting
      if (
        agent.currentGoal === "crafting" &&
        agent.pathIndex >= agent.path.length
      ) {
        const recipe = RECIPES.find((r) => r.id === agent.actionTarget);
        if (recipe && hasIngredients(agent, recipe.inputs)) {
          agent.actionTicks = recipe.ticks;
          agent.emoji = "🔨";
          const ev = makeEvent(
            world,
            agent,
            hour,
            "craft",
            `${agent.nameKo}이(가) ${recipe.nameKo} 제작 중`,
          );
          events.push(ev);
        } else {
          agent.currentGoal = "idle";
          agent.currentGoalKo = "자유 시간";
          agent.actionTarget = undefined;
        }
      }
    }
  } else if (agent.currentGoal === "going_home") {
    agent.currentGoal = "sleeping";
    agent.currentGoalKo = "수면 중";
    agent.sleeping = true;
  } else if (agent.currentGoal === "eating" && !agent.sleeping) {
    // Eat food from inventory
    const eatEvent = doEat(world, agent, hour);
    if (eatEvent) events.push(eatEvent);
  } else if (!agent.sleeping) {
    // At destination - do routine behavior
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

// --- Autonomous Goal System ---

function updateGoalAutonomous(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
) {
  // Night: go home and sleep
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
    return;
  }

  // Wake up if sleeping during day
  if (agent.sleeping || agent.currentGoal === "going_home") {
    if (hour >= 5 && hour < 22) {
      agent.sleeping = false;
    } else {
      return;
    }
  }

  // Skip if busy with action
  if (agent.actionTicks > 0) return;
  // Skip if already pathfinding (unless idle)
  if (
    agent.path.length > 0 &&
    agent.pathIndex < agent.path.length &&
    agent.currentGoal !== "idle"
  )
    return;

  // Priority 1: Hunger — eat or hunt
  if (agent.hunger < HUNGER_THRESHOLD) {
    if (agent.inventory.food > 0 || agent.inventory.meal > 0) {
      // Go home or tavern to eat
      agent.currentGoal = "eating";
      agent.currentGoalKo = "식사하러 이동 중";
      agent.emoji = "🍖";
      navigateTo(world, agent, "tavern");
      return;
    }
    // No food — go hunting
    const huntNode = findNearestResource(world, agent, "food");
    if (huntNode) {
      agent.currentGoal = "gathering";
      agent.currentGoalKo = "사냥 중";
      agent.emoji = "🏹";
      agent.actionTarget = huntNode.id;
      navigateToPoint(world, agent, { x: huntNode.x, y: huntNode.y });
      return;
    }
    // Buy food if has gold
    if (agent.gold >= RESOURCE_PRICES.food) {
      agent.currentGoal = "buying_food";
      agent.currentGoalKo = "음식 구매하러 이동 중";
      agent.emoji = "💰";
      navigateTo(world, agent, "market");
      return;
    }
  }

  // Priority 2: Job-based activity (schedule)
  const scheduled = agent.schedule.find(
    (s) => hour >= s.startHour && hour < s.endHour,
  );

  if (scheduled) {
    if (agent.currentGoal !== scheduled.activity) {
      agent.currentGoal = scheduled.activity;
      agent.currentGoalKo = scheduled.activityKo;
      navigateTo(world, agent, scheduled.locationId);
    }
    return;
  }

  // Priority 3: Craft if has materials (especially for craftsmen)
  if (agent.currentGoal === "idle" || agent.currentGoal === "자유 시간") {
    const recipe = findCraftableRecipe(agent);
    if (recipe && agent.skills.crafting > 0.2) {
      agent.currentGoal = "crafting";
      agent.currentGoalKo = `${recipe.nameKo} 제작하러 이동 중`;
      agent.emoji = "🔨";
      agent.actionTarget = recipe.id;
      navigateTo(world, agent, agent.workLocationId);
      return;
    }
  }

  // Priority 4: Gather resources (if idle and not hungry)
  if (agent.currentGoal === "idle" && agent.hunger > 0.4) {
    // Pick a resource based on agent role
    const targetType = pickGatherTarget(agent);
    if (targetType) {
      const node = findNearestResource(world, agent, targetType);
      if (node) {
        agent.currentGoal = "gathering";
        agent.currentGoalKo = `${node.nameKo} 채집하러 이동 중`;
        agent.emoji = node.emoji;
        agent.actionTarget = node.id;
        navigateToPoint(world, agent, { x: node.x, y: node.y });
        return;
      }
    }
  }

  // Priority 5: Think (if idle for too long)
  if (agent.currentGoal === "idle" && Math.random() < 0.05) {
    agent.currentGoal = "thinking";
    agent.currentGoalKo = "고민 중";
    agent.emoji = "💭";
    // Wander to plaza
    navigateTo(world, agent, "plaza");
    return;
  }

  // Default: idle / free time
  if (
    agent.currentGoal !== "idle" &&
    agent.currentGoal !== "thinking" &&
    !scheduled &&
    agent.path.length === 0
  ) {
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
  }
}

// --- Resource Helpers ---

function findNearestResource(
  world: WorldState,
  agent: WorldAgent,
  type: ResourceType,
): ResourceNode | undefined {
  return world.resourceNodes
    .filter((n) => n.type === type && n.amount >= 1)
    .sort(
      (a, b) =>
        distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) -
        distance({ x: agent.x, y: agent.y }, { x: b.x, y: b.y }),
    )[0];
}

function pickGatherTarget(agent: WorldAgent): ResourceType | null {
  const roles = agent.seed.roles ?? [];
  if (roles.includes("blacksmith") || roles.includes("craftsman")) {
    if (agent.inventory.ore < 3) return "ore";
    if (agent.inventory.wood < 2) return "wood";
  }
  if (roles.includes("healer") || roles.includes("priestess")) {
    if (agent.inventory.herb < 3) return "herb";
  }
  if (roles.includes("warrior") || roles.includes("guardian")) {
    if (agent.inventory.food < 2) return "food";
    return "wood";
  }
  if (roles.includes("merchant") || roles.includes("trader")) {
    // Merchants gather varied resources to sell
    const lowest = (["wood", "ore", "herb"] as ResourceType[]).sort(
      (a, b) => agent.inventory[a] - agent.inventory[b],
    )[0];
    return lowest;
  }
  // Default: gather wood or food
  if (agent.inventory.food < 2) return "food";
  if (Math.random() < 0.5) return "wood";
  return null;
}

function findCraftableRecipe(agent: WorldAgent) {
  return RECIPES.find((r) => hasIngredients(agent, r.inputs));
}

function hasIngredients(
  agent: WorldAgent,
  inputs: Partial<Record<ResourceType, number>>,
): boolean {
  for (const [res, amt] of Object.entries(inputs)) {
    if ((agent.inventory[res as ResourceType] ?? 0) < (amt ?? 0)) return false;
  }
  return true;
}

function consumeIngredients(
  agent: WorldAgent,
  inputs: Partial<Record<ResourceType, number>>,
) {
  for (const [res, amt] of Object.entries(inputs)) {
    agent.inventory[res as ItemType] -= amt ?? 0;
  }
}

// --- Action Completion ---

function completeAction(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
): WorldEvent | null {
  if (agent.currentGoal === "gathering" && agent.actionTarget) {
    const node = world.resourceNodes.find((n) => n.id === agent.actionTarget);
    if (node && node.amount >= 1) {
      const amount = Math.min(
        Math.floor(node.amount),
        1 + Math.floor(agent.skills.gathering * 2),
      );
      node.amount -= amount;
      agent.inventory[node.type] += amount;
      agent.skills.gathering = Math.min(1, agent.skills.gathering + 0.005);
      agent.currentGoal = "idle";
      agent.currentGoalKo = "자유 시간";
      agent.actionTarget = undefined;

      // If gathered food, gain some food for hunting
      if (node.type === "food") {
        agent.emoji = "🏹";
        return makeEvent(
          world,
          agent,
          hour,
          "gather",
          `${agent.nameKo}이(가) 사냥에 성공! (고기 +${amount})`,
        );
      }

      const gatherEmoji: Record<ResourceType, string> = {
        wood: "🪓",
        ore: "⛏️",
        food: "🏹",
        herb: "🌿",
      };
      agent.emoji = gatherEmoji[node.type] ?? "📦";
      return makeEvent(
        world,
        agent,
        hour,
        "gather",
        `${agent.nameKo}이(가) ${node.nameKo} ${amount}개 채집 완료`,
      );
    }
  }

  if (agent.currentGoal === "crafting" && agent.actionTarget) {
    const recipe = RECIPES.find((r) => r.id === agent.actionTarget);
    if (recipe && hasIngredients(agent, recipe.inputs)) {
      consumeIngredients(agent, recipe.inputs);
      agent.inventory[recipe.output] += 1;
      agent.skills.crafting = Math.min(1, agent.skills.crafting + 0.008);
      agent.currentGoal = "idle";
      agent.currentGoalKo = "자유 시간";
      agent.actionTarget = undefined;
      agent.emoji = "✨";
      return makeEvent(
        world,
        agent,
        hour,
        "craft",
        `${agent.nameKo}이(가) ${recipe.nameKo} 제작 완료!`,
      );
    }
  }

  agent.currentGoal = "idle";
  agent.currentGoalKo = "자유 시간";
  agent.actionTarget = undefined;
  return null;
}

// --- Eating ---

function doEat(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
): WorldEvent | null {
  if (agent.inventory.meal > 0) {
    agent.inventory.meal -= 1;
    agent.hunger = Math.min(1, agent.hunger + 0.4);
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
    agent.emoji = "🍖";
    return makeEvent(
      world,
      agent,
      hour,
      "eat",
      `${agent.nameKo}이(가) 식사 완료 (포만감: ${Math.floor(agent.hunger * 100)}%)`,
    );
  }
  if (agent.inventory.food > 0) {
    agent.inventory.food -= 1;
    agent.hunger = Math.min(1, agent.hunger + 0.35);
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
    agent.emoji = "🍖";
    return makeEvent(
      world,
      agent,
      hour,
      "eat",
      `${agent.nameKo}이(가) 고기를 구워 먹었다 (포만감: ${Math.floor(agent.hunger * 100)}%)`,
    );
  }
  // No food at all - reset goal
  agent.currentGoal = "idle";
  agent.currentGoalKo = "자유 시간";
  return null;
}

// --- Trading ---

function tryTrade(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
  hour: number,
): WorldEvent | null {
  // Find something agent has surplus, other needs
  const resources: ResourceType[] = ["wood", "ore", "food", "herb"];
  for (const res of resources) {
    if (
      agent.inventory[res] >= 3 &&
      other.inventory[res] <= 1 &&
      other.gold >= RESOURCE_PRICES[res]
    ) {
      const price = RESOURCE_PRICES[res];
      const isMerchant = (agent.seed.roles ?? []).includes("merchant");
      const finalPrice = isMerchant ? Math.ceil(price * 1.2) : price;
      agent.inventory[res] -= 1;
      agent.gold += finalPrice;
      other.inventory[res] += 1;
      other.gold -= finalPrice;

      const resNames: Record<ResourceType, string> = {
        wood: "나무",
        ore: "광석",
        food: "고기",
        herb: "약초",
      };
      return makeEvent(
        world,
        agent,
        hour,
        "trade",
        `${agent.nameKo}이(가) ${other.nameKo}에게 ${resNames[res]} 1개를 ${finalPrice}골드에 판매`,
      );
    }
  }

  // Try selling crafted items
  const items: ItemType[] = ["weapon", "tool", "potion"];
  for (const item of items) {
    if (agent.inventory[item] >= 1 && other.gold >= RESOURCE_PRICES[item]) {
      const price = RESOURCE_PRICES[item];
      agent.inventory[item] -= 1;
      agent.gold += price;
      other.inventory[item] += 1;
      other.gold -= price;

      const itemNames: Record<string, string> = {
        weapon: "무기",
        tool: "도구",
        potion: "물약",
      };
      return makeEvent(
        world,
        agent,
        hour,
        "trade",
        `${agent.nameKo}이(가) ${other.nameKo}에게 ${itemNames[item]} 판매 (${price}G)`,
      );
    }
  }

  return null;
}

// --- Cooperation ---

function tryCooperate(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
  hour: number,
): WorldEvent | null {
  // Help hungry neighbor
  if (other.hunger < 0.2 && agent.inventory.food > 1) {
    agent.inventory.food -= 1;
    other.inventory.food += 1;
    agent.emoji = "🤝";
    other.emoji = "🙏";
    return makeEvent(
      world,
      agent,
      hour,
      "cooperate",
      `${agent.nameKo}이(가) 배고픈 ${other.nameKo}에게 음식을 나눠주었다`,
    );
  }

  // Mentor skill transfer
  const agentRoles = agent.seed.roles ?? [];
  const otherRoles = other.seed.roles ?? [];
  if (
    agentRoles.includes("sage") &&
    agent.skills.crafting > other.skills.crafting + 0.1
  ) {
    other.skills.crafting = Math.min(1, other.skills.crafting + 0.01);
    agent.emoji = "🤝";
    return makeEvent(
      world,
      agent,
      hour,
      "cooperate",
      `${agent.nameKo}이(가) ${other.nameKo}에게 기술을 전수 중`,
    );
  }

  if (
    agentRoles.includes("warrior") &&
    other.actionTicks > 0 &&
    other.currentGoal === "gathering"
  ) {
    // Help with gathering - reduce remaining ticks
    other.actionTicks = Math.max(0, other.actionTicks - 3);
    agent.emoji = "🤝";
    return makeEvent(
      world,
      agent,
      hour,
      "cooperate",
      `${agent.nameKo}이(가) ${other.nameKo}의 채집을 도와주고 있다`,
    );
  }

  return null;
}

// --- Navigation ---

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
  agent.moveCooldown = 0;
}

function navigateToPoint(world: WorldState, agent: WorldAgent, target: Point) {
  const path = findPath(world.tiles, { x: agent.x, y: agent.y }, target);
  agent.path = path;
  agent.pathIndex = 0;
  agent.moveCooldown = 0;
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

// --- Event Helpers ---

function makeEvent(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
  type: WorldEvent["type"],
  descKo: string,
): WorldEvent {
  return {
    tick: world.currentTick,
    hour,
    agentId: agent.id,
    agentName: agent.nameKo,
    description: descKo,
    descriptionKo: descKo,
    type,
  };
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

  const actionType = response.action.type;
  let descKo: string;
  if (
    actionType.includes("attack") ||
    actionType.includes("fight") ||
    actionType.includes("retaliat")
  ) {
    const dmg = Math.floor(
      response.action.intensity * 30 * (1 + agent.skills.combat * 0.5),
    );
    monster.hp -= dmg;
    if (monster.hp <= 0) {
      monster.alive = false;
      monster.respawnTick = world.currentTick + MONSTER_RESPAWN_TICKS;
      // Loot from combat
      agent.inventory.food += 1;
      agent.gold += Math.floor(3 + monster.strength * 5);
      agent.skills.combat = Math.min(1, agent.skills.combat + 0.01);
      descKo = `${agent.nameKo}이(가) ${monster.nameKo}을(를) 처치! (고기+1, 골드+${Math.floor(3 + monster.strength * 5)})`;
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

  // If at market and need to buy food
  if (location.type === "market" && agent.currentGoal === "buying_food") {
    if (agent.gold >= RESOURCE_PRICES.food) {
      agent.gold -= RESOURCE_PRICES.food;
      agent.inventory.food += 1;
      agent.currentGoal = "eating";
      agent.currentGoalKo = "식사 준비 중";
      return makeEvent(
        world,
        agent,
        hour,
        "trade",
        `${agent.nameKo}이(가) 시장에서 음식을 ${RESOURCE_PRICES.food}골드에 구매`,
      );
    }
  }

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
  if (Math.random() > 0.1) return null;

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
