'use client'

import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Check, CheckCircle2, CircleDot, Clock, Compass, Dices, Edit3, Loader2, ShieldAlert, X } from 'lucide-react'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import type { DiceRoll } from '@/components/dice/dice'
import type { DiceActor } from '@/components/dice/DiceRoller'
import { buildPlayerColorMap, getPlayerNameColor, type Turn } from '../types'

// The dice tray draws a 3D die with three.js, so it is only downloaded when a player opens it
const DiceRoller = dynamic(() => import('@/components/dice/DiceRoller'), { ssr: false })

const INLINE_TOKEN_REGEX =
  /(\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`|~~[^~\n]+?~~|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?HP:\s*[^)\n]+\)|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?(?:Skill\s*Cost|SP):\s*[^)\n]+\)|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?[^():\n]{1,40}:\s*\d+\s*\/\s*\d+\s*(?:->|→|=>)\s*\d+\s*\/\s*\d+[^)\n]*\)|\[(?:d20[^\]]*|DC\s*\d+[^\]]*)\]|\[[^\]\n]{1,40}\])/gi

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderPlainWithPlayerNames(
  text: string,
  colorMap: ReadonlyMap<string, string>,
  playerNamesRegex: RegExp | null,
  keyPrefix: number
): ReactNode {
  if (!playerNamesRegex) return text
  const subParts = text.split(playerNamesRegex)
  if (subParts.length === 1) return text

  return subParts.map((chunk, idx) => {
    if (!chunk) return null
    const color = colorMap.get(chunk.trim().toLowerCase())
    if (color) {
      return (
        <strong key={`${keyPrefix}-${idx}`} className={`font-bold ${color}`}>
          {chunk}
        </strong>
      )
    }
    return chunk
  })
}

function renderInlineFormattedText(
  text: string,
  colorMap: ReadonlyMap<string, string>,
  playerNamesRegex: RegExp | null
): ReactNode[] {
  const parts = text.split(INLINE_TOKEN_REGEX)
  return parts.map((part, index) => {
    if (!part) return null

    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      const inner = part.slice(3, -3)
      const colorClass = getPlayerNameColor(inner, colorMap)
      return (
        <strong key={index} className={`font-bold italic ${colorClass}`}>
          {inner}
        </strong>
      )
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2)
      const colorClass = getPlayerNameColor(inner, colorMap)
      return (
        <strong key={index} className={`font-bold ${colorClass}`}>
          {inner}
        </strong>
      )
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={index} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      )
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[0.85em] text-amber-300"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={index} className="line-through text-zinc-500">
          {part.slice(2, -2)}
        </del>
      )
    }

    if (/^\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?HP:\s*[^)\n]+\)$/i.test(part)) {
      return (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-red-950/60 border border-red-800/60 font-mono text-[0.75em] font-semibold text-red-300 align-middle"
        >
          {part.slice(1, -1)}
        </span>
      )
    }

    if (/^\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?(?:Skill\s*Cost|SP):\s*[^)\n]+\)$/i.test(part)) {
      return (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-cyan-950/60 border border-cyan-800/60 font-mono text-[0.75em] font-semibold text-cyan-300 align-middle"
        >
          {part.slice(1, -1)}
        </span>
      )
    }

    if (
      /^\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?[^():\n]{1,40}:\s*\d+\s*\/\s*\d+\s*(?:->|→|=>)\s*\d+\s*\/\s*\d+[^)\n]*\)$/i.test(
        part
      )
    ) {
      return (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-violet-950/60 border border-violet-800/60 font-mono text-[0.75em] font-semibold text-violet-300 align-middle"
        >
          {part.slice(1, -1)}
        </span>
      )
    }

    if (/^\[(?:d20[^\]]*|DC\s*\d+[^\]]*)\]$/i.test(part)) {
      return (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 mx-1 rounded-md bg-amber-950/70 border border-amber-700/60 font-mono text-[0.8em] font-semibold text-amber-300 align-middle"
        >
          {part.slice(1, -1)}
        </span>
      )
    }

    if (part.startsWith('[') && part.endsWith(']') && part.length > 2) {
      const inner = part.slice(1, -1).trim()
      const colorClass = getPlayerNameColor(inner, colorMap)
      return (
        <strong key={index} className={`font-bold ${colorClass}`}>
          {inner}
        </strong>
      )
    }

    return renderPlainWithPlayerNames(part, colorMap, playerNamesRegex, index)
  })
}

type NarrativeSection = {
  kind: 'narrative' | 'overview' | 'decision'
  lines: string[]
}

const SECTION_HEADER_REGEX = /^\s*(?:#+\s*)?(?:\*\*)?\[\s*(overview|decision)\s*\](?:\*\*)?\s*:?\s*$/i

function parseNarrativeSections(rawText: string): NarrativeSection[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n')
  const sections: NarrativeSection[] = []
  let current: NarrativeSection = { kind: 'narrative', lines: [] }

  for (const line of lines) {
    const headerMatch = line.match(SECTION_HEADER_REGEX)
    if (headerMatch) {
      if (current.lines.some((l) => l.trim().length > 0)) {
        sections.push(current)
      }
      const sectionKind = headerMatch[1].toLowerCase() === 'overview' ? 'overview' : 'decision'
      current = { kind: sectionKind, lines: [] }
    } else {
      current.lines.push(line)
    }
  }

  if (current.lines.some((l) => l.trim().length > 0)) {
    sections.push(current)
  }

  return sections
}

function FormattedNarrativeOutput({
  text,
  colorMap,
  playerNamesRegex,
}: {
  text: string
  colorMap: ReadonlyMap<string, string>
  playerNamesRegex: RegExp | null
}) {
  const sections = parseNarrativeSections(text)

  return (
    <div className="space-y-4">
      {sections.map((section, sIdx) => {
        if (section.kind === 'overview') {
          const nonEmptyLines = section.lines.map((l) => l.trim()).filter(Boolean)
          if (nonEmptyLines.length === 0) return null
          return (
            <div
              key={sIdx}
              className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-sky-400 border-b border-zinc-800/80 pb-2">
                <Compass className="w-3.5 h-3.5" />
                <span>[ Overview ]</span>
              </div>
              <div className="space-y-1.5 text-base leading-relaxed text-zinc-200">
                {nonEmptyLines.map((line, lIdx) => {
                  const cleanLine = line.replace(/^[-*]\s+/, '')
                  const kvMatch = cleanLine.match(/^([^:：]{2,40}?)\s*[:：]\s*(.+)$/)
                  if (kvMatch) {
                    const label = kvMatch[1].replace(/^\*\*|\*\*$/g, '').trim()
                    const value = kvMatch[2]
                    return (
                      <div key={lIdx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 shrink-0">
                          {label} :
                        </span>
                        <span className="text-zinc-100">
                          {renderInlineFormattedText(value, colorMap, playerNamesRegex)}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div key={lIdx}>
                      {renderInlineFormattedText(cleanLine, colorMap, playerNamesRegex)}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        if (section.kind === 'decision') {
          const nonEmptyLines = section.lines.map((l) => l.trim()).filter(Boolean)
          if (nonEmptyLines.length === 0) return null
          return (
            <div
              key={sIdx}
              className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-400 border-b border-amber-900/50 pb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>[ Decision ]</span>
              </div>
              <div className="space-y-2 text-base leading-relaxed text-zinc-200">
                {nonEmptyLines.map((line, lIdx) => {
                  const isBullet = /^[-*]\s+/.test(line)
                  const content = isBullet ? line.replace(/^[-*]\s+/, '') : line
                  return (
                    <div key={lIdx} className="flex items-start gap-2">
                      {isBullet && (
                        <span className="text-amber-400 font-bold select-none mt-0.5">•</span>
                      )}
                      <div className="flex-1">
                        {renderInlineFormattedText(content, colorMap, playerNamesRegex)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        return (
          <div key={sIdx} className="text-2xl leading-relaxed text-zinc-200 space-y-2">
            {section.lines.map((line, lIdx) => {
              const trimmed = line.trim()
              if (!trimmed) {
                return <div key={lIdx} className="h-2" />
              }

              if (/^---+$/.test(trimmed)) {
                return <hr key={lIdx} className="border-zinc-800 my-3" />
              }

              const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
              if (headingMatch) {
                return (
                  <h4 key={lIdx} className="text-lg font-bold text-amber-300 pt-2">
                    {renderInlineFormattedText(headingMatch[2], colorMap, playerNamesRegex)}
                  </h4>
                )
              }

              if (/^[-*]\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 pl-2">
                    <span className="text-amber-500 select-none">•</span>
                    <div className="flex-1">
                      {renderInlineFormattedText(
                        trimmed.replace(/^[-*]\s+/, ''),
                        colorMap,
                        playerNamesRegex
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <p key={lIdx}>{renderInlineFormattedText(line, colorMap, playerNamesRegex)}</p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

type NarrativeFeedPanelProps = {
  turns: Turn[]
  playerNames?: string[]
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
  playerNames = [],
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
  const { colorMap, playerNamesRegex } = useMemo(() => {
    const discoveredNames: string[] = [...playerNames]
    for (const turn of turns) {
      const boldMatches = turn.narrative_output.matchAll(/\*\*([^*\n]{1,40}?)\*\*/g)
      for (const m of boldMatches) {
        const candidate = m[1].trim()
        if (candidate && !/^\[?\s*(overview|decision)\s*\]?$/i.test(candidate)) {
          discoveredNames.push(candidate)
        }
      }
      const decisionBracketMatches = turn.narrative_output.matchAll(/^\s*[-*]\s*\[([^\]\n]{1,40})\]/gm)
      for (const m of decisionBracketMatches) {
        const candidate = m[1].trim()
        if (candidate) {
          discoveredNames.push(candidate)
        }
      }
    }

    const map = buildPlayerColorMap(discoveredNames)
    const uniquePartyNames = Array.from(
      new Set(playerNames.map((n) => n.trim()).filter((n) => n.length >= 2))
    ).sort((a, b) => b.length - a.length)

    const regex =
      uniquePartyNames.length > 0
        ? new RegExp(`(${uniquePartyNames.map(escapeRegExp).join('|')})`, 'gi')
        : null

    return { colorMap: map, playerNamesRegex: regex }
  }, [playerNames, turns])
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isInitialScrollDoneRef = useRef(false)
  const prevTurnsCountRef = useRef(turns.length)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    setIsAtBottom(true)
  }, [])

  // Auto-scroll to latest turn on table entry
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || turns.length === 0) return

    if (!isInitialScrollDoneRef.current) {
      isInitialScrollDoneRef.current = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
        })
      })
      return
    }

    if (turns.length > prevTurnsCountRef.current) {
      prevTurnsCountRef.current = turns.length
      if (isAtBottom) {
        requestAnimationFrame(() => {
          scrollToBottom('smooth')
        })
      }
    }
  }, [turns, isAtBottom, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(distanceFromBottom < 100)
  }, [])

  return (
    <main className="flex-1 flex flex-col justify-between h-full bg-zinc-950 relative">
      {/* Narrative chat area */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 pt-14 pb-72 lg:pb-16 space-y-6">
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
                <FormattedNarrativeOutput
                  text={turn.narrative_output}
                  colorMap={colorMap}
                  playerNamesRegex={playerNamesRegex}
                />
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

      {/* Floating Scroll to Bottom Symbol (Minimalist CircleDot, no text, no arrows) */}
      {!isAtBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Scroll to latest turn"
          title="ไปยังข้อความล่าสุด"
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-zinc-950/90 hover:bg-zinc-900 border border-amber-500/60 hover:border-amber-400 text-amber-400 hover:text-amber-300 shadow-[0_4px_20px_rgba(245,158,11,0.35)] backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer group"
        >
          <CircleDot className="w-4 h-4 animate-pulse group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Bottom Private Drafting Input & Ready Barrier */}
      <div className="border-t border-zinc-800 bg-zinc-900/80 py-4 px-4 sm:px-6 backdrop-blur-md">
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
