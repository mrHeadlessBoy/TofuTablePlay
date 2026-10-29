import type { LoreEntry } from './lorebook'
import type { AbilityScoreKey, CharacterSkill } from '@/features/character/domain'
import type { CharacterTemplate, SheetCustomValues } from '@/features/character/template'

// Shared shapes for the multiplayer AI Dungeon Master (dm.ts and its helpers)

export interface PartyMemberAction {
  characterId?: string
  characterName: string
  classType: string
  currentHp?: number
  maxHp?: number
  currentSkillCost?: number
  maxSkillCost?: number
  condition?: string
  stats?: Record<AbilityScoreKey, number>
  appearance?: string
  inventory?: string
  equipment?: string[]
  strengths?: string
  weaknesses?: string
  backstory?: string
  skills?: CharacterSkill[]
  sheetTemplate?: CharacterTemplate
  sheetCustom?: SheetCustomValues
  action: string | null
}

export interface PartyMemberStateUpdate {
  characterId: string
  characterName: string
  currentHp: number
  maxHp: number
  currentSkillCost: number
  maxSkillCost: number
  condition: string
  customResources: Record<string, { current: number; max: number }>
}

// One resource bar on a member's sheet, with the names the AI may use for it
export interface MemberResourceDescriptor {
  id: string
  label: string
  shortTag: string
  current: number
  max: number
  aliases: string[]
}

export interface DmTurnInput {
  campaign: {
    title: string
    category: string
    world_setting: string
    core_description: string
    rule_mechanics: string
  }
  loreEntries: LoreEntry[]
  recentTurns: {
    turn_number: number
    narrative_output: string
    party_actions_summary?: string
  }[]
  partyActions: PartyMemberAction[]
  language?: 'th' | 'en'
}

// Shared enemy damage table for a table, scaled from the party's average primary max
export interface PartyDamageBenchmark {
  avgPartyMaxHp: number
  grazeMin: number
  grazeMax: number
  normalMin: number
  normalMax: number
  heavyMin: number
  heavyMax: number
}
