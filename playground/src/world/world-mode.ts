import {
  loadPrototypePatterns,
  createWorldState,
  worldTick,
  tickToHour,
  hourToTimeString,
  getTimeOfDayLabelKo,
  type WorldSimState,
  type WorldAgent,
  type WorldEvent,
} from "soul-core";
import { AGENT_DEFS } from "./agents";
import {
  createCamera,
  renderWorld,
  TILE_SIZE,
  type Camera,
  createVisualState,
  type VisualState,
  snapshotPositions,
  tickVisuals,
  addBubble,
  addInteraction,
} from "./renderer";

// --- State ---

let world: WorldSimState;
let camera: Camera;
let vs: VisualState;
let running = false;
let timerId: number | null = null;
let animFrameId: number | null = null;
let lastFrameTime = 0;

// --- DOM ---

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;

const worldCanvas = $<HTMLCanvasElement>("#world-canvas");
const ctx = worldCanvas.getContext("2d")!;
const dayEl = $("#world-day");
const timeEl = $("#world-time");
const periodEl = $("#world-period");
const speedInput = $<HTMLInputElement>("#world-speed");
const speedVal = $("#world-speed-val");
const startBtn = $("#world-start");
const pauseBtn = $("#world-pause");
const resetBtn = $("#world-reset");
const npcList = $("#world-npc-list");
const npcCountEl = $("#world-npc-count");
const selectedNameEl = $("#world-selected-name");
const npcDetail = $("#world-npc-detail");
const worldEmotions = $("#world-emotions");
const worldNeeds = $("#world-needs");
const worldRelationships = $("#world-relationships");
const eventLog = $("#world-event-log");
const infoBar = $("#world-info-bar");

// --- Korean Labels ---

const EMOTION_LABELS: Record<string, string> = {
  joy: "기쁨",
  anger: "분노",
  fear: "공포",
  sadness: "슬픔",
  surprise: "놀람",
  disgust: "혐오",
  contempt: "경멸",
  trust: "신뢰",
  anticipation: "기대",
  shame: "수치",
  guilt: "죄책감",
  pride: "자부심",
  envy: "질투",
  gratitude: "감사",
  hope: "희망",
  love: "사랑",
  loneliness: "외로움",
  curiosity: "호기심",
  nostalgia: "향수",
  awe: "경외",
  determination: "결의",
  anxiety: "불안",
  distress: "고통",
};

const NEED_LABELS: Record<string, string> = {
  hunger: "배고픔",
  fatigue: "피로",
  pain: "고통",
  safety: "안전",
  affiliation: "소속감",
  intimacy: "친밀감",
  autonomy: "자율성",
  competence: "유능감",
  recognition: "인정욕구",
  curiosity: "호기심",
  control: "통제력",
  rest: "휴식",
};

// --- Init ---

export function initWorldMode() {
  loadPrototypePatterns();
  world = createWorldState(AGENT_DEFS);
  camera = createCamera();
  vs = createVisualState();
  snapshotPositions(vs, world.agents);

  resizeCanvas();
  buildNpcList();
  updateTimeDisplay();
  renderNpcDetail();
  startRenderLoop();

  // Event listeners
  startBtn.addEventListener("click", startSim);
  pauseBtn.addEventListener("click", pauseSim);
  resetBtn.addEventListener("click", resetWorld);
  speedInput.addEventListener("input", () => {
    speedVal.textContent = `${(+speedInput.value / 1000).toFixed(1)}초`;
    if (running) restartTimer();
  });

  // Canvas events
  worldCanvas.addEventListener("click", onCanvasClick);
  worldCanvas.addEventListener("wheel", onCanvasWheel, { passive: false });

  // Keyboard
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resizeCanvas);
}

export function destroyWorldMode() {
  if (timerId !== null) clearTimeout(timerId);
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("resize", resizeCanvas);
  running = false;
  timerId = null;
  animFrameId = null;
}

// --- Canvas ---

function resizeCanvas() {
  const parent = worldCanvas.parentElement!;
  worldCanvas.width = parent.clientWidth;
  worldCanvas.height = parent.clientHeight - 30;
}

function startRenderLoop() {
  lastFrameTime = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    tickVisuals(vs, dt);
    renderWorld(ctx, world, camera, worldCanvas.width, worldCanvas.height, vs);
    animFrameId = requestAnimationFrame(frame);
  }
  animFrameId = requestAnimationFrame(frame);
}

// --- Simulation ---

function startSim() {
  if (running) return;
  running = true;
  world.paused = false;
  startBtn.style.display = "none";
  pauseBtn.style.display = "block";
  restartTimer();
}

function pauseSim() {
  running = false;
  world.paused = true;
  startBtn.style.display = "block";
  startBtn.textContent = "재개";
  pauseBtn.style.display = "none";
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

// --- Time-based Speed ---

const SPEED_LABELS: Record<string, string> = {
  "0.15": "밤 (빠르게)",
  "0.3": "새벽",
  "1": "",
};

function getSpeedMultiplier(hour: number): number {
  // With 288 ticks/day (5min/tick), keep activity time at normal speed
  // and compress sleep/transition time
  if (hour >= 22 || hour < 5) return 0.15; // night: very fast
  if (hour >= 5 && hour < 6) return 0.3; // dawn: fast
  return 1.0; // day: normal
}

function restartTimer() {
  if (timerId !== null) clearTimeout(timerId);
  const baseInterval = +speedInput.value;

  function scheduleTick() {
    const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
    const multiplier = getSpeedMultiplier(hour);
    const interval = baseInterval * multiplier;

    // Update speed label
    const label = SPEED_LABELS[String(multiplier)] ?? `x${multiplier}`;
    speedVal.textContent = `${(baseInterval / 1000).toFixed(1)}초${label ? ` (${label})` : ""}`;

    timerId = window.setTimeout(() => {
      snapshotPositions(vs, world.agents);

      const events = worldTick(world);

      for (const a of world.agents) {
        const l = vs.lerps.get(a.id);
        if (l) {
          l.toX = a.x;
          l.toY = a.y;
        }
      }
      vs.lerpProgress = 0;

      const EVENT_BUBBLE_CONFIG: Record<
        string,
        { emoji: string; color: string }
      > = {
        social: { emoji: "💬", color: "#7c8aff" },
        combat: { emoji: "⚔️", color: "#ff6b6b" },
        routine: { emoji: "🔄", color: "#4ecdc4" },
        gather: { emoji: "⛏️", color: "#8BC34A" },
        craft: { emoji: "🔨", color: "#FF9800" },
        trade: { emoji: "💰", color: "#FFD700" },
        eat: { emoji: "🍖", color: "#FF7043" },
        cooperate: { emoji: "🤝", color: "#42A5F5" },
        think: { emoji: "💭", color: "#AB47BC" },
      };

      for (const ev of events) {
        const agent = world.agents.find((a) => a.id === ev.agentId);
        if (!agent) continue;

        if (ev.type === "social") {
          const other = world.agents.find(
            (a) => a.id !== agent.id && ev.descriptionKo.includes(a.nameKo),
          );
          if (other) {
            addInteraction(vs, agent.id, other.id, "#7c8aff");
          }
        }
        if (ev.type === "cooperate" || ev.type === "trade") {
          const other = world.agents.find(
            (a) => a.id !== agent.id && ev.descriptionKo.includes(a.nameKo),
          );
          if (other) {
            addInteraction(
              vs,
              agent.id,
              other.id,
              EVENT_BUBBLE_CONFIG[ev.type]?.color ?? "#fff",
            );
          }
        }

        const config = EVENT_BUBBLE_CONFIG[ev.type];
        if (config) {
          addBubble(
            vs,
            agent.x,
            agent.y,
            ev.descriptionKo,
            config.emoji,
            config.color,
          );
        }
      }

      updateTimeDisplay();
      updateNpcList();
      addEventsToLog(events);
      if (world.selectedAgentId) renderNpcDetail();

      if (running) scheduleTick();
    }, interval);
  }
  scheduleTick();
}

function resetWorld() {
  if (timerId !== null) clearTimeout(timerId);
  running = false;
  timerId = null;
  world = createWorldState(AGENT_DEFS);
  camera = createCamera();
  vs = createVisualState();
  snapshotPositions(vs, world.agents);
  startBtn.style.display = "block";
  startBtn.textContent = "시작";
  pauseBtn.style.display = "none";
  eventLog.innerHTML = "";
  updateTimeDisplay();
  buildNpcList();
  renderNpcDetail();
}

// --- UI Updates ---

function updateTimeDisplay() {
  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  const day = Math.floor(world.currentTick / world.config.ticksPerDay) + 1;
  dayEl.textContent = `${day}일차`;
  timeEl.textContent = hourToTimeString(hour);
  periodEl.textContent = getTimeOfDayLabelKo(hour);
}

function buildNpcList() {
  npcCountEl.textContent = String(world.agents.length);
  npcList.innerHTML = "";
  for (const agent of world.agents) {
    const card = document.createElement("div");
    card.className =
      "npc-card" + (world.selectedAgentId === agent.id ? " selected" : "");
    card.dataset.agentId = agent.id;
    const hPct = Math.floor(agent.hunger * 100);
    const hCol = hPct > 50 ? "#4CAF50" : hPct > 25 ? "#FF9800" : "#f44336";
    card.innerHTML = `
      <div class="npc-dot" style="background: ${agent.color}"></div>
      <span class="npc-emoji">${agent.emoji}</span>
      <span class="npc-name">${agent.nameKo}</span>
      <span class="npc-hunger" style="color:${hCol}">${hPct}%</span>
      <span class="npc-hp" style="color:${agent.hp < 30 ? "#f44336" : agent.hp < 60 ? "#FF9800" : "#4CAF50"}">❤️${Math.floor(agent.hp)}</span>
      <span class="npc-gold">💰${agent.gold}</span>
      <span class="npc-activity">${agent.currentGoalKo}</span>
    `;
    card.addEventListener("click", () => selectAgent(agent.id));
    npcList.appendChild(card);
  }
}

function updateNpcList() {
  const cards = npcList.querySelectorAll<HTMLDivElement>(".npc-card");
  cards.forEach((card) => {
    const id = card.dataset.agentId;
    const agent = world.agents.find((a) => a.id === id);
    if (!agent) return;
    card.querySelector(".npc-emoji")!.textContent = agent.emoji;
    card.querySelector(".npc-activity")!.textContent = agent.currentGoalKo;
    const hPct = Math.floor(agent.hunger * 100);
    const hCol = hPct > 50 ? "#4CAF50" : hPct > 25 ? "#FF9800" : "#f44336";
    const hungerEl = card.querySelector<HTMLElement>(".npc-hunger");
    if (hungerEl) {
      hungerEl.textContent = `${hPct}%`;
      hungerEl.style.color = hCol;
    }
    const goldEl = card.querySelector<HTMLElement>(".npc-gold");
    if (goldEl) goldEl.textContent = `💰${agent.gold}`;
    const hpEl = card.querySelector<HTMLElement>(".npc-hp");
    if (hpEl) {
      hpEl.textContent = `❤️${Math.floor(agent.hp)}`;
      hpEl.style.color =
        agent.hp < 30 ? "#f44336" : agent.hp < 60 ? "#FF9800" : "#4CAF50";
    }
    card.classList.toggle("selected", world.selectedAgentId === agent.id);
  });
}

function selectAgent(id: string) {
  world.selectedAgentId = id;
  // Center camera on agent
  const agent = world.agents.find((a) => a.id === id);
  if (agent) {
    camera.x = agent.x;
    camera.y = agent.y;
  }
  updateNpcList();
  renderNpcDetail();
}

function renderNpcDetail() {
  const agent = world.agents.find((a) => a.id === world.selectedAgentId);
  if (!agent) {
    selectedNameEl.textContent = "없음";
    npcDetail.innerHTML = "NPC를 클릭하여 선택하세요";
    worldEmotions.innerHTML = "";
    worldNeeds.innerHTML = "";
    worldRelationships.innerHTML = "";
    return;
  }

  selectedNameEl.textContent = agent.nameKo;

  const invItems =
    Object.entries(agent.inventory)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        const icons: Record<string, string> = {
          wood: "🪵",
          ore: "⛏️",
          food: "🍖",
          herb: "🌿",
          weapon: "⚔️",
          tool: "🔧",
          potion: "🧪",
          meal: "🍽️",
        };
        return `<span class="inv-item">${icons[k] ?? "📦"}${v}</span>`;
      })
      .join(" ") || '<span style="color:#555">없음</span>';

  const hungerPct = Math.floor(agent.hunger * 100);
  const hungerColor =
    hungerPct > 50 ? "#4CAF50" : hungerPct > 25 ? "#FF9800" : "#f44336";

  npcDetail.innerHTML = `
    <div class="npc-detail-header">
      <span class="npc-detail-emoji">${agent.emoji}</span>
      <div>
        <div class="npc-detail-name">${agent.nameKo} (${agent.seed.name})</div>
        <div class="npc-detail-role">${agent.seed.roles?.join(", ") ?? ""}</div>
      </div>
    </div>
    <div class="npc-detail-goal">
      <span class="goal-label">현재:</span> ${agent.currentGoalKo}
      ${agent.lastAction ? `<span style="color:#ff9f43">[${agent.lastAction.type}]</span>` : ""}
    </div>
    <div class="npc-stats">
      <div class="stat-row">
        <span>💰 골드: ${agent.gold}</span>
        <span style="color:${hungerColor}">🍖 포만감: ${hungerPct}%</span>
      </div>
      <div class="stat-row">
        <span style="color:${agent.hp < 30 ? "#f44336" : agent.hp < 60 ? "#FF9800" : "#4CAF50"}">❤️ HP: ${Math.floor(agent.hp)}/100</span>
        <span style="color:${agent.fatigue > 0.7 ? "#f44336" : agent.fatigue > 0.4 ? "#FF9800" : "#4CAF50"}">💧 피로: ${Math.floor(agent.fatigue * 100)}%</span>
      </div>
      <div class="stat-row">
        <div style="display:flex;gap:4px;align-items:center;width:100%">
          <span style="font-size:10px;min-width:50px">❤️ HP</span>
          <div style="flex:1;height:6px;background:#333;border-radius:3px;overflow:hidden">
            <div style="width:${agent.hp}%;height:100%;background:${agent.hp < 30 ? "#f44336" : agent.hp < 60 ? "#FF9800" : "#4CAF50"}"></div>
          </div>
        </div>
      </div>
      <div class="stat-row">
        <div style="display:flex;gap:4px;align-items:center;width:100%">
          <span style="font-size:10px;min-width:50px">💧 피로</span>
          <div style="flex:1;height:6px;background:#333;border-radius:3px;overflow:hidden">
            <div style="width:${agent.fatigue * 100}%;height:100%;background:${agent.fatigue > 0.7 ? "#f44336" : agent.fatigue > 0.4 ? "#FF9800" : "#4CAF50"}"></div>
          </div>
        </div>
      </div>
      <div class="stat-row">
        <span>⚔️ 전투: ${(agent.skills.combat * 100).toFixed(0)}%</span>
        <span>🔨 제작: ${(agent.skills.crafting * 100).toFixed(0)}%</span>
        <span>⛏️ 채집: ${(agent.skills.gathering * 100).toFixed(0)}%</span>
      </div>
      ${agent.inventory.tool > 0 ? `<div class="stat-row"><span>🔧 도구 내구도: ${10 - agent.toolUses}/10</span></div>` : ""}
      ${agent.inventory.weapon > 0 ? `<div class="stat-row"><span>🗡️ 무기 내구도: ${20 - agent.weaponUses}/20</span></div>` : ""}
      ${Object.keys(agent.debts).length > 0 ? `<div class="stat-row"><span style="color:#f44336">💸 빚: ${Object.values(agent.debts).reduce((s, v) => s + v, 0)}G</span></div>` : ""}
      <div class="stat-row inv-row">
        <span class="inv-label">인벤토리:</span> ${invItems}
      </div>
    </div>
  `;

  // Emotions
  const activeEmotions = agent.state.emotions.active.filter(
    (e) => e.intensity > 0.05,
  );
  if (activeEmotions.length > 0) {
    worldEmotions.innerHTML = activeEmotions
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 6)
      .map(
        (e) => `
        <div class="emotion-bar">
          <span class="bar-label">${EMOTION_LABELS[e.type] ?? e.type}</span>
          <div class="bar-track"><div class="bar-fill" style="width: ${e.intensity * 100}%"></div></div>
          <span class="bar-value">${e.intensity.toFixed(2)}</span>
        </div>
      `,
      )
      .join("");
  } else {
    worldEmotions.innerHTML =
      '<div style="color:#444;font-size:11px">평온</div>';
  }

  // Needs
  worldNeeds.innerHTML = agent.state.needs.needs
    .sort((a, b) => a.current - b.current)
    .slice(0, 6)
    .map(
      (n) => `
      <div class="need-bar">
        <span class="bar-label">${NEED_LABELS[n.id] ?? n.id}</span>
        <div class="bar-track"><div class="bar-fill" style="width: ${n.current * 100}%"></div></div>
        <span class="bar-value">${n.current.toFixed(2)}</span>
      </div>
    `,
    )
    .join("");

  // Relationships
  const rels = agent.state.social.relationships;
  if (rels.length > 0) {
    worldRelationships.innerHTML = rels
      .slice(0, 5)
      .map((r) => {
        const other = world.agents.find((a) => a.id === r.targetId);
        const name = other?.nameKo ?? r.targetId;
        return `
          <div class="rel-card">
            <div class="rel-name">${name}</div>
            <div class="rel-stats">
              <span class="rel-stat ${r.trust >= 0 ? "positive" : "negative"}">신뢰: ${r.trust.toFixed(2)}</span>
              <span class="rel-stat ${r.affection >= 0 ? "positive" : "negative"}">호감: ${r.affection.toFixed(2)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    worldRelationships.innerHTML =
      '<div style="color:#444;font-size:11px">없음</div>';
  }
}

function addEventsToLog(events: WorldEvent[]) {
  for (const ev of events) {
    const entry = document.createElement("div");
    entry.className = `event-log-entry ${ev.type}`;
    const timeStr = hourToTimeString(ev.hour);
    entry.innerHTML = `<span class="event-time">${timeStr}</span><span class="event-text">${ev.descriptionKo}</span>`;
    eventLog.insertBefore(entry, eventLog.firstChild);
  }

  // Trim
  while (eventLog.children.length > 100) {
    eventLog.removeChild(eventLog.lastChild!);
  }
}

// --- Input ---

const keysDown = new Set<string>();

function onKeyDown(e: KeyboardEvent) {
  const worldView = document.getElementById("world-view");
  if (!worldView || worldView.style.display === "none") return;

  const speed = 2;
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      camera.y -= speed;
      break;
    case "ArrowDown":
    case "s":
    case "S":
      camera.y += speed;
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      camera.x -= speed;
      break;
    case "ArrowRight":
    case "d":
    case "D":
      camera.x += speed;
      break;
    case " ":
      e.preventDefault();
      if (running) pauseSim();
      else startSim();
      break;
    default:
      return;
  }
  e.preventDefault();

  // Clamp camera
  camera.x = Math.max(0, Math.min(63, camera.x));
  camera.y = Math.max(0, Math.min(63, camera.y));
}

function onCanvasClick(e: MouseEvent) {
  const rect = worldCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Convert to tile coords
  const viewW = worldCanvas.width;
  const viewH = worldCanvas.height;
  const tileSize = TILE_SIZE * camera.zoom;
  const offsetX = viewW / 2 - camera.x * tileSize;
  const offsetY = viewH / 2 - camera.y * tileSize;

  const tileX = Math.floor((mx - offsetX) / tileSize);
  const tileY = Math.floor((my - offsetY) / tileSize);

  // Check if clicked on an agent
  const clickedAgent = world.agents.find((a) => a.x === tileX && a.y === tileY);

  if (clickedAgent) {
    selectAgent(clickedAgent.id);
  } else {
    // Check 1-tile radius
    const nearAgent = world.agents.find(
      (a) => Math.abs(a.x - tileX) <= 1 && Math.abs(a.y - tileY) <= 1,
    );
    if (nearAgent) {
      selectAgent(nearAgent.id);
    } else {
      world.selectedAgentId = null;
      updateNpcList();
      renderNpcDetail();
    }
  }
}

function onCanvasWheel(e: WheelEvent) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  camera.zoom = Math.max(0.5, Math.min(4, camera.zoom + delta));
}
