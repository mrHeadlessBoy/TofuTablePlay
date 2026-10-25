// Equipment slot names, conditions, and stat helpers for character sheets.
// They live here, not in actions.ts, because a 'use server' file may only export async functions:
// anything else it exports reaches the browser as a server-action reference instead of its value.

/** Equipment slots: [head, torso, leg, foot, left hand, right hand] */
export type EquipmentSlots = [string, string, string, string, string, string]

export const EQUIPMENT_LABELS = ['Head', 'Torso', 'Leg', 'Foot', 'Left Hand', 'Right Hand'] as const

export const EMPTY_EQUIPMENT: EquipmentSlots = ['', '', '', '', '', '']

export const CHARACTER_CONDITIONS = [
  'Normal',
  'Bloodied',
  'Poisoned',
  'Stunned',
  'Blinded',
  'Unconscious',
  'Blessed',
  'Charmed',
  'Exhausted',
] as const

export const ABILITY_SCORE_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
export type AbilityScoreKey = (typeof ABILITY_SCORE_KEYS)[number]

export const DEFAULT_ABILITY_SCORES: Record<AbilityScoreKey, number> = {
  STR: 0,
  DEX: 0,
  CON: 0,
  INT: 0,
  WIS: 0,
  CHA: 0,
}

export interface CharacterSkill {
  name: string
  cost: number
  description: string
}

export interface CharacterInventoryItem {
  name: string
  quantity: number
  description?: string
}

export function sanitizeInventoryItems(items: unknown): CharacterInventoryItem[] {
  if (!Array.isArray(items)) return []
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const parsedQty = Number(item.quantity ?? item.count ?? item.qty)
      return {
        name: typeof item.name === 'string' ? item.name.trim() : '',
        quantity: Number.isFinite(parsedQty) && parsedQty >= 0 ? Math.round(parsedQty) : 1,
        description: typeof item.description === 'string' ? item.description.trim() : '',
      }
    })
    .filter((item) => item.name.length > 0 || (item.description && item.description.length > 0))
}

export function extractCharacterInventory(
  character:
    | {
        inventory?: unknown
        stats?: Record<string, unknown> | null
      }
    | null
    | undefined
): CharacterInventoryItem[] {
  if (!character) return []
  const raw = character.inventory
  if (Array.isArray(raw)) {
    return sanitizeInventoryItems(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return sanitizeInventoryItems(parsed)
        }
      } catch {
        // Fall back to plain text line parsing
      }
    }
    // Parse legacy plain text (e.g. "Health Potion x2", "Torch x5", "Rope")
    const lines = trimmed.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean)
    const items: CharacterInventoryItem[] = []
    for (const line of lines) {
      const matchQtyEnd = line.match(/^(.+?)\s*(?:[xX*]\s*(\d+)|\(\s*[xX*]?\s*(\d+)\s*\))$/)
      const matchQtyStart = line.match(/^(\d+)\s*[xX*]\s*(.+)$/)
      if (matchQtyEnd) {
        const name = matchQtyEnd[1].trim()
        const qty = Number(matchQtyEnd[2] || matchQtyEnd[3])
        items.push({ name, quantity: Number.isFinite(qty) ? Math.max(1, qty) : 1 })
      } else if (matchQtyStart) {
        const qty = Number(matchQtyStart[1])
        const name = matchQtyStart[2].trim()
        items.push({ name, quantity: Number.isFinite(qty) ? Math.max(1, qty) : 1 })
      } else {
        items.push({ name: line, quantity: 1 })
      }
    }
    return items
  }

  const nested =
    character.stats && typeof character.stats === 'object' ? character.stats.inventory : undefined
  if (Array.isArray(nested)) {
    return sanitizeInventoryItems(nested)
  }

  return []
}

export function formatInventoryForPrompt(inventory: unknown): string {
  const items = Array.isArray(inventory)
    ? sanitizeInventoryItems(inventory)
    : extractCharacterInventory({ inventory })

  if (items.length === 0) return ''

  return items
    .map((item) => {
      const qtyStr = `x${item.quantity}`
      const descStr = item.description ? ` - ${item.description}` : ''
      return `${item.name} (${qtyStr}${descStr})`
    })
    .join(', ')
}

export function serializeInventory(inventory: unknown): string {
  const items = Array.isArray(inventory)
    ? sanitizeInventoryItems(inventory)
    : extractCharacterInventory({ inventory })
  return JSON.stringify(items)
}

export function sanitizeCharacterSkills(skills: unknown): CharacterSkill[] {
  if (!Array.isArray(skills)) return []
  return skills
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const parsedCost = Number(item.cost)
      return {
        name: typeof item.name === 'string' ? item.name.trim() : '',
        cost: Number.isFinite(parsedCost) ? Math.max(0, parsedCost) : 0,
        description: typeof item.description === 'string' ? item.description.trim() : '',
      }
    })
    .filter((skill) => skill.name.length > 0 || skill.description.length > 0)
}

export function extractCharacterSkills(
  character:
    | {
        skills?: unknown
        stats?: Record<string, unknown> | null
      }
    | null
    | undefined
): CharacterSkill[] {
  if (!character) return []
  if (Array.isArray(character.skills)) {
    return sanitizeCharacterSkills(character.skills)
  }
  const nestedSkills = character.stats && typeof character.stats === 'object' ? character.stats.skills : undefined
  if (Array.isArray(nestedSkills)) {
    return sanitizeCharacterSkills(nestedSkills)
  }
  return []
}

export function sanitizeAbilityScores(
  stats: Record<string, unknown> | undefined | null,
  fallback = 0
): Record<AbilityScoreKey, number> {
  const result = { ...DEFAULT_ABILITY_SCORES }
  for (const key of ABILITY_SCORE_KEYS) {
    const raw = stats?.[key]
    const num = Number(raw)
    result[key] = Number.isFinite(num) ? num : fallback
  }
  return result
}

export function clampHpValues(currentHpInput: number | string | undefined, maxHpInput: number | string | undefined) {
  const maxHp = Math.max(1, Number(maxHpInput) || 1)
  const currentHp = Math.max(0, Math.min(maxHp, Number(currentHpInput) || 0))
  return { currentHp, maxHp }
}

export function clampSkillCostValues(
  currentCostInput: number | string | undefined,
  maxCostInput: number | string | undefined
) {
  const parsedMax = Number(maxCostInput)
  const maxSkillCost = Number.isFinite(parsedMax) ? Math.max(0, parsedMax) : 10
  const parsedCurrent = Number(currentCostInput)
  const currentSkillCost = Number.isFinite(parsedCurrent)
    ? Math.max(0, Math.min(maxSkillCost, parsedCurrent))
    : maxSkillCost
  return { currentSkillCost, maxSkillCost }
}

export function extractCharacterSkillCost(
  character:
    | {
        armor_class?: number | null
        current_skill_cost?: number | null
        max_skill_cost?: number | null
        stats?: Record<string, unknown> | null
      }
    | null
    | undefined
): { currentSkillCost: number; maxSkillCost: number } {
  if (!character) return { currentSkillCost: 10, maxSkillCost: 10 }
  const statsObj = character.stats && typeof character.stats === 'object' ? character.stats : undefined
  const rawMax =
    character.max_skill_cost ??
    (statsObj?.max_skill_cost as number | string | undefined) ??
    character.armor_class ??
    10
  const rawCurrent =
    character.current_skill_cost ??
    (statsObj?.current_skill_cost as number | string | undefined) ??
    character.armor_class ??
    rawMax
  return clampSkillCostValues(rawCurrent, rawMax)
}

/**
 * Standard 4-Tier HP Color Thresholds:
 * - >= 75%: Green (#4ade80 / text-emerald-400 / bg-emerald-400)
 * - 50% - 74.99%: Yellow (#facc15 / text-yellow-400 / bg-yellow-400)
 * - 30% - 49.99%: Orange (#f97316 / text-orange-400 / bg-orange-500)
 * - < 30%: Red (#ef4444 / text-red-400 / bg-red-500) — Bloodied / Critical
 */
export function getHpColorHex(ratio: number): string {
  if (ratio >= 0.75) return '#4ade80' // Green
  if (ratio >= 0.50) return '#facc15' // Yellow
  if (ratio >= 0.30) return '#f97316' // Orange
  return '#ef4444' // Red (< 30% Bloodied)
}

export function getHpTailwindClass(currentHp: number, maxHp: number): {
  text: string
  bg: string
  border: string
} {
  const safeMax = Math.max(1, maxHp)
  const ratio = Math.max(0, currentHp / safeMax)
  if (ratio >= 0.75) return { text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-500/60' }
  if (ratio >= 0.50) return { text: 'text-yellow-400', bg: 'bg-yellow-400', border: 'border-yellow-500/60' }
  if (ratio >= 0.30) return { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/60' }
  return { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/60' }
}
