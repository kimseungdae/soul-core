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

const MOVE_COOLDOWN = 3;
const STARVATION_HP_DECAY = 0.5; // hp loss per tick when starving
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
    marketPrices: { ...RESOURCE_PRICES },
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
    hp: 100,
    skills: {
      combat: 0.3,
      crafting: 0.3,
      gathering: 0.3,
      ...def.initialSkills,
    },
    moveCooldown: 0,
    actionTicks: 0,
    maxActionTicks: 0,
    toolUses: 0,
    weaponUses: 0,
    stunTicks: 0,
    fatigue: 0,
    previousGoal: "idle",
    debts: {},
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

  // Dynamic price recovery (Step 17): drift toward base price
  for (const key of Object.keys(world.marketPrices) as ItemType[]) {
    const base = RESOURCE_PRICES[key];
    const current = world.marketPrices[key];
    if (Math.abs(current - base) > 0.1) {
      world.marketPrices[key] += (base - current) * 0.005;
    }
  }

  // Auto debt repayment (Step 18)
  for (const agent of world.agents) {
    for (const [creditorId, debt] of Object.entries(agent.debts)) {
      if (debt > 0 && agent.gold >= 1) {
        const repay = Math.min(debt, agent.gold, 2);
        agent.gold -= repay;
        agent.debts[creditorId] -= repay;
        const creditor = world.agents.find((a) => a.id === creditorId);
        if (creditor) creditor.gold += repay;
        if (agent.debts[creditorId] <= 0) delete agent.debts[creditorId];
      }
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

  // Village project tick (Step 22)
  tickVillageProject(world, events, hour);

  // Fulfill pending resource exchanges (Step 21)
  for (const agent of world.agents) {
    if (agent.pendingTrade) {
      const partner = world.agents.find(
        (a) => a.id === agent.pendingTrade!.partnerId,
      );
      if (
        partner &&
        isAdjacent({ x: agent.x, y: agent.y }, { x: partner.x, y: partner.y })
      ) {
        const t = agent.pendingTrade;
        if (
          agent.inventory[t.give] >= t.giveAmt &&
          partner.inventory[t.receive] >= t.receiveAmt
        ) {
          agent.inventory[t.give] -= t.giveAmt;
          agent.inventory[t.receive] += t.receiveAmt;
          partner.inventory[t.receive] -= t.receiveAmt;
          partner.inventory[t.give] += t.giveAmt;
          events.push(
            makeEvent(
              world,
              agent,
              hour,
              "trade",
              `${agent.nameKo}와(과) ${partner.nameKo}: 자원 교환 완료!`,
            ),
          );
        }
        agent.pendingTrade = undefined;
        partner.pendingTrade = undefined;
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

  // Stunned (knocked out, hp was 0)
  if (agent.stunTicks > 0) {
    agent.stunTicks--;
    agent.emoji = "💫";
    if (agent.stunTicks === 0) {
      agent.hp = 20;
      agent.currentGoal = "going_home";
      agent.currentGoalKo = "귀가 중 (부상)";
      navigateTo(world, agent, agent.homeLocationId);
    }
    return events;
  }

  // Auto-use potion when hp < 30
  if (agent.hp < 30 && agent.inventory.potion > 0) {
    agent.inventory.potion -= 1;
    agent.hp = Math.min(100, agent.hp + 30);
    events.push(
      makeEvent(
        world,
        agent,
        hour,
        "eat",
        `${agent.nameKo}이(가) 물약을 사용했다 (HP: ${agent.hp})`,
      ),
    );
  }

  // Hunger decay (only while awake)
  if (!agent.sleeping) {
    agent.hunger = Math.max(0, agent.hunger - HUNGER_DECAY);
  }

  // Fatigue system (Step 9)
  if (agent.sleeping) {
    agent.fatigue = Math.max(0, agent.fatigue - 0.01);
    // HP recovery during sleep (Step 12)
    agent.hp = Math.min(100, agent.hp + 0.5);
  } else {
    agent.fatigue = Math.min(1, agent.fatigue + 0.002);
    // HP recovery at home/tavern (Step 12)
    const loc = getAgentLocation(world, agent);
    if (loc?.type === "tavern" || loc?.id === agent.homeLocationId) {
      agent.hp = Math.min(100, agent.hp + 0.2);
    }
    // Healer proximity HP boost
    const nearHealer = world.agents.find(
      (a) =>
        a.id !== agent.id &&
        (a.seed.roles ?? []).some((r) => r === "healer" || r === "priestess") &&
        distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) <= 3,
    );
    if (nearHealer && agent.hp < 100) {
      agent.hp = Math.min(100, agent.hp + 0.2);
    }
  }

  // Fatigue auto-home (Step 9)
  if (
    agent.fatigue > 0.9 &&
    !agent.sleeping &&
    agent.currentGoal !== "going_home"
  ) {
    agent.currentGoal = "going_home";
    agent.currentGoalKo = "피로해서 귀가 중";
    agent.emoji = "😪";
    navigateTo(world, agent, agent.homeLocationId);
    return events;
  }

  // If performing an action (gathering/crafting), continue it
  if (agent.actionTicks > 0) {
    agent.actionTicks--;
    agent.fatigue = Math.min(1, agent.fatigue + 0.005); // extra fatigue for active work
    if (agent.actionTicks === 0) {
      const actionEvents = completeAction(world, agent, hour);
      events.push(...actionEvents);
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
    // High neuroticism → extra flee chance
    const neuroFlee =
      agent.state.traits.bigFive.neuroticism > 0.7 && Math.random() < 0.3;
    if (neuroFlee) {
      navigateTo(world, agent, agent.homeLocationId);
      agent.emoji = "😰";
      events.push(
        makeEvent(
          world,
          agent,
          hour,
          "combat",
          `${agent.nameKo}이(가) ${nearbyMonster.nameKo}을(를) 보고 겁먹어 도망쳤다`,
        ),
      );
      return events;
    }
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
      const ext = agent.state.traits.bigFive.extraversion;
      // Try trade first (extraversion boosts)
      if (Math.random() < 0.05 + ext * 0.06) {
        const tradeEvent = tryTrade(world, agent, nearbyAgent, hour);
        if (tradeEvent) {
          events.push(tradeEvent);
          return events;
        }
      }
      // Cooperate/help (agreeableness boosts)
      if (
        Math.random() <
        0.03 + agent.state.traits.bigFive.agreeableness * 0.06
      ) {
        const coopEvent = tryCooperate(world, agent, nearbyAgent, hour);
        if (coopEvent) {
          events.push(coopEvent);
          return events;
        }
      }
      // Hunt party proposal (Step 20)
      if (Math.random() < 0.04) {
        const huntEvent = tryFormHuntParty(world, agent, nearbyAgent, hour);
        if (huntEvent) {
          events.push(huntEvent);
          return events;
        }
      }
      // Resource exchange proposal (Step 21)
      if (Math.random() < 0.03) {
        const exchangeEvent = tryResourceExchange(
          world,
          agent,
          nearbyAgent,
          hour,
        );
        if (exchangeEvent) {
          events.push(exchangeEvent);
          return events;
        }
      }
      // Social depth events (Step 16)
      if (Math.random() < 0.05) {
        const depthEvent = trySocialDepthEvent(world, agent, nearbyAgent, hour);
        if (depthEvent) {
          events.push(depthEvent);
          return events;
        }
      }
      // Regular social (extraversion boosts)
      if (Math.random() < 0.05 + ext * 0.08) {
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
      const hungerPenalty = agent.hunger < 0.1 ? 2 : 0;
      const hpPenalty = agent.hp < 50 ? 1 : 0;
      agent.moveCooldown = MOVE_COOLDOWN + hungerPenalty + hpPenalty;

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
          const baseTicks = GATHER_TICKS[node.type];
          const toolBonus =
            agent.inventory.tool > 0 ? agent.inventory.tool * 2 : 0;
          agent.actionTicks = Math.max(2, baseTicks - toolBonus);
          agent.maxActionTicks = agent.actionTicks;
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
          const craftSkillBonus = agent.skills.crafting >= 0.5 ? 0.7 : 1.0;
          agent.actionTicks = Math.max(
            2,
            Math.floor(recipe.ticks * craftSkillBonus),
          );
          agent.maxActionTicks = agent.actionTicks;
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
  } else if (agent.currentGoal === "exploring" && !agent.sleeping) {
    // Exploration reward (Step 15)
    const reward = getExplorationReward(agent);
    events.push(
      makeEvent(
        world,
        agent,
        hour,
        "explore",
        `${agent.nameKo}이(가) 탐험 중 ${reward.descKo}`,
      ),
    );
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
    agent.emoji = "🧭";
  } else if (agent.currentGoal === "eating" && !agent.sleeping) {
    const eatEvent = doEat(world, agent, hour);
    if (eatEvent) events.push(eatEvent);
  } else if (!agent.sleeping) {
    // Try contributing to village project (Step 22)
    if (world.villageProject && Math.random() < 0.05) {
      const contributeEvent = tryContributeToProject(world, agent, hour);
      if (contributeEvent) {
        events.push(contributeEvent);
        return events;
      }
    }
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

  // Get personality traits
  const bf = agent.state.traits.bigFive;
  const mood = agent.state.emotions.mood;
  const roles = agent.seed.roles ?? [];

  // Get dominant emotion
  const topEmotion = agent.state.emotions.active.sort(
    (a, b) => b.intensity - a.intensity,
  )[0];
  const emotionType = topEmotion?.type;
  const emotionIntensity = topEmotion?.intensity ?? 0;

  // Emotion overrides (Step 7)
  if (emotionIntensity > 0.5) {
    if (
      (emotionType === "fear" || emotionType === "anxiety") &&
      !isInVillage(world, agent)
    ) {
      agent.currentGoal = "going_home";
      agent.currentGoalKo = "두려워서 귀가 중";
      agent.emoji = "😰";
      navigateTo(world, agent, agent.homeLocationId);
      return;
    }
    if (emotionType === "distress" || emotionType === "loneliness") {
      if (Math.random() < 0.3) {
        const dest = Math.random() < 0.5 ? "church" : "library";
        agent.currentGoal = "seeking_comfort";
        agent.currentGoalKo =
          emotionType === "loneliness" ? "외로움을 달래러" : "위안을 구하러";
        agent.emoji = "😢";
        navigateTo(world, agent, dest);
        return;
      }
    }
    if (emotionType === "joy" && Math.random() < 0.2) {
      agent.currentGoal = "socializing";
      agent.currentGoalKo = "기분 좋게 어울리는 중";
      agent.emoji = "😊";
      navigateTo(world, agent, "plaza");
      return;
    }
  }

  // Priority 3: Job-specific behavior (Step 6)
  if (agent.currentGoal === "idle") {
    const jobAction = getJobSpecificAction(world, agent, roles);
    if (jobAction) {
      agent.currentGoal = jobAction.goal;
      agent.currentGoalKo = jobAction.goalKo;
      agent.emoji = jobAction.emoji;
      if (jobAction.actionTarget) agent.actionTarget = jobAction.actionTarget;
      if (jobAction.navigateTo) navigateTo(world, agent, jobAction.navigateTo);
      else if (jobAction.navigateToPoint)
        navigateToPoint(world, agent, jobAction.navigateToPoint);
      return;
    }
  }

  // Priority 4: Craft if has materials (personality-weighted)
  if (agent.currentGoal === "idle" || agent.currentGoal === "자유 시간") {
    const recipe = findCraftableRecipe(agent);
    const craftChance = 0.3 + bf.conscientiousness * 0.4;
    if (recipe && agent.skills.crafting > 0.2 && Math.random() < craftChance) {
      agent.currentGoal = "crafting";
      agent.currentGoalKo = `${recipe.nameKo} 제작하러 이동 중`;
      agent.emoji = "🔨";
      agent.actionTarget = recipe.id;
      navigateTo(world, agent, agent.workLocationId);
      return;
    }
  }

  // Priority 5: Gather resources (personality-weighted)
  if (agent.currentGoal === "idle" && agent.hunger > 0.4) {
    const gatherChance = 0.4 + bf.conscientiousness * 0.3;
    if (Math.random() < gatherChance) {
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
  }

  // Priority 6: Explore (high Openness) (Step 5)
  if (agent.currentGoal === "idle" && Math.random() < bf.openness * 0.15) {
    const exploreTargets = ["forest", "dungeon", "wilderness"] as const;
    const target =
      exploreTargets[Math.floor(Math.random() * exploreTargets.length)];
    const loc = world.locations.find((l) => l.type === target);
    if (loc) {
      agent.currentGoal = "exploring";
      agent.currentGoalKo = `${loc.nameKo} 탐험 중`;
      agent.emoji = "🧭";
      navigateTo(world, agent, loc.id);
      return;
    }
  }

  // Priority 7: Socialize (high Extraversion)
  if (agent.currentGoal === "idle" && Math.random() < bf.extraversion * 0.12) {
    const socialSpots = ["tavern", "plaza", "market"];
    const spot = socialSpots[Math.floor(Math.random() * socialSpots.length)];
    agent.currentGoal = "socializing";
    agent.currentGoalKo = "어울리러 이동 중";
    agent.emoji = "💬";
    navigateTo(world, agent, spot);
    return;
  }

  // Priority 8: Think (low Extraversion or high Neuroticism)
  if (
    agent.currentGoal === "idle" &&
    Math.random() < 0.05 + bf.neuroticism * 0.05
  ) {
    agent.currentGoal = "thinking";
    agent.currentGoalKo = "고민 중";
    agent.emoji = "💭";
    navigateTo(world, agent, "plaza");
    return;
  }

  // Default: idle / free time
  if (
    agent.currentGoal !== "idle" &&
    agent.currentGoal !== "thinking" &&
    agent.currentGoal !== "exploring" &&
    agent.currentGoal !== "socializing" &&
    agent.currentGoal !== "seeking_comfort" &&
    !scheduled &&
    agent.path.length === 0
  ) {
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
  }
}

// --- Job-Specific Behavior (Step 6) ---

interface JobAction {
  goal: string;
  goalKo: string;
  emoji: string;
  actionTarget?: string;
  navigateTo?: string;
  navigateToPoint?: { x: number; y: number };
}

function getJobSpecificAction(
  world: WorldState,
  agent: WorldAgent,
  roles: string[],
): JobAction | null {
  // Warrior: actively hunt monsters
  if (roles.includes("warrior") || roles.includes("guardian")) {
    if (agent.hp > 50 && Math.random() < 0.25) {
      const nearestMonster = world.monsters
        .filter((m) => m.alive)
        .sort(
          (a, b) =>
            distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) -
            distance({ x: agent.x, y: agent.y }, { x: b.x, y: b.y }),
        )[0];
      if (nearestMonster) {
        return {
          goal: "hunting_monster",
          goalKo: `${nearestMonster.nameKo} 사냥하러 출발`,
          emoji: "⚔️",
          navigateToPoint: { x: nearestMonster.x, y: nearestMonster.y },
        };
      }
    }
  }

  // Blacksmith: prioritize ore gathering when low
  if (roles.includes("blacksmith") || roles.includes("craftsman")) {
    if (agent.inventory.ore < 2 && Math.random() < 0.3) {
      const oreNode = findNearestResource(world, agent, "ore");
      if (oreNode) {
        return {
          goal: "gathering",
          goalKo: "광산 원정 출발",
          emoji: "⛏️",
          actionTarget: oreNode.id,
          navigateToPoint: { x: oreNode.x, y: oreNode.y },
        };
      }
    }
  }

  // Merchant: visit NPCs to sell
  if (roles.includes("merchant") || roles.includes("trader")) {
    const hasGoods = Object.values(agent.inventory).some((v) => v >= 3);
    if (hasGoods && Math.random() < 0.2) {
      const target = world.agents
        .filter((a) => a.id !== agent.id && !a.sleeping)
        .sort(() => Math.random() - 0.5)[0];
      if (target) {
        return {
          goal: "visiting_customer",
          goalKo: `${target.nameKo}에게 판매하러 이동`,
          emoji: "💰",
          navigateToPoint: { x: target.x, y: target.y },
        };
      }
    }
  }

  // Healer: find injured NPCs
  if (roles.includes("healer") || roles.includes("priestess")) {
    if (agent.inventory.potion > 0) {
      const injured = world.agents.find(
        (a) => a.id !== agent.id && a.hp < 50 && !a.sleeping,
      );
      if (injured) {
        return {
          goal: "healing",
          goalKo: `${injured.nameKo} 치료하러 이동`,
          emoji: "💊",
          navigateToPoint: { x: injured.x, y: injured.y },
        };
      }
    }
  }

  // Scholar: study at library
  if (roles.includes("scholar")) {
    if (Math.random() < 0.2) {
      return {
        goal: "studying",
        goalKo: "연구 중",
        emoji: "📖",
        navigateTo: "library",
      };
    }
  }

  // Sage: give advice at plaza
  if (roles.includes("sage") || roles.includes("advisor")) {
    if (Math.random() < 0.15) {
      return {
        goal: "advising",
        goalKo: "조언하러 이동",
        emoji: "🔮",
        navigateTo: "plaza",
      };
    }
  }

  return null;
}

// --- Relationship Helper (Step 8) ---

function getRelationship(agent: WorldAgent, targetId: string) {
  return agent.state.social.relationships.find((r) => r.targetId === targetId);
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
): WorldEvent[] {
  const results: WorldEvent[] = [];

  if (agent.currentGoal === "gathering" && agent.actionTarget) {
    const node = world.resourceNodes.find((n) => n.id === agent.actionTarget);
    if (node && node.amount >= 1) {
      // Failure check (Step 14)
      if (checkGatherFailure(agent)) {
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
        agent.actionTarget = undefined;
        agent.emoji = "😓";
        results.push(
          makeEvent(
            world,
            agent,
            hour,
            "gather",
            `${agent.nameKo}이(가) ${node.nameKo} 채집에 실패했다...`,
          ),
        );
        return results;
      }

      const toolBonus = agent.inventory.tool > 0 ? 1 : 0;
      const skillBonus = agent.skills.gathering >= 0.5 ? 1 : 0;
      const amount = Math.min(
        Math.floor(node.amount),
        1 + Math.floor(agent.skills.gathering * 2) + toolBonus + skillBonus,
      );
      node.amount -= amount;
      agent.inventory[node.type] += amount;
      const prevGathering = agent.skills.gathering;
      agent.skills.gathering = Math.min(1, agent.skills.gathering + 0.015);

      // Skill level-up event (Step 10)
      if (prevGathering < 0.5 && agent.skills.gathering >= 0.5) {
        results.push(
          makeEvent(
            world,
            agent,
            hour,
            "gather",
            `⭐ ${agent.nameKo}의 채집 기술이 숙련 단계에 도달!`,
          ),
        );
      }

      // Tool durability
      if (agent.inventory.tool > 0) {
        agent.toolUses++;
        if (agent.toolUses >= 10) {
          agent.inventory.tool -= 1;
          agent.toolUses = 0;
        }
      }

      agent.previousGoal = "gathering";
      agent.actionTarget = undefined;

      // Goal chaining (Step 11): gather → craft if possible
      const chainRecipe = findCraftableRecipe(agent);
      if (chainRecipe && agent.skills.crafting > 0.2) {
        agent.currentGoal = "crafting";
        agent.currentGoalKo = `${chainRecipe.nameKo} 제작하러 이동 중`;
        agent.emoji = "🔨";
        agent.actionTarget = chainRecipe.id;
        navigateTo(world, agent, agent.workLocationId);
      } else {
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
      }

      if (node.type === "food") {
        agent.emoji = agent.currentGoal === "crafting" ? "🔨" : "🏹";
        results.push(
          makeEvent(
            world,
            agent,
            hour,
            "gather",
            `${agent.nameKo}이(가) 사냥에 성공! (고기 +${amount})`,
          ),
        );
        return results;
      }

      const gatherEmoji: Record<ResourceType, string> = {
        wood: "🪓",
        ore: "⛏️",
        food: "🏹",
        herb: "🌿",
      };
      if (agent.currentGoal !== "crafting") {
        agent.emoji = gatherEmoji[node.type] ?? "📦";
      }
      results.push(
        makeEvent(
          world,
          agent,
          hour,
          "gather",
          `${agent.nameKo}이(가) ${node.nameKo} ${amount}개 채집 완료`,
        ),
      );
      return results;
    }
  }

  if (agent.currentGoal === "crafting" && agent.actionTarget) {
    const recipe = RECIPES.find((r) => r.id === agent.actionTarget);
    if (recipe && hasIngredients(agent, recipe.inputs)) {
      // Craft failure check (Step 14) — lose half inputs
      if (checkCraftFailure(agent)) {
        for (const [res, amt] of Object.entries(recipe.inputs)) {
          agent.inventory[res as ItemType] -= Math.ceil((amt ?? 0) / 2);
        }
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
        agent.actionTarget = undefined;
        agent.emoji = "😞";
        results.push(
          makeEvent(
            world,
            agent,
            hour,
            "craft",
            `${agent.nameKo}이(가) ${recipe.nameKo} 제작에 실패했다... (재료 일부 손실)`,
          ),
        );
        return results;
      }
      consumeIngredients(agent, recipe.inputs);
      agent.inventory[recipe.output] += 1;
      const prevCrafting = agent.skills.crafting;
      // Crafting skill 0.5+ → 30% faster (applied at start, not here)
      agent.skills.crafting = Math.min(1, agent.skills.crafting + 0.02);

      // Skill level-up event (Step 10)
      if (prevCrafting < 0.5 && agent.skills.crafting >= 0.5) {
        results.push(
          makeEvent(
            world,
            agent,
            hour,
            "craft",
            `⭐ ${agent.nameKo}의 제작 기술이 숙련 단계에 도달!`,
          ),
        );
      }

      agent.previousGoal = "crafting";
      agent.actionTarget = undefined;

      // Goal chaining (Step 11): craft → sell if surplus
      const totalItems =
        agent.inventory.weapon +
        agent.inventory.tool +
        agent.inventory.potion +
        agent.inventory.meal;
      if (totalItems >= 3) {
        agent.currentGoal = "selling";
        agent.currentGoalKo = "잉여 물품 판매하러 이동";
        agent.emoji = "💰";
        navigateTo(world, agent, "market");
      } else {
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
        agent.emoji = "✨";
      }

      results.push(
        makeEvent(
          world,
          agent,
          hour,
          "craft",
          `${agent.nameKo}이(가) ${recipe.nameKo} 제작 완료!`,
        ),
      );
      return results;
    }
  }

  agent.currentGoal = "idle";
  agent.currentGoalKo = "자유 시간";
  agent.actionTarget = undefined;
  return results;
}

// --- Eating ---

function doEat(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
): WorldEvent | null {
  const location = getAgentLocation(world, agent);
  const atHomeOrTavern =
    location?.type === "tavern" || location?.id === agent.homeLocationId;

  // Meal: +0.5 hunger, only at tavern/home
  if (agent.inventory.meal > 0 && atHomeOrTavern) {
    agent.inventory.meal -= 1;
    agent.hunger = Math.min(1, agent.hunger + 0.5);
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
    agent.emoji = "🍖";
    return makeEvent(
      world,
      agent,
      hour,
      "eat",
      `${agent.nameKo}이(가) 맛있는 식사를 했다 (포만감: ${Math.floor(agent.hunger * 100)}%)`,
    );
  }

  // Raw food: +0.25 hunger, anywhere
  if (agent.inventory.food > 0) {
    agent.inventory.food -= 1;
    agent.hunger = Math.min(1, agent.hunger + 0.25);
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

  // Has meal but not at tavern/home → go there
  if (agent.inventory.meal > 0 && !atHomeOrTavern) {
    agent.currentGoal = "eating";
    agent.currentGoalKo = "식사하러 이동 중";
    agent.emoji = "🍖";
    navigateTo(world, agent, "tavern");
    return null;
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
  const rel = getRelationship(agent, other.id);
  const trust = rel?.trust ?? 0;
  if (trust < -0.3) return null;

  const isMerchant = (agent.seed.roles ?? []).includes("merchant");
  const trustDiscount = trust > 0.7 ? 0.9 : 1.0;
  const merchantMarkup = isMerchant ? 1.2 : 1.0;
  const agreeDiscount = 1.0 - agent.state.traits.bigFive.agreeableness * 0.1;

  const resNames: Record<string, string> = {
    wood: "나무",
    ore: "광석",
    food: "고기",
    herb: "약초",
    weapon: "무기",
    tool: "도구",
    potion: "물약",
    meal: "식사",
  };

  // Helper: execute trade with dynamic pricing + debt
  const executeTrade = (item: ItemType, qty: number): WorldEvent | null => {
    const basePrice = world.marketPrices[item];
    const finalPrice = Math.max(
      1,
      Math.ceil(basePrice * merchantMarkup * trustDiscount * agreeDiscount),
    );
    const canPay = other.gold >= finalPrice;
    const debtLimit = trust * 20;
    const currentDebt = other.debts[agent.id] ?? 0;
    const canDebt = trust > 0.5 && currentDebt + finalPrice <= debtLimit;

    if (!canPay && !canDebt) return null;

    agent.inventory[item] -= qty;
    if (canPay) {
      agent.gold += finalPrice;
      other.gold -= finalPrice;
    } else {
      // Debt (Step 18)
      other.debts[agent.id] = currentDebt + finalPrice;
    }
    other.inventory[item] += qty;

    // Dynamic price adjustment (Step 17): item sold → price drops slightly
    world.marketPrices[item] = Math.max(
      RESOURCE_PRICES[item] * 0.5,
      world.marketPrices[item] * 0.97,
    );

    const debtStr = !canPay ? " (외상)" : "";
    return makeEvent(
      world,
      agent,
      hour,
      "trade",
      `${agent.nameKo}이(가) ${other.nameKo}에게 ${resNames[item]} 판매 (${finalPrice}G${debtStr})`,
    );
  };

  // Try resources
  const resources: ResourceType[] = ["wood", "ore", "food", "herb"];
  for (const res of resources) {
    if (agent.inventory[res] >= 3 && other.inventory[res] <= 1) {
      const ev = executeTrade(res, 1);
      if (ev) return ev;
    }
  }

  // Try crafted items
  const items: ItemType[] = ["weapon", "tool", "potion"];
  for (const item of items) {
    if (agent.inventory[item] >= 1) {
      const ev = executeTrade(item, 1);
      if (ev) return ev;
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
  const rel = getRelationship(agent, other.id);
  const trust = rel?.trust ?? 0;
  const affection = rel?.affection ?? 0;

  // Low trust → don't cooperate
  if (trust < -0.3) return null;

  // Healer: give potion to injured (Step 6 extension)
  const agentRoles = agent.seed.roles ?? [];
  if (
    (agentRoles.includes("healer") || agentRoles.includes("priestess")) &&
    other.hp < 50 &&
    agent.inventory.potion > 0
  ) {
    agent.inventory.potion -= 1;
    other.hp = Math.min(100, other.hp + 30);
    agent.emoji = "💊";
    other.emoji = "💖";
    return makeEvent(
      world,
      agent,
      hour,
      "cooperate",
      `${agent.nameKo}이(가) 부상당한 ${other.nameKo}에게 물약을 건넸다`,
    );
  }

  // Help hungry neighbor (trust-weighted)
  if (other.hunger < 0.2 && agent.inventory.food > 1) {
    const helpChance =
      0.3 + agent.state.traits.bigFive.agreeableness * 0.4 + trust * 0.2;
    if (Math.random() < helpChance) {
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
  }

  // Gift (high affection, Step 8)
  if (affection > 0.8 && Math.random() < 0.1) {
    const giftItems: ItemType[] = ["herb", "wood", "ore"];
    for (const item of giftItems) {
      if (agent.inventory[item] >= 2) {
        agent.inventory[item] -= 1;
        other.inventory[item] += 1;
        agent.emoji = "🎁";
        return makeEvent(
          world,
          agent,
          hour,
          "cooperate",
          `${agent.nameKo}이(가) ${other.nameKo}에게 선물을 건넸다`,
        );
      }
    }
  }

  // Mentor skill transfer
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

// --- Hunt Party (Step 20) ---

function tryFormHuntParty(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
  hour: number,
): WorldEvent | null {
  const agentRoles = agent.seed.roles ?? [];
  if (!agentRoles.includes("warrior") && !agentRoles.includes("guardian"))
    return null;
  if (agent.huntPartyWith || other.huntPartyWith) return null;
  if (agent.hp < 50 || other.hp < 50) return null;

  const rel = getRelationship(agent, other.id);
  const trust = rel?.trust ?? 0;
  if (trust < 0.3 && Math.random() > 0.1) return null;

  // Form hunt party
  agent.huntPartyWith = other.id;
  other.huntPartyWith = agent.id;

  const monster = world.monsters
    .filter((m) => m.alive)
    .sort(
      (a, b) =>
        distance({ x: agent.x, y: agent.y }, { x: a.x, y: a.y }) -
        distance({ x: agent.x, y: agent.y }, { x: b.x, y: b.y }),
    )[0];

  if (monster) {
    agent.currentGoal = "hunting_monster";
    agent.currentGoalKo = `${other.nameKo}와(과) 함께 사냥`;
    agent.emoji = "⚔️";
    navigateToPoint(world, agent, { x: monster.x, y: monster.y });
    other.currentGoal = "hunting_monster";
    other.currentGoalKo = `${agent.nameKo}와(과) 함께 사냥`;
    other.emoji = "⚔️";
    navigateToPoint(world, other, { x: monster.x, y: monster.y });
  }

  return makeEvent(
    world,
    agent,
    hour,
    "cooperate",
    `${agent.nameKo}이(가) ${other.nameKo}에게 사냥 파티를 제안했다!`,
  );
}

// --- Resource Exchange Promise (Step 21) ---

function tryResourceExchange(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
  hour: number,
): WorldEvent | null {
  if (agent.pendingTrade || other.pendingTrade) return null;

  const agentSurplus = (["wood", "ore", "herb"] as ResourceType[]).filter(
    (r) => agent.inventory[r] >= 3,
  );
  const otherSurplus = (["wood", "ore", "herb"] as ResourceType[]).filter(
    (r) => other.inventory[r] >= 3,
  );

  if (agentSurplus.length === 0 || otherSurplus.length === 0) return null;

  const give = agentSurplus.find((r) => other.inventory[r] <= 1);
  const receive = otherSurplus.find((r) => agent.inventory[r] <= 1);
  if (!give || !receive || give === receive) return null;

  const trade = {
    partnerId: other.id,
    give,
    giveAmt: 2,
    receive,
    receiveAmt: 2,
  };
  agent.pendingTrade = trade;
  other.pendingTrade = {
    partnerId: agent.id,
    give: receive,
    giveAmt: 2,
    receive: give,
    receiveAmt: 2,
  };

  const resNames: Record<string, string> = {
    wood: "나무",
    ore: "광석",
    food: "고기",
    herb: "약초",
  };
  return makeEvent(
    world,
    agent,
    hour,
    "cooperate",
    `${agent.nameKo}와(과) ${other.nameKo}: ${resNames[give]} ↔ ${resNames[receive]} 교환 약속`,
  );
}

// --- Village Project (Step 22) ---

function tickVillageProject(
  world: WorldState,
  events: WorldEvent[],
  hour: number,
) {
  // Start new project periodically (every 2 days)
  if (
    !world.villageProject &&
    world.currentTick % (world.config.ticksPerDay * 2) === 0 &&
    world.currentTick > 0
  ) {
    const projects = [
      {
        name: "fence_repair",
        nameKo: "울타리 보수",
        requiredItem: "wood" as ItemType,
        requiredAmount: 15,
      },
      {
        name: "weapon_stock",
        nameKo: "무기 비축",
        requiredItem: "weapon" as ItemType,
        requiredAmount: 5,
      },
      {
        name: "potion_stock",
        nameKo: "물약 비축",
        requiredItem: "potion" as ItemType,
        requiredAmount: 5,
      },
    ];
    const proj = projects[Math.floor(Math.random() * projects.length)];
    world.villageProject = {
      ...proj,
      contributed: 0,
      contributors: [],
      deadline: world.currentTick + world.config.ticksPerDay,
    };
    events.push({
      tick: world.currentTick,
      hour,
      agentId: "system" as any,
      agentName: "마을",
      description: `Village project: ${proj.name}`,
      descriptionKo: `📢 마을 프로젝트: ${proj.nameKo} (${proj.requiredItem} ${proj.requiredAmount}개 필요)`,
      type: "cooperate",
    });
  }

  // Check deadline
  if (world.villageProject) {
    if (
      world.villageProject.contributed >= world.villageProject.requiredAmount
    ) {
      events.push({
        tick: world.currentTick,
        hour,
        agentId: "system" as any,
        agentName: "마을",
        description: "Village project completed!",
        descriptionKo: `🎉 ${world.villageProject.nameKo} 완료! 마을 전체 보너스!`,
        type: "cooperate",
      });
      // Bonus: all agents get gold
      for (const agent of world.agents) {
        agent.gold += 5;
      }
      world.villageProject = undefined;
    } else if (world.currentTick >= world.villageProject.deadline) {
      events.push({
        tick: world.currentTick,
        hour,
        agentId: "system" as any,
        agentName: "마을",
        description: "Village project failed",
        descriptionKo: `❌ ${world.villageProject.nameKo} 실패... 마을이 위험해졌다`,
        type: "cooperate",
      });
      world.villageProject = undefined;
    }
  }
}

// NPC contribute to village project
function tryContributeToProject(
  world: WorldState,
  agent: WorldAgent,
  hour: number,
): WorldEvent | null {
  const proj = world.villageProject;
  if (!proj) return null;
  if (proj.contributors.includes(agent.id)) return null;

  const item = proj.requiredItem;
  if (agent.inventory[item] < 1) return null;

  // Agreeableness affects willingness
  const willingness = 0.1 + agent.state.traits.bigFive.agreeableness * 0.3;
  if (Math.random() > willingness) return null;

  const contribute = Math.min(agent.inventory[item], 2);
  agent.inventory[item] -= contribute;
  proj.contributed += contribute;
  proj.contributors.push(agent.id);

  return makeEvent(
    world,
    agent,
    hour,
    "cooperate",
    `${agent.nameKo}이(가) ${proj.nameKo}에 ${contribute}개 기부!`,
  );
}

// --- Event Templates (Step 13) ---

const EVENT_TEMPLATES: Record<string, string[]> = {
  gather_wood: [
    "묵묵히 나무를 베고 있다",
    "능숙하게 도끼를 휘둘렀다",
    "땀을 흘리며 벌목 중",
    "좋은 목재를 발견했다",
  ],
  gather_ore: [
    "광맥을 캐고 있다",
    "곡괭이로 바위를 내리쳤다",
    "반짝이는 광석을 발견",
    "깊은 곳에서 양질의 광석 채굴",
  ],
  gather_food: [
    "먹이를 추적하고 있다",
    "재빠르게 사냥감을 쫓았다",
    "숨어서 먹이를 기다리는 중",
    "정확한 솜씨로 사냥 성공",
  ],
  gather_herb: [
    "약초를 채집하고 있다",
    "귀한 약초 발견!",
    "조심스럽게 약초를 캐는 중",
    "약초의 향기를 맡으며 채집",
  ],
  craft: [
    "정성스럽게 제작 중",
    "망치를 두드리는 소리가 울려퍼진다",
    "숙련된 솜씨로 작업 중",
    "집중해서 만들고 있다",
  ],
  eat_meal: [
    "맛있는 식사를 즐겼다",
    "든든하게 배를 채웠다",
    "감사하며 식사 중",
  ],
  eat_raw: [
    "고기를 구워 먹었다",
    "허겁지겁 음식을 먹었다",
    "간단히 요기를 했다",
  ],
  social: [
    "이야기꽃을 피웠다",
    "함께 웃으며 대화 중",
    "진지하게 이야기를 나눴다",
    "소소한 수다를 떨었다",
  ],
  combat_win: [
    "화려한 솜씨로 처치!",
    "용감하게 싸워 승리!",
    "필사적인 전투 끝에 승리",
  ],
  combat_fight: ["맹렬히 싸우고 있다", "치열한 전투 중", "일진일퇴의 공방"],
};

function pickTemplate(key: string): string {
  const templates = EVENT_TEMPLATES[key];
  if (!templates || templates.length === 0) return "";
  return templates[Math.floor(Math.random() * templates.length)];
}

// --- Failure Events (Step 14) ---

function checkGatherFailure(agent: WorldAgent): boolean {
  if (agent.fatigue > 0.7 && Math.random() < 0.15) return true;
  if (agent.inventory.tool === 0 && Math.random() < 0.1) return true;
  return false;
}

function checkCraftFailure(agent: WorldAgent): boolean {
  if (agent.skills.crafting < 0.3 && Math.random() < 0.15) return true;
  return false;
}

// --- Exploration Rewards (Step 15) ---

function getExplorationReward(agent: WorldAgent): {
  descKo: string;
  type: "resource" | "gold" | "skill";
} {
  const roll = Math.random();
  if (roll < 0.4) {
    const resources: ResourceType[] = ["wood", "ore", "food", "herb"];
    const res = resources[Math.floor(Math.random() * resources.length)];
    const amount = 1 + Math.floor(Math.random() * 2);
    agent.inventory[res] += amount;
    const names: Record<ResourceType, string> = {
      wood: "나무",
      ore: "광석",
      food: "고기",
      herb: "약초",
    };
    return { descKo: `${names[res]} ${amount}개를 발견!`, type: "resource" };
  }
  if (roll < 0.7) {
    const gold = 3 + Math.floor(Math.random() * 8);
    agent.gold += gold;
    return { descKo: `${gold}골드를 발견!`, type: "gold" };
  }
  const skills: (keyof WorldAgent["skills"])[] = [
    "combat",
    "crafting",
    "gathering",
  ];
  const skill = skills[Math.floor(Math.random() * skills.length)];
  agent.skills[skill] = Math.min(1, agent.skills[skill] + 0.02);
  const skillNames = { combat: "전투", crafting: "제작", gathering: "채집" };
  return { descKo: `${skillNames[skill]} 경험을 얻었다!`, type: "skill" };
}

// --- Social Depth Events (Step 16) ---

function trySocialDepthEvent(
  world: WorldState,
  agent: WorldAgent,
  other: WorldAgent,
  hour: number,
): WorldEvent | null {
  const agentMood = agent.state.emotions.mood;
  const otherMood = other.state.emotions.mood;
  const agentRoles = agent.seed.roles ?? [];

  // Counseling: sad agent seeks comfort from nearby NPC
  if (agentMood.valence < -0.3 && otherMood.valence > 0) {
    return makeEvent(
      world,
      agent,
      hour,
      "social",
      `${agent.nameKo}이(가) ${other.nameKo}에게 고민을 털어놓았다`,
    );
  }

  // Conflict: both angry
  if (
    agentMood.arousal > 0.5 &&
    otherMood.arousal > 0.5 &&
    Math.random() < 0.1
  ) {
    return makeEvent(
      world,
      agent,
      hour,
      "social",
      `${agent.nameKo}이(가) ${other.nameKo}와(과) 언쟁을 벌였다`,
    );
  }

  // Mentoring: sage teaches apprentice
  if (
    agentRoles.includes("sage") &&
    (other.seed.roles ?? []).includes("apprentice")
  ) {
    other.skills.crafting = Math.min(1, other.skills.crafting + 0.03);
    other.skills.gathering = Math.min(1, other.skills.gathering + 0.03);
    return makeEvent(
      world,
      agent,
      hour,
      "cooperate",
      `${agent.nameKo}이(가) ${other.nameKo}에게 지식을 전수했다`,
    );
  }

  return null;
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

  // No weapon → 30% extra flee chance
  const hasWeapon = agent.inventory.weapon > 0;
  const forceFlee = !hasWeapon && Math.random() < 0.3;

  if (
    !forceFlee &&
    (actionType.includes("attack") ||
      actionType.includes("fight") ||
      actionType.includes("retaliat"))
  ) {
    const weaponMult = hasWeapon ? 1.5 : 1.0;
    // Hunt party bonus (Step 20)
    const partyPartner = agent.huntPartyWith
      ? world.agents.find((a) => a.id === agent.huntPartyWith)
      : undefined;
    const partyBonus = partyPartner ? 1.3 : 1.0;
    const combatSkillBonus = agent.skills.combat >= 0.5 ? 1.5 : 1.0; // Step 10
    const dmg = Math.floor(
      response.action.intensity *
        30 *
        (1 + agent.skills.combat * 0.5) *
        weaponMult *
        partyBonus *
        combatSkillBonus,
    );
    monster.hp -= dmg;

    // Weapon durability
    if (hasWeapon) {
      agent.weaponUses++;
      if (agent.weaponUses >= 20) {
        agent.inventory.weapon -= 1;
        agent.weaponUses = 0;
      }
    }

    // Monster hits back
    const monsterDmg = Math.floor(monster.strength * 15);
    agent.hp = Math.max(0, agent.hp - monsterDmg);

    if (agent.hp === 0) {
      // Knocked out
      agent.stunTicks = 50;
      agent.currentGoal = "stunned";
      agent.currentGoalKo = "기절";
      agent.emoji = "💫";
      agent.path = [];
      descKo = `${agent.nameKo}이(가) ${monster.nameKo}에게 쓰러졌다! (기절 50틱)`;
    } else if (monster.hp <= 0) {
      monster.alive = false;
      monster.respawnTick = world.currentTick + MONSTER_RESPAWN_TICKS;
      const lootGold = Math.floor(3 + monster.strength * 5);
      agent.inventory.food += 1;
      agent.gold += lootGold;
      agent.skills.combat = Math.min(1, agent.skills.combat + 0.01);
      // Hunt party loot sharing (Step 20)
      if (partyPartner) {
        partyPartner.inventory.food += 1;
        partyPartner.gold += lootGold;
        partyPartner.skills.combat = Math.min(
          1,
          partyPartner.skills.combat + 0.005,
        );
        agent.huntPartyWith = undefined;
        partyPartner.huntPartyWith = undefined;
        descKo = `${agent.nameKo}와(과) ${partyPartner.nameKo}이(가) 함께 ${monster.nameKo} 처치! (전리품 분배)`;
      } else {
        descKo = `${agent.nameKo}이(가) ${monster.nameKo}을(를) 처치! (고기+1, 골드+${lootGold})`;
      }
    } else {
      descKo = `${agent.nameKo}이(가) ${monster.nameKo}과(와) 전투 중 (몬스터HP: ${monster.hp}/${monster.maxHp}, 내HP: ${agent.hp})`;
    }
    agent.emoji = agent.hp > 0 ? "⚔️" : "💫";
  } else {
    // Flee (forced or chosen)
    navigateTo(world, agent, agent.homeLocationId);
    descKo = forceFlee
      ? `${agent.nameKo}이(가) 무기 없이 ${monster.nameKo}에게서 도망쳤다`
      : `${agent.nameKo}이(가) ${monster.nameKo}에게서 도망쳤다`;
    agent.emoji = "🏃";
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
    const foodPrice = Math.ceil(world.marketPrices.food);
    if (agent.gold >= foodPrice) {
      agent.gold -= foodPrice;
      agent.inventory.food += 1;
      // Buying increases price slightly (Step 17)
      world.marketPrices.food = Math.min(
        RESOURCE_PRICES.food * 2,
        world.marketPrices.food * 1.03,
      );
      agent.currentGoal = "eating";
      agent.currentGoalKo = "식사 준비 중";
      return makeEvent(
        world,
        agent,
        hour,
        "trade",
        `${agent.nameKo}이(가) 시장에서 음식을 ${foodPrice}골드에 구매`,
      );
    }
  }

  // Selling at market (Step 19 / Goal chain sell destination)
  if (location.type === "market" && agent.currentGoal === "selling") {
    const sellItems: ItemType[] = ["weapon", "tool", "potion", "meal"];
    for (const item of sellItems) {
      if (agent.inventory[item] >= 1) {
        const price = Math.ceil(world.marketPrices[item]);
        agent.inventory[item] -= 1;
        agent.gold += price;
        world.marketPrices[item] = Math.max(
          RESOURCE_PRICES[item] * 0.5,
          world.marketPrices[item] * 0.95,
        );
        const itemNames: Record<string, string> = {
          weapon: "무기",
          tool: "도구",
          potion: "물약",
          meal: "식사",
        };
        agent.currentGoal = "idle";
        agent.currentGoalKo = "자유 시간";
        return makeEvent(
          world,
          agent,
          hour,
          "trade",
          `${agent.nameKo}이(가) 시장에서 ${itemNames[item]}을(를) ${price}G에 판매`,
        );
      }
    }
    agent.currentGoal = "idle";
    agent.currentGoalKo = "자유 시간";
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
