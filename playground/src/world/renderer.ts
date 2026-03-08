import type {
  WorldAgent,
  Monster,
  MonsterType,
  TileType,
  WorldSimState,
  WorldLocation,
  ResourceNode,
} from "soul-core";
import { tickToHour } from "soul-core";

// --- Constants ---

export const TILE_SIZE = 16;
const MAP_SIZE = 64;
const AGENT_RADIUS = 6;
const MINIMAP_SIZE = 72;
const MINIMAP_PADDING = 10;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// --- Visual Effects ---

export interface Bubble {
  x: number;
  y: number;
  text: string;
  emoji: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface InteractionLine {
  fromId: string;
  toId: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface AgentLerp {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface VisualState {
  lerps: Map<string, AgentLerp>;
  lerpProgress: number;
  bubbles: Bubble[];
  interactions: InteractionLine[];
  globalTick: number;
}

export function createVisualState(): VisualState {
  return {
    lerps: new Map(),
    lerpProgress: 1,
    bubbles: [],
    interactions: [],
    globalTick: 0,
  };
}

export function addBubble(
  vs: VisualState,
  x: number,
  y: number,
  text: string,
  emoji: string,
  color: string,
) {
  vs.bubbles.push({ x, y, text, emoji, color, life: 0, maxLife: 150 });
}

export function addInteraction(
  vs: VisualState,
  fromId: string,
  toId: string,
  color: string,
) {
  vs.interactions.push({ fromId, toId, color, life: 0, maxLife: 120 });
}

export function snapshotPositions(vs: VisualState, agents: WorldAgent[]) {
  for (const a of agents) {
    const prev = vs.lerps.get(a.id);
    vs.lerps.set(a.id, {
      fromX: prev ? prev.toX : a.x,
      fromY: prev ? prev.toY : a.y,
      toX: a.x,
      toY: a.y,
    });
  }
  vs.lerpProgress = 0;
}

export function tickVisuals(vs: VisualState, dt: number) {
  vs.globalTick++;
  vs.lerpProgress = Math.min(1, vs.lerpProgress + dt * 3);

  for (let i = vs.bubbles.length - 1; i >= 0; i--) {
    vs.bubbles[i].life += 1;
    if (vs.bubbles[i].life >= vs.bubbles[i].maxLife) {
      vs.bubbles.splice(i, 1);
    }
  }

  for (let i = vs.interactions.length - 1; i >= 0; i--) {
    vs.interactions[i].life += 1;
    if (vs.interactions[i].life >= vs.interactions[i].maxLife) {
      vs.interactions.splice(i, 1);
    }
  }
}

// --- Tile Colors ---

const TILE_COLORS: Record<TileType, string> = {
  grass: "#3a7a2e",
  path: "#a09070",
  water: "#2a5a8e",
  forest: "#1a4a12",
  wall: "#6a6a7a",
  floor: "#7a6a5a",
  door: "#8b6914",
  bridge: "#8a7a5a",
  mountain: "#5a5a6a",
  dungeon_floor: "#4a3a4e",
  dungeon_wall: "#2a1a2e",
  cave_entrance: "#1a1a2a",
  fence: "#6b5b3f",
  plaza: "#8a8a7a",
  market_stall: "#9b7b3f",
};

// Tile variation range per type
const TILE_VARY: Partial<Record<TileType, number>> = {
  grass: 14,
  forest: 12,
  path: 6,
  floor: 5,
  plaza: 5,
  mountain: 8,
  dungeon_floor: 6,
  water: 6,
  market_stall: 4,
};

// Tiles that should have subtle border
const TILE_BORDER: Partial<Record<TileType, string>> = {
  wall: "rgba(40,40,50,0.6)",
  fence: "rgba(60,50,30,0.5)",
  dungeon_wall: "rgba(20,10,20,0.6)",
  bridge: "rgba(80,70,50,0.4)",
};

const MONSTER_EMOJI: Record<MonsterType, string> = {
  wolf: "🐺",
  goblin: "👹",
  skeleton: "💀",
  bandit: "🗡️",
};

// --- Camera ---

export function createCamera(): Camera {
  return { x: 32, y: 32, zoom: 1.5 };
}

// --- Helpers ---

function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) >>> 0;
}

function varyColor(base: string, x: number, y: number, range: number): string {
  const h = tileHash(x, y);
  const offset = (h % (range * 2 + 1)) - range;
  const r = Math.min(255, Math.max(0, parseInt(base.slice(1, 3), 16) + offset));
  const g = Math.min(255, Math.max(0, parseInt(base.slice(3, 5), 16) + offset));
  const b = Math.min(255, Math.max(0, parseInt(base.slice(5, 7), 16) + offset));
  return `rgb(${r},${g},${b})`;
}

function lerp(a: number, b: number, t: number): number {
  const tt = 1 - Math.pow(1 - t, 3);
  return a + (b - a) * tt;
}

function getAgentScreenPos(
  agent: WorldAgent,
  vs: VisualState,
  ts: number,
  offsetX: number,
  offsetY: number,
): { sx: number; sy: number } {
  const lerpData = vs.lerps.get(agent.id);
  let ax: number, ay: number;
  if (lerpData && vs.lerpProgress < 1) {
    ax = lerp(lerpData.fromX, lerpData.toX, vs.lerpProgress);
    ay = lerp(lerpData.fromY, lerpData.toY, vs.lerpProgress);
  } else {
    ax = agent.x;
    ay = agent.y;
  }
  return {
    sx: offsetX + (ax + 0.5) * ts,
    sy: offsetY + (ay + 0.5) * ts,
  };
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

// --- Draw Functions ---

function drawTiles(
  ctx: CanvasRenderingContext2D,
  world: WorldSimState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  tick: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  const startCol = Math.max(0, Math.floor(-offsetX / ts));
  const startRow = Math.max(0, Math.floor(-offsetY / ts));
  const endCol = Math.min(MAP_SIZE, Math.ceil((canvasW - offsetX) / ts));
  const endRow = Math.min(MAP_SIZE, Math.ceil((canvasH - offsetY) / ts));

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const tile = world.tiles[row]?.[col];
      if (!tile) continue;
      const type = tile.type;
      const base = TILE_COLORS[type] ?? "#000000";
      const vRange = TILE_VARY[type];

      // Water shimmer
      if (type === "water") {
        const wave = Math.sin(tick * 0.03 + col * 0.8 + row * 0.5) * 8;
        ctx.fillStyle = varyColor(base, col, row + Math.floor(wave), 10);
      } else if (vRange) {
        ctx.fillStyle = varyColor(base, col, row, vRange);
      } else {
        ctx.fillStyle = base;
      }

      const px = Math.floor(offsetX + col * ts);
      const py = Math.floor(offsetY + row * ts);
      const pw = Math.ceil(ts) + 1;
      const ph = Math.ceil(ts) + 1;
      ctx.fillRect(px, py, pw, ph);

      // Subtle border for structural tiles
      const borderColor = TILE_BORDER[type];
      if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }
    }
  }
}

function drawLocationLabels(
  ctx: CanvasRenderingContext2D,
  locations: WorldLocation[],
  camera: Camera,
  canvasW: number,
  canvasH: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  ctx.save();
  ctx.font = `bold ${Math.max(9, 11 * camera.zoom)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (const loc of locations) {
    const cx = offsetX + (loc.bounds.x + loc.bounds.w / 2) * ts;
    const cy = offsetY + loc.bounds.y * ts - 4 * camera.zoom;
    if (cx < -100 || cx > canvasW + 100 || cy < -40 || cy > canvasH + 40)
      continue;

    const textW = ctx.measureText(loc.nameKo).width;
    const boxH = 14 * camera.zoom;

    // Background with border
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(cx - textW / 2 - 4, cy - boxH, textW + 8, boxH);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - textW / 2 - 4, cy - boxH, textW + 8, boxH);

    // Text with shadow
    ctx.fillStyle = "#ffffff";
    ctx.fillText(loc.nameKo, cx, cy);
  }
  ctx.restore();
}

function drawInteractions(
  ctx: CanvasRenderingContext2D,
  world: WorldSimState,
  vs: VisualState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  for (const line of vs.interactions) {
    const from = world.agents.find((a) => a.id === line.fromId);
    const to = world.agents.find((a) => a.id === line.toId);
    if (!from || !to) continue;

    const p1 = getAgentScreenPos(from, vs, ts, offsetX, offsetY);
    const p2 = getAgentScreenPos(to, vs, ts, offsetX, offsetY);

    const alpha = 1 - line.life / line.maxLife;
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.globalAlpha = alpha * 0.7;
    ctx.lineWidth = 2.5 * camera.zoom;
    ctx.setLineDash([6 * camera.zoom, 4 * camera.zoom]);
    // Animate dash offset for flowing effect
    ctx.lineDashOffset = -(vs.globalTick * 0.8);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulse dots at endpoints
    const pulseR = (3 + Math.sin(vs.globalTick * 0.15) * 1.5) * camera.zoom;
    ctx.fillStyle = line.color;
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(p1.sx, p1.sy, pulseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p2.sx, p2.sy, pulseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawAgents(
  ctx: CanvasRenderingContext2D,
  agents: WorldAgent[],
  selectedId: string | null,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  tick: number,
  vs: VisualState,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;
  const r = AGENT_RADIUS * camera.zoom;
  const gt = vs.globalTick;

  for (const agent of agents) {
    const { sx, sy } = getAgentScreenPos(agent, vs, ts, offsetX, offsetY);

    if (
      sx < -r * 6 ||
      sx > canvasW + r * 6 ||
      sy < -r * 6 ||
      sy > canvasH + r * 6
    )
      continue;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection highlight (double pulsing ring)
    if (agent.id === selectedId) {
      const pulse = 1 + 0.2 * Math.sin(gt * 0.1);
      ctx.save();
      ctx.strokeStyle = "#ffdd44";
      ctx.lineWidth = 3 * camera.zoom;
      ctx.shadowColor = "#ffdd44";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.8 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1.5 * camera.zoom;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Agent body (gradient)
    const grad = ctx.createRadialGradient(
      sx - r * 0.3,
      sy - r * 0.3,
      r * 0.1,
      sx,
      sy,
      r,
    );
    grad.addColorStop(0, lightenColor(agent.color, 50));
    grad.addColorStop(0.7, agent.color);
    grad.addColorStop(1, lightenColor(agent.color, -20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sleeping indicator (floating Z with fade)
    if (agent.sleeping) {
      ctx.save();
      const zPhase = gt * 0.06;
      const z1Alpha = 0.4 + 0.6 * Math.abs(Math.sin(zPhase));
      const z2Alpha = 0.4 + 0.6 * Math.abs(Math.sin(zPhase + 1));
      const z3Alpha = 0.4 + 0.6 * Math.abs(Math.sin(zPhase + 2));
      const floatBase = sy - r * 1.5;

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#aaaaff";

      // Three Z's floating at different heights
      ctx.font = `${Math.max(8, 10 * camera.zoom)}px sans-serif`;
      ctx.globalAlpha = z1Alpha;
      ctx.fillText(
        "z",
        sx + r * 0.5,
        floatBase + Math.sin(gt * 0.04) * 3 * camera.zoom,
      );
      ctx.font = `${Math.max(10, 13 * camera.zoom)}px sans-serif`;
      ctx.globalAlpha = z2Alpha;
      ctx.fillText(
        "Z",
        sx + r * 1.0,
        floatBase - 6 * camera.zoom + Math.sin(gt * 0.04 + 1) * 3 * camera.zoom,
      );
      ctx.font = `bold ${Math.max(12, 16 * camera.zoom)}px sans-serif`;
      ctx.globalAlpha = z3Alpha;
      ctx.fillText(
        "Z",
        sx + r * 1.5,
        floatBase -
          14 * camera.zoom +
          Math.sin(gt * 0.04 + 2) * 3 * camera.zoom,
      );
      ctx.restore();
    } else {
      // Emoji above (with bounce)
      const bounce = Math.sin(gt * 0.06 + agent.x * 0.5) * 2.5 * camera.zoom;
      ctx.save();
      ctx.font = `${Math.max(12, 16 * camera.zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(agent.emoji, sx, sy - r - 3 * camera.zoom + bounce);
      ctx.restore();
    }

    // Name below (with outline for readability)
    ctx.save();
    ctx.font = `bold ${Math.max(8, 10 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeText(agent.nameKo, sx, sy + r + 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(agent.nameKo, sx, sy + r + 2);
    ctx.restore();

    // Status effect icons (Step 23)
    const statusIcons: string[] = [];
    if (agent.hp < 30) statusIcons.push("❤️");
    if (agent.fatigue > 0.7) statusIcons.push("💧");
    if (agent.stunTicks > 0) statusIcons.push("💫");
    if (agent.huntPartyWith) statusIcons.push("👥");
    if (statusIcons.length > 0 && !agent.sleeping) {
      ctx.save();
      ctx.font = `${Math.max(8, 10 * camera.zoom)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const iconY = sy - r - 22 * camera.zoom;
      statusIcons.forEach((icon, i) => {
        ctx.fillText(icon, sx + r + i * 10 * camera.zoom, iconY);
      });
      ctx.restore();
    }

    // HP bar (when < 100 and not sleeping)
    if (agent.hp < 100 && !agent.sleeping) {
      const barW = ts * 0.9;
      const barH = 2.5 * camera.zoom;
      const bx = sx - barW / 2;
      const by = sy + r + 14 * camera.zoom;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(bx, by, barW, barH);
      const hpRatio = agent.hp / 100;
      ctx.fillStyle =
        hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FF9800" : "#f44336";
      ctx.fillRect(bx, by, barW * hpRatio, barH);
    }

    // Hunger bar (only when low)
    if (agent.hunger < 0.5 && !agent.sleeping) {
      const barW = ts * 0.9;
      const barH = 2.5 * camera.zoom;
      const bx = sx - barW / 2;
      const hpOffset = agent.hp < 100 ? 5 * camera.zoom : 0;
      const by = sy + r + 14 * camera.zoom + hpOffset;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(bx, by, barW, barH);
      const hRatio = agent.hunger;
      ctx.fillStyle = hRatio > 0.3 ? "#FF9800" : "#f44336";
      ctx.fillRect(bx, by, barW * hRatio, barH);
    }

    // Action progress bar with real progress (Step 24)
    if (agent.actionTicks > 0 && agent.maxActionTicks > 0) {
      const barW = ts * 0.9;
      const barH = 3 * camera.zoom;
      const bx = sx - barW / 2;
      const by = sy - r - 20 * camera.zoom;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bx, by, barW, barH);
      const progress = 1 - agent.actionTicks / agent.maxActionTicks;
      // Color based on action type
      const isGathering = agent.currentGoal === "gathering";
      const isCrafting = agent.currentGoal === "crafting";
      const barColor = isGathering
        ? "#4CAF50"
        : isCrafting
          ? "#FF9800"
          : "#f44336";
      ctx.fillStyle = barColor;
      ctx.fillRect(bx, by, barW * progress, barH);
      // Progress text
      ctx.save();
      ctx.font = `${Math.max(7, 8 * camera.zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${Math.floor(progress * 100)}%`, sx, by - 1);
      ctx.restore();
    }
  }
}

function drawResourceNodes(
  ctx: CanvasRenderingContext2D,
  nodes: ResourceNode[],
  camera: Camera,
  canvasW: number,
  canvasH: number,
  gt: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  const nodeColors: Record<string, string> = {
    wood: "#2d7a2d",
    ore: "#7a7a8a",
    food: "#8a6a3a",
    herb: "#4a9a3a",
  };

  for (const node of nodes) {
    const sx = offsetX + (node.x + 0.5) * ts;
    const sy = offsetY + (node.y + 0.5) * ts;
    if (sx < -40 || sx > canvasW + 40 || sy < -40 || sy > canvasH + 40)
      continue;

    const r = AGENT_RADIUS * camera.zoom * 0.75;
    const color = nodeColors[node.type] ?? "#666";

    // Background glow
    const pulse = 0.3 + 0.1 * Math.sin(gt * 0.04 + node.x * 0.5);
    ctx.fillStyle = `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Node body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Emoji
    ctx.save();
    ctx.font = `${Math.max(10, 13 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(node.emoji, sx, sy - r - 1);
    ctx.restore();

    // Amount bar
    const barW = ts * 0.8;
    const barH = 2.5 * camera.zoom;
    const bx = sx - barW / 2;
    const by = sy + r + 2;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(bx, by, barW, barH);
    const ratio = node.amount / node.maxAmount;
    ctx.fillStyle =
      ratio > 0.5 ? "#4CAF50" : ratio > 0.2 ? "#FF9800" : "#f44336";
    ctx.fillRect(bx, by, barW * ratio, barH);
  }
}

function drawMonsters(
  ctx: CanvasRenderingContext2D,
  monsters: Monster[],
  camera: Camera,
  canvasW: number,
  canvasH: number,
  tick: number,
  gt: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  for (const m of monsters) {
    if (!m.alive) continue;

    const sx = offsetX + (m.x + 0.5) * ts;
    const sy = offsetY + (m.y + 0.5) * ts;
    if (sx < -40 || sx > canvasW + 40 || sy < -40 || sy > canvasH + 40)
      continue;

    const r = AGENT_RADIUS * camera.zoom * 0.85;

    // Threat aura (pulsing)
    const aura = 0.25 + 0.15 * Math.sin(gt * 0.08 + m.x);
    ctx.fillStyle = `rgba(180,30,30,${aura})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "rgba(200,40,40,0.8)";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Emoji with bounce
    const emoji = MONSTER_EMOJI[m.type] ?? "👾";
    const bounce = Math.sin(gt * 0.07 + m.y * 0.5) * 1.5 * camera.zoom;
    ctx.save();
    ctx.font = `${Math.max(10, 14 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(emoji, sx, sy - r - 1 + bounce);
    ctx.restore();

    // HP bar (gradient)
    if (m.hp < m.maxHp) {
      const barW = ts * 1;
      const barH = 3 * camera.zoom;
      const bx = sx - barW / 2;
      const by = sy + r + 3;
      ctx.fillStyle = "#222";
      ctx.fillRect(bx, by, barW, barH);
      const hpRatio = m.hp / m.maxHp;
      const hpGrad = ctx.createLinearGradient(bx, by, bx + barW * hpRatio, by);
      hpGrad.addColorStop(0, "#ff4444");
      hpGrad.addColorStop(1, "#ff8844");
      ctx.fillStyle = hpGrad;
      ctx.fillRect(bx, by, barW * hpRatio, barH);
    }
  }
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  vs: VisualState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;

  for (const b of vs.bubbles) {
    const progress = b.life / b.maxLife;

    // Alpha: fade in (0-10%), full (10-70%), fade out (70-100%)
    const alpha =
      progress < 0.1
        ? progress / 0.1
        : progress > 0.7
          ? (1 - progress) / 0.3
          : 1;

    // Scale: bounce in, shrink out
    let scale = 1;
    if (progress < 0.08) {
      const t = progress / 0.08;
      scale = 0.5 + 0.6 * t - 0.1 * Math.sin(t * Math.PI);
    } else if (progress > 0.8) {
      scale = 1 - ((progress - 0.8) / 0.2) * 0.3;
    }

    const floatY = -progress * 45 * camera.zoom;

    const bx = offsetX + (b.x + 0.5) * ts;
    const by = offsetY + (b.y + 0.5) * ts + floatY - 22 * camera.zoom;

    if (bx < -200 || bx > canvasW + 200 || by < -100 || by > canvasH + 100)
      continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bx, by);
    ctx.scale(scale, scale);

    // Bubble background
    const fontSize = Math.max(10, 11 * camera.zoom);
    ctx.font = `${fontSize}px sans-serif`;
    const label = `${b.emoji} ${b.text}`;
    const tw = ctx.measureText(label).width;
    const padding = 8;
    const bw = tw + padding * 2;
    const bh = fontSize + padding * 2;

    // Rounded rect with gradient background
    const rx = -bw / 2;
    const ry = -bh / 2;
    const radius = 8;

    const bgGrad = ctx.createLinearGradient(rx, ry, rx, ry + bh);
    bgGrad.addColorStop(0, "rgba(20,20,30,0.85)");
    bgGrad.addColorStop(1, "rgba(10,10,20,0.9)");
    ctx.fillStyle = bgGrad;

    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + bw - radius, ry);
    ctx.quadraticCurveTo(rx + bw, ry, rx + bw, ry + radius);
    ctx.lineTo(rx + bw, ry + bh - radius);
    ctx.quadraticCurveTo(rx + bw, ry + bh, rx + bw - radius, ry + bh);
    ctx.lineTo(rx + radius, ry + bh);
    ctx.quadraticCurveTo(rx, ry + bh, rx, ry + bh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}

function drawNightOverlay(
  ctx: CanvasRenderingContext2D,
  hour: number,
  canvasW: number,
  canvasH: number,
  gt: number,
) {
  let nightAlpha = 0;
  let warmAlpha = 0;

  if (hour < 5) {
    nightAlpha = 0.45;
  } else if (hour < 6) {
    // Dawn: transition from night blue to warm orange
    nightAlpha = 0.45 * (1 - (hour - 5));
    warmAlpha = 0.15 * (hour - 5);
  } else if (hour < 7) {
    warmAlpha = 0.15 * (1 - (hour - 6));
  } else if (hour >= 18 && hour < 19.5) {
    // Sunset: warm golden
    warmAlpha = 0.12 * ((hour - 18) / 1.5);
  } else if (hour >= 19.5 && hour < 21) {
    // Dusk: warm fading to blue
    warmAlpha = 0.12 * (1 - (hour - 19.5) / 1.5);
    nightAlpha = 0.45 * ((hour - 19.5) / 1.5);
  } else if (hour >= 21) {
    nightAlpha = 0.45;
  }

  // Warm overlay (sunrise/sunset)
  if (warmAlpha > 0.01) {
    ctx.fillStyle = `rgba(200,120,50,${warmAlpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Night overlay
  if (nightAlpha > 0.01) {
    ctx.fillStyle = `rgba(10,10,50,${nightAlpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Stars
    if (nightAlpha > 0.2) {
      ctx.save();
      const starAlpha = (nightAlpha - 0.2) / 0.25;
      for (let i = 0; i < 30; i++) {
        const h = tileHash(i * 7, i * 13);
        const sx = h % canvasW;
        const sy = (h >> 10) % canvasH;
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(gt * 0.02 + i * 2.3));
        ctx.globalAlpha = starAlpha * twinkle;
        ctx.fillStyle = "#ffffff";
        const size = 1 + (h % 2);
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.restore();
    }
  }
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  world: WorldSimState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
) {
  const mx = canvasW - MINIMAP_SIZE - MINIMAP_PADDING;
  const my = canvasH - MINIMAP_SIZE - MINIMAP_PADDING;
  const scale = MINIMAP_SIZE / MAP_SIZE;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(mx - 2, my - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 2, my - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const tile = world.tiles[row]?.[col];
      if (!tile) continue;
      ctx.fillStyle = TILE_COLORS[tile.type] ?? "#000";
      ctx.fillRect(
        mx + col * scale,
        my + row * scale,
        Math.ceil(scale),
        Math.ceil(scale),
      );
    }
  }

  // Resource nodes
  const nodeMinimapColors: Record<string, string> = {
    wood: "#4CAF50",
    ore: "#9E9E9E",
    food: "#8D6E63",
    herb: "#66BB6A",
  };
  for (const node of world.resourceNodes) {
    ctx.fillStyle = nodeMinimapColors[node.type] ?? "#888";
    ctx.fillRect(mx + node.x * scale, my + node.y * scale, 2, 2);
  }

  // Agents (larger dots)
  for (const agent of world.agents) {
    ctx.fillStyle = agent.color;
    ctx.fillRect(mx + agent.x * scale - 0.5, my + agent.y * scale - 0.5, 3, 3);
  }

  // Monsters
  for (const m of world.monsters) {
    if (!m.alive) continue;
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(mx + m.x * scale, my + m.y * scale, 2, 2);
  }

  // Viewport rect
  const ts = TILE_SIZE * camera.zoom;
  const vpX = camera.x - canvasW / (2 * ts);
  const vpY = camera.y - canvasH / (2 * ts);
  const vpW = canvasW / ts;
  const vpH = canvasH / ts;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + vpX * scale, my + vpY * scale, vpW * scale, vpH * scale);
}

// --- Main render ---

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: WorldSimState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  vs: VisualState,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawTiles(ctx, world, camera, canvasW, canvasH, vs.globalTick);
  drawLocationLabels(ctx, world.locations, camera, canvasW, canvasH);
  drawResourceNodes(
    ctx,
    world.resourceNodes,
    camera,
    canvasW,
    canvasH,
    vs.globalTick,
  );
  drawInteractions(ctx, world, vs, camera, canvasW, canvasH);
  drawMonsters(
    ctx,
    world.monsters,
    camera,
    canvasW,
    canvasH,
    world.currentTick,
    vs.globalTick,
  );
  drawAgents(
    ctx,
    world.agents,
    world.selectedAgentId,
    camera,
    canvasW,
    canvasH,
    world.currentTick,
    vs,
  );
  drawBubbles(ctx, vs, camera, canvasW, canvasH);

  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  drawNightOverlay(ctx, hour, canvasW, canvasH, vs.globalTick);
  drawMinimap(ctx, world, camera, canvasW, canvasH);
}
