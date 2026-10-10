'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateDmNarrative } from '@/lib/ai/dm'

export async function linkCharacterToTable(tableId: string, characterId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('table_members')
    .update({ character_id: characterId })
    .eq('table_id', tableId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}

export async function submitActionDraft(tableId: string, currentTurnNumber: number, actionText: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Find member id
  const { data: member } = await supabase
    .from('table_members')
    .select('id')
    .eq('table_id', tableId)
    .eq('user_id', user.id)
    .single()

  if (!member) throw new Error('Member not found')

  // Find current turn entry
  const { data: turn } = await supabase
    .from('turns')
    .select('id')
    .eq('table_id', tableId)
    .eq('turn_number', currentTurnNumber)
    .single()

  if (!turn) throw new Error('Current turn not found')

  // Record action draft
  const { error } = await supabase
    .from('turn_actions')
    .upsert(
      {
        turn_id: turn.id,
        member_id: member.id,
        action_text: actionText,
      },
      { onConflict: 'turn_id,member_id' }
    )

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}

export async function toggleReadyStatus(tableId: string, isReady: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('table_members')
    .update({ is_ready: isReady })
    .eq('table_id', tableId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  // Verify whether all members are ready
  const { data: members, error: membersErr } = await supabase
    .from('table_members')
    .select('is_ready')
    .eq('table_id', tableId)

  if (membersErr) throw new Error(membersErr.message)

  const allReady = members && members.length > 0 && members.every((m) => m.is_ready)

  if (allReady) {
    // 5-second synchronized countdown trigger
    const countdownEnd = new Date(Date.now() + 5000).toISOString()
    const { error: updateErr } = await supabase
      .from('tables')
      .update({
        turn_phase: 'countdown',
        countdown_end: countdownEnd,
      })
      .eq('id', tableId)
    if (updateErr) throw new Error(updateErr.message)
  } else {
    // Reset phase if any player unreadies
    const { error: updateErr } = await supabase
      .from('tables')
      .update({
        turn_phase: 'drafting',
        countdown_end: null,
      })
      .eq('id', tableId)
    if (updateErr) throw new Error(updateErr.message)
  }

  revalidatePath(`/table/${tableId}`)
}

export async function resolveTurn(tableId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Fetch table and campaign settings
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('*, campaigns(*)')
    .eq('id', tableId)
    .single()

  if (tableErr || !table) throw new Error('Table not found')

  // Atomic Concurrency Lock: Claim resolution lock so multiple simultaneous callers cannot execute resolveTurn twice
  const { data: lockedTable, error: lockErr } = await supabase
    .from('tables')
    .update({ turn_phase: 'resolving' })
    .eq('id', tableId)
    .eq('current_turn', table.current_turn)
    .in('turn_phase', ['countdown', 'drafting'])
    .select()
    .single()

  // If another client won the race or already locked/resolved, safely abort
  if (lockErr || !lockedTable) {
    return { resolved: false, message: 'Turn is already being resolved' }
  }

  try {
    // 2. Fetch actions drafted for current turn
    const { data: currentTurnRecord, error: turnRecErr } = await supabase
      .from('turns')
      .select('id, turn_number')
      .eq('table_id', tableId)
      .eq('turn_number', table.current_turn)
      .single()

    if (turnRecErr) throw new Error(`Failed to locate turn record: ${turnRecErr.message}`)

    const { data: actions, error: actErr } = await supabase
      .from('turn_actions')
      .select('*, table_members(characters(*))')
      .eq('turn_id', currentTurnRecord?.id)

    if (actErr) throw new Error(`Failed to fetch player actions: ${actErr.message}`)

    const partyActions = (actions || []).map((act) => ({
      characterName: act.table_members?.characters?.name || 'Unknown Adventurer',
      classType: act.table_members?.characters?.class_archetype || 'Wanderer',
      action: act.action_text,
    }))

    // 3. Fetch lorebook entries for dynamic scanning
    const { data: loreEntries, error: loreErr } = await supabase
      .from('lorebook_entries')
      .select('*')
      .eq('campaign_id', table.campaign_id)

    if (loreErr) throw new Error(`Failed to fetch lorebook entries: ${loreErr.message}`)

    // 4. Fetch recent turn history
    const { data: recentTurns, error: turnsErr } = await supabase
      .from('turns')
      .select('turn_number, narrative_output')
      .eq('table_id', tableId)
      .order('turn_number', { ascending: true })

    if (turnsErr) throw new Error(`Failed to fetch turns history: ${turnsErr.message}`)

    // 5. Generate AI Dungeon Master scene narrative
    const aiNarrative = await generateDmNarrative({
      campaign: table.campaigns,
      loreEntries: loreEntries || [],
      recentTurns: recentTurns || [],
      partyActions,
    })

    const nextTurnNumber = table.current_turn + 1

    // 6. Persist new narrative turn
    const { error: insertTurnErr } = await supabase.from('turns').insert({
      table_id: tableId,
      turn_number: nextTurnNumber,
      narrative_output: aiNarrative,
      edited_by_host: false,
    })

    if (insertTurnErr) throw new Error(`Failed to persist new turn: ${insertTurnErr.message}`)

    // 7. Reset ready statuses and bump turn counter
    const { error: resetMembersErr } = await supabase
      .from('table_members')
      .update({ is_ready: false })
      .eq('table_id', tableId)

    if (resetMembersErr) throw new Error(`Failed to reset members ready state: ${resetMembersErr.message}`)

    const { error: updateTableErr } = await supabase
      .from('tables')
      .update({
        current_turn: nextTurnNumber,
        turn_phase: 'drafting',
        countdown_end: null,
      })
      .eq('id', tableId)

    if (updateTableErr) throw new Error(`Failed to update table turn state: ${updateTableErr.message}`)

    revalidatePath(`/table/${tableId}`)
    return { resolved: true, turnNumber: nextTurnNumber }
  } catch (err) {
    // If generation fails, restore table phase so players can retry
    await supabase
      .from('tables')
      .update({ turn_phase: 'drafting', countdown_end: null })
      .eq('id', tableId)
    throw err
  }
}

export async function hostOverrideNarrative(turnId: string, updatedNarrative: string, tableId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Validate Head Table permissions
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('head_table_id')
    .eq('id', tableId)
    .single()

  if (tableErr || !table) throw new Error('Table not found')

  if (table.head_table_id !== user.id) {
    throw new Error('Only the Head Table can edit AI narrative blocks')
  }

  const { error: updateErr } = await supabase
    .from('turns')
    .update({
      narrative_output: updatedNarrative,
      edited_by_host: true,
    })
    .eq('id', turnId)

  if (updateErr) throw new Error(updateErr.message)
  revalidatePath(`/table/${tableId}`)
}

export async function voteKickMember(tableId: string, targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify that only the Head Table has authority to kick players
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('head_table_id')
    .eq('id', tableId)
    .single()

  if (tableErr || !table) throw new Error('Table not found')
  if (table.head_table_id !== user.id) {
    throw new Error('Only the Head Table has permission to kick players from the room')
  }
  if (targetUserId === user.id) {
    throw new Error('Head Table cannot kick themselves')
  }

  // Remove the member
  const { error } = await supabase
    .from('table_members')
    .delete()
    .eq('table_id', tableId)
    .eq('user_id', targetUserId)

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}

export async function updateCharacterCombatState(
  tableId: string,
  characterId: string,
  updates: {
    current_hp?: number
    max_hp?: number
    armor_class?: number
    status_condition?: string
    inventory?: string
    stats?: Record<string, number | string>
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', characterId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}