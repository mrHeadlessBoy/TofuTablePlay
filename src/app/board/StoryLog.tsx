'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dices, MessageSquareText, ScrollText, Settings2, X } from 'lucide-react'
import type { LogEntry, LogKind } from '@/lib/board/types'

type StoryLogProps = {
  entries: LogEntry[]
  onClose: () => void
}

type Filter = 'all' | LogKind

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'narration', label: 'Story' },
  { id: 'action', label: 'Actions' },
  { id: 'roll', label: 'Dice' },
]

const KIND_STYLE: Record<LogKind, { icon: typeof Dices; tone: string }> = {
  narration: { icon: ScrollText, tone: 'text-amber-300' },
  action: { icon: MessageSquareText, tone: 'text-sky-300' },
  roll: { icon: Dices, tone: 'text-emerald-300' },
  system: { icon: Settings2, tone: 'text-white/45' },
}

/** Everything that has happened at the table, grouped by turn, so the story can be re-read later. */
export default function StoryLog({ entries, onClose }: StoryLogProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const listRef = useRef<HTMLDivElement>(null)

  const turns = useMemo(() => {
    const visible = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter)
    const grouped = new Map<number, LogEntry[]>()
    for (const entry of visible) {
      const bucket = grouped.get(entry.turn)
      if (bucket) bucket.push(entry)
      else grouped.set(entry.turn, [entry])
    }
    return Array.from(grouped.entries())
  }, [entries, filter])

  // Open on the newest entry.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [filter, entries.length])

  return (
    <section
      aria-label="Story log"
      className="flex h-full w-[26rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-xl border border-white/10 bg-black/70 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-400">
          <ScrollText className="h-4 w-4" /> Story Log
        </span>
        <button type="button" onClick={onClose} aria-label="Close story log" className="text-white/50 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex gap-1 border-b border-white/10 px-3 py-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
              filter === option.id ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {turns.length === 0 && <p className="text-xs italic text-white/40">ยังไม่มีรายการในหมวดนี้</p>}
        {turns.map(([turn, items]) => (
          <div key={turn} className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Turn {turn}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            {items.map((entry) => {
              const { icon: Icon, tone } = KIND_STYLE[entry.kind]
              return (
                <article key={entry.id} className="flex gap-2.5">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                  <div className="min-w-0">
                    <p className={`font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}>{entry.speaker}</p>
                    <p
                      className={`whitespace-pre-line break-words text-[13px] leading-relaxed ${
                        entry.kind === 'system' ? 'text-white/50' : entry.kind === 'roll' ? 'font-mono text-xs text-white/85' : 'text-white/90'
                      }`}
                    >
                      {entry.text}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
