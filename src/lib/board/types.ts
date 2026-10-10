// Shared types for the Battle Board prototype (/board).
// Used by the client components and by the AI Dungeon Master server code.

export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export const ABILITY_KEYS: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

export type Stats = Record<AbilityKey, number>

export type MapTheme = 'forest' | 'ruins' | 'dungeon'

export type TerrainKind = 'grass' | 'path' | 'water' | 'bridge' | 'stone' | 'asphalt' | 'rubble' | 'void'

export type PropKind = 'tree' | 'rock' | 'bush' | 'pillar' | 'wall' | 'crate' | 'wreck' | 'campfire'

export type Tile = {
  terrain: TerrainKind
  /** Elevation step, 0-3. One step is drawn 0.22 world units high. */
  elevation: number
  prop: PropKind | null
  /** Tokens cannot enter or pass through a blocked tile. */
  blocked: boolean
  /** Per-tile random value (0-1) so colours and props vary a little. */
  noise: number
}

export type Point = { x: number; y: number }

export type BoardMap = {
  theme: MapTheme
  seed: number
  name: string
  cols: number
  rows: number
  tiles: Tile[]
  /** Where the party starts and where new threats tend to appear. */
  anchors: { party: Point; threat: Point }
}

export type TokenKind = 'hero' | 'enemy' | 'npc'

export type Token = {
  id: string
  kind: TokenKind
  name: string
  classType: string
  color: string
  x: number
  y: number
  hp: number
  maxHp: number
  ac: number
  /** Walking speed in feet per turn. One tile is 5 ft. */
  speed: number
  stats: Stats
  condition: string
  /** Set when the token was created from a sheet in the Character Codex. */
  characterId?: string
}

export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100
export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export type DiceRoll = {
  id: string
  /** Who rolled. Empty when it is a free roll from the dice tray. */
  roller: string
  label: string
  sides: DieSides
  count: number
  modifier: number
  mode: RollMode
  /** Dice that count toward the total. */
  kept: number[]
  /** The d20 that advantage / disadvantage threw away. */
  dropped: number | null
  total: number
  dc: number | null
  /** null when the roll had no DC. */
  success: boolean | null
  critical: 'hit' | 'fail' | null
  at: number
}

export type RollRequest = {
  id: string
  character: string
  ability: AbilityKey
  dc: number
  reason: string
}

export type SceneSummary = {
  location: string
  threat: string
  goal: string
}

export type LogKind = 'narration' | 'action' | 'roll' | 'system'

export type LogEntry = {
  id: string
  turn: number
  kind: LogKind
  speaker: string
  text: string
  at: number
}

// ---------- AI Dungeon Master contract ----------

export type DmTokenInput = {
  name: string
  kind: TokenKind
  classType: string
  x: number
  y: number
  hp: number
  maxHp: number
  ac: number
  condition: string
}

export type DmTurnInput = {
  campaignId: string | null
  turn: number
  mapName: string
  mapTheme: MapTheme
  cols: number
  rows: number
  tokens: DmTokenInput[]
  /** One entry per hero on the board, however many there are. action is null when nothing was drafted. */
  actions: { character: string; classType: string; action: string | null }[]
  /** Dice results since the last narration, already formatted for the prompt. */
  rolls: string[]
  /** Earlier narrations, oldest first. */
  history: { turn: number; text: string }[]
  scene: SceneSummary | null
}

export type DmSpawn = {
  name: string
  kind: 'enemy' | 'npc'
  near: string | null
  hp: number
  ac: number
}

export type DmTurnResult = {
  /** Short paragraphs, shown one page at a time in the text box. */
  narration: string[]
  scene: SceneSummary | null
  rolls: { character: string; ability: AbilityKey; dc: number; reason: string }[]
  hpChanges: { target: string; delta: number }[]
  spawns: DmSpawn[]
  defeated: string[]
}

export type NarrateAction = (input: DmTurnInput) => Promise<DmTurnResult>
