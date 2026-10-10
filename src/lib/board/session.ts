import { newId, normaliseStats } from './utils'
import { findFreeTiles, generateMap } from './maps'
import type {
  BoardMap,
  LogEntry,
  LogKind,
  MapTheme,
  Point,
  RollRequest,
  SceneSummary,
  Stats,
  Token,
  TokenKind,
} from './types'

/** A sheet from the Character Codex, as stored in the `characters` table. */
export type CodexCharacter = {
  id: string
  name: string
  class_archetype?: string | null
  current_hp?: number | null
  max_hp?: number | null
  armor_class?: number | null
  status_condition?: string | null
  stats?: Record<string, number | string> | null
}

export type CampaignOption = {
  id: string
  title: string
  category?: string | null
}

export type Dialogue = {
  id: string
  speaker: string
  pages: string[]
}

/**
 * Everything about one solo table. It lives in the browser (localStorage) for now,
 * so this prototype needs no new database tables.
 */
export type BoardSession = {
  version: 1
  theme: MapTheme
  seed: number
  campaignId: string | null
  turn: number
  tokens: Token[]
  /** Token id -> drafted action for the current turn. */
  drafts: Record<string, string>
  ready: Record<string, boolean>
  /** Token id -> feet already walked this turn. */
  movedFeet: Record<string, number>
  log: LogEntry[]
  scene: SceneSummary | null
  rollRequests: RollRequest[]
  /** Dice results the DM has not heard about yet. */
  pendingRolls: string[]
  dialogue: Dialogue
}

const STORAGE_PREFIX = 'dnd-board:v1:'
const MAX_LOG_ENTRIES = 400
/** How many Codex sheets are seated automatically. More can be added from the roster. */
const INITIAL_PARTY_SIZE = 6

export const HERO_COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#6366f1']
export const ENEMY_COLOR = '#5f6b52'
export const NPC_COLOR = '#7c8796'

const SAMPLE_HEROES: { name: string; classType: string; hp: number; ac: number; stats: Stats }[] = [
  { name: 'Kael', classType: 'Fighter', hp: 28, ac: 17, stats: { STR: 16, DEX: 12, CON: 15, INT: 9, WIS: 11, CHA: 10 } },
  { name: 'Lyra', classType: 'Wizard', hp: 16, ac: 12, stats: { STR: 8, DEX: 14, CON: 12, INT: 17, WIS: 13, CHA: 10 } },
  { name: 'Finn', classType: 'Rogue', hp: 20, ac: 15, stats: { STR: 10, DEX: 17, CON: 12, INT: 13, WIS: 11, CHA: 14 } },
  { name: 'Mira', classType: 'Cleric', hp: 22, ac: 16, stats: { STR: 13, DEX: 10, CON: 14, INT: 10, WIS: 16, CHA: 12 } },
]

export function heroColor(index: number): string {
  return HERO_COLORS[index % HERO_COLORS.length]
}

export function logEntry(turn: number, kind: LogKind, speaker: string, text: string): LogEntry {
  return { id: newId('log'), turn, kind, speaker, text, at: Date.now() }
}

export function appendLog(log: LogEntry[], entries: LogEntry[]): LogEntry[] {
  return [...log, ...entries].slice(-MAX_LOG_ENTRIES)
}

export function heroFromCharacter(character: CodexCharacter, colorIndex: number, at: Point): Token {
  const maxHp = Math.max(1, Number(character.max_hp) || 10)
  return {
    id: newId('hero'),
    kind: 'hero',
    name: character.name?.trim() || 'Unnamed Hero',
    classType: character.class_archetype?.trim() || 'Wanderer',
    color: heroColor(colorIndex),
    x: at.x,
    y: at.y,
    hp: Math.max(0, Math.min(maxHp, Number(character.current_hp ?? maxHp) || 0)),
    maxHp,
    ac: Number(character.armor_class) || 10,
    speed: 30,
    stats: normaliseStats(character.stats),
    condition: character.status_condition?.trim() || 'Normal',
    characterId: character.id,
  }
}

export function makeToken(
  kind: TokenKind,
  fields: { name: string; classType?: string; hp: number; ac: number; color?: string; stats?: Stats },
  at: Point
): Token {
  const hp = Math.max(1, Math.round(fields.hp) || 1)
  return {
    id: newId(kind),
    kind,
    name: fields.name.trim() || (kind === 'enemy' ? 'Enemy' : kind === 'npc' ? 'Stranger' : 'Hero'),
    classType: fields.classType?.trim() || (kind === 'enemy' ? 'Hostile' : kind === 'npc' ? 'NPC' : 'Adventurer'),
    color: fields.color ?? (kind === 'enemy' ? ENEMY_COLOR : kind === 'npc' ? NPC_COLOR : HERO_COLORS[0]),
    x: at.x,
    y: at.y,
    hp,
    maxHp: hp,
    ac: Math.max(1, Math.round(fields.ac) || 10),
    speed: 30,
    stats: fields.stats ?? normaliseStats(null),
    condition: 'Normal',
  }
}

/** Make a name unique on the board: "Zombie", "Zombie 2", "Zombie 3"... */
export function uniqueName(tokens: Token[], name: string): string {
  const taken = new Set(tokens.map((token) => token.name.toLowerCase()))
  if (!taken.has(name.toLowerCase())) return name
  let suffix = 2
  while (taken.has(`${name} ${suffix}`.toLowerCase())) suffix++
  return `${name} ${suffix}`
}

function introDialogue(map: BoardMap): Dialogue {
  return {
    id: newId('dlg'),
    speaker: 'Table Guide',
    pages: [
      `ปาร์ตี้ของคุณมาถึง ${map.name} แล้ว`,
      'คลิกตัวละครเพื่อเลือก คลิกช่องสีฟ้าเพื่อเดิน หมุนลูกกลิ้งเพื่อซูม ลากซ้ายเพื่อเลื่อนแมพ ลากขวาเพื่อหมุนมุมมอง',
      'พิมพ์แอ็กชันของแต่ละคนด้านล่างแล้วกด READY เมื่อครบทุกคน AI Dungeon Master จะเล่าเรื่องต่อ',
    ],
  }
}

export function createSession(theme: MapTheme, characters: CodexCharacter[], campaignId: string | null = null): BoardSession {
  const seed = Math.floor(Math.random() * 100000)
  const map = generateMap(theme, seed)
  const roster = characters.slice(0, INITIAL_PARTY_SIZE)
  const heroCount = roster.length > 0 ? roster.length : SAMPLE_HEROES.length
  const spots = findFreeTiles(map, [], map.anchors.party, heroCount)

  const tokens: Token[] =
    roster.length > 0
      ? roster.map((character, index) => heroFromCharacter(character, index, spots[index] ?? map.anchors.party))
      : SAMPLE_HEROES.map((hero, index) =>
          makeToken('hero', { ...hero, color: heroColor(index) }, spots[index] ?? map.anchors.party)
        )

  return {
    version: 1,
    theme,
    seed,
    campaignId,
    turn: 1,
    tokens,
    drafts: {},
    ready: {},
    movedFeet: {},
    log: [logEntry(1, 'system', 'Table', `เปิดโต๊ะใหม่ที่ ${map.name} · ปาร์ตี้ ${tokens.length} คน`)],
    scene: null,
    rollRequests: [],
    pendingRolls: [],
    dialogue: introDialogue(map),
  }
}

function isSession(value: unknown): value is BoardSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<BoardSession>
  return (
    session.version === 1 &&
    typeof session.theme === 'string' &&
    typeof session.seed === 'number' &&
    typeof session.turn === 'number' &&
    Array.isArray(session.tokens) &&
    Array.isArray(session.log) &&
    Array.isArray(session.dialogue?.pages)
  )
}

export function loadSession(userId: string): BoardSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) return null
    return {
      ...parsed,
      drafts: parsed.drafts ?? {},
      ready: parsed.ready ?? {},
      movedFeet: parsed.movedFeet ?? {},
      rollRequests: parsed.rollRequests ?? [],
      pendingRolls: parsed.pendingRolls ?? [],
      scene: parsed.scene ?? null,
    }
  } catch {
    return null
  }
}

export function saveSession(userId: string, session: BoardSession) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(session))
  } catch {
    // Storage full or blocked: the table still works, it just will not survive a reload.
  }
}

/** Restore the saved table, or seat a new one. */
export function initialSession(userId: string, characters: CodexCharacter[]): BoardSession {
  return loadSession(userId) ?? createSession('forest', characters)
}
