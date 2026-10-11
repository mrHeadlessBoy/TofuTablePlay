'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  toggleReadyStatus,
  linkCharacterToTable,
  getTableMembers,
  getServerTime,
  resolveTurn,
  hostOverrideNarrative,
  voteKickMember,
  updateCharacterCombatState,
} from './actions'
import { COUNTDOWN_MS } from './countdown'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import {
  Shield,
  Heart,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
  Edit3,
  Check,
  X,
  Loader2,
  UserX,
  ArrowLeft,
  RotateCcw,
  Save,
  Dices,
} from 'lucide-react'
import Link from 'next/link'
import { abilityModifier, describeRoll, type DiceRoll } from '@/components/dice/dice'
import type { DiceActor } from '@/components/dice/DiceRoller'

// The dice tray draws a 3D die with three.js, so it is only downloaded when a player opens it
const DiceRoller = dynamic(() => import('@/components/dice/DiceRoller'), { ssr: false })

type Character = {
  id: string
  name: string
  class_archetype?: string
  current_hp?: number
  max_hp?: number
  armor_class?: number
  status_condition?: string
  stats?: Record<string, number | string>
  inventory?: string
}

type Member = {
  id: string
  user_id: string
  is_ready: boolean
  characters?: Character | null
}

type Turn = {
  id: string
  turn_number: number
  narrative_output: string
  edited_by_host?: boolean
}

type LorebookEntry = {
  id: string
  title: string
  category?: string
  content?: string
}

type TableData = {
  id: string
  table_code: string
  turn_phase?: string
  countdown_end?: string | null
  current_turn?: number
  head_table_id?: string
}

type TablePlaygroundProps = {
  initialTable: TableData
  initialMembers: Member[]
  initialTurns: Turn[]
  lorebook: LorebookEntry[]
  userCharacters: Character[]
  currentMember?: Member | null
  userId: string
  isHeadTable: boolean
}

const COUNTDOWN_SECONDS = Math.ceil(COUNTDOWN_MS / 1000)
// How long another player's Ready click is trusted when their request never reports back
const READY_CLAIM_TTL_MS = 6000

// A Ready click that the roster on screen already shows, before the server's copy has caught up.
// settledAt is set once the request behind it has finished (null while it is still running).
type ReadyClaim = { ready: boolean; settledAt: number | null; expiresAt: number }
type ReadyClaims = Map<string, ReadyClaim>

// Lays those clicks over a roster that just came from the server. A reload that was asked for
// before a click was saved still carries the old value, and used to flip the badge back.
// Once a reload that started after the request finished arrives, the server's copy is the truth
// again and the claim is dropped.
function withReadyClaims(list: Member[], claims: ReadyClaims, reloadStartedAt: number): Member[] {
  if (claims.size === 0) return list
  const now = Date.now()
  for (const [memberUserId, claim] of claims) {
    const confirmed = claim.settledAt !== null && reloadStartedAt >= claim.settledAt
    if (confirmed || now > claim.expiresAt) claims.delete(memberUserId)
  }
  return list.map((m) => {
    const claim = claims.get(m.user_id)
    return claim ? { ...m, is_ready: claim.ready } : m
  })
}

const CONDITIONS = ['Normal', 'Bloodied', 'Poisoned', 'Stunned', 'Blinded', 'Unconscious', 'Blessed', 'Charmed', 'Exhausted']

export default function TablePlayground({
  initialTable,
  initialMembers,
  initialTurns,
  lorebook,
  userCharacters,
  currentMember,
  userId,
  isHeadTable,
}: TablePlaygroundProps) {
  const [table, setTable] = useState(initialTable)
  const [members, setMembers] = useState(initialMembers)
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null)
  const [turns, setTurns] = useState(initialTurns)
  const [draftAction, setDraftAction] = useState('')
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [diceOpen, setDiceOpen] = useState(false)

  // Server clock minus this device's clock, in ms. countdown_end is stamped by the server,
  // so a device whose clock is a few seconds off would otherwise count down from another number.
  const clockOffsetRef = useRef(0)
  // Ready clicks the server's roster has not caught up with (this player's own, and ones announced by others)
  const readyClaimsRef = useRef<ReadyClaims>(new Map())
  // Roster refreshes run one at a time (see refreshMembers)
  const membersRefreshRef = useRef({ running: false, again: false })
  // When the table state last came from a trusted answer, so a slower, older poll result is dropped
  const tableSetAtRef = useRef(0)
  const seenPhaseRef = useRef(`${initialTable.turn_phase}:${initialTable.current_turn}`)

  // A new turn starts with an empty draft for every player, not only the host who resolved it
  const [draftTurn, setDraftTurn] = useState(initialTable.current_turn)
  if (table.current_turn !== draftTurn) {
    setDraftTurn(table.current_turn)
    setDraftAction('')
  }

  // Host override and AI generation states
  const [isResolving, setIsResolving] = useState(false)
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Character Inspector editing state
  const [isEditingChar, setIsEditingChar] = useState(false)
  const [isSavingChar, setIsSavingChar] = useState(false)
  const [isSwitchingChar, setIsSwitchingChar] = useState(false)
  const [charForm, setCharForm] = useState({
    current_hp: 10,
    max_hp: 10,
    armor_class: 10,
    status_condition: 'Normal',
    inventory: '',
    stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } as Record<string, number | string>,
  })

  // Ref to hold the Supabase channel for broadcasting
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Derive the active member and character dynamically from live members state
  const activeMember = members.find((m) => m.user_id === userId) || currentMember
  const activeChar = activeMember?.characters

  // The draft is locked once the player is ready, so the dice tray is locked with it
  // True on every player's screen while the Dungeon Master is writing the turn, not only the host's.
  // isResolving is the host's own request; the others learn it from the table phase. The countdown
  // reaching zero counts too, so nobody waits for that phase change to arrive before seeing the loader.
  const turnResolving =
    isResolving ||
    table.turn_phase === 'resolving' ||
    (table.turn_phase === 'countdown' && countdownSeconds === 0)

  const draftLocked = Boolean(activeMember?.is_ready) || table.turn_phase === 'countdown' || turnResolving

  // Let the player roll as their own character, with that sheet's ability bonuses
  const diceActors: DiceActor[] = activeChar
    ? [
        {
          id: activeChar.id,
          name: activeChar.name,
          modifiers: Object.fromEntries(
            Object.entries(activeChar.stats || {}).map(([key, value]) => [key, abilityModifier(value)])
          ),
        },
      ]
    : []

  // Write the roll into the draft so the Dungeon Master reads the number when the turn resolves
  const handleDiceRoll = (roll: DiceRoll) => {
    if (draftLocked) return
    const result = describeRoll(roll)
    const text = result.startsWith(roll.label) ? `[ทอยเต๋า ${result}]` : `[ทอยเต๋า ${roll.label}: ${result}]`
    setDraftAction((current) => (current.trim() ? `${current.trim()} ${text}` : text))
  }

  const handleOpenEdit = () => {
    if (activeChar) {
      setCharForm({
        current_hp: activeChar.current_hp ?? 10,
        max_hp: activeChar.max_hp ?? 10,
        armor_class: activeChar.armor_class ?? 10,
        status_condition: activeChar.status_condition || 'Normal',
        inventory: activeChar.inventory || '',
        stats: activeChar.stats || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      })
    }
    setIsEditingChar(true)
  }

  // Ask the server what time it is, so the countdown below does not depend on this device's clock.
  useEffect(() => {
    let cancelled = false

    const syncClock = async () => {
      let bestRoundTrip = Infinity
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        const sentAt = Date.now()
        try {
          const serverNow = await getServerTime()
          const roundTrip = Date.now() - sentAt
          // The quickest answer spent the least time on the wire, so it is the most accurate one
          if (!cancelled && roundTrip < bestRoundTrip) {
            bestRoundTrip = roundTrip
            clockOffsetRef.current = serverNow - (sentAt + roundTrip / 2)
          }
        } catch {
          // Keep the offset we already have
        }
      }
    }

    void syncClock()
    return () => {
      cancelled = true
    }
  }, [])

  // Reload the roster from the server. Server actions queue up one behind another, so a burst of
  // realtime events used to line up several reloads in front of this player's own Ready click.
  // Now only one runs at a time, and events that arrive meanwhile share a single follow-up reload.
  const refreshMembers = useCallback(async () => {
    const refresh = membersRefreshRef.current
    if (refresh.running) {
      refresh.again = true
      return
    }
    refresh.running = true
    do {
      refresh.again = false
      const startedAt = Date.now()
      try {
        const latest: Member[] = await getTableMembers(table.id)
        setMembers(withReadyClaims(latest, readyClaimsRef.current, startedAt))
        setMemberLoadError(null)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to refresh party members'
        console.error(message)
        setMemberLoadError(message)
      }
    } while (refresh.again)
    refresh.running = false
  }, [table.id])

  // Load members on page load and refresh them only when member state changes.
  useEffect(() => {
    const supabase = createClient()

    const fetchTable = async () => {
      const askedAt = Date.now()
      const { data } = await supabase
        .from('tables')
        .select('*')
        .eq('id', table.id)
        .single()
      // An answer that was asked for before a newer state arrived is already out of date
      if (data && askedAt >= tableSetAtRef.current) setTable((prev) => ({ ...prev, ...data }))
    }

    const fetchTurns = async () => {
      const { data } = await supabase
        .from('turns')
        .select('*')
        .eq('table_id', table.id)
        .order('turn_number', { ascending: true })
      if (data) setTurns(data)
    }

    const channel = supabase
      .channel(`table_sync:${table.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${table.id}` },
        (payload) => {
          const nextTable = payload.new as Partial<TableData> | null
          if (!nextTable) return
          tableSetAtRef.current = Date.now()
          setTable((currentTable) => ({
            ...currentTable,
            ...nextTable,
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_members', filter: `table_id=eq.${table.id}` },
        () => {
          void refreshMembers()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `table_id=eq.${table.id}` },
        () => {
          fetchTurns()
        }
      )
      .on('broadcast', { event: 'member_ready' }, ({ payload }) => {
        // Another player just pressed Ready: show it at once. Their confirmed state follows with table_sync.
        const memberUserId: unknown = payload?.userId
        const ready: unknown = payload?.ready
        if (typeof memberUserId !== 'string' || typeof ready !== 'boolean' || memberUserId === userId) return
        readyClaimsRef.current.set(memberUserId, { ready, settledAt: null, expiresAt: Date.now() + READY_CLAIM_TTL_MS })
        setMembers((prev) => prev.map((m) => (m.user_id === memberUserId ? { ...m, is_ready: ready } : m)))
      })
      .on('broadcast', { event: 'table_sync' }, ({ payload }) => {
        // The sender's request has finished: the reload below is the truth for them again
        const senderClaim = typeof payload?.userId === 'string' ? readyClaimsRef.current.get(payload.userId) : undefined
        if (senderClaim) senderClaim.settledAt = Date.now()
        void refreshMembers()
        fetchTable()
        fetchTurns()
      })
      .subscribe()

    channelRef.current = channel

    // Keep the polling fallback for table and turn updates; member data is event-driven.
    const interval = setInterval(() => {
      fetchTable()
      fetchTurns()
    }, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [table.id, userId, refreshMembers])

  // The roster is refreshed by events. If one was missed, catch up whenever the table moves to
  // another phase or turn (those arrive separately, through realtime and the polling above).
  useEffect(() => {
    const phaseKey = `${table.turn_phase}:${table.current_turn}`
    if (phaseKey === seenPhaseRef.current) return
    seenPhaseRef.current = phaseKey
    void refreshMembers()
  }, [table.turn_phase, table.current_turn, refreshMembers])

  const broadcast = useCallback(
    (event: 'table_sync' | 'member_ready', extra: Record<string, unknown> = {}) => {
      try {
        channelRef.current?.send({
          type: 'broadcast',
          event,
          payload: { userId, timestamp: Date.now(), ...extra },
        })
      } catch {
        // Ignored if channel isn't ready
      }
    },
    [userId]
  )

  const broadcastSync = useCallback(() => broadcast('table_sync'), [broadcast])

  const handleResolveTurn = useCallback(async () => {
    setIsResolving(true)
    let failure: string | null = null
    try {
      const result = await resolveTurn(table.id)
      setDraftAction('')
      // Move this screen on from the answer itself. Waiting for realtime left the countdown sitting
      // at zero for a moment, which kept the loader up and could fire this resolve a second time.
      tableSetAtRef.current = Date.now()
      if (result.resolved && typeof result.turnNumber === 'number') {
        const nextTurn = result.turnNumber
        setTable((prev) => ({ ...prev, current_turn: nextTurn, turn_phase: 'drafting', countdown_end: null }))
      } else {
        // Another request holds this turn: keep showing the loader until its result arrives
        setTable((prev) => ({ ...prev, turn_phase: 'resolving' }))
      }
    } catch (err: unknown) {
      console.error(err)
      failure = err instanceof Error ? err.message : 'Error resolving turn with AI'
      // resolveTurn puts the table back to drafting when it fails, so do the same here
      tableSetAtRef.current = Date.now()
      setTable((prev) => ({ ...prev, turn_phase: 'drafting', countdown_end: null }))
    }
    setIsResolving(false)
    // Tell the other players either way, so their loader ends with the new turn or with the retry
    broadcastSync()
    if (failure) alert(failure)
  }, [table.id, broadcastSync])

  // Synchronized countdown timer
  useEffect(() => {
    if (table.turn_phase !== 'countdown' || !table.countdown_end) {
      const resetId = window.setTimeout(() => {
        setCountdownSeconds(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }

    const countdownEnd = new Date(table.countdown_end)

    if (Number.isNaN(countdownEnd.getTime())) {
      const resetId = window.setTimeout(() => {
        setCountdownSeconds(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }

    const interval = setInterval(() => {
      // "Now" on the server's clock, the same one that stamped countdown_end
      const serverNow = Date.now() + clockOffsetRef.current
      const remaining = Math.min(
        COUNTDOWN_SECONDS,
        Math.max(0, Math.ceil((countdownEnd.getTime() - serverNow) / 1000))
      )
      setCountdownSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [table.turn_phase, table.countdown_end])

  // Automatic turn resolution once the countdown reaches 0 (invoked by Head Table)
  useEffect(() => {
    if (
      !isHeadTable ||
      table.turn_phase !== 'countdown' ||
      countdownSeconds !== 0 ||
      isResolving
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void handleResolveTurn()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [countdownSeconds, isHeadTable, table.turn_phase, isResolving, handleResolveTurn])

  const handleReadyToggle = async () => {
    // One request at a time: a second click while the first was on its way made the badge jump
    if (!activeMember || readyClaimsRef.current.get(userId)?.settledAt === null) return
    if (typeof table.current_turn !== 'number') return

    const nextState = !activeMember.is_ready
    const setOwnReady = (ready: boolean) =>
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, is_ready: ready } : m)))

    // Show it right away, on this screen and on the other players' screens.
    // The server's answer follows, and table_sync below replaces the guess with the saved state.
    const claim: ReadyClaim = { ready: nextState, settledAt: null, expiresAt: Infinity }
    readyClaimsRef.current.set(userId, claim)
    setOwnReady(nextState)
    broadcast('member_ready', { ready: nextState })

    let failure: string | null = null
    try {
      const phase = await toggleReadyStatus(
        table.id,
        nextState,
        nextState ? { turnNumber: table.current_turn, text: draftAction } : undefined
      )
      if (phase) {
        // This click started or stopped the countdown: show it without waiting for realtime
        tableSetAtRef.current = Date.now()
        setTable((prev) => ({ ...prev, ...phase }))
      }
    } catch (err: unknown) {
      // Roll back so the roster never shows READY for a draft that was not saved
      failure = err instanceof Error ? err.message : 'Failed to submit your action'
      readyClaimsRef.current.delete(userId)
      setOwnReady(!nextState)
    }

    // Saved (or rolled back). The claim stays until a roster reload that started after this moment arrives.
    claim.settledAt = Date.now()
    broadcastSync()
    if (failure) alert(failure)
  }

  const handleSelectCharacter = async (charId: string) => {
    try {
      await linkCharacterToTable(table.id, charId)
      setMembers(await getTableMembers(table.id))
      setMemberLoadError(null)
      setIsSwitchingChar(false)
      broadcastSync()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to select character'
      console.error(message)
      alert(message)
    }
  }

  const handleSaveCharEdits = async () => {
    if (!activeChar) return
    setIsSavingChar(true)
    try {
      await updateCharacterCombatState(table.id, activeChar.id, charForm)

      // Optimistic update
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId
            ? {
                ...m,
                characters: m.characters
                  ? {
                      ...m.characters,
                      ...charForm,
                    }
                  : null,
              }
            : m
        )
      )
      setIsEditingChar(false)
      broadcastSync()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update character')
    } finally {
      setIsSavingChar(false)
    }
  }

  const handleSaveHostEdit = async (turnId: string) => {
    await hostOverrideNarrative(turnId, editText, table.id)
    setEditingTurnId(null)
    broadcastSync()
  }

  const handleKick = async (targetUserId: string, targetName: string) => {
    if (confirm(`Remove ${targetName} from this table?`)) {
      await voteKickMember(table.id, targetUserId)
      broadcastSync()
    }
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* LEFT PANEL: Character Inspector */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <Link
            href="/hub"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaign Hub
          </Link>
          <div className="border-b border-zinc-800 pb-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500">
                Character Inspector
              </span>
              {activeChar && !isSwitchingChar && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (isEditingChar) {
                        setIsEditingChar(false)
                      } else {
                        handleOpenEdit()
                      }
                    }}
                    className="text-[10px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> {isEditingChar ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={() => setIsSwitchingChar(true)}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Switch
                  </button>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {activeChar ? activeChar.name : 'No Character Bound'}
            </h2>
            <p className="text-xs text-zinc-400">
              {activeChar?.class_archetype || 'Select a sheet below to participate'}
            </p>
          </div>

          {!activeChar || isSwitchingChar ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 font-medium">
                  Select a character for this session:
                </label>
                {isSwitchingChar && (
                  <button
                    onClick={() => setIsSwitchingChar(false)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {userCharacters.map((char: Character) => (
                <button
                  key={char.id}
                  onClick={() => handleSelectCharacter(char.id)}
                  className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-500 text-xs transition cursor-pointer"
                >
                  <p className="font-semibold text-white">{char.name}</p>
                  <p className="text-zinc-500">
                    {char.class_archetype} | HP: {char.current_hp}/{char.max_hp}
                  </p>
                </button>
              ))}
              {userCharacters.length === 0 && (
                <p className="text-xs text-zinc-500 italic">
                  No character sheets found. Create one in the Character Codex.
                </p>
              )}
            </div>
          ) : isEditingChar ? (
            /* Inline Character Editor */
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Current HP</label>
                  <input
                    type="number"
                    value={charForm.current_hp}
                    onChange={(e) => setCharForm({ ...charForm, current_hp: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Max HP</label>
                  <input
                    type="number"
                    value={charForm.max_hp}
                    onChange={(e) => setCharForm({ ...charForm, max_hp: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Armor Class</label>
                  <input
                    type="number"
                    value={charForm.armor_class}
                    onChange={(e) => setCharForm({ ...charForm, armor_class: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Condition</label>
                  <select
                    value={charForm.status_condition}
                    onChange={(e) => setCharForm({ ...charForm, status_condition: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stats Editor */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Ability Scores</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.keys(charForm.stats || {}).map((stat) => (
                    <div key={stat} className="bg-zinc-950 border border-zinc-800 rounded p-1 text-center">
                      <span className="text-[9px] text-zinc-500 uppercase block">{stat}</span>
                      <input
                        type="number"
                        value={charForm.stats[stat] ?? 10}
                        onChange={(e) =>
                          setCharForm({
                            ...charForm,
                            stats: { ...charForm.stats, [stat]: Number(e.target.value) },
                          })
                        }
                        className="w-full bg-transparent text-center font-bold text-xs text-white outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory Editor */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Inventory</label>
                <textarea
                  rows={3}
                  value={charForm.inventory}
                  onChange={(e) => setCharForm({ ...charForm, inventory: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveCharEdits}
                  disabled={isSavingChar}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> {isSavingChar ? 'Saving...' : 'Save Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingChar(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Combat Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono block">
                      Hit Points
                    </span>
                    <span className="font-bold text-sm text-white">
                      {activeChar.current_hp} / {activeChar.max_hp}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono block">
                      Armor Class
                    </span>
                    <span className="font-bold text-sm text-white">{activeChar.armor_class}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-center">
                <span className="text-zinc-400">Condition:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  activeChar.status_condition === 'Normal'
                    ? 'bg-zinc-800 text-zinc-300'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {activeChar.status_condition || 'Normal'}
                </span>
              </div>

              {/* Attributes */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(activeChar.stats || {}).map(([key, val]) => (
                  <div key={key} className="bg-zinc-950 border border-zinc-800/80 rounded p-2 text-center">
                    <span className="text-[9px] text-zinc-500 block uppercase font-mono">{key}</span>
                    <span className="font-bold text-white text-xs">{String(val)}</span>
                  </div>
                ))}
              </div>

              {/* Inventory */}
              <div>
                <span className="text-[10px] uppercase font-mono text-zinc-400">Inventory</span>
                <div className="mt-1 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 min-h-15 whitespace-pre-line text-[11px]">
                  {activeChar.inventory || 'Empty'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-zinc-600 border-t border-zinc-800 pt-3 flex justify-between">
          <span>CODE: {table.table_code}</span>
          <span>{isHeadTable ? 'HEAD TABLE' : 'PLAYER'}</span>
        </div>
      </aside>

      {/* CENTER: Main Turn Narrative & Action Feed */}
      <main className="flex-1 flex flex-col justify-between h-full bg-zinc-950">
        {/* Narrative chat area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {turns.map((turn: Turn) => (
              <div
                key={turn.id}
                className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 shadow-lg space-y-3"
              >
                <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">
                      {/* The opening narration is not a played turn, so play is numbered from the row after it */}
                      {turn.turn_number === OPENING_TURN_NUMBER
                        ? 'คำบรรยาย'
                        : `Turn ${turn.turn_number - OPENING_TURN_NUMBER}`}
                    </span>
                    {turn.edited_by_host && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded">
                        Edited by Host
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">AI Dungeon Master</span>
                    {isHeadTable && editingTurnId !== turn.id && (
                      <button
                        onClick={() => {
                          setEditingTurnId(turn.id)
                          setEditText(turn.narrative_output)
                        }}
                        className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                </div>

                {editingTurnId === turn.id ? (
                  <div className="space-y-3">
                    <textarea
                      rows={5}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingTurnId(null)}
                        className="px-3 py-1 text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSaveHostEdit(turn.id)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-zinc-200 whitespace-pre-line">
                    {turn.narrative_output}
                  </div>
                )}
              </div>
            ))}

            {/* AI Turn Processing State */}
            {turnResolving && (
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-3 text-amber-400 text-sm animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                The AI Dungeon Master is resolving the party&apos;s actions...
              </div>
            )}
          </div>
        </div>

        {/* Bottom Private Drafting Input & Ready Barrier */}
        <div className="border-t border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-md">
          <div className="max-w-3xl mx-auto space-y-3">
            {table.turn_phase === 'countdown' && !turnResolving && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-600/50 flex items-center justify-center gap-2 text-amber-300 font-mono text-sm animate-pulse">
                <Clock className="w-4 h-4" /> ALL PLAYERS READY — Submitting actions in {countdownSeconds ?? COUNTDOWN_SECONDS}s...
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                placeholder={
                  activeMember?.is_ready
                    ? 'Action locked. Waiting for other players...'
                    : 'Draft your hidden turn action...'
                }
                value={draftAction}
                disabled={activeMember?.is_ready || table.turn_phase === 'countdown' || turnResolving}
                onChange={(e) => setDraftAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReadyToggle()
                }}
                className="flex-1 bg-zinc-950 border border-zinc-750 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 outline-none disabled:opacity-50"
              />
              {/* Dice tray: opens above the input, and every roll is added to the draft */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDiceOpen((open) => !open)}
                  disabled={draftLocked}
                  aria-label="Dice tray"
                  aria-expanded={diceOpen}
                  title="ทอยเต๋า"
                  className={`h-full px-3 rounded-lg border transition disabled:opacity-50 ${
                    diceOpen && !draftLocked
                      ? 'border-amber-500 bg-amber-950/40 text-amber-400'
                      : 'border-zinc-700 text-zinc-300 hover:border-amber-500 hover:text-amber-400'
                  } cursor-pointer`}
                >
                  <Dices className="w-4 h-4" />
                </button>
                {diceOpen && !draftLocked && (
                  <div className="absolute bottom-full right-0 z-30 mb-3 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl">
                    <DiceRoller
                      actors={diceActors}
                      onRoll={handleDiceRoll}
                      onClose={() => setDiceOpen(false)}
                      hint="เลือกลูกเต๋าแล้วกด ROLL ผลทอยจะถูกใส่ในช่อง action ให้"
                      className="bg-zinc-950"
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleReadyToggle}
                disabled={turnResolving}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-50 ${
                  activeMember?.is_ready
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                } cursor-pointer`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {activeMember?.is_ready ? 'Ready!' : 'Ready Up'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT PANEL: Party Roster & Lorebook Overview */}
      <aside className="w-80 border-l border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* Party Roster with Host Kick */}
          <div>
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-white">Party Roster</h3>
            </div>
            <div className="mt-3 space-y-2">
              {memberLoadError && (
                <p className="text-xs text-red-400" role="alert">{memberLoadError}</p>
              )}
              {members.map((m: Member) => {
                const char = m.characters
                const charName = char?.name || 'Spectator/Unbound'
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white block">{charName}</span>
                        {m.user_id === table.head_table_id && (
                          <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-800 px-1 rounded">
                            HOST
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                        <span>{char?.class_archetype || 'No class'}</span>
                        {char?.current_hp !== undefined && (
                          <span className="text-red-400 font-mono">
                            HP: {char.current_hp}/{char.max_hp}
                          </span>
                        )}
                        {char?.status_condition && char.status_condition !== 'Normal' && (
                          <span className="text-amber-400 font-mono">
                            [{char.status_condition}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          m.is_ready
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {m.is_ready ? 'READY' : 'DRAFTING'}
                      </span>
                      {isHeadTable && m.user_id !== userId && (
                        <button
                          onClick={() => handleKick(m.user_id, charName)}
                          title="Kick Player (Host)"
                          className="text-zinc-600 hover:text-red-400 transition cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick-Lookup Lorebook */}
          <div>
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-white">Campaign Lorebook</h3>
            </div>
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
              {lorebook.map((entry: LorebookEntry) => (
                <div key={entry.id} className="p-2 rounded bg-zinc-950 border border-zinc-800 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{entry.title}</span>
                    <span className="text-[9px] text-amber-400 font-mono">{entry.category}</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] mt-1 line-clamp-2">{entry.content}</p>
                </div>
              ))}
              {lorebook.length === 0 && (
                <p className="text-zinc-500 text-xs italic">No entries in the lorebook.</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}