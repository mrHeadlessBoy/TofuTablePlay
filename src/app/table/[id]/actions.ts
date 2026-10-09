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
  const { data: members } = await supabase
    .from('table_members')
    .select('is_ready')
    .eq('table_id', tableId)

  const allReady = members && members.length > 0 && members.every((m) => m.is_ready)

  if (allReady) {
    // 5-second synchronized countdown trigger
    const countdownEnd = new Date(Date.now() + 5000).toISOString()
    await supabase
      .from('tables')
      .update({
        turn_phase: 'countdown',
        countdown_end: countdownEnd,
      })
      .eq('id', tableId)
  } else {
    // Reset phase if any player unreadies
    await supabase
      .from('tables')
      .update({
        turn_phase: 'drafting',
        countdown_end: null,
      })
      .eq('id', tableId)
  }

  revalidatePath(`/table/${tableId}`)
}

export async function resolveTurn(tableId: string) {
  const supabase = await createClient()

  // 1. Fetch table and campaign settings
  const { data: table } = await supabase
    .from('tables')
    .select('*, campaigns(*)')
    .eq('id', tableId)
    .single()

  if (!table) throw new Error('Table not found')

  // 2. Fetch actions drafted for current turn
  const { data: currentTurnRecord } = await supabase
    .from('turns')
    .select('id, turn_number')
    .eq('table_id', tableId)
    .eq('turn_number', table.current_turn)
    .single()

  const { data: actions } = await supabase
    .from('turn_actions')
    .select('*, table_members(characters(*))')
    .eq('turn_id', currentTurnRecord?.id)

  const partyActions = (actions || []).map((act) => ({
    characterName: act.table_members?.characters?.name || 'Unknown Adventurer',
    classType: act.table_members?.characters?.class_archetype || 'Wanderer',
    action: act.action_text,
  }))

  // 3. Fetch lorebook entries for dynamic scanning
  const { data: loreEntries } = await supabase
    .from('lorebook_entries')
    .select('*')
    .eq('campaign_id', table.campaign_id)

  // 4. Fetch recent turn history
  const { data: recentTurns } = await supabase
    .from('turns')
    .select('turn_number, narrative_output')
    .eq('table_id', tableId)
    .order('turn_number', { ascending: true })

  // 5. Generate AI Dungeon Master scene narrative
  const aiNarrative = await generateDmNarrative({
    campaign: table.campaigns,
    loreEntries: loreEntries || [],
    recentTurns: recentTurns || [],
    partyActions,
  })

  const nextTurnNumber = table.current_turn + 1

  // 6. Persist new narrative turn
  await supabase.from('turns').insert({
    table_id: tableId,
    turn_number: nextTurnNumber,
    narrative_output: aiNarrative,
    edited_by_host: false,
  })

  // 7. Reset ready statuses and bump turn counter
  await supabase
    .from('table_members')
    .update({ is_ready: false })
    .eq('table_id', tableId)

  await supabase
    .from('tables')
    .update({
      current_turn: nextTurnNumber,
      turn_phase: 'drafting',
      countdown_end: null,
    })
    .eq('id', tableId)

  revalidatePath(`/table/${tableId}`)
}

export async function hostOverrideNarrative(turnId: string, updatedNarrative: string, tableId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Validate Head Table permissions
  const { data: table } = await supabase
    .from('tables')
    .select('head_table_id')
    .eq('id', tableId)
    .single()

  if (table?.head_table_id !== user?.id) {
    throw new Error('Only the Head Table can edit AI narrative blocks')
  }

  await supabase
    .from('turns')
    .update({
      narrative_output: updatedNarrative,
      edited_by_host: true,
    })
    .eq('id', turnId)

  revalidatePath(`/table/${tableId}`)
}

export async function voteKickMember(tableId: string, targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Remove the member
  const { error } = await supabase
    .from('table_members')
    .delete()
    .eq('table_id', tableId)
    .eq('user_id', targetUserId)

  if (error) throw new Error(error.message)

  // If the removed member was Head Table, transfer ownership to the next member
  const { data: table } = await supabase
    .from('tables')
    .select('head_table_id')
    .eq('id', tableId)
    .single()

  if (table?.head_table_id === targetUserId) {
    const { data: remainingMembers } = await supabase
      .from('table_members')
      .select('user_id')
      .eq('table_id', tableId)
      .limit(1)

    if (remainingMembers && remainingMembers.length > 0) {
      await supabase
        .from('tables')
        .update({ head_table_id: remainingMembers[0].user_id })
        .eq('id', tableId)
    }
  }

  revalidatePath(`/table/${tableId}`)
}