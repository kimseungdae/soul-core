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
  return { x: 32, y: 32, zoom: 1 };
}

// --- Pseudo-random variation ---

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

// --- Render helpers ---

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
      const needsVariation = type === "grass" || type === "forest";
      ctx.fillStyle = needsVariation ? varyColor(base, col, row, 12) : base;
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

function drawAgents(
  ctx: CanvasRenderingContext2D,
  agents: WorldAgent[],
  selectedId: string | null,
  camera: Camera,
  canvasW: number,
  canvasH: number,
  tick: number,
) {
  const ts = TILE_SIZE * camera.zoom;
  const offsetX = canvasW / 2 - camera.x * ts;
  const offsetY = canvasH / 2 - camera.y * ts;
  const r = AGENT_RADIUS * camera.zoom;

  for (const agent of agents) {
    const sx = offsetX + (agent.x + 0.5) * ts;
    const sy = offsetY + (agent.y + 0.5) * ts;

    if (
      sx < -r * 4 ||
      sx > canvasW + r * 4 ||
      sy < -r * 4 ||
      sy > canvasH + r * 4
    )
      continue;

    // Selection highlight (pulsing ring)
    if (agent.id === selectedId) {
      const pulse = 1 + 0.3 * Math.sin(tick * 0.15);
      ctx.save();
      ctx.strokeStyle = "#ffdd44";
      ctx.lineWidth = 2.5 * camera.zoom;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Agent body
    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Dark outline
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Emoji above
    ctx.save();
    ctx.font = `${Math.max(10, 14 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(agent.emoji, sx, sy - r - 2 * camera.zoom);
    ctx.restore();

    // Name below
    ctx.save();
    ctx.font = `bold ${Math.max(8, 9 * camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeText(agent.nameKo, sx, sy + r + 1);
    ctx.fillText(agent.nameKo, sx, sy + r + 1);
    ctx.restore();
  }
}

function drawMonsters(
  ctx: CanvasRenderingContext2D,
  monsters: Monster[],
  camera: Camera,
  canvasW: number,
  canvasH: number,
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

    // Red-tinted circle
    const r = AGENT_RADIUS * camera.zoom * 0.85;
    ctx.fillStyle = "rgba(180,30,30,0.7)";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

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
      const barW = ts * 0.8;
      const barH = 2 * camera.zoom;
      const bx = sx - barW / 2;
      const by = sy + r + 2;
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = "#e33";
      ctx.fillRect(bx, by, barW * (m.hp / m.maxHp), barH);
    }
  }
}

function drawNightOverlay(
  ctx: CanvasRenderingContext2D,
  hour: number,
  canvasW: number,
  canvasH: number,
) {
  let alpha = 0;

  if (hour < 5) {
    alpha = 0.45;
  } else if (hour < 7) {
    alpha = 0.45 * (1 - (hour - 5) / 2);
  } else if (hour > 21) {
    alpha = 0.45 * ((hour - 21) / 3);
  }

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

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(mx - 1, my - 1, MINIMAP_SIZE + 2, MINIMAP_SIZE + 2);

  // Tiles (1px per tile)
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

  // Agents as dots
  for (const agent of world.agents) {
    ctx.fillStyle = agent.color;
    ctx.fillRect(mx + agent.x * scale, my + agent.y * scale, 2, 2);
  }

  // Monsters as red dots
  for (const m of world.monsters) {
    if (!m.alive) continue;
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(mx + m.x * scale, my + m.y * scale, 2, 2);
  }

  // Viewport rectangle
  const ts = TILE_SIZE * camera.zoom;
  const vpX = camera.x - canvasW / (2 * ts);
  const vpY = camera.y - canvasH / (2 * ts);
  const vpW = canvasW / ts;
  const vpH = canvasH / ts;

  ctx.strokeStyle = "#ffffff";
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
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Background (out-of-bounds area)
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawTiles(ctx, world, camera, canvasW, canvasH);
  drawLocationLabels(ctx, world.locations, camera, canvasW, canvasH);
  drawMonsters(ctx, world.monsters, camera, canvasW, canvasH);
  drawAgents(
    ctx,
    world.agents,
    world.selectedAgentId,
    camera,
    canvasW,
    canvasH,
    world.currentTick,
  );

  const hour = tickToHour(world.currentTick, world.config.ticksPerDay);
  drawNightOverlay(ctx, hour, canvasW, canvasH);
  drawMinimap(ctx, world, camera, canvasW, canvasH);
}
