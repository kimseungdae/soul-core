import type { WorldTile, WorldLocation, TileType, ResourceNode } from "./types";

const W = 64;
const H = 64;

function tile(
  type: TileType,
  walkable: boolean,
  locationId?: string,
): WorldTile {
  return { type, walkable, locationId };
}

function fillRect(
  map: WorldTile[][],
  x: number,
  y: number,
  w: number,
  h: number,
  type: TileType,
  walkable: boolean,
  locationId?: string,
) {
  for (let row = y; row < y + h && row < H; row++) {
    for (let col = x; col < x + w && col < W; col++) {
      map[row][col] = tile(type, walkable, locationId);
    }
  }
}

function drawHLine(
  map: WorldTile[][],
  x1: number,
  x2: number,
  y: number,
  type: TileType,
  walkable: boolean,
  locationId?: string,
) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  for (let x = start; x <= end; x++) {
    if (y >= 0 && y < H && x >= 0 && x < W)
      map[y][x] = tile(type, walkable, locationId);
  }
}

function drawVLine(
  map: WorldTile[][],
  x: number,
  y1: number,
  y2: number,
  type: TileType,
  walkable: boolean,
  locationId?: string,
) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  for (let y = start; y <= end; y++) {
    if (y >= 0 && y < H && x >= 0 && x < W)
      map[y][x] = tile(type, walkable, locationId);
  }
}

function buildingOutline(
  map: WorldTile[][],
  x: number,
  y: number,
  w: number,
  h: number,
  locationId: string,
  doorX: number,
  doorY: number,
) {
  // Walls
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      if (row === y || row === y + h - 1 || col === x || col === x + w - 1) {
        map[row][col] = tile("wall", false, locationId);
      } else {
        map[row][col] = tile("floor", true, locationId);
      }
    }
  }
  // Door
  map[doorY][doorX] = tile("door", true, locationId);
}

export interface TileMapData {
  width: number;
  height: number;
  tiles: WorldTile[][];
  locations: WorldLocation[];
  resourceNodes: ResourceNode[];
}

export function createVillageMap(): TileMapData {
  // Init: all grass
  const tiles: WorldTile[][] = [];
  for (let y = 0; y < H; y++) {
    tiles[y] = [];
    for (let x = 0; x < W; x++) {
      tiles[y][x] = tile("grass", true);
    }
  }

  // --- Outer terrain ---

  // Mountains (top/bottom edges)
  fillRect(tiles, 0, 0, W, 3, "mountain", false);
  fillRect(tiles, 0, H - 3, W, 3, "mountain", false);
  fillRect(tiles, 0, 0, 3, H, "mountain", false);
  fillRect(tiles, W - 3, 0, 3, H, "mountain", false);

  // Forest belt
  fillRect(tiles, 3, 3, W - 6, 7, "forest", true);
  fillRect(tiles, 3, H - 10, W - 6, 7, "forest", true);
  fillRect(tiles, 3, 3, 7, H - 6, "forest", true);
  fillRect(tiles, W - 10, 3, 7, H - 6, "forest", true);

  // Clearings in forest for monster zones
  fillRect(tiles, 10, 5, 8, 4, "grass", true);
  fillRect(tiles, 46, 5, 8, 4, "grass", true);
  fillRect(tiles, 10, H - 9, 8, 4, "grass", true);
  fillRect(tiles, 46, H - 9, 8, 4, "grass", true);

  // --- River (west side, vertical) ---
  for (let y = 10; y < H - 10; y++) {
    const offset = Math.floor(Math.sin(y * 0.3) * 1.5);
    const rx = 13 + offset;
    tiles[y][rx] = tile("water", false);
    tiles[y][rx + 1] = tile("water", false);
  }

  // --- Dungeon entrance (north) ---
  const dungeonId = "dungeon";
  fillRect(tiles, 29, 4, 6, 5, "dungeon_wall", false, dungeonId);
  fillRect(tiles, 30, 5, 4, 3, "dungeon_floor", true, dungeonId);
  tiles[8][31] = tile("cave_entrance", true, dungeonId);
  tiles[8][32] = tile("cave_entrance", true, dungeonId);
  // Path to dungeon
  drawVLine(tiles, 31, 9, 14, "path", true);
  drawVLine(tiles, 32, 9, 14, "path", true);

  // --- Village area (center, roughly 30x30) ---
  const vx = 17; // village start x
  const vy = 15; // village start y
  const vw = 30;
  const vh = 34;

  // Village fence
  for (let x = vx; x < vx + vw; x++) {
    tiles[vy][x] = tile("fence", false);
    tiles[vy + vh - 1][x] = tile("fence", false);
  }
  for (let y = vy; y < vy + vh; y++) {
    tiles[y][vx] = tile("fence", false);
    tiles[y][vx + vw - 1] = tile("fence", false);
  }

  // Village interior: grass
  fillRect(tiles, vx + 1, vy + 1, vw - 2, vh - 2, "grass", true);

  // Gates
  const northGateX = 31;
  tiles[vy][northGateX] = tile("path", true, "gate_north");
  tiles[vy][northGateX + 1] = tile("path", true, "gate_north");

  const southGateX = 31;
  tiles[vy + vh - 1][southGateX] = tile("path", true, "gate_south");
  tiles[vy + vh - 1][southGateX + 1] = tile("path", true, "gate_south");

  // Bridge over river
  tiles[30][13] = tile("bridge", true);
  tiles[30][14] = tile("bridge", true);
  tiles[30][15] = tile("bridge", true);
  tiles[31][13] = tile("bridge", true);
  tiles[31][14] = tile("bridge", true);
  tiles[31][15] = tile("bridge", true);

  // --- Main roads ---
  // North-south main road
  drawVLine(tiles, 31, vy + 1, vy + vh - 2, "path", true);
  drawVLine(tiles, 32, vy + 1, vy + vh - 2, "path", true);

  // East-west main road
  drawHLine(tiles, vx + 1, vx + vw - 2, 30, "path", true);
  drawHLine(tiles, vx + 1, vx + vw - 2, 31, "path", true);

  // --- Central Plaza ---
  const plazaId = "plaza";
  fillRect(tiles, 28, 28, 8, 8, "plaza", true, plazaId);
  // Fountain (center of plaza, decorative)
  tiles[31][31] = tile("water", false, plazaId);
  tiles[31][32] = tile("water", false, plazaId);
  tiles[32][31] = tile("water", false, plazaId);
  tiles[32][32] = tile("water", false, plazaId);

  // --- Buildings ---

  // 1. Tavern (east of plaza, large)
  const tavernId = "tavern";
  buildingOutline(tiles, 37, 27, 8, 7, tavernId, 37, 30);
  // Side path to tavern
  drawHLine(tiles, 36, 37, 30, "path", true);

  // 2. Blacksmith (southeast)
  const smithId = "blacksmith";
  buildingOutline(tiles, 37, 36, 7, 6, smithId, 37, 38);
  drawHLine(tiles, 36, 37, 38, "path", true);

  // 3. Market area (south of plaza)
  const marketId = "market";
  fillRect(tiles, 28, 37, 8, 4, "plaza", true, marketId);
  tiles[37][29] = tile("market_stall", false, marketId);
  tiles[37][31] = tile("market_stall", false, marketId);
  tiles[37][33] = tile("market_stall", false, marketId);
  tiles[37][35] = tile("market_stall", false, marketId);

  // 4. Library (northwest inside village)
  const libraryId = "library";
  buildingOutline(tiles, 19, 17, 7, 6, libraryId, 25, 20);
  drawHLine(tiles, 25, 31, 20, "path", true);

  // 5. Church (northeast inside village)
  const churchId = "church";
  buildingOutline(tiles, 37, 17, 7, 7, churchId, 37, 20);
  drawHLine(tiles, 33, 37, 20, "path", true);

  // 6. Barracks (north, near gate)
  const barracksId = "barracks";
  buildingOutline(tiles, 27, 17, 6, 5, barracksId, 31, 21);
  // Already connected to main road

  // 7. House - Kael (warrior)
  const house1Id = "house_kael";
  buildingOutline(tiles, 19, 25, 6, 5, house1Id, 24, 27);
  drawHLine(tiles, 24, 28, 27, "path", true);

  // 8. House - Lyra (scholar)
  const house2Id = "house_lyra";
  buildingOutline(tiles, 19, 31, 6, 5, house2Id, 24, 33);
  drawHLine(tiles, 24, 28, 33, "path", true);

  // 9. House - Vex (rogue)
  const house3Id = "house_vex";
  buildingOutline(tiles, 19, 37, 6, 5, house3Id, 24, 39);
  drawHLine(tiles, 24, 28, 39, "path", true);

  // 10. House - Elena (healer)
  const house4Id = "house_elena";
  buildingOutline(tiles, 37, 43, 6, 5, house4Id, 37, 45);
  drawHLine(tiles, 33, 37, 45, "path", true);

  // 11. House - Bjorn (blacksmith)
  const house5Id = "house_bjorn";
  buildingOutline(tiles, 27, 43, 6, 5, house5Id, 32, 43);

  // 12. House - Mira (merchant)
  const house6Id = "house_mira";
  buildingOutline(tiles, 19, 43, 6, 5, house6Id, 24, 45);
  drawHLine(tiles, 24, 28, 45, "path", true);

  // Secondary paths
  drawVLine(tiles, 28, 27, 45, "path", true);
  drawHLine(tiles, 33, 37, 30, "path", true);
  drawVLine(tiles, 36, 27, 42, "path", true);

  // --- Locations ---
  const locations: WorldLocation[] = [
    {
      id: "plaza",
      name: "Village Plaza",
      nameKo: "마을 광장",
      type: "plaza",
      bounds: { x: 28, y: 28, w: 8, h: 8 },
      entrance: { x: 31, y: 28 },
      safeZone: true,
    },
    {
      id: "tavern",
      name: "Golden Mug Tavern",
      nameKo: "황금잔 주점",
      type: "tavern",
      bounds: { x: 37, y: 27, w: 8, h: 7 },
      entrance: { x: 37, y: 30 },
      safeZone: true,
    },
    {
      id: "blacksmith",
      name: "Bjorn's Forge",
      nameKo: "비요른의 대장간",
      type: "blacksmith",
      bounds: { x: 37, y: 36, w: 7, h: 6 },
      entrance: { x: 37, y: 38 },
      safeZone: true,
    },
    {
      id: "market",
      name: "Village Market",
      nameKo: "마을 시장",
      type: "market",
      bounds: { x: 28, y: 37, w: 8, h: 4 },
      entrance: { x: 31, y: 37 },
      safeZone: true,
    },
    {
      id: "library",
      name: "Hall of Knowledge",
      nameKo: "지식의 전당",
      type: "library",
      bounds: { x: 19, y: 17, w: 7, h: 6 },
      entrance: { x: 25, y: 20 },
      safeZone: true,
    },
    {
      id: "church",
      name: "Temple of Light",
      nameKo: "빛의 신전",
      type: "church",
      bounds: { x: 37, y: 17, w: 7, h: 7 },
      entrance: { x: 37, y: 20 },
      safeZone: true,
    },
    {
      id: "barracks",
      name: "Guard Barracks",
      nameKo: "경비 막사",
      type: "barracks",
      bounds: { x: 27, y: 17, w: 6, h: 5 },
      entrance: { x: 31, y: 21 },
      safeZone: true,
    },
    {
      id: "gate_north",
      name: "North Gate",
      nameKo: "북문",
      type: "gate",
      bounds: { x: 31, y: 15, w: 2, h: 1 },
      entrance: { x: 31, y: 15 },
      safeZone: true,
    },
    {
      id: "gate_south",
      name: "South Gate",
      nameKo: "남문",
      type: "gate",
      bounds: { x: 31, y: 48, w: 2, h: 1 },
      entrance: { x: 31, y: 48 },
      safeZone: true,
    },
    {
      id: "house_kael",
      name: "Kael's House",
      nameKo: "카엘의 집",
      type: "house",
      bounds: { x: 19, y: 25, w: 6, h: 5 },
      entrance: { x: 24, y: 27 },
      safeZone: true,
    },
    {
      id: "house_lyra",
      name: "Lyra's House",
      nameKo: "리라의 집",
      type: "house",
      bounds: { x: 19, y: 31, w: 6, h: 5 },
      entrance: { x: 24, y: 33 },
      safeZone: true,
    },
    {
      id: "house_vex",
      name: "Vex's House",
      nameKo: "벡스의 집",
      type: "house",
      bounds: { x: 19, y: 37, w: 6, h: 5 },
      entrance: { x: 24, y: 39 },
      safeZone: true,
    },
    {
      id: "house_elena",
      name: "Elena's House",
      nameKo: "엘레나의 집",
      type: "house",
      bounds: { x: 37, y: 43, w: 6, h: 5 },
      entrance: { x: 37, y: 45 },
      safeZone: true,
    },
    {
      id: "house_bjorn",
      name: "Bjorn's House",
      nameKo: "비요른의 집",
      type: "house",
      bounds: { x: 27, y: 43, w: 6, h: 5 },
      entrance: { x: 32, y: 43 },
      safeZone: true,
    },
    {
      id: "house_mira",
      name: "Mira's House",
      nameKo: "미라의 집",
      type: "house",
      bounds: { x: 19, y: 43, w: 6, h: 5 },
      entrance: { x: 24, y: 45 },
      safeZone: true,
    },
    {
      id: "dungeon",
      name: "Shadow Cave",
      nameKo: "그림자 동굴",
      type: "dungeon",
      bounds: { x: 29, y: 4, w: 6, h: 5 },
      entrance: { x: 31, y: 8 },
      safeZone: false,
    },
    {
      id: "north_forest",
      name: "Northern Forest",
      nameKo: "북쪽 숲",
      type: "forest",
      bounds: { x: 10, y: 5, w: 15, h: 9 },
      entrance: { x: 17, y: 10 },
      safeZone: false,
    },
    {
      id: "south_forest",
      name: "Southern Forest",
      nameKo: "남쪽 숲",
      type: "forest",
      bounds: { x: 10, y: H - 10, w: 15, h: 7 },
      entrance: { x: 17, y: H - 10 },
      safeZone: false,
    },
  ];

  const resourceNodes = createResourceNodes();

  return { width: W, height: H, tiles, locations, resourceNodes };
}

function createResourceNodes(): ResourceNode[] {
  return [
    // Wood - forest areas
    {
      id: "wood-1",
      type: "wood",
      x: 5,
      y: 12,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    {
      id: "wood-2",
      type: "wood",
      x: 8,
      y: 15,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    {
      id: "wood-3",
      type: "wood",
      x: 6,
      y: 50,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    {
      id: "wood-4",
      type: "wood",
      x: 55,
      y: 12,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    {
      id: "wood-5",
      type: "wood",
      x: 55,
      y: 50,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    {
      id: "wood-6",
      type: "wood",
      x: 8,
      y: 30,
      amount: 10,
      maxAmount: 10,
      regenRate: 0.02,
      emoji: "🌲",
      nameKo: "나무",
    },
    // Ore - mountain/dungeon areas
    {
      id: "ore-1",
      type: "ore",
      x: 30,
      y: 6,
      amount: 8,
      maxAmount: 8,
      regenRate: 0.01,
      emoji: "⛏️",
      nameKo: "광석",
    },
    {
      id: "ore-2",
      type: "ore",
      x: 33,
      y: 6,
      amount: 8,
      maxAmount: 8,
      regenRate: 0.01,
      emoji: "⛏️",
      nameKo: "광석",
    },
    {
      id: "ore-3",
      type: "ore",
      x: 5,
      y: 5,
      amount: 8,
      maxAmount: 8,
      regenRate: 0.01,
      emoji: "⛏️",
      nameKo: "광석",
    },
    {
      id: "ore-4",
      type: "ore",
      x: 58,
      y: 5,
      amount: 8,
      maxAmount: 8,
      regenRate: 0.01,
      emoji: "⛏️",
      nameKo: "광석",
    },
    // Food - hunting grounds (clearings)
    {
      id: "food-1",
      type: "food",
      x: 12,
      y: 7,
      amount: 6,
      maxAmount: 6,
      regenRate: 0.015,
      emoji: "🦌",
      nameKo: "사냥터",
    },
    {
      id: "food-2",
      type: "food",
      x: 48,
      y: 7,
      amount: 6,
      maxAmount: 6,
      regenRate: 0.015,
      emoji: "🦌",
      nameKo: "사냥터",
    },
    {
      id: "food-3",
      type: "food",
      x: 12,
      y: 57,
      amount: 6,
      maxAmount: 6,
      regenRate: 0.015,
      emoji: "🦌",
      nameKo: "사냥터",
    },
    {
      id: "food-4",
      type: "food",
      x: 48,
      y: 57,
      amount: 6,
      maxAmount: 6,
      regenRate: 0.015,
      emoji: "🦌",
      nameKo: "사냥터",
    },
    // Herb - river/forest edges
    {
      id: "herb-1",
      type: "herb",
      x: 11,
      y: 25,
      amount: 5,
      maxAmount: 5,
      regenRate: 0.025,
      emoji: "🌿",
      nameKo: "약초",
    },
    {
      id: "herb-2",
      type: "herb",
      x: 11,
      y: 35,
      amount: 5,
      maxAmount: 5,
      regenRate: 0.025,
      emoji: "🌿",
      nameKo: "약초",
    },
    {
      id: "herb-3",
      type: "herb",
      x: 7,
      y: 42,
      amount: 5,
      maxAmount: 5,
      regenRate: 0.025,
      emoji: "🌿",
      nameKo: "약초",
    },
  ];
}
