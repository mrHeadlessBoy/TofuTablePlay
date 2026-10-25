'use server'

import { createAdminClient } from '@/lib/supabase/server'
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
    STR: number
    DEX: number
    CON: number
    INT: number
    WIS: number
    CHA: number
    current_skill_cost?: number
    max_skill_cost?: number
    skills?: CharacterSkill[]
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

  const sanitizedSkills =
    data.skills !== undefined
      ? sanitizeCharacterSkills(data.skills)
      : extractCharacterSkills(data)

  const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(data)
  const sanitizedScores = sanitizeAbilityScores(data.stats, 0)

  const normalizedStats = {
    ...sanitizedScores,
    current_skill_cost: currentSkillCost,
    max_skill_cost: maxSkillCost,
    skills: sanitizedSkills,
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
