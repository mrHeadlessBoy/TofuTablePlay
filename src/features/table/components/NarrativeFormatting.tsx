'use client'

import { useMemo, type ReactNode } from 'react'
import { Compass } from 'lucide-react'
import { buildPlayerColorMap, getPlayerNameColor, type Turn } from '../types'

const INLINE_TOKEN_REGEX =
  /(\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`|~~[^~\n]+?~~|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?HP:\s*[^)\n]+\)|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?(?:Skill\s*Cost|SP):\s*[^)\n]+\)|\((?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?[^():\n]{1,40}:\s*\d+\s*\/\s*\d+\s*(?:->|→|=>)\s*\d+\s*\/\s*\d+[^)\n]*\)|\[(?:d20[^\]]*|DC\s*\d+[^\]]*)\]|\[[^\]\n]{1,40}\])/gi

// Optional "Name —" / "Name:" prefix inside a status badge, e.g. "(Shacco — HP: 80/100)"
const BADGE_NAME_PREFIX = String.raw`(?:[^()\n—–\-:]{1,40}?\s*(?:—|–|-|:)\s*)?`

const BADGE_CLASS =
  'inline-flex items-center px-2 py-0.5 mx-1 rounded-md border font-mono font-semibold align-middle'

// Parenthesised / bracketed status tokens rendered as coloured badges, checked in this order
const STATUS_BADGE_RULES: { pattern: RegExp; className: string }[] = [
  {
    pattern: new RegExp(String.raw`^\(${BADGE_NAME_PREFIX}HP:\s*[^)\n]+\)$`, 'i'),
    className: 'bg-red-950/60 border-red-800/60 text-[0.75em] text-red-300',
  },
  {
    pattern: new RegExp(String.raw`^\(${BADGE_NAME_PREFIX}(?:Skill\s*Cost|SP):\s*[^)\n]+\)$`, 'i'),
    className: 'bg-cyan-950/60 border-cyan-800/60 text-[0.75em] text-cyan-300',
  },
  {
    // Any other resource change, e.g. "(Name — Sanity: 50/50 -> 42/50)"
    pattern: new RegExp(
      String.raw`^\(${BADGE_NAME_PREFIX}[^():\n]{1,40}:\s*\d+\s*\/\s*\d+\s*(?:->|→|=>)\s*\d+\s*\/\s*\d+[^)\n]*\)$`,
      'i',
    ),
    className: 'bg-violet-950/60 border-violet-800/60 text-[0.75em] text-violet-300',
  },
  {
    // Dice / DC checks, e.g. "[d20 + 3]" or "[DC 15]"
    pattern: /^\[(?:d20[^\]]*|DC\s*\d+[^\]]*)\]$/i,
    className: 'bg-amber-950/70 border-amber-700/60 text-[0.8em] text-amber-300',
  },
]

const BULLET_REGEX = /^[-*]\s+/
const SECTION_HEADER_REGEX = /^\s*(?:#+\s*)?(?:\*\*)?\[\s*(overview|decision)\s*\](?:\*\*)?\s*:?\s*$/i

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type NameHighlighting = {
  colorMap: ReadonlyMap<string, string>
  playerNamesRegex: RegExp | null
}

// Colour map for every name that appears bold or as a [Decision] bullet, plus a regex that finds party names in plain text
export function usePlayerNameHighlighting(playerNames: string[], turns: Turn[]): NameHighlighting {
  return useMemo(() => {
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
      new Set(playerNames.map((n) => n.trim()).filter((n) => n.length >= 2)),
    ).sort((a, b) => b.length - a.length)

    const regex =
      uniquePartyNames.length > 0
        ? new RegExp(`(${uniquePartyNames.map(escapeRegExp).join('|')})`, 'gi')
        : null

    return { colorMap: map, playerNamesRegex: regex }
  }, [playerNames, turns])
}

/* ------------------------------------------------------------------ */
/* Inline formatting                                                   */
/* ------------------------------------------------------------------ */

function renderPlainWithPlayerNames(
  text: string,
  colorMap: ReadonlyMap<string, string>,
  playerNamesRegex: RegExp | null,
  keyPrefix: number,
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

function isWrappedIn(part: string, marker: string): boolean {
  return part.startsWith(marker) && part.endsWith(marker) && part.length > marker.length * 2
}

// Inline Markdown (***bold italic***, **bold**, *italic*, `code`, ~~strike~~), status badges and coloured player names
function renderInlineFormattedText(
  text: string,
  { colorMap, playerNamesRegex }: NameHighlighting,
): ReactNode[] {
  const parts = text.split(INLINE_TOKEN_REGEX)
  return parts.map((part, index) => {
    if (!part) return null

    if (isWrappedIn(part, '***')) {
      const inner = part.slice(3, -3)
      return (
        <strong key={index} className={`font-bold italic ${getPlayerNameColor(inner, colorMap)}`}>
          {inner}
        </strong>
      )
    }

    if (isWrappedIn(part, '**')) {
      const inner = part.slice(2, -2)
      return (
        <strong key={index} className={`font-bold ${getPlayerNameColor(inner, colorMap)}`}>
          {inner}
        </strong>
      )
    }

    if (isWrappedIn(part, '*')) {
      return (
        <em key={index} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      )
    }

    if (isWrappedIn(part, '`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[0.85em] text-amber-300"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    if (isWrappedIn(part, '~~')) {
      return (
        <del key={index} className="line-through text-zinc-500">
          {part.slice(2, -2)}
        </del>
      )
    }

    const badgeRule = STATUS_BADGE_RULES.find((rule) => rule.pattern.test(part))
    if (badgeRule) {
      return (
        <span key={index} className={`${BADGE_CLASS} ${badgeRule.className}`}>
          {part.slice(1, -1)}
        </span>
      )
    }

    // Any other [bracketed] token is a name (e.g. "[Shacco]" in a Decision list)
    if (part.startsWith('[') && part.endsWith(']') && part.length > 2) {
      const inner = part.slice(1, -1).trim()
      return (
        <strong key={index} className={`font-bold ${getPlayerNameColor(inner, colorMap)}`}>
          {inner}
        </strong>
      )
    }

    return renderPlainWithPlayerNames(part, colorMap, playerNamesRegex, index)
  })
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

type NarrativeSection = {
  kind: 'narrative' | 'overview' | 'decision'
  lines: string[]
}

// Split the DM's reply on "[ Overview ]" / "[ Decision ]" header lines
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

type FormattedNarrativeOutputProps = NameHighlighting & { text: string }

export function FormattedNarrativeOutput({
  text,
  colorMap,
  playerNamesRegex,
}: FormattedNarrativeOutputProps) {
  const highlighting = { colorMap, playerNamesRegex }
  const sections = parseNarrativeSections(text)

  return (
    <div className="space-y-4">
      {sections.map((section, sIdx) => {
        if (section.kind === 'overview') {
          return <OverviewCard key={sIdx} lines={section.lines} highlighting={highlighting} />
        }
        if (section.kind === 'decision') {
          return <DecisionCard key={sIdx} lines={section.lines} highlighting={highlighting} />
        }
        return <NarrativeBlock key={sIdx} lines={section.lines} highlighting={highlighting} />
      })}
    </div>
  )
}

type SectionProps = {
  lines: string[]
  highlighting: NameHighlighting
}

function SectionHeading({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider pb-2 border-b ${className}`}
    >
      <Compass className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  )
}

// [ Overview ] — "Label : value" lines shown as a key/value list
function OverviewCard({ lines, highlighting }: SectionProps) {
  const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean)
  if (nonEmptyLines.length === 0) return null

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-2.5">
      <SectionHeading label="[ Overview ]" className="text-sky-400 border-zinc-800/80" />
      <div className="space-y-1.5 text-base leading-relaxed text-zinc-200">
        {nonEmptyLines.map((line, lIdx) => {
          const cleanLine = line.replace(BULLET_REGEX, '')
          const kvMatch = cleanLine.match(/^([^:：]{2,40}?)\s*[:：]\s*(.+)$/)
          if (kvMatch) {
            const label = kvMatch[1].replace(/^\*\*|\*\*$/g, '').trim()
            return (
              <div key={lIdx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 shrink-0">
                  {label} :
                </span>
                <span className="text-zinc-100">
                  {renderInlineFormattedText(kvMatch[2], highlighting)}
                </span>
              </div>
            )
          }
          return <div key={lIdx}>{renderInlineFormattedText(cleanLine, highlighting)}</div>
        })}
      </div>
    </div>
  )
}

// [ Decision ] — next-turn prompts, bullets get an amber dot
function DecisionCard({ lines, highlighting }: SectionProps) {
  const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean)
  if (nonEmptyLines.length === 0) return null

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2.5">
      <SectionHeading label="[ Decision ]" className="text-amber-400 border-amber-900/50" />
      <div className="space-y-2 text-base leading-relaxed text-zinc-200">
        {nonEmptyLines.map((line, lIdx) => {
          const isBullet = BULLET_REGEX.test(line)
          const content = isBullet ? line.replace(BULLET_REGEX, '') : line
          return (
            <div key={lIdx} className="flex items-start gap-2">
              {isBullet && <span className="text-amber-400 font-bold select-none mt-0.5">•</span>}
              <div className="flex-1">{renderInlineFormattedText(content, highlighting)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Story prose: blank lines, --- rules, # headings and - bullets
function NarrativeBlock({ lines, highlighting }: SectionProps) {
  return (
    <div className="text-2xl leading-relaxed text-zinc-200 space-y-2">
      {lines.map((line, lIdx) => {
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
              {renderInlineFormattedText(headingMatch[2], highlighting)}
            </h4>
          )
        }

        if (BULLET_REGEX.test(trimmed)) {
          return (
            <div key={lIdx} className="flex items-start gap-2.5 pl-2">
              <span className="text-amber-500 select-none">•</span>
              <div className="flex-1">
                {renderInlineFormattedText(trimmed.replace(BULLET_REGEX, ''), highlighting)}
              </div>
            </div>
          )
        }

        return <p key={lIdx}>{renderInlineFormattedText(line, highlighting)}</p>
      })}
    </div>
  )
}
