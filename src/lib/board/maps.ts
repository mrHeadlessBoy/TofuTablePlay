import type { BoardMap, MapTheme, Point, PropKind, TerrainKind, Tile, Token } from './types'

export const FEET_PER_TILE = 5
export const MAP_COLS = 18
export const MAP_ROWS = 14

export const MAP_THEMES: { id: MapTheme; label: string; name: string }[] = [
  { id: 'forest', label: 'Forest Road', name: 'Autumn Forest Road' },
  { id: 'ruins', label: 'Ruined City', name: 'Abandoned City Block' },
  { id: 'dungeon', label: 'Dungeon', name: 'Sunken Dungeon Hall' },
]

/** Small deterministic RNG so the same seed always builds the same map. */
function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function tileIndex(map: Pick<BoardMap, 'cols'>, x: number, y: number): number {
  return y * map.cols + x
}

export function inBounds(map: Pick<BoardMap, 'cols' | 'rows'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.cols && y < map.rows
}

export function tileAt(map: BoardMap, x: number, y: number): Tile | null {
  return inBounds(map, x, y) ? map.tiles[tileIndex(map, x, y)] : null
}

/** World-space height of the walkable surface of a tile. */
export function tileTopY(tile: Tile): number {
  if (tile.terrain === 'water') return -0.2
  return tile.elevation * 0.22
}

function makeTile(terrain: TerrainKind, noise: number, elevation = 0): Tile {
  return { terrain, elevation, prop: null, blocked: terrain === 'water' || terrain === 'void', noise }
}

function setProp(tile: Tile, prop: PropKind, blocks = true) {
  tile.prop = prop
  if (blocks) tile.blocked = true
}

function buildForest(rand: () => number, cols: number, rows: number): { tiles: Tile[]; party: Point; threat: Point } {
  const phase = rand() * Math.PI * 2
  const hillX = 3 + rand() * 4
  const hillY = rand() < 0.5 ? 2 : rows - 3
  const pathY = (x: number) => Math.round(rows / 2 + Math.sin(x * 0.45 + phase) * 2.2)
  const riverX = (y: number) => Math.round(cols * 0.68 + Math.sin(y * 0.55 + phase * 1.7) * 1.6)

  const tiles: Tile[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const noise = rand()
      const hill = Math.max(0, 2.6 - Math.hypot(x - hillX, y - hillY) * 0.75)
      const tile = makeTile('grass', noise, Math.min(3, Math.round(hill + noise * 0.35)))
      const onPath = Math.abs(y - pathY(x)) <= 0
      const nearPath = Math.abs(y - pathY(x)) <= 1
      const river = riverX(y)
      const onRiver = x === river || (x === river + 1 && noise > 0.45)

      if (onRiver) {
        tile.terrain = onPath ? 'bridge' : 'water'
        tile.elevation = 0
        tile.blocked = !onPath
      } else if (onPath) {
        tile.terrain = 'path'
        tile.elevation = Math.min(tile.elevation, 1)
      } else if (nearPath) {
        tile.elevation = Math.min(tile.elevation, 1)
      }

      if (tile.terrain === 'grass' && !nearPath) {
        const edge = Math.min(x, y, cols - 1 - x, rows - 1 - y)
        const treeChance = edge <= 1 ? 0.34 : 0.13
        const roll = rand()
        if (roll < treeChance) setProp(tile, 'tree')
        else if (roll < treeChance + 0.05) setProp(tile, 'rock')
        else if (roll < treeChance + 0.11) setProp(tile, 'bush', false)
      }
      tiles.push(tile)
    }
  }

  // A small ruin on the far bank.
  const ruinX = Math.min(cols - 3, riverX(2) + 3)
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 2], [0, 2]] as const) {
    const tile = tiles[(2 + dy) * cols + ruinX + dx]
    if (!tile || tile.terrain === 'water' || tile.terrain === 'bridge' || tile.terrain === 'path') continue
    tile.terrain = 'stone'
    tile.prop = null
    tile.blocked = false
    if ((dx + dy) % 2 === 0) setProp(tile, 'pillar')
  }

  const party = { x: 2, y: pathY(2) }
  const camp = tiles[(party.y - 2 < 0 ? party.y + 2 : party.y - 2) * cols + 1]
  if (camp && camp.terrain === 'grass') {
    camp.prop = null
    camp.blocked = false
    setProp(camp, 'campfire')
  }
  return { tiles, party, threat: { x: cols - 3, y: pathY(cols - 3) } }
}

function buildRuins(rand: () => number, cols: number, rows: number): { tiles: Tile[]; party: Point; threat: Point } {
  const roadTop = Math.floor(rows / 2) - 2
  const roadBottom = roadTop + 3
  const crossX = 6 + Math.floor(rand() * 6)

  const tiles: Tile[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const noise = rand()
      const onRoad = (y >= roadTop && y <= roadBottom) || (x >= crossX && x <= crossX + 2)
      const sidewalk =
        !onRoad && (y === roadTop - 1 || y === roadBottom + 1 || x === crossX - 1 || x === crossX + 3)
      const tile = makeTile(onRoad ? 'asphalt' : sidewalk ? 'stone' : 'rubble', noise, onRoad ? 0 : 1)

      if (onRoad) {
        const roll = rand()
        if (roll < 0.05) setProp(tile, 'wreck')
        else if (roll < 0.09) setProp(tile, 'crate')
      } else if (!sidewalk) {
        // Broken building shells: walls along the outer rows, debris inside.
        const outerRow = y === 0 || y === rows - 1 || y === roadTop - 3 || y === roadBottom + 3
        const outerCol = x === 0 || x === cols - 1
        const roll = rand()
        if ((outerRow || outerCol) && roll < 0.62) {
          setProp(tile, 'wall')
          tile.elevation = 1
        } else if (roll < 0.1) setProp(tile, 'rock')
        else if (roll < 0.16) setProp(tile, 'crate')
        else if (roll < 0.2) {
          tile.terrain = 'grass'
          setProp(tile, 'tree')
        }
      }
      tiles.push(tile)
    }
  }
  const midRoad = roadTop + 1
  return { tiles, party: { x: 1, y: midRoad }, threat: { x: cols - 2, y: midRoad + 1 } }
}

function buildDungeon(rand: () => number, cols: number, rows: number): { tiles: Tile[]; party: Point; threat: Point } {
  const chasmX = Math.floor(cols / 2) + Math.floor(rand() * 3) - 1
  const bridgeY = 3 + Math.floor(rand() * (rows - 6))
  const dividerX = Math.floor(cols / 4)
  const doorY = 2 + Math.floor(rand() * (rows - 4))

  const tiles: Tile[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const noise = rand()
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1
      const tile = makeTile('stone', noise, 0)

      if (x === chasmX || x === chasmX + 1) {
        if (y === bridgeY) tile.terrain = 'bridge'
        else {
          tile.terrain = 'void'
          tile.blocked = true
        }
      } else if (border) {
        setProp(tile, 'wall')
      } else if (x === dividerX && y !== doorY && y !== doorY + 1) {
        setProp(tile, 'wall')
      } else {
        const pillarGrid = x % 4 === 2 && y % 4 === 2 && Math.abs(x - chasmX) > 1
        const roll = rand()
        if (pillarGrid) setProp(tile, 'pillar')
        else if (roll < 0.035) setProp(tile, 'rock')
        else if (roll < 0.06) setProp(tile, 'crate')
        else if (roll < 0.1) tile.terrain = 'rubble'
      }
      tiles.push(tile)
    }
  }

  // Braziers flanking the bridge.
  for (const dx of [-1, 2]) {
    const tile = tiles[(bridgeY - 1) * cols + chasmX + dx]
    if (tile && tile.terrain !== 'void' && !tile.prop) setProp(tile, 'campfire')
  }
  return { tiles, party: { x: 2, y: doorY }, threat: { x: cols - 3, y: bridgeY } }
}

export function generateMap(theme: MapTheme, seed: number): BoardMap {
  const rand = mulberry32(seed * 7919 + theme.length * 104729)
  const cols = MAP_COLS
  const rows = MAP_ROWS
  const built =
    theme === 'forest' ? buildForest(rand, cols, rows) : theme === 'ruins' ? buildRuins(rand, cols, rows) : buildDungeon(rand, cols, rows)

  const map: BoardMap = {
    theme,
    seed,
    name: MAP_THEMES.find((entry) => entry.id === theme)?.name ?? 'Battle Board',
    cols,
    rows,
    tiles: built.tiles,
    anchors: { party: built.party, threat: built.threat },
  }

  // Whatever the generator rolled, the party needs open ground to stand on and walk out of,
  // and new threats need a clear tile to appear on.
  for (const [anchor, radius] of [[map.anchors.party, 2], [map.anchors.threat, 1]] as const) {
    const level = tileAt(map, anchor.x, anchor.y)?.elevation ?? 0
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tile = tileAt(map, anchor.x + dx, anchor.y + dy)
        if (!tile || tile.terrain === 'water' || tile.terrain === 'void' || tile.prop === 'wall') continue
        tile.prop = null
        tile.blocked = false
        tile.elevation = Math.max(level - 1, Math.min(level + 1, tile.elevation))
      }
    }
  }
  return map
}

const NEIGHBOURS: Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
]

function canStep(map: BoardMap, from: Point, to: Point): boolean {
  const a = tileAt(map, from.x, from.y)
  const b = tileAt(map, to.x, to.y)
  if (!a || !b || b.blocked) return false
  // A single step cannot climb or drop more than one elevation level.
  if (Math.abs(tileTopY(a) - tileTopY(b)) > 0.3) return false
  // No squeezing diagonally between two blocked corners.
  if (from.x !== to.x && from.y !== to.y) {
    const sideA = tileAt(map, to.x, from.y)
    const sideB = tileAt(map, from.x, to.y)
    if (!sideA || !sideB || sideA.blocked || sideB.blocked) return false
  }
  return true
}

/**
 * Every tile the token can reach with the given movement budget.
 * Returns tile index -> feet spent. Allies can be walked through, other tokens cannot,
 * and nobody may stop on an occupied tile.
 */
export function reachableTiles(map: BoardMap, tokens: Token[], token: Token, budgetFeet: number): Map<number, number> {
  const reachable = new Map<number, number>()
  if (budgetFeet < FEET_PER_TILE || !inBounds(map, token.x, token.y)) return reachable

  const occupied = new Map<number, Token>()
  for (const other of tokens) {
    if (other.id !== token.id) occupied.set(tileIndex(map, other.x, other.y), other)
  }

  const cost = new Map<number, number>([[tileIndex(map, token.x, token.y), 0]])
  let frontier: Point[] = [{ x: token.x, y: token.y }]

  while (frontier.length > 0) {
    const next: Point[] = []
    for (const point of frontier) {
      const spent = cost.get(tileIndex(map, point.x, point.y)) ?? 0
      if (spent + FEET_PER_TILE > budgetFeet) continue
      for (const delta of NEIGHBOURS) {
        const target = { x: point.x + delta.x, y: point.y + delta.y }
        if (!canStep(map, point, target)) continue
        const index = tileIndex(map, target.x, target.y)
        if (cost.has(index)) continue
        const blocker = occupied.get(index)
        if (blocker && blocker.kind !== token.kind) continue
        cost.set(index, spent + FEET_PER_TILE)
        next.push(target)
        if (!blocker) reachable.set(index, spent + FEET_PER_TILE)
      }
    }
    frontier = next
  }
  return reachable
}

/** Free, standable tiles closest to a point. Used for placing heroes and spawned creatures. */
export function findFreeTiles(map: BoardMap, tokens: Pick<Token, 'x' | 'y'>[], near: Point, count: number): Point[] {
  const taken = new Set(tokens.map((token) => tileIndex(map, token.x, token.y)))
  const candidates: (Point & { distance: number })[] = []
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const tile = map.tiles[tileIndex(map, x, y)]
      if (tile.blocked || taken.has(tileIndex(map, x, y))) continue
      candidates.push({ x, y, distance: Math.hypot(x - near.x, y - near.y) })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  return candidates.slice(0, count).map(({ x, y }) => ({ x, y }))
}

/** D&D grid distance: diagonals count as one tile. */
export function distanceFeet(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * FEET_PER_TILE
}
