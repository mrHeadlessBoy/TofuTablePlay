'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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

// Allows any participant to leave a table they joined
export async function leaveTable(tableId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('table_members')
    .delete()
    .eq('table_id', tableId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/hub')
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Deletes a table and all of its child rows.
async function purgeTables(supabase: SupabaseServerClient, tableIds: string[]) {
  if (tableIds.length === 0) return

  // Use service role admin client if available to ensure foreign key rows and child records are deleted cleanly
  const admin = (createAdminClient() || supabase) as SupabaseServerClient

  const { data: turns, error: turnsErr } = await admin
    .from('turns')
    .select('id')
    .in('table_id', tableIds)
  if (turnsErr) throw new Error(turnsErr.message)

  const turnIds = (turns ?? []).map((t: { id: string }) => t.id)
  if (turnIds.length > 0) {
    const { error } = await admin.from('turn_actions').delete().in('turn_id', turnIds)
    if (error) throw new Error(error.message)
  }

  const { error: delTurnsErr } = await admin.from('turns').delete().in('table_id', tableIds)
  if (delTurnsErr) throw new Error(delTurnsErr.message)

  const { error: delMembersErr } = await admin
    .from('table_members')
    .delete()
    .in('table_id', tableIds)
  if (delMembersErr) throw new Error(delMembersErr.message)

  const { data: deleted, error: delTablesErr } = await admin
    .from('tables')
    .delete()
    .in('id', tableIds)
    .select('id')
  if (delTablesErr) throw new Error(delTablesErr.message)

  if ((deleted ?? []).length !== tableIds.length) {
    throw new Error('Table could not be deleted. Check the DELETE policy on "tables" in Supabase.')
  }
}

export async function deleteTable(tableId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: table } = await supabase
    .from('tables')
    .select('id, head_table_id')
    .eq('id', tableId)
    .single()

  if (!table) throw new Error('Table not found')
  if (table.head_table_id !== user.id) {
    throw new Error('Only the Head Table can delete this table')
  }

  await purgeTables(supabase, [table.id])
  revalidatePath('/hub')
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, creator_id')
    .eq('id', campaignId)
    .single()

  if (!campaign) throw new Error('Campaign not found')
  if (campaign.creator_id !== user.id) {
    throw new Error('Only the campaign creator can delete this campaign')
  }

  const admin = createAdminClient() || supabase

  // Remove every table running this campaign first.
  const { data: tables, error: tablesErr } = await admin
    .from('tables')
    .select('id')
    .eq('campaign_id', campaign.id)
  if (tablesErr) throw new Error(tablesErr.message)
  await purgeTables(admin, (tables ?? []).map((t: { id: string }) => t.id))

  const { error: loreErr } = await admin
    .from('lorebook_entries')
    .delete()
    .eq('campaign_id', campaign.id)
  if (loreErr) throw new Error(loreErr.message)

  const { data: deleted, error: campErr } = await admin
    .from('campaigns')
    .delete()
    .eq('id', campaign.id)
    .select('id')
  if (campErr) throw new Error(campErr.message)
  if (!deleted || deleted.length === 0) {
    throw new Error('Campaign could not be deleted. Check the DELETE policy on "campaigns" in Supabase.')
  }

  revalidatePath('/hub')
}