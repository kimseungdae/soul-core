import type { WorldTile } from "./types";

export interface Point {
  x: number;
  y: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIRS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function findPath(
  tiles: WorldTile[][],
  start: Point,
  end: Point,
  maxSteps = 500,
): Point[] {
  const h = tiles.length;
  const w = tiles[0].length;

  if (start.x === end.x && start.y === end.y) return [];
  if (end.x < 0 || end.x >= w || end.y < 0 || end.y >= h) return [];
  if (!tiles[end.y][end.x].walkable) {
    // Find nearest walkable tile to end
    for (const d of DIRS) {
      const nx = end.x + d.x;
      const ny = end.y + d.y;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && tiles[ny][nx].walkable) {
        end = { x: nx, y: ny };
        break;
      }
    }
    if (!tiles[end.y][end.x].walkable) return [];
  }

  const open: AStarNode[] = [];
  const closed = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };
  open.push(startNode);

  let steps = 0;
  while (open.length > 0 && steps < maxSteps) {
    steps++;

    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path: Point[] = [];
      let node: AStarNode | null = current;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key(current.x, current.y));

    for (const d of DIRS) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (!tiles[ny][nx].walkable) continue;
      if (closed.has(key(nx, ny))) continue;

      const g = current.g + 1;
      const h2 = heuristic({ x: nx, y: ny }, end);
      const f = g + h2;

      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        open.push({ x: nx, y: ny, g, h: h2, f, parent: current });
      }
    }
  }

  return [];
}

export function distance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isAdjacent(a: Point, b: Point): boolean {
  return distance(a, b) <= 2;
}
