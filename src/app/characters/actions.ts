'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Equipment slots: [head, torso, leg, foot, left hand, right hand] */
export type EquipmentSlots = [string, string, string, string, string, string]

export const EQUIPMENT_LABELS = ['Head', 'Torso', 'Leg', 'Foot', 'Left Hand', 'Right Hand'] as const

export const EMPTY_EQUIPMENT: EquipmentSlots = ['', '', '', '', '', '']

export interface CharacterFormData {
  id?: string
  user_id?: string
  name: string
  class_archetype: string
  current_hp: number
  max_hp: number
  armor_class: number
  stats: {
    STR: number
    DEX: number
    CON: number
    INT: number
    WIS: number
    CHA: number
  }
  appearance: string
  backstory: string
  strengths: string
  weaknesses: string
  inventory: string
  status_condition: string
  equipment: EquipmentSlots
}

export async function saveCharacter(data: CharacterFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const payload = {
    user_id: user.id,
    name: data.name,
    class_archetype: data.class_archetype,
    current_hp: data.current_hp,
    max_hp: data.max_hp,
    armor_class: data.armor_class,
    stats: data.stats,
    appearance: data.appearance,
    backstory: data.backstory,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    inventory: data.inventory,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

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