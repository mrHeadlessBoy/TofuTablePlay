'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function generateTableCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function launchTable(campaignId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const code = generateTableCode()

  // 1. Create table
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .insert({
      campaign_id: campaignId,
      head_table_id: user.id,
      table_code: code,
      turn_phase: 'drafting',
      current_turn: 1,
    })
    .select()
    .single()

  if (tableErr || !table) throw new Error(tableErr?.message || 'Table initialization failed')

  // 2. Add host as member
  await supabase.from('table_members').insert({
    table_id: table.id,
    user_id: user.id,
  })

  // 3. Create initial Turn 1 placeholder
  await supabase.from('turns').insert({
    table_id: table.id,
    turn_number: 1,
    narrative_output: 'The journey begins. Review your character sheet and submit your opening moves.',
  })

  redirect(`/table/${table.id}`)
}

export async function joinTableByCode(code: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const cleanCode = code.trim().toUpperCase()
  const { data: table, error } = await supabase
    .from('tables')
    .select('id')
    .eq('table_code', cleanCode)
    .single()

  if (error || !table) throw new Error('Table not found')

  // Insert member if not already joined
  await supabase.from('table_members').upsert({
    table_id: table.id,
    user_id: user.id,
  }, { onConflict: 'table_id,user_id' })

  redirect(`/table/${table.id}`)
}