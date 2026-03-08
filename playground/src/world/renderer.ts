import type {
  WorldAgent,
  Monster,
  MonsterType,
  TileType,
  WorldSimState,
  WorldLocation,
} from "soul-core";
import { tickToHour } from "soul-core";

// --- Constants ---

export const TILE_SIZE = 16;
const MAP_SIZE = 64;
const AGENT_RADIUS = 6;
const MINIMAP_SIZE = 64;
const MINIMAP_PADDING = 8;

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
}

export function createVisualState(): VisualState {
  return {
    lerps: new Map(),
    lerpProgress: 1,
    bubbles: [],
    interactions: [],
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
  vs.bubbles.push({ x, y, text, emoji, color, life: 0, maxLife: 120 });
}

export function addInteraction(
  vs: VisualState,
  fromId: string,
  toId: string,
  color: string,
) {
  vs.interactions.push({ fromId, toId, color, life: 0, maxLife: 90 });
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
  // Advance lerp
  vs.lerpProgress = Math.min(1, vs.lerpProgress + dt * 3);

  // Advance bubbles
  for (let i = vs.bubbles.length - 1; i >= 0; i--) {
    vs.bubbles[i].life += 1;
    if (vs.bubbles[i].life >= vs.bubbles[i].maxLife) {
      vs.bubbles.splice(i, 1);
    }
  }

  // Advance interactions
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
  // Ease-out cubic
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

// --- Draw Functions ---

function drawTiles(
  ctx: CanvasRenderingContext2D,
  world: WorldSimState,
  camera: Camera,
  canvasW: number,
  canvasH: number,
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
      const needsVar = type === "grass" || type === "forest";
      ctx.fillStyle = needsVar ? varyColor(base, col, row, 12) : base;
      ctx.fillRect(
        Math.floor(offsetX + col * ts),
        Math.floor(offsetY + row * ts),
        Math.ceil(ts) + 1,
        Math.ceil(ts) + 1,
      );
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
  ctx.font = `${Math.max(9, 11 * camera.zoom)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (const loc of locations) {
    const cx = offsetX + (loc.bounds.x + loc.bounds.w / 2) * ts;
    const cy = offsetY + loc.bounds.y * ts - 4 * camera.zoom;
    if (cx < -100 || cx > canvasW + 100 || cy < -40 || cy > canvasH + 40)
      continue;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const textW = ctx.measureText(loc.nameKo).width;
    ctx.fillRect(
      cx - textW / 2 - 3,
      cy - 12 * camera.zoom,
      textW + 6,
      14 * camera.zoom,
    );
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
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = 2 * camera.zoom;
    ctx.setLineDash([4 * camera.zoom, 4 * camera.zoom]);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
    ctx.setLineDash([]);
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
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.8, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection highlight (pulsing ring)
    if (agent.id === selectedId) {
      const pulse = 1 + 0.25 * Math.sin(tick * 0.12);
      ctx.save();
      ctx.strokeStyle = "#ffdd44";
      ctx.lineWidth = 2.5 * camera.zoom;
      ctx.shadowColor = "#ffdd44";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.8 * pulse, 0, Math.PI * 2);
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
    grad.addColorStop(0, lightenColor(agent.color, 40));
    grad.addColorStop(1, agent.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sleeping indicator
    if (agent.sleeping) {
      ctx.save();
      ctx.font = `${Math.max(12, 16 * camera.zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const zzz = tick % 3 === 0 ? "💤" : tick % 3 === 1 ? "z" : "Z";
      ctx.fillStyle = "#aaaaff";
      ctx.fillText(zzz, sx + r, sy - r * 1.5);
      ctx.restore();
    } else {
      // Emoji above (with bounce)
      const bounce = Math.sin(tick * 0.08 + agent.x * 0.5) * 2 * camera.zoom;
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
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(agent.nameKo, sx, sy + r + 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(agent.nameKo, sx, sy + r + 2);
    ctx.restore();
  }
}

function drawMonsters(
  ctx: CanvasRenderingContext2D,
  monsters: Monster[],
  camera: Camera,
  canvasW: number,
  canvasH: number,
  tick: number,
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
    const aura = 0.3 + 0.15 * Math.sin(tick * 0.1 + m.x);
    ctx.fillStyle = `rgba(180,30,30,${aura})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "rgba(200,40,40,0.8)";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Emoji
    const emoji = MONSTER_EMOJI[m.type] ?? "👾";
    ctx.save();
    ctx.font = `${Math.max(10, 14 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(emoji, sx, sy - r - 1);
    ctx.restore();

    // HP bar
    if (m.hp < m.maxHp) {
      const barW = ts * 1;
      const barH = 3 * camera.zoom;
      const bx = sx - barW / 2;
      const by = sy + r + 3;
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = "#e33";
      ctx.fillRect(bx, by, barW * (m.hp / m.maxHp), barH);
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
    const alpha =
      progress < 0.1
        ? progress / 0.1
        : progress > 0.7
          ? (1 - progress) / 0.3
          : 1;
    const floatY = -progress * 40 * camera.zoom;

    const bx = offsetX + (b.x + 0.5) * ts;
    const by = offsetY + (b.y + 0.5) * ts + floatY - 20 * camera.zoom;

    if (bx < -100 || bx > canvasW + 100 || by < -100 || by > canvasH + 100)
      continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Bubble background
    const fontSize = Math.max(10, 11 * camera.zoom);
    ctx.font = `${fontSize}px sans-serif`;
    const label = `${b.emoji} ${b.text}`;
    const tw = ctx.measureText(label).width;
    const padding = 6;
    const bw = tw + padding * 2;
    const bh = fontSize + padding * 2;

    // Rounded rect
    const rx = bx - bw / 2;
    const ry = by - bh / 2;
    const radius = 6;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
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
    ctx.fillText(label, bx, by);

    ctx.restore();
  }
}

function drawNightOverlay(
  ctx: CanvasRenderingContext2D,
  hour: number,
  canvasW: number,
  canvasH: number,
) {
  let alpha = 0;
  if (hour < 5) alpha = 0.45;
  else if (hour < 7) alpha = 0.45 * (1 - (hour - 5) / 2);
  else if (hour > 21) alpha = 0.45 * ((hour - 21) / 3);

  if (alpha > 0.01) {
    ctx.fillStyle = `rgba(10,10,50,${alpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
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

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(mx - 1, my - 1, MINIMAP_SIZE + 2, MINIMAP_SIZE + 2);

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

  for (const agent of world.agents) {
    ctx.fillStyle = agent.color;
    ctx.fillRect(mx + agent.x * scale, my + agent.y * scale, 2, 2);
  }

  for (const m of world.monsters) {
    if (!m.alive) continue;
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(mx + m.x * scale, my + m.y * scale, 2, 2);
  }

  const ts = TILE_SIZE * camera.zoom;
  const vpX = camera.x - canvasW / (2 * ts);
  const vpY = camera.y - canvasH / (2 * ts);
  const vpW = canvasW / ts;
  const vpH = canvasH / ts;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + vpX * scale, my + vpY * scale, vpW * scale, vpH * scale);
}

// --- Utility ---

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
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

  drawTiles(ctx, world, camera, canvasW, canvasH);
  drawLocationLabels(ctx, world.locations, camera, canvasW, canvasH);
  drawInteractions(ctx, world, vs, camera, canvasW, canvasH);
  drawMonsters(
    ctx,
    world.monsters,
    camera,
    canvasW,
    canvasH,
    world.currentTick,
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
  drawNightOverlay(ctx, hour, canvasW, canvasH);
  drawMinimap(ctx, world, camera, canvasW, canvasH);
}
