'use client'

import dynamic from 'next/dynamic'
import { Check, CheckCircle2, Clock, Dices, Edit3, Loader2, X } from 'lucide-react'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import type { DiceRoll } from '@/components/dice/dice'
import type { DiceActor } from '@/components/dice/DiceRoller'
import type { Turn } from './types'

// The dice tray draws a 3D die with three.js, so it is only downloaded when a player opens it
const DiceRoller = dynamic(() => import('@/components/dice/DiceRoller'), { ssr: false })

type NarrativeFeedPanelProps = {
  turns: Turn[]
  isHeadTable: boolean
  editingTurnId: string | null
  editText: string
  turnResolving: boolean
  turnPhase: string | undefined
  countdownSeconds: number | null
  defaultCountdownSeconds: number
  isPlayerReady: boolean
  draftAction: string
  draftLocked: boolean
  diceOpen: boolean
  diceActors: DiceActor[]
  onStartEditTurn: (turn: Turn) => void
  onCancelEditTurn: () => void
  onChangeEditText: (text: string) => void
  onSaveHostEdit: (turnId: string) => void
  onChangeDraftAction: (text: string) => void
  onToggleDiceOpen: () => void
  onCloseDice: () => void
  onDiceRoll: (roll: DiceRoll) => void
  onReadyToggle: () => void
}

export default function NarrativeFeedPanel({
  turns,
  isHeadTable,
  editingTurnId,
  editText,
  turnResolving,
  turnPhase,
  countdownSeconds,
  defaultCountdownSeconds,
  isPlayerReady,
  draftAction,
  draftLocked,
  diceOpen,
  diceActors,
  onStartEditTurn,
  onCancelEditTurn,
  onChangeEditText,
  onSaveHostEdit,
  onChangeDraftAction,
  onToggleDiceOpen,
  onCloseDice,
  onDiceRoll,
  onReadyToggle,
}: NarrativeFeedPanelProps) {
  return (
    <main className="flex-1 flex flex-col justify-between h-full bg-zinc-950">
      {/* Narrative chat area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {turns.map((turn) => (
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
                      onClick={() => onStartEditTurn(turn)}
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
                    onChange={(e) => onChangeEditText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={onCancelEditTurn}
                      className="px-3 py-1 text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                    <button
                      onClick={() => onSaveHostEdit(turn.id)}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-2xl leading-relaxed text-zinc-200 whitespace-pre-line">
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
          {turnPhase === 'countdown' && !turnResolving && (
            <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-600/50 flex items-center justify-center gap-2 text-amber-300 font-mono text-sm animate-pulse">
              <Clock className="w-4 h-4" /> ALL PLAYERS READY — Submitting actions in{' '}
              {countdownSeconds ?? defaultCountdownSeconds}s...
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              placeholder={
                isPlayerReady
                  ? 'Action locked. Waiting for other players...'
                  : 'Draft your hidden turn action...'
              }
              value={draftAction}
              disabled={draftLocked}
              onChange={(e) => onChangeDraftAction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onReadyToggle()
              }}
              className="flex-1 bg-zinc-950 border border-zinc-750 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 outline-none disabled:opacity-50"
            />
            {/* Dice tray: opens above the input, and every roll is added to the draft */}
            <div className="relative">
              <button
                type="button"
                onClick={onToggleDiceOpen}
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
                    onRoll={onDiceRoll}
                    onClose={onCloseDice}
                    hint="เลือกลูกเต๋าแล้วกด ROLL ผลทอยจะถูกใส่ในช่อง action ให้"
                    className="bg-zinc-950"
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onReadyToggle}
              disabled={turnResolving}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-50 ${
                isPlayerReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              } cursor-pointer`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isPlayerReady ? 'Ready!' : 'Ready Up'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
