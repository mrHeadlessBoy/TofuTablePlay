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
  STR: 10,
  DEX: 10,
  CON: 10,
  INT: 10,
  WIS: 10,
  CHA: 10,
}

export interface CharacterSkill {
  name: string
  description: string
}

export function sanitizeCharacterSkills(skills: unknown): CharacterSkill[] {
  if (!Array.isArray(skills)) return []
  return skills
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      description: typeof item.description === 'string' ? item.description.trim() : '',
    }))
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

