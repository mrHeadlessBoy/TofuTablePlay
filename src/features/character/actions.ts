'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import {
  extractCharacterSkillCost,
  extractCharacterSkills,
  sanitizeAbilityScores,
  sanitizeCharacterSkills,
  serializeInventory,
  type CharacterInventoryItem,
  type CharacterSkill,
  type EquipmentSlots,
} from './domain'
import {
  extractCampaignTemplate,
  templateStatsPayload,
  type CharacterTemplate,
  type SheetCustomValues,
} from './template'

export interface CharacterFormData {
  id?: string
  user_id?: string
  name: string
  class_archetype: string
  current_hp: number
  max_hp: number
  armor_class: number
  current_skill_cost?: number
  max_skill_cost?: number
  stats: {
    STR?: number
    DEX?: number
    CON?: number
    INT?: number
    WIS?: number
    CHA?: number
    current_skill_cost?: number
    max_skill_cost?: number
    skills?: CharacterSkill[]
    sheet_template?: CharacterTemplate
    sheet_custom?: SheetCustomValues
    [key: string]: unknown
  }
  appearance: string
  backstory: string
  strengths: string
  weaknesses: string
  inventory: string | CharacterInventoryItem[]
  status_condition: string
  equipment: EquipmentSlots
  skills?: CharacterSkill[]
}

export async function saveCharacter(data: CharacterFormData) {
  const { supabase, user } = await requireAuthenticatedUser()

  if (!data.name || !data.name.trim()) {
    throw new Error('กรุณากรอกชื่อตัวละคร (Character name is required)')
  }
  if (data.name.trim().length > 60) {
    throw new Error('ชื่อตัวละครต้องมีความยาวไม่เกิน 60 ตัวอักษร (Character name cannot exceed 60 characters)')
  }

  const sanitizedSkills =
    data.skills !== undefined
      ? sanitizeCharacterSkills(data.skills)
      : extractCharacterSkills(data)

  const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(data)
  const sanitizedScores = sanitizeAbilityScores(data.stats, 0)
  const templatePayload = templateStatsPayload(
    data.stats?.sheet_template,
    data.stats?.sheet_custom
  )

  const normalizedStats = {
    ...data.stats,
    ...sanitizedScores,
    current_skill_cost: currentSkillCost,
    max_skill_cost: maxSkillCost,
    skills: sanitizedSkills,
    ...templatePayload,
  }

  const maxHp = Number(data.max_hp) || 1
  const currentHp = Math.min(maxHp, Number(data.current_hp) || 0)

  const payload = {
    user_id: user.id,
    name: data.name,
    class_archetype: data.class_archetype,
    current_hp: currentHp,
    max_hp: maxHp,
    armor_class: currentSkillCost,
    stats: normalizedStats,
    appearance: data.appearance,
    backstory: data.backstory,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    inventory: serializeInventory(data.inventory),
    status_condition: data.status_condition || 'Normal',
    equipment: data.equipment,
  }

  if (data.id) {
    const { error } = await supabase
      .from('characters')
      .update(payload)
      .eq('id', data.id)
      .eq('user_id', user.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('characters')
      .insert(payload)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/characters')
}

export async function deleteCharacter(characterId: string) {
  const { supabase, user } = await requireAuthenticatedUser()

  const { data: character } = await supabase
    .from('characters')
    .select('id, user_id')
    .eq('id', characterId)
    .single()

  if (!character) throw new Error('Character not found')
  if (character.user_id !== user.id) {
    throw new Error('Only the character owner can delete this character sheet')
  }

  const admin = createAdminClient() || supabase

  // Detach this character from any active table seats first
  await admin
    .from('table_members')
    .update({ character_id: null })
    .eq('character_id', character.id)

  const { error } = await admin
    .from('characters')
    .delete()
    .eq('id', character.id)

  if (error) throw new Error(error.message)

  revalidatePath('/characters')
  return { success: true }
}

export async function getCampaignRequiredTemplate(
  campaignIdOrTableCode: string
): Promise<CharacterTemplate | null> {
  const supabase = await createClient()

  // 1. Try campaign ID
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, category, rule_mechanics')
    .eq('id', campaignIdOrTableCode)
    .maybeSingle()

  if (campaign) {
    return extractCampaignTemplate(campaign)
  }

  // 2. Try table code (e.g. 6-character code)
  const { data: table } = await supabase
    .from('tables')
    .select('id, campaigns(*)')
    .eq('table_code', campaignIdOrTableCode.toUpperCase())
    .maybeSingle()

  if (table?.campaigns) {
    const camp = Array.isArray(table.campaigns) ? table.campaigns[0] : table.campaigns
    return extractCampaignTemplate(camp as Parameters<typeof extractCampaignTemplate>[0])
  }

  // 3. Try finding by template ID embedded in campaign rule_mechanics
  const { data: matchedCampaign } = await supabase
    .from('campaigns')
    .select('id, category, rule_mechanics')
    .ilike('rule_mechanics', `%"id":"${campaignIdOrTableCode}"%`)
    .limit(1)
    .maybeSingle()

  if (matchedCampaign) {
    return extractCampaignTemplate(matchedCampaign)
  }

  return null
}
