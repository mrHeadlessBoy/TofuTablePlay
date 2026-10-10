'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  toggleReadyStatus,
  submitActionDraft,
  linkCharacterToTable,
  resolveTurn,
  hostOverrideNarrative,
  voteKickMember,
  updateCharacterCombatState,
} from './actions'
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
} from 'lucide-react'
import Link from 'next/link'

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
  const [turns, setTurns] = useState(initialTurns)
  const [draftAction, setDraftAction] = useState('')
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  
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

  // Real-time listener for table state, members, and turns with broadcast and polling fallback
  useEffect(() => {
    const supabase = createClient()

    const fetchMembers = async () => {
      const { data } = await supabase
        .from('table_members')
        .select('*, characters(*)')
        .eq('table_id', table.id)
      if (data) setMembers(data)
    }

    const fetchTable = async () => {
      const { data } = await supabase
        .from('tables')
        .select('*')
        .eq('id', table.id)
        .single()
      if (data) setTable((prev) => ({ ...prev, ...data }))
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
          fetchMembers()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `table_id=eq.${table.id}` },
        () => {
          fetchTurns()
        }
      )
      .on('broadcast', { event: 'table_sync' }, () => {
        fetchMembers()
        fetchTable()
        fetchTurns()
      })
      .subscribe()

    channelRef.current = channel

    // 3-second light polling fallback so that players are always synchronized even if websocket disconnects
    const interval = setInterval(() => {
      fetchMembers()
      fetchTable()
      fetchTurns()
    }, 3000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [table.id])

  const broadcastSync = useCallback(() => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'table_sync',
        payload: { userId, timestamp: Date.now() },
      })
    } catch {
      // Ignored if channel isn't ready
    }
  }, [userId])

  const handleResolveTurn = useCallback(async () => {
    setIsResolving(true)
    try {
      await resolveTurn(table.id)
      setDraftAction('')
      broadcastSync()
    } catch (err: unknown) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Error resolving turn with AI')
    } finally {
      setIsResolving(false)
    }
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
      const remaining = Math.max(
        0,
        Math.ceil((countdownEnd.getTime() - Date.now()) / 1000)
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
    if (!activeMember) return
    if (typeof table.current_turn !== 'number') return

    const nextState = !activeMember.is_ready

    // Optimistic UI update
    setMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, is_ready: nextState } : m))
    )

    if (nextState && draftAction.trim()) {
      await submitActionDraft(table.id, table.current_turn, draftAction)
    }
    await toggleReadyStatus(table.id, nextState)
    broadcastSync()
  }

  const handleSelectCharacter = async (charId: string) => {
    const chosen = userCharacters.find((c) => c.id === charId)
    // Optimistic update
    if (chosen) {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, characters: chosen } : m))
      )
    }
    setIsSwitchingChar(false)
    await linkCharacterToTable(table.id, charId)
    broadcastSync()
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
                    className="text-[10px] text-zinc-400 hover:text-amber-400 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> {isEditingChar ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={() => setIsSwitchingChar(true)}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
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
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {userCharacters.map((char: Character) => (
                <button
                  key={char.id}
                  onClick={() => handleSelectCharacter(char.id)}
                  className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-500 text-xs transition"
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
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {isSavingChar ? 'Saving...' : 'Save Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingChar(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300"
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
                      Turn {turn.turn_number}
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
                        className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 transition"
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
                        className="px-3 py-1 text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        onClick={() => handleSaveHostEdit(turn.id)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs flex items-center gap-1"
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
            {isResolving && (
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
            {table.turn_phase === 'countdown' && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-600/50 flex items-center justify-center gap-2 text-amber-300 font-mono text-sm animate-pulse">
                <Clock className="w-4 h-4" /> ALL PLAYERS READY — Submitting actions in {countdownSeconds}s...
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
                disabled={activeMember?.is_ready || table.turn_phase === 'countdown' || isResolving}
                onChange={(e) => setDraftAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReadyToggle()
                }}
                className="flex-1 bg-zinc-950 border border-zinc-750 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleReadyToggle}
                disabled={isResolving}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-50 ${
                  activeMember?.is_ready
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
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
                          className="text-zinc-600 hover:text-red-400 transition"
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