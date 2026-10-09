'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CharacterFormData {
  id?: string
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