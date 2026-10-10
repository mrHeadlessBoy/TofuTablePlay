'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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

  // Record action draft.
  // member.id above always belongs to the signed-in user, so writing through the service-role
  // client is safe and makes the save behave the same for every seat (not only the Head Table).
  const db = createAdminClient() ?? supabase
  const { error } = await db
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

  // Only someone seated at this table may resolve its turn (the party reads below bypass RLS)
  const { data: callerSeat } = await supabase
    .from('table_members')
    .select('id')
    .eq('table_id', tableId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!callerSeat && table.head_table_id !== user.id) {
    throw new Error('Only members of this table can resolve its turn')
  }

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
    // Drafts are private: with the caller's own session, RLS only returns the caller's
    // turn_actions row, so the Head Table would resolve the turn with just their own draft.
    // Read the whole party through the service-role client instead.
    const admin = createAdminClient()
    const db = admin ?? supabase
    if (!admin) {
      console.warn(
        '[resolveTurn] SUPABASE_SERVICE_ROLE_KEY is not set — other players\' drafts may be hidden by RLS.'
      )
    }

    // 2. Fetch every seat at the table and the drafts submitted for the current turn
    const { data: currentTurnRecord, error: turnRecErr } = await supabase
      .from('turns')
      .select('id, turn_number')
      .eq('table_id', tableId)
      .eq('turn_number', table.current_turn)
      .single()

    if (turnRecErr || !currentTurnRecord) {
      throw new Error(`Failed to locate turn record: ${turnRecErr?.message ?? 'not found'}`)
    }

    const { data: seats, error: seatsErr } = await db
      .from('table_members')
      .select('id, joined_at, characters(*)')
      .eq('table_id', tableId)
      .order('joined_at', { ascending: true })

    if (seatsErr) throw new Error(`Failed to fetch party members: ${seatsErr.message}`)

    const { data: actions, error: actErr } = await db
      .from('turn_actions')
      .select('member_id, action_text')
      .eq('turn_id', currentTurnRecord.id)

    if (actErr) throw new Error(`Failed to fetch player actions: ${actErr.message}`)

    const draftByMember = new Map<string, string>()
    for (const act of actions || []) {
      const text = (act.action_text || '').trim()
      if (text) draftByMember.set(act.member_id, text)
    }

    // One entry per seated player, in join order — the party size is whatever the table holds.
    // A seat with neither a character nor a draft is a spectator and is left out.
    const partyActions = (seats || []).flatMap((seat, index) => {
      const character = Array.isArray(seat.characters) ? seat.characters[0] : seat.characters
      const action = draftByMember.get(seat.id) ?? null
      if (!character && !action) return []
      return [
        {
          characterName: character?.name || `Unknown Adventurer ${index + 1}`,
          classType: character?.class_archetype || 'Wanderer',
          action,
        },
      ]
    })

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

    // 7. Reset ready statuses for every seat (not just the caller's) and bump turn counter
    const { error: resetMembersErr } = await db
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