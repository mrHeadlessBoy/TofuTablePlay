'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'

type DialogueBoxProps = {
  speaker: string
  pages: string[]
  /** Shown while the Dungeon Master is still writing. */
  busy?: boolean
  onOpenLog: () => void
}

const TYPE_INTERVAL_MS = 26

/** Split by grapheme so Thai vowels and tone marks never appear half-typed. */
function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (part) => part.segment)
  }
  return Array.from(text)
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.isContentEditable
}

/**
 * Retro text box for the narration: one page at a time, typed out letter by letter.
 * Click the box (or press Space / Enter) to finish the page, then to turn it.
 * The parent remounts it with a new `key` whenever a new narration arrives.
 */
export default function DialogueBox({ speaker, pages, busy = false, onOpenLog }: DialogueBoxProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [shown, setShown] = useState(0)

  const page = pages[Math.min(pageIndex, pages.length - 1)] ?? ''
  const graphemes = useMemo(() => splitGraphemes(page), [page])
  const typing = shown < graphemes.length
  const isLastPage = pageIndex >= pages.length - 1

  useEffect(() => {
    if (!typing) return
    const timer = window.setInterval(() => setShown((count) => count + 1), TYPE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [typing, pageIndex])

  const advance = useCallback(() => {
    if (busy) return
    if (typing) {
      setShown(graphemes.length)
    } else if (!isLastPage) {
      setPageIndex((index) => index + 1)
      setShown(0)
    }
  }, [busy, typing, isLastPage, graphemes.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      advance()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance])

  return (
    <div className="relative select-none">
      <div className="absolute -top-3 left-4 z-10 flex items-center gap-2">
        <span className="bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
          {speaker}
        </span>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpenLog()
        }}
        className="absolute -top-3 right-4 z-10 flex items-center gap-1.5 border-2 border-white bg-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 hover:bg-white hover:text-black"
      >
        <ScrollText className="h-3 w-3" /> Log
      </button>

      <div
        role="button"
        tabIndex={0}
        aria-label="Advance narration"
        onClick={advance}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            advance()
          }
        }}
        className="h-[8.25rem] cursor-pointer overflow-y-auto border-[3px] border-white bg-black/90 px-6 pb-4 pt-5 font-mono text-[15px] leading-7 text-white outline-none focus-visible:border-amber-300"
      >
        {busy ? (
          <p className="flex gap-3 text-white/70">
            <span>*</span>
            <span className="animate-pulse">Dungeon Master กำลังเล่าเรื่อง . . .</span>
          </p>
        ) : (
          <p className="flex gap-3 whitespace-pre-wrap">
            <span>*</span>
            <span>{graphemes.slice(0, shown).join('')}</span>
          </p>
        )}
      </div>

      {!busy && (
        <div className="pointer-events-none absolute bottom-2 right-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
          {pages.length > 1 && (
            <span>
              {Math.min(pageIndex + 1, pages.length)} / {pages.length}
            </span>
          )}
          {!typing && !isLastPage && <span className="animate-bounce text-sm leading-none text-white">▼</span>}
          {!typing && isLastPage && <span className="text-white/40">■</span>}
        </div>
      )}
    </div>
  )
}
