'use client'

import { useId, type ReactNode } from 'react'
import { getHpColorHex } from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  isColumnStatId,
  readCharacterTemplate,
  readCustomValues,
  type ResourceColor,
  type SheetCustomValues,
  type TemplateResource,
  type TemplateStat,
} from '@/features/character/template'
import type { Character } from '../types'

// Dial is drawn in a 200 x 200 viewBox centred on (100, 100)
const CX = 100
const CY = 100
const EMPTY_STROKE = '#52525b'
const MUTED_TEXT = '#71717a'

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeClockwiseArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const span = Math.max(0, Math.min(359.9, endDeg - startDeg))
  if (span < 0.5) return ''
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg + span)
  const largeArc = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function describeCounterClockwiseArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const span = Math.max(0, Math.min(359.9, startDeg - endDeg))
  if (span < 0.5) return ''
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg - span)
  const largeArc = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function describeSectorWedge(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startDeg)
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg)
  const innerEnd = polarToCartesian(cx, cy, innerR, endDeg)
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg)
  const span = Math.abs(endDeg - startDeg)
  const largeArc = span > 180 ? 1 : 0
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

/* ------------------------------------------------------------------ */
/* Resource & stat resolution                                          */
/* ------------------------------------------------------------------ */

export function getSaoHpStroke(ratio: number): string {
  return getHpColorHex(ratio)
}

const RESOURCE_STROKE_HEX: Record<ResourceColor, string> = {
  red: '#ef4444',
  amber: '#fbbf24',
  cyan: '#38bdf8',
  emerald: '#34d399',
  violet: '#a855f7',
  rose: '#fb7185',
  sky: '#38bdf8',
  zinc: '#a1a1aa',
}

function formatShortResourceLabel(res: TemplateResource): string {
  if (res.id === 'hp' && /^hit\s*points/i.test(res.label)) return 'HP'
  if (res.id === 'skill_cost' && /^skill\s*cost$/i.test(res.label)) return 'SKILL PT'
  const base = res.label.split(/[（(]/)[0].trim() || res.label.trim() || res.id
  return base.toUpperCase().slice(0, 10)
}

function formatShortStatLabel(stat: TemplateStat, maxChars: number): string {
  if (isColumnStatId(stat.id)) return stat.id.slice(0, maxChars)
  const base = (stat.label || stat.id).split(/[（(]/)[0].trim() || stat.label || stat.id
  return base.toUpperCase().slice(0, maxChars)
}

type ResolvedDialResource = {
  id: string
  arcLabel: string
  current: number
  max: number
  ratio: number
  strokeColor: string
  wedgeFill: string
}

function resolveDialResource(
  res: TemplateResource,
  activeChar: Character | null | undefined,
  currentSkillCost: number,
  maxSkillCost: number,
  customValues: SheetCustomValues,
): ResolvedDialResource {
  if (res.id === 'hp') {
    const current = activeChar ? (activeChar.current_hp ?? res.defaultMax) : 0
    const max = Math.max(1, activeChar ? (activeChar.max_hp ?? res.defaultMax) : res.defaultMax || 1)
    const ratio = activeChar ? Math.max(0, Math.min(1, current / max)) : 0
    const strokeColor = activeChar ? getSaoHpStroke(ratio) : EMPTY_STROKE
    return {
      id: res.id,
      arcLabel: formatShortResourceLabel(res),
      current,
      max: activeChar ? (activeChar.max_hp ?? res.defaultMax) : res.defaultMax,
      ratio,
      strokeColor,
      wedgeFill: 'rgba(74,222,128,0.045)',
    }
  }

  if (res.id === 'skill_cost') {
    const current = activeChar ? currentSkillCost : 0
    const rawMax = activeChar ? maxSkillCost : res.defaultMax
    const max = Math.max(1, rawMax || 1)
    const ratio = activeChar && rawMax > 0 ? Math.max(0, Math.min(1, current / max)) : 0
    const strokeColor = activeChar ? (RESOURCE_STROKE_HEX[res.color] ?? '#38bdf8') : EMPTY_STROKE
    return {
      id: res.id,
      arcLabel: formatShortResourceLabel(res),
      current,
      max: rawMax,
      ratio,
      strokeColor,
      wedgeFill: 'rgba(56,189,248,0.045)',
    }
  }

  const stored = customValues.resources[res.id] ?? { current: res.defaultMax, max: res.defaultMax }
  const current = activeChar ? stored.current : 0
  const rawMax = activeChar ? stored.max : res.defaultMax
  const max = Math.max(1, rawMax || 1)
  const ratio = activeChar && rawMax > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  const strokeColor = activeChar ? (RESOURCE_STROKE_HEX[res.color] ?? '#a855f7') : EMPTY_STROKE
  return {
    id: res.id,
    arcLabel: formatShortResourceLabel(res),
    current,
    max: rawMax,
    ratio,
    strokeColor,
    wedgeFill: 'rgba(168,85,247,0.045)',
  }
}

/* ------------------------------------------------------------------ */
/* Dial                                                                */
/* ------------------------------------------------------------------ */

export type SaoDualSemicircleDialProps = {
  activeChar: Character | null | undefined
  currentSkillCost: number
  maxSkillCost: number
  isOpen?: boolean
  variant: 'orb' | 'crest'
}

/**
 * 2-Part Semicircle SAO HUD Dial:
 * - Upper Semicircle (ด้านบน): Dynamic template resource gauges + concentric curved SVG <textPath> readouts
 * - Lower Semicircle (ด้านล่าง): Dynamic template stats (supports < 6, = 6, or > 6 stats via adaptive sectors / dual rings)
 */
export function SaoDualSemicircleDial({
  activeChar,
  currentSkillCost,
  maxSkillCost,
  isOpen = false,
  variant,
}: SaoDualSemicircleDialProps) {
  const uid = useId().replace(/:/g, '')
  const idFor = (name: string) => `${name}-${variant}-${uid}`

  const activeTemplate = activeChar ? readCharacterTemplate(activeChar) : CLASSIC_TEMPLATE
  const customValues = activeChar
    ? readCustomValues(activeChar)
    : { stats: {}, resources: {}, fields: {}, equipment: {} }

  const resources = activeTemplate.resources.map((res) =>
    resolveDialResource(res, activeChar, currentSkillCost, maxSkillCost, customValues),
  )

  const dialStats = activeChar ? activeTemplate.stats : CLASSIC_TEMPLATE.stats
  const splitBarStroke = isOpen ? '#fbbf24' : 'rgba(255,255,255,0.6)'
  const ids = {
    coreGrad: idFor('saoCore'),
    glowFilter: idFor('saoGlow'),
    hpLabel: idFor('hpLabelArc'),
    hpValue: idFor('hpValueArc'),
    spLabel: idFor('spLabelArc'),
    spValue: idFor('spValueArc'),
    fullLabel: idFor('fullLabelArc'),
    fullValue: idFor('fullValueArc'),
  }

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full select-none overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={ids.coreGrad} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isOpen ? '#291d09' : '#18181b'} stopOpacity="0.97" />
          <stop offset="100%" stopColor="#09090b" stopOpacity="0.99" />
        </radialGradient>
        <filter id={ids.glowFilter} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Curved guide paths for Upper Semicircle resource readouts */}
        <path id={ids.hpLabel} d={describeClockwiseArc(CX, CY, 65, 184, 266)} fill="none" />
        <path id={ids.hpValue} d={describeClockwiseArc(CX, CY, 48, 184, 266)} fill="none" />
        <path id={ids.spLabel} d={describeClockwiseArc(CX, CY, 65, 274, 356)} fill="none" />
        <path id={ids.spValue} d={describeClockwiseArc(CX, CY, 48, 274, 356)} fill="none" />
        <path id={ids.fullLabel} d={describeClockwiseArc(CX, CY, 65, 184, 356)} fill="none" />
        <path id={ids.fullValue} d={describeClockwiseArc(CX, CY, 48, 184, 356)} fill="none" />
      </defs>

      {/* Main Circular Backdrop */}
      <circle
        cx={CX}
        cy={CY}
        r={94.5}
        fill={`url(#${ids.coreGrad})`}
        stroke={isOpen ? '#f59e0b' : 'rgba(255,255,255,0.32)'}
        strokeWidth={isOpen ? 2.4 : 1.8}
      />

      {/* Outer SAO Tech Dashed Ring */}
      <circle
        cx={CX}
        cy={CY}
        r={98}
        fill="none"
        stroke={isOpen ? 'rgba(251,191,36,0.85)' : 'rgba(245,158,11,0.42)'}
        strokeWidth="1.2"
        strokeDasharray="12 5 2.5 5"
      />

      {/* ================= UPPER SEMICIRCLE: Dynamic Template Resources ================= */}
      <UpperResourceArcs
        resources={resources}
        hasCharacter={Boolean(activeChar)}
        ids={ids}
      />

      {/* Horizontal Split Bar separating Upper Semicircle & Lower Semicircle */}
      <line x1={7} y1={100} x2={63} y2={100} stroke={splitBarStroke} strokeWidth="2" />
      <line x1={137} y1={100} x2={193} y2={100} stroke={splitBarStroke} strokeWidth="2" />

      {/* ================= LOWER SEMICIRCLE: Dynamic Template Stats ================= */}
      <LowerStatRings
        stats={dialStats}
        activeChar={activeChar}
        customValues={customValues}
        isOpen={isOpen}
      />

      {/* ================= CENTER SAO EMBLEM CORE ================= */}
      <DialCore activeChar={activeChar} isOpen={isOpen} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Upper semicircle                                                    */
/* ------------------------------------------------------------------ */

type DialIds = Record<
  'coreGrad' | 'glowFilter' | 'hpLabel' | 'hpValue' | 'spLabel' | 'spValue' | 'fullLabel' | 'fullValue',
  string
>

// Single resource → one full upper arc; two or more → left (resource #1) and right (resource #2) arcs
function UpperResourceArcs({
  resources,
  hasCharacter,
  ids,
}: {
  resources: ResolvedDialResource[]
  hasCharacter: boolean
  ids: DialIds
}) {
  const leftRes = resources[0] ?? null
  const rightRes = resources[1] ?? null

  // Upper Semicircle gauge arcs (r = 84):
  // Single-resource full upper arc (184° -> 356°), or Dual left (184° -> 266°) & right (356° -> 274°)
  const fullUpperTrackPath = describeClockwiseArc(CX, CY, 84, 184, 356)
  const leftTrackPath = describeClockwiseArc(CX, CY, 84, 184, 266)
  const rightTrackPath = describeCounterClockwiseArc(CX, CY, 84, 356, 274)

  const valueText = (res: ResolvedDialResource | null) =>
    hasCharacter && res ? `${res.current}/${res.max}` : '--/--'
  const valueFill = (res: ResolvedDialResource | null) =>
    hasCharacter && res ? res.strokeColor : MUTED_TEXT

  let arcs: ReactNode
  if (resources.length === 0) {
    arcs = (
      <>
        <path
          d={fullUpperTrackPath}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="8.5"
          strokeLinecap="round"
        />
        <ArcText
          pathId={ids.fullLabel}
          fill={MUTED_TEXT}
          fontSize="8.5"
          fontWeight="800"
          letterSpacing="0.14em"
        >
          NO RESOURCE
        </ArcText>
      </>
    )
  } else if (resources.length === 1 && leftRes) {
    arcs = (
      <>
        <path d={describeSectorWedge(CX, CY, 40, 76, 184, 356)} fill={leftRes.wedgeFill} />
        <ArcGauge d={fullUpperTrackPath} resource={leftRes} glowFilterId={ids.glowFilter} />
        <ArcText pathId={ids.fullLabel} fill="#d4d4d8" fontSize="8.8" fontWeight="800" letterSpacing="0.14em">
          {leftRes.arcLabel}
        </ArcText>
        <ArcValueText pathId={ids.fullValue} fill={valueFill(leftRes)}>
          {valueText(leftRes)}
        </ArcValueText>
      </>
    )
  } else {
    arcs = (
      <>
        {/* Upper subtle quadrant wedges */}
        <path
          d={describeSectorWedge(CX, CY, 40, 76, 183, 268)}
          fill={leftRes?.wedgeFill ?? 'rgba(74,222,128,0.045)'}
        />
        <path
          d={describeSectorWedge(CX, CY, 40, 76, 272, 357)}
          fill={rightRes?.wedgeFill ?? 'rgba(56,189,248,0.045)'}
        />

        {/* Top vertical split tick between Resource #1 (left) and Resource #2 (right) */}
        <line x1={100} y1={10} x2={100} y2={58} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* Resource #1 / #2 Track & Active Gauge (Upper-Left / Upper-Right) */}
        <ArcGauge d={leftTrackPath} resource={leftRes} glowFilterId={ids.glowFilter} />
        <ArcGauge d={rightTrackPath} resource={rightRes} glowFilterId={ids.glowFilter} />

        {/* Curved Resource #1 Text Readout (Upper-Left) */}
        <ArcText pathId={ids.hpLabel} fill="#d4d4d8" fontSize="8.8" fontWeight="800" letterSpacing="0.14em">
          {leftRes?.arcLabel ?? 'HP'}
        </ArcText>
        <ArcValueText pathId={ids.hpValue} fill={valueFill(leftRes)}>
          {valueText(leftRes)}
        </ArcValueText>

        {/* Curved Resource #2 Text Readout (Upper-Right) */}
        <ArcText pathId={ids.spLabel} fill="#d4d4d8" fontSize="8.5" fontWeight="800" letterSpacing="0.1em">
          {rightRes?.arcLabel ?? 'SKILL PT'}
        </ArcText>
        <ArcValueText pathId={ids.spValue} fill={valueFill(rightRes)}>
          {valueText(rightRes)}
        </ArcValueText>
      </>
    )
  }

  return (
    <>
      {/* Upper inner guide arc */}
      <path
        d={describeClockwiseArc(CX, CY, 40, 184, 356)}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
      />
      {arcs}
    </>
  )
}

// Grey track plus the coloured, glowing fill for how full the resource is
function ArcGauge({
  d,
  resource,
  glowFilterId,
}: {
  d: string
  resource: ResolvedDialResource | null
  glowFilterId: string
}) {
  return (
    <>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8.5" strokeLinecap="round" />
      {resource && resource.ratio > 0 && (
        <path
          d={d}
          fill="none"
          stroke={resource.strokeColor}
          strokeWidth="8.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={(1 - resource.ratio) * 100}
          filter={`url(#${glowFilterId})`}
        />
      )}
    </>
  )
}

// Monospace text centred along one of the curved guide paths in <defs>
function ArcText({
  pathId,
  fill,
  fontSize,
  fontWeight,
  letterSpacing,
  children,
}: {
  pathId: string
  fill: string
  fontSize: string
  fontWeight: string
  letterSpacing: string
  children: ReactNode
}) {
  return (
    <text
      fill={fill}
      fontSize={fontSize}
      fontFamily="monospace"
      fontWeight={fontWeight}
      letterSpacing={letterSpacing}
      textAnchor="middle"
    >
      <textPath href={`#${pathId}`} startOffset="50%">
        {children}
      </textPath>
    </text>
  )
}

function ArcValueText({ pathId, fill, children }: { pathId: string; fill: string; children: ReactNode }) {
  return (
    <ArcText pathId={pathId} fill={fill} fontSize="12.5" fontWeight="900" letterSpacing="0.04em">
      {children}
    </ArcText>
  )
}

/* ------------------------------------------------------------------ */
/* Lower semicircle                                                    */
/* ------------------------------------------------------------------ */

type StatRingContext = {
  activeChar: Character | null | undefined
  customValues: SheetCustomValues
  isOpen: boolean
}

// More than 8 stats are split over two concentric rings
function LowerStatRings({ stats, ...ctx }: StatRingContext & { stats: readonly TemplateStat[] }) {
  const totalStats = stats.length
  const useTwoStatRings = totalStats > 8
  const splitAt = Math.ceil(totalStats / 2)

  let rings: ReactNode
  if (totalStats === 0) {
    rings = (
      <text
        x={CX}
        y={CY + 66}
        textAnchor="middle"
        fill={MUTED_TEXT}
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="800"
        letterSpacing="0.12em"
      >
        NO STATS
      </text>
    )
  } else if (useTwoStatRings) {
    rings = (
      <>
        <StatRing
          {...ctx}
          ringStats={stats.slice(0, splitAt)}
          isCompactRings
          ringKey="outer"
          innerR={64.5}
          outerR={89}
          labelR={71}
          valR={82.5}
        />
        <StatRing
          {...ctx}
          ringStats={stats.slice(splitAt)}
          isCompactRings
          ringKey="inner"
          innerR={40}
          outerR={64.5}
          labelR={46.5}
          valR={57.5}
        />
        <path
          d={describeClockwiseArc(CX, CY, 64.5, 3.5, 176.5)}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
      </>
    )
  } else {
    rings = (
      <StatRing
        {...ctx}
        ringStats={stats}
        isCompactRings={false}
        ringKey="single"
        innerR={40}
        outerR={89}
        labelR={55}
        valR={74.5}
      />
    )
  }

  return (
    <>
      {rings}
      {/* Lower Semicircle outer frame: 3° -> 177° (174° sweep along bottom for the Stats) */}
      <path
        d={describeClockwiseArc(CX, CY, 89, 3, 177)}
        fill="none"
        stroke={ctx.isOpen ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.42)'}
        strokeWidth="2.2"
      />
      <path
        d={describeClockwiseArc(CX, CY, 40, 4, 176)}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
      />
    </>
  )
}

function StatRing({
  ringStats,
  isCompactRings,
  ringKey,
  innerR,
  outerR,
  labelR,
  valR,
  activeChar,
  customValues,
  isOpen,
}: StatRingContext & {
  ringStats: readonly TemplateStat[]
  isCompactRings: boolean
  ringKey: string
  innerR: number
  outerR: number
  labelR: number
  valR: number
}) {
  const count = ringStats.length
  if (count === 0) return null

  const spanDeg = 174 / count
  const dividerAngles = Array.from({ length: Math.max(0, count - 1) }, (_, idx) => 177 - (idx + 1) * spanDeg)
  const isCompactRing = isCompactRings || count >= 7
  const labelFontSize = isCompactRings ? '6.4' : count <= 4 ? '9' : count <= 6 ? '8.5' : '7.2'
  const valFontSize = isCompactRings ? '9.2' : count <= 4 ? '13' : count <= 6 ? '12.5' : '10.2'
  const maxLabelChars = count <= 4 ? 6 : isCompactRing ? 3 : 4

  return (
    <g>
      {ringStats.map((stat, idx) => {
        const endDeg = 177 - idx * spanDeg
        const startDeg = endDeg - spanDeg
        return (
          <path
            key={`wedge-${ringKey}-${stat.id}`}
            d={describeSectorWedge(CX, CY, innerR, outerR, startDeg, endDeg)}
            fill={idx % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(245,158,11,0.045)'}
          />
        )
      })}

      {dividerAngles.map((deg) => {
        const innerPt = polarToCartesian(CX, CY, innerR, deg)
        const outerPt = polarToCartesian(CX, CY, outerR, deg)
        return (
          <line
            key={`div-${ringKey}-${deg}`}
            x1={innerPt.x}
            y1={innerPt.y}
            x2={outerPt.x}
            y2={outerPt.y}
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="1.2"
          />
        )
      })}

      {ringStats.map((stat, idx) => {
        const centerDeg = 177 - (idx * spanDeg + spanDeg / 2)
        const labelPos = polarToCartesian(CX, CY, labelR, centerDeg)
        const valPos = polarToCartesian(CX, CY, valR, centerDeg)
        const rawScore = activeChar
          ? isColumnStatId(stat.id)
            ? (activeChar.stats?.[stat.id] ?? stat.default)
            : (customValues.stats[stat.id] ?? activeChar.stats?.[stat.id] ?? stat.default)
          : '--'

        return (
          <g key={`stat-${ringKey}-${stat.id}`}>
            <text
              x={labelPos.x}
              y={labelPos.y + (isCompactRings ? 2.2 : 3)}
              textAnchor="middle"
              fill="#d4d4d8"
              fontSize={labelFontSize}
              fontFamily="monospace"
              fontWeight="800"
            >
              {formatShortStatLabel(stat, maxLabelChars)}
            </text>
            <text
              x={valPos.x}
              y={valPos.y + (isCompactRings ? 3 : 4)}
              textAnchor="middle"
              fill={isOpen ? '#fde68a' : '#ffffff'}
              fontSize={valFontSize}
              fontFamily="monospace"
              fontWeight="900"
            >
              {String(rawScore)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Centre emblem                                                       */
/* ------------------------------------------------------------------ */

function DialCore({ activeChar, isOpen }: { activeChar: Character | null | undefined; isOpen: boolean }) {
  const shortName = activeChar?.name
    ? activeChar.name.length > 10
      ? `${activeChar.name.slice(0, 9)}…`
      : activeChar.name
    : 'BIND'
  const hasCondition =
    !activeChar || Boolean(activeChar.status_condition && activeChar.status_condition !== 'Normal')

  return (
    <>
      <circle
        cx={CX}
        cy={CY}
        r={35.5}
        fill={isOpen ? '#f59e0b' : '#18181b'}
        fillOpacity={isOpen ? 0.22 : 0.96}
        stroke={isOpen ? '#fbbf24' : 'rgba(245,158,11,0.75)'}
        strokeWidth="2.2"
      />
      <circle
        cx={CX}
        cy={CY}
        r={30.5}
        fill="none"
        stroke={isOpen ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)'}
        strokeWidth="1"
      />
      <text
        x={CX}
        y={CY - 2}
        textAnchor="middle"
        fill={isOpen ? '#fde68a' : '#ffffff'}
        fontSize="10.5"
        fontWeight="800"
        letterSpacing="0.04em"
      >
        {shortName}
      </text>
      <text
        x={CX}
        y={CY + 11}
        textAnchor="middle"
        fill={hasCondition ? '#fbbf24' : '#a1a1aa'}
        fontSize="8"
        fontFamily="monospace"
        fontWeight="700"
      >
        {!activeChar ? 'SELECT' : (activeChar.status_condition || 'NORMAL').toUpperCase().slice(0, 9)}
      </text>
    </>
  )
}
