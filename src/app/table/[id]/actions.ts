'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateDmNarrative } from '@/lib/ai/dm'
import { COUNTDOWN_MS, type TablePhase } from './countdown'

type SessionClient = Awaited<ReturnType<typeof createClient>>
type DbClient = SessionClient | NonNullable<ReturnType<typeof createAdminClient>>

async function requireAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}

async function assertHeadTable(supabase: SessionClient, tableId: string, userId: string, errorMessage: string) {
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('head_table_id')
    .eq('id', tableId)
    .single()

  if (tableErr || !table) throw new Error('Table not found')
  if (table.head_table_id !== userId) {
    throw new Error(errorMessage)
  }
}

export async function linkCharacterToTable(tableId: string, characterId: string) {
  const { supabase, user } = await requireAuthenticatedUser()

  const { error } = await supabase
    .from('table_members')
    .update({ character_id: characterId })
    .eq('table_id', tableId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}

export async function getTableMembers(tableId: string) {
  const { supabase, user } = await requireAuthenticatedUser()

  const { data: ownSeat, error: ownSeatErr } = await supabase
    .from('table_members')
    .select('id')
    .eq('table_id', tableId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (ownSeatErr) throw new Error(ownSeatErr.message)
  if (!ownSeat) throw new Error('You are not a member of this table')

  const admin = createAdminClient()
  if (!admin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to display party character names.')
  }

  const [membersRes, tableRes] = await Promise.all([
    admin
      .from('table_members')
      .select('id, user_id, is_ready, character_id')
      .eq('table_id', tableId)
      .order('joined_at', { ascending: true }),
    admin
      .from('tables')
      .select('current_turn')
      .eq('id', tableId)
      .single(),
  ])

  if (membersRes.error) throw new Error(`Failed to fetch table members: ${membersRes.error.message}`)
  const members = membersRes.data ?? []

  const draftByMemberId = new Map<string, string>()
  const currentTurn = tableRes.data?.current_turn
  if (typeof currentTurn === 'number') {
    const { data: turn } = await admin
      .from('turns')
      .select('id')
      .eq('table_id', tableId)
      .eq('turn_number', currentTurn)
      .maybeSingle()

    if (turn?.id) {
      const { data: actions } = await admin
        .from('turn_actions')
        .select('member_id, action_text')
        .eq('turn_id', turn.id)

      for (const act of actions ?? []) {
        if (act.action_text) {
          draftByMemberId.set(act.member_id, act.action_text)
        }
      }
    }
  }

  const characterIds = [...new Set(members.flatMap((member) => (
    member.character_id ? [member.character_id] : []
  )))]

  const charactersById = new Map()

  if (characterIds.length > 0) {
    const { data: partyCharacters, error: charactersErr } = await admin
      .from('characters')
      .select('id, name, class_archetype, current_hp, max_hp, armor_class, status_condition, strengths, weaknesses, backstory')
      .in('id', characterIds)

    if (charactersErr) throw new Error(`Failed to fetch party character names: ${charactersErr.message}`)

    for (const character of partyCharacters ?? []) {
      charactersById.set(character.id, character)
    }

    const ownCharacterIds = members
      .filter((member) => member.user_id === user.id && member.character_id)
      .map((member) => member.character_id)

    if (ownCharacterIds.length > 0) {
      const { data: ownCharacters, error: ownCharactersErr } = await supabase
        .from('characters')
        .select('*')
        .in('id', ownCharacterIds)
        .eq('user_id', user.id)

      if (ownCharactersErr) throw new Error(`Failed to fetch your character sheet: ${ownCharactersErr.message}`)

      for (const character of ownCharacters ?? []) {
        charactersById.set(character.id, character)
      }
    }
  }

  return members.map((member) => ({
    id: member.id,
    user_id: member.user_id,
    is_ready: member.is_ready,
    action_text: member.is_ready ? draftByMemberId.get(member.id) ?? null : null,
    characters: member.character_id ? charactersById.get(member.character_id) ?? null : null,
  }))
}

// Saves one player's draft for the given turn. Shared by submitActionDraft and toggleReadyStatus.
async function saveActionDraft(
  supabase: SessionClient,
  userId: string,
  tableId: string,
  turnNumber: number,
  actionText: string
) {
  // The seat and the turn row do not depend on each other, so look them up together
  const [{ data: member }, { data: turn }] = await Promise.all([
    supabase
      .from('table_members')
      .select('id')
      .eq('table_id', tableId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('turns')
      .select('id')
      .eq('table_id', tableId)
      .eq('turn_number', turnNumber)
      .single(),
  ])

  if (!member) throw new Error('Member not found')
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
}

export async function submitActionDraft(tableId: string, currentTurnNumber: number, actionText: string) {
  const { supabase, user } = await requireAuthenticatedUser()

  await saveActionDraft(supabase, user.id, tableId, currentTurnNumber, actionText)
  revalidatePath(`/table/${tableId}`)
}

async function everyoneReady(db: DbClient, tableId: string): Promise<boolean> {
  const { data: members, error } = await db
    .from('table_members')
    .select('is_ready')
    .eq('table_id', tableId)

  if (error) throw new Error(error.message)
  return Boolean(members && members.length > 0 && members.every((m) => m.is_ready))
}

// Stops a running countdown. Does nothing in any other phase, so a turn that is resolving is never touched.
// With `onlyEndingAt`, it only stops the one countdown that was started with that end time.
async function cancelCountdown(db: DbClient, tableId: string, onlyEndingAt?: string) {
  let query = db
    .from('tables')
    .update({ turn_phase: 'drafting', countdown_end: null })
    .eq('id', tableId)
    .eq('turn_phase', 'countdown')
  if (onlyEndingAt) query = query.eq('countdown_end', onlyEndingAt)

  const { data, error } = await query.select('turn_phase, countdown_end').maybeSingle()

  if (error) throw new Error(error.message)
  return data as TablePhase | null
}

/**
 * Sets this player's Ready state. When `draft` is given it is saved in the same request,
 * so pressing Ready costs one round trip instead of two.
 * Returns the table's new phase when this call changed it, otherwise null.
 *
 * There is no revalidatePath here on purpose: the playground keeps its own live state, and
 * re-rendering the whole page inside this request only made every Ready click slower.
 */
export async function toggleReadyStatus(
  tableId: string,
  isReady: boolean,
  draft?: { turnNumber: number; text: string }
): Promise<TablePhase | null> {
  const { supabase, user } = await requireAuthenticatedUser()

  if (isReady && draft && draft.text.trim()) {
    await saveActionDraft(supabase, user.id, tableId, draft.turnNumber, draft.text)
  }

  const { data: seat, error } = await supabase
    .from('table_members')
    .update({ is_ready: isReady })
    .eq('table_id', tableId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!seat) throw new Error('You are not a member of this table')

  // The phase belongs to the whole table and several players can press Ready in the same moment.
  // Every write below only applies from the phase it expects, so two requests can never undo each
  // other: nobody restarts a countdown that is running, and nobody pulls a resolving turn back.
  const db: DbClient = createAdminClient() ?? supabase

  // Stepping back only ever needs to stop a countdown
  if (!isReady) return cancelCountdown(db, tableId)

  let changed: TablePhase | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await everyoneReady(db, tableId))) return changed

    // 5-second synchronized countdown trigger (only from drafting: the first request to get here wins)
    const countdownEnd = new Date(Date.now() + COUNTDOWN_MS).toISOString()
    const { data: started, error: startErr } = await db
      .from('tables')
      .update({
        turn_phase: 'countdown',
        countdown_end: countdownEnd,
      })
      .eq('id', tableId)
      .eq('turn_phase', 'drafting')
      .select('turn_phase, countdown_end')
      .maybeSingle()

    if (startErr) throw new Error(startErr.message)
    // Another request already started the countdown, or the turn is resolving
    if (!started) return changed

    if (await everyoneReady(db, tableId)) return started as TablePhase

    // A player stepped back between the check and the write. Their own request ran before this
    // countdown existed and had nothing to stop, so stop it here (this one only), then look again
    // in case they are ready once more.
    await cancelCountdown(db, tableId, countdownEnd)
    changed = { turn_phase: 'drafting', countdown_end: null }
  }

  return changed
}

// The server's clock. countdown_end is stamped with it, so each browser asks for it once and
// counts down from the same "now" even when the device's own clock is a few seconds off.
export async function getServerTime(): Promise<number> {
  return Date.now()
}

export async function resolveTurn(tableId: string) {
  const { supabase, user } = await requireAuthenticatedUser()

  // Fetch table and campaign settings
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

    // Fetch every seat at the table and the drafts submitted for the current turn
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
          currentHp: character?.current_hp ?? 10,
          maxHp: character?.max_hp ?? 10,
          ac: character?.armor_class ?? 10,
          condition: character?.status_condition || 'Normal',
          inventory: character?.inventory || '',
          equipment: Array.isArray(character?.equipment) ? character.equipment : [],
          strengths: character?.strengths || '',
          weaknesses: character?.weaknesses || '',
          backstory: character?.backstory || '',
          action,
        },
      ]
    })

    // Fetch lorebook entries for dynamic scanning
    const { data: loreEntries, error: loreErr } = await supabase
      .from('lorebook_entries')
      .select('*')
      .eq('campaign_id', table.campaign_id)

    if (loreErr) throw new Error(`Failed to fetch lorebook entries: ${loreErr.message}`)

    // Fetch recent turn history
    const { data: recentTurns, error: turnsErr } = await supabase
      .from('turns')
      .select('turn_number, narrative_output')
      .eq('table_id', tableId)
      .order('turn_number', { ascending: true })

    if (turnsErr) throw new Error(`Failed to fetch turns history: ${turnsErr.message}`)

    // Generate AI Dungeon Master scene narrative
    const aiNarrative = await generateDmNarrative({
      campaign: table.campaigns,
      loreEntries: loreEntries || [],
      recentTurns: recentTurns || [],
      partyActions,
    })

    const nextTurnNumber = table.current_turn + 1

    // Persist new narrative turn
    const { error: insertTurnErr } = await supabase.from('turns').insert({
      table_id: tableId,
      turn_number: nextTurnNumber,
      narrative_output: aiNarrative,
      edited_by_host: false,
    })

    if (insertTurnErr) throw new Error(`Failed to persist new turn: ${insertTurnErr.message}`)

    // Reset ready statuses for every seat (not just the caller's) and bump turn counter
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
  const { supabase, user } = await requireAuthenticatedUser()
  await assertHeadTable(supabase, tableId, user.id, 'Only the Head Table can edit AI narrative blocks')

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
  const { supabase, user } = await requireAuthenticatedUser()
  await assertHeadTable(supabase, tableId, user.id, 'Only the Head Table has permission to kick players from the room')

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
    equipment?: string[]
    stats?: Record<string, number | string>
  }
) {
  const { supabase, user } = await requireAuthenticatedUser()

  const payloadUpdates = { ...updates }
  if (updates.stats) {
    const normalizedStats: Record<string, number> = {}
    for (const [k, v] of Object.entries(updates.stats)) {
      const num = Number(v)
      normalizedStats[k] = Number.isFinite(num) ? num : 0
    }
    payloadUpdates.stats = normalizedStats
  }
  if (updates.max_hp !== undefined && updates.current_hp !== undefined) {
    payloadUpdates.current_hp = Math.min(updates.max_hp, updates.current_hp)
  }

  const { error } = await supabase
    .from('characters')
    .update(payloadUpdates)
    .eq('id', characterId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath(`/table/${tableId}`)
}