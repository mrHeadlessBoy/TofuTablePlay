import type { AbilityScoreKey, CharacterSkill } from '@/app/characters/equipment'

export type Character = {
  id: string
  name: string
  class_archetype?: string
  current_hp?: number
  max_hp?: number
  armor_class?: number
  current_skill_cost?: number
  max_skill_cost?: number
  status_condition?: string
  stats?: Partial<Record<AbilityScoreKey, number | string>> & {
    current_skill_cost?: number
    max_skill_cost?: number
    skills?: CharacterSkill[]
    [key: string]: unknown
  }
  inventory?: string
  equipment?: string[]
  strengths?: string
  weaknesses?: string
  backstory?: string
  appearance?: string
  skills?: CharacterSkill[]
}

export type Member = {
  id: string
  user_id: string
  is_ready: boolean
  action_text?: string | null
  characters?: Character | null
}

export type Turn = {
  id: string
  turn_number: number
  narrative_output: string
  edited_by_host?: boolean
}

export type LorebookEntry = {
  id: string
  title: string
  category?: string
  content?: string
}

export type TableData = {
  id: string
  table_code: string
  turn_phase?: string
  countdown_end?: string | null
  current_turn?: number
  head_table_id?: string
}

export type TablePlaygroundProps = {
  initialTable: TableData
  initialMembers: Member[]
  initialTurns: Turn[]
  lorebook: LorebookEntry[]
  userCharacters: Character[]
  currentMember?: Member | null
  userId: string
  isHeadTable: boolean
}

export type CharacterCombatFormState = {
  current_hp: number
  max_hp: number
  armor_class: number
  current_skill_cost: number
  max_skill_cost: number
  status_condition: string
  inventory: string
  equipment: string[]
  stats: Record<string, number | string>
  skills: CharacterSkill[]
}

// How long another player's Ready click is trusted when their request never reports back
export const READY_CLAIM_TTL_MS = 6000

// A Ready click that the roster on screen already shows, before the server's copy has caught up.
// settledAt is set once the request behind it has finished (null while it is still running).
export type ReadyClaim = {
  ready: boolean
  actionText?: string | null
  settledAt: number | null
  expiresAt: number
}

export type ReadyClaims = Map<string, ReadyClaim>

// Lays those clicks over a roster that just came from the server. A reload that was asked for
// before a click was saved still carries the old value, and used to flip the badge back.
// Once a reload that started after the request finished arrives, the server's copy is the truth
// again and the claim is dropped.
export function withReadyClaims(list: Member[], claims: ReadyClaims, reloadStartedAt: number): Member[] {
  if (claims.size === 0) return list
  const now = Date.now()
  for (const [memberUserId, claim] of claims) {
    const confirmed = claim.settledAt !== null && reloadStartedAt >= claim.settledAt
    if (confirmed || now > claim.expiresAt) claims.delete(memberUserId)
  }
  return list.map((m) => {
    const claim = claims.get(m.user_id)
    if (!claim) return m
    return {
      ...m,
      is_ready: claim.ready,
      action_text: claim.ready ? (claim.actionText ?? m.action_text ?? null) : null,
    }
  })
}


export type ChatMode = 'ic' | 'ooc'

export type PartyChatMessage = {
  id: string
  userId: string
  senderName: string
  characterClass?: string | null
  isHost?: boolean
  mode: ChatMode
  text: string
  timestamp: number
}

export const MAX_PARTY_CHAT_MESSAGES = 80


export const PLAYER_NAME_COLORS = [
  'text-amber-300',
  'text-sky-300',
  'text-emerald-300',
  'text-rose-300',
  'text-violet-300',
  'text-cyan-300',
  'text-fuchsia-300',
  'text-lime-300',
  'text-orange-300',
  'text-teal-300',
  'text-pink-300',
  'text-indigo-300',
] as const

export function hashPlayerName(name: string): number {
  const clean = name.trim().toLowerCase()
  let hash = 2166136261
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

export function buildPlayerColorMap(names: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const usedIndices = new Set<number>()

  for (const rawName of names) {
    const clean = rawName.trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (map.has(key)) continue

    let idx = hashPlayerName(key) % PLAYER_NAME_COLORS.length
    let attempts = 0
    while (usedIndices.has(idx) && attempts < PLAYER_NAME_COLORS.length) {
      idx = (idx + 1) % PLAYER_NAME_COLORS.length
      attempts++
    }
    usedIndices.add(idx)
    map.set(key, PLAYER_NAME_COLORS[idx])
  }

  return map
}

export function getPlayerNameColor(
  name: string,
  colorMap?: ReadonlyMap<string, string>
): string {
  const clean = name.replace(/^\*+|\*+$/g, '').replace(/^\[|\]$/g, '').trim()
  if (!clean) return PLAYER_NAME_COLORS[0]
  const key = clean.toLowerCase()
  const mapped = colorMap?.get(key)
  if (mapped) return mapped
  return PLAYER_NAME_COLORS[hashPlayerName(key) % PLAYER_NAME_COLORS.length]
}
