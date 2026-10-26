'use client'

import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
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

export const SAO_ORB_SCALE_STORAGE_KEY = 'dnd_sao_orb_scale'
export const DEFAULT_ORB_SCALE_PERCENT = 100
export const MIN_ORB_SCALE_PERCENT = 50
export const MAX_ORB_SCALE_PERCENT = 150
export const ORB_SCALE_STEP_PERCENT = 10

// Desktop default at 100% is 280px (80% calibrated baseline), scaling down responsively on tablet & mobile
export function getResponsiveBaseOrbPx(viewportWidth: number): number {
  if (viewportWidth < 640) return 154 // Mobile default (~80% of 192px)
  if (viewportWidth < 1024) return 205 // Tablet default (~80% of 256px)
  return 280 // Desktop default (280px = ~80% of original 352px)
}

export function computeEffectiveOrbPx(
  scalePercent: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const basePx = getResponsiveBaseOrbPx(viewportWidth)
  const rawPx = Math.round((basePx * scalePercent) / 100)
  const maxSafePx = Math.max(140, Math.min(viewportWidth - 32, viewportHeight - 96))
  return Math.min(rawPx, maxSafePx)
}

// Subtle SAO-inspired crystalline UI chime using Web Audio API (zero external asset overhead)
let saoAudioCtx: AudioContext | null = null
export function playSaoChime(opening: boolean) {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!saoAudioCtx) saoAudioCtx = new AudioContextClass()
    if (saoAudioCtx.state === 'suspended') void saoAudioCtx.resume()

    const now = saoAudioCtx.currentTime
    const notes = opening ? [1318.51, 1975.53] : [1318.51, 987.77] // E6->B6 open, E6->B5 close
    notes.forEach((freq, idx) => {
      if (!saoAudioCtx) return
      const osc = saoAudioCtx.createOscillator()
      const gain = saoAudioCtx.createGain()
      osc.type = 'sine'
      const start = now + idx * 0.055
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.045, start)
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.18)
      osc.connect(gain)
      gain.connect(saoAudioCtx.destination)
      osc.start(start)
      osc.stop(start + 0.19)
    })
  } catch {
    // Ignore if audio context is blocked
  }
}

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
  endDeg: number
): string {
  const span = Math.max(0, Math.min(359.9, endDeg - startDeg))
  if (span < 0.5) return ''
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg + span)
  const largeArc = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function describeSectorWedge(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
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

function describeCounterClockwiseArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const span = Math.max(0, Math.min(359.9, startDeg - endDeg))
  if (span < 0.5) return ''
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, startDeg - span)
  const largeArc = span > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

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
  customValues: SheetCustomValues
): ResolvedDialResource {
  if (res.id === 'hp') {
    const current = activeChar ? (activeChar.current_hp ?? res.defaultMax) : 0
    const max = Math.max(1, activeChar ? (activeChar.max_hp ?? res.defaultMax) : res.defaultMax || 1)
    const ratio = activeChar ? Math.max(0, Math.min(1, current / max)) : 0
    const strokeColor = activeChar ? getSaoHpStroke(ratio) : '#52525b'
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
    const strokeColor = activeChar ? (RESOURCE_STROKE_HEX[res.color] ?? '#38bdf8') : '#52525b'
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
  const strokeColor = activeChar ? (RESOURCE_STROKE_HEX[res.color] ?? '#a855f7') : '#52525b'
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
  const cx = 100
  const cy = 100

  const activeTemplate = activeChar ? readCharacterTemplate(activeChar) : CLASSIC_TEMPLATE
  const customValues = activeChar
    ? readCustomValues(activeChar)
    : { stats: {}, resources: {}, fields: {}, equipment: {} }

  const resolvedResources = activeTemplate.resources.map((res) =>
    resolveDialResource(res, activeChar, currentSkillCost, maxSkillCost, customValues)
  )
  const leftRes = resolvedResources[0] ?? null
  const rightRes = resolvedResources[1] ?? null
  const isSingleResource = resolvedResources.length === 1

  const dialStats = activeChar ? activeTemplate.stats : CLASSIC_TEMPLATE.stats
  const totalStats = dialStats.length
  const useTwoStatRings = totalStats > 8

  const outerRingStats = useTwoStatRings
    ? dialStats.slice(0, Math.ceil(totalStats / 2))
    : dialStats
  const innerRingStats = useTwoStatRings ? dialStats.slice(Math.ceil(totalStats / 2)) : []

  // Upper Semicircle gauge arcs (r = 84):
  // Single-resource full upper arc (184° -> 356°), or Dual left (184° -> 266°) & right (356° -> 274°)
  const fullUpperTrackPath = describeClockwiseArc(cx, cy, 84, 184, 356)
  const fullUpperLabelArcPath = describeClockwiseArc(cx, cy, 65, 184, 356)
  const fullUpperValueArcPath = describeClockwiseArc(cx, cy, 48, 184, 356)

  const hpTrackPath = describeClockwiseArc(cx, cy, 84, 184, 266)
  const spTrackPath = describeCounterClockwiseArc(cx, cy, 84, 356, 274)

  const hpLabelArcPath = describeClockwiseArc(cx, cy, 65, 184, 266)
  const hpValueArcPath = describeClockwiseArc(cx, cy, 48, 184, 266)
  const spLabelArcPath = describeClockwiseArc(cx, cy, 65, 274, 356)
  const spValueArcPath = describeClockwiseArc(cx, cy, 48, 274, 356)

  // Lower Semicircle outer frame: 3° -> 177° (174° sweep along bottom for the Stats)
  const lowerOuterArc = describeClockwiseArc(cx, cy, 89, 3, 177)
  const lowerMidArc = describeClockwiseArc(cx, cy, 64.5, 3.5, 176.5)
  const lowerInnerArc = describeClockwiseArc(cx, cy, 40, 4, 176)

  const shortName = activeChar?.name
    ? activeChar.name.length > 10
      ? `${activeChar.name.slice(0, 9)}…`
      : activeChar.name
    : 'BIND'

  const coreGradId = `saoCore-${variant}-${uid}`
  const glowFilterId = `saoGlow-${variant}-${uid}`
  const hpLabelPathId = `hpLabelArc-${variant}-${uid}`
  const hpValuePathId = `hpValueArc-${variant}-${uid}`
  const spLabelPathId = `spLabelArc-${variant}-${uid}`
  const spValuePathId = `spValueArc-${variant}-${uid}`
  const fullLabelPathId = `fullLabelArc-${variant}-${uid}`
  const fullValuePathId = `fullValueArc-${variant}-${uid}`

  const renderStatRing = (
    ringStats: TemplateStat[],
    innerR: number,
    outerR: number,
    labelR: number,
    valR: number,
    ringKey: string
  ) => {
    const count = ringStats.length
    if (count === 0) return null
    const spanDeg = 174 / count
    const dividerAngles = Array.from({ length: Math.max(0, count - 1) }, (_, idx) =>
      177 - (idx + 1) * spanDeg
    )
    const isCompactRing = useTwoStatRings || count >= 7
    const labelFontSize = useTwoStatRings ? '6.4' : count <= 4 ? '9' : count <= 6 ? '8.5' : '7.2'
    const valFontSize = useTwoStatRings ? '9.2' : count <= 4 ? '13' : count <= 6 ? '12.5' : '10.2'
    const maxLabelChars = count <= 4 ? 6 : isCompactRing ? 3 : 4

    return (
      <g key={ringKey}>
        {ringStats.map((stat, idx) => {
          const endDeg = 177 - idx * spanDeg
          const startDeg = endDeg - spanDeg
          return (
            <path
              key={`wedge-${ringKey}-${stat.id}`}
              d={describeSectorWedge(cx, cy, innerR, outerR, startDeg, endDeg)}
              fill={idx % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(245,158,11,0.045)'}
            />
          )
        })}

        {dividerAngles.map((deg) => {
          const innerPt = polarToCartesian(cx, cy, innerR, deg)
          const outerPt = polarToCartesian(cx, cy, outerR, deg)
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
          const labelPos = polarToCartesian(cx, cy, labelR, centerDeg)
          const valPos = polarToCartesian(cx, cy, valR, centerDeg)
          const rawScore = activeChar
            ? isColumnStatId(stat.id)
              ? (activeChar.stats?.[stat.id] ?? stat.default)
              : (customValues.stats[stat.id] ?? activeChar.stats?.[stat.id] ?? stat.default)
            : '--'
          const shortStatLabel = formatShortStatLabel(stat, maxLabelChars)

          return (
            <g key={`stat-${ringKey}-${stat.id}`}>
              <text
                x={labelPos.x}
                y={labelPos.y + (useTwoStatRings ? 2.2 : 3)}
                textAnchor="middle"
                fill="#d4d4d8"
                fontSize={labelFontSize}
                fontFamily="monospace"
                fontWeight="800"
              >
                {shortStatLabel}
              </text>
              <text
                x={valPos.x}
                y={valPos.y + (useTwoStatRings ? 3 : 4)}
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

  return (
    <svg
      viewBox="0 0 200 200"
      className="w-full h-full select-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={coreGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isOpen ? '#291d09' : '#18181b'} stopOpacity="0.97" />
          <stop offset="100%" stopColor="#09090b" stopOpacity="0.99" />
        </radialGradient>
        <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Curved guide paths for Upper Semicircle resource readouts */}
        <path id={hpLabelPathId} d={hpLabelArcPath} fill="none" />
        <path id={hpValuePathId} d={hpValueArcPath} fill="none" />
        <path id={spLabelPathId} d={spLabelArcPath} fill="none" />
        <path id={spValuePathId} d={spValueArcPath} fill="none" />
        <path id={fullLabelPathId} d={fullUpperLabelArcPath} fill="none" />
        <path id={fullValuePathId} d={fullUpperValueArcPath} fill="none" />
      </defs>

      {/* Main Circular Backdrop */}
      <circle
        cx={cx}
        cy={cy}
        r={94.5}
        fill={`url(#${coreGradId})`}
        stroke={isOpen ? '#f59e0b' : 'rgba(255,255,255,0.32)'}
        strokeWidth={isOpen ? 2.4 : 1.8}
      />

      {/* Outer SAO Tech Dashed Ring */}
      <circle
        cx={cx}
        cy={cy}
        r={98}
        fill="none"
        stroke={isOpen ? 'rgba(251,191,36,0.85)' : 'rgba(245,158,11,0.42)'}
        strokeWidth="1.2"
        strokeDasharray="12 5 2.5 5"
      />

      {/* ================= UPPER SEMICIRCLE: Dynamic Template Resources ================= */}
      {/* Upper inner guide arc */}
      <path
        d={describeClockwiseArc(cx, cy, 40, 184, 356)}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
      />

      {resolvedResources.length === 0 ? (
        <>
          <path
            d={fullUpperTrackPath}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          <text
            fill="#71717a"
            fontSize="8.5"
            fontFamily="monospace"
            fontWeight="800"
            letterSpacing="0.14em"
            textAnchor="middle"
          >
            <textPath href={`#${fullLabelPathId}`} startOffset="50%">
              NO RESOURCE
            </textPath>
          </text>
        </>
      ) : isSingleResource && leftRes ? (
        <>
          <path
            d={describeSectorWedge(cx, cy, 40, 76, 184, 356)}
            fill={leftRes.wedgeFill}
          />
          <path
            d={fullUpperTrackPath}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          {leftRes.ratio > 0 && (
            <path
              d={fullUpperTrackPath}
              fill="none"
              stroke={leftRes.strokeColor}
              strokeWidth="8.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={(1 - leftRes.ratio) * 100}
              filter={`url(#${glowFilterId})`}
            />
          )}
          <text
            fill="#d4d4d8"
            fontSize="8.8"
            fontFamily="monospace"
            fontWeight="800"
            letterSpacing="0.14em"
            textAnchor="middle"
          >
            <textPath href={`#${fullLabelPathId}`} startOffset="50%">
              {leftRes.arcLabel}
            </textPath>
          </text>
          <text
            fill={activeChar ? leftRes.strokeColor : '#71717a'}
            fontSize="12.5"
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="0.04em"
            textAnchor="middle"
          >
            <textPath href={`#${fullValuePathId}`} startOffset="50%">
              {activeChar ? `${leftRes.current}/${leftRes.max}` : '--/--'}
            </textPath>
          </text>
        </>
      ) : (
        <>
          {/* Upper subtle quadrant wedges */}
          <path
            d={describeSectorWedge(cx, cy, 40, 76, 183, 268)}
            fill={leftRes?.wedgeFill ?? 'rgba(74,222,128,0.045)'}
          />
          <path
            d={describeSectorWedge(cx, cy, 40, 76, 272, 357)}
            fill={rightRes?.wedgeFill ?? 'rgba(56,189,248,0.045)'}
          />

          {/* Top vertical split tick between Resource #1 (left) and Resource #2 (right) */}
          <line
            x1={100}
            y1={10}
            x2={100}
            y2={58}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
          />

          {/* Resource #1 Track & Active Gauge (Upper-Left) */}
          <path
            d={hpTrackPath}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          {leftRes && leftRes.ratio > 0 && (
            <path
              d={hpTrackPath}
              fill="none"
              stroke={leftRes.strokeColor}
              strokeWidth="8.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={(1 - leftRes.ratio) * 100}
              filter={`url(#${glowFilterId})`}
            />
          )}

          {/* Resource #2 Track & Active Gauge (Upper-Right) */}
          <path
            d={spTrackPath}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          {rightRes && rightRes.ratio > 0 && (
            <path
              d={spTrackPath}
              fill="none"
              stroke={rightRes.strokeColor}
              strokeWidth="8.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={(1 - rightRes.ratio) * 100}
              filter={`url(#${glowFilterId})`}
            />
          )}

          {/* Curved Resource #1 Text Readout (Upper-Left) */}
          <text
            fill="#d4d4d8"
            fontSize="8.8"
            fontFamily="monospace"
            fontWeight="800"
            letterSpacing="0.14em"
            textAnchor="middle"
          >
            <textPath href={`#${hpLabelPathId}`} startOffset="50%">
              {leftRes?.arcLabel ?? 'HP'}
            </textPath>
          </text>
          <text
            fill={activeChar && leftRes ? leftRes.strokeColor : '#71717a'}
            fontSize="12.5"
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="0.04em"
            textAnchor="middle"
          >
            <textPath href={`#${hpValuePathId}`} startOffset="50%">
              {activeChar && leftRes ? `${leftRes.current}/${leftRes.max}` : '--/--'}
            </textPath>
          </text>

          {/* Curved Resource #2 Text Readout (Upper-Right) */}
          <text
            fill="#d4d4d8"
            fontSize="8.5"
            fontFamily="monospace"
            fontWeight="800"
            letterSpacing="0.1em"
            textAnchor="middle"
          >
            <textPath href={`#${spLabelPathId}`} startOffset="50%">
              {rightRes?.arcLabel ?? 'SKILL PT'}
            </textPath>
          </text>
          <text
            fill={activeChar && rightRes ? rightRes.strokeColor : '#71717a'}
            fontSize="12.5"
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="0.04em"
            textAnchor="middle"
          >
            <textPath href={`#${spValuePathId}`} startOffset="50%">
              {activeChar && rightRes ? `${rightRes.current}/${rightRes.max}` : '--/--'}
            </textPath>
          </text>
        </>
      )}

      {/* Horizontal Split Bar separating Upper Semicircle & Lower Semicircle */}
      <line
        x1={7}
        y1={100}
        x2={63}
        y2={100}
        stroke={isOpen ? '#fbbf24' : 'rgba(255,255,255,0.6)'}
        strokeWidth="2"
      />
      <line
        x1={137}
        y1={100}
        x2={193}
        y2={100}
        stroke={isOpen ? '#fbbf24' : 'rgba(255,255,255,0.6)'}
        strokeWidth="2"
      />

      {/* ================= LOWER SEMICIRCLE: Dynamic Template Stats ================= */}
      {totalStats === 0 ? (
        <text
          x={cx}
          y={cy + 66}
          textAnchor="middle"
          fill="#71717a"
          fontSize="8.5"
          fontFamily="monospace"
          fontWeight="800"
          letterSpacing="0.12em"
        >
          NO STATS
        </text>
      ) : useTwoStatRings ? (
        <>
          {renderStatRing(outerRingStats, 64.5, 89, 71, 82.5, 'outer')}
          {renderStatRing(innerRingStats, 40, 64.5, 46.5, 57.5, 'inner')}
          <path
            d={lowerMidArc}
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1"
          />
        </>
      ) : (
        renderStatRing(outerRingStats, 40, 89, 55, 74.5, 'single')
      )}

      <path
        d={lowerOuterArc}
        fill="none"
        stroke={isOpen ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.42)'}
        strokeWidth="2.2"
      />
      <path
        d={lowerInnerArc}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
      />

      {/* ================= CENTER SAO EMBLEM CORE ================= */}
      <circle
        cx={cx}
        cy={cy}
        r={35.5}
        fill={isOpen ? '#f59e0b' : '#18181b'}
        fillOpacity={isOpen ? 0.22 : 0.96}
        stroke={isOpen ? '#fbbf24' : 'rgba(245,158,11,0.75)'}
        strokeWidth="2.2"
      />
      <circle
        cx={cx}
        cy={cy}
        r={30.5}
        fill="none"
        stroke={isOpen ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)'}
        strokeWidth="1"
      />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fill={isOpen ? '#fde68a' : '#ffffff'}
        fontSize="10.5"
        fontWeight="800"
        letterSpacing="0.04em"
      >
        {shortName}
      </text>
      <text
        x={cx}
        y={cy + 11}
        textAnchor="middle"
        fill={
          !activeChar
            ? '#fbbf24'
            : activeChar.status_condition && activeChar.status_condition !== 'Normal'
              ? '#fbbf24'
              : '#a1a1aa'
        }
        fontSize="8"
        fontFamily="monospace"
        fontWeight="700"
      >
        {!activeChar
          ? 'SELECT'
          : (activeChar.status_condition || 'NORMAL').toUpperCase().slice(0, 9)}
      </text>
    </svg>
  )
}

export type SaoCharacterOrbProps = {
  activeChar: Character | null | undefined
  currentSkillCost: number
  maxSkillCost: number
  isOpen: boolean
  orbSizePx: number
  scalePercent: number
  onToggle: () => void
  onDecreaseScale: () => void
  onIncreaseScale: () => void
  onResetScale: () => void
}

/**
 * Responsive Floating Bottom-Left SAO Circular Orb Button with [ − | 100% | + ] size control.
 * Desktop 100% default = 352px (22rem), scaling down automatically on tablet/mobile viewports.
 */
export default function SaoCharacterOrb({
  activeChar,
  currentSkillCost,
  maxSkillCost,
  isOpen,
  orbSizePx,
  scalePercent,
  onToggle,
  onDecreaseScale,
  onIncreaseScale,
  onResetScale,
}: SaoCharacterOrbProps) {
  return (
    <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-40 flex flex-col items-center gap-1.5">
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={onToggle}
          style={{ width: `${orbSizePx}px`, height: `${orbSizePx}px` }}
          aria-expanded={isOpen}
          aria-label="Toggle Character Status Window"
          title={
            activeChar
              ? `${activeChar.name} — คลิกเพื่อ${isOpen ? 'พับเก็บ' : 'เปิดดูข้อมูลตัวละครเต็ม'}`
              : 'คลิกเพื่อเลือกตัวละครเข้าสู่โต๊ะ'
          }
          className={`group relative rounded-full p-1 transition-transform duration-300 cursor-pointer focus:outline-none ${
            isOpen
              ? 'scale-[1.02] drop-shadow-[0_0_32px_rgba(245,158,11,0.6)]'
              : 'hover:scale-[1.03] drop-shadow-[0_12px_36px_rgba(0,0,0,0.9)] hover:drop-shadow-[0_0_24px_rgba(245,158,11,0.4)]'
          }`}
        >
          {/* Ambient SAO Ring Pulse when no character is bound */}
          {!activeChar && !isOpen && (
            <span className="pointer-events-none absolute inset-3 rounded-full border-2 border-amber-400/50 animate-ping" />
          )}

          <SaoDualSemicircleDial
            activeChar={activeChar}
            currentSkillCost={currentSkillCost}
            maxSkillCost={maxSkillCost}
            isOpen={isOpen}
            variant="orb"
          />
        </button>

        {/* SAO Active Pointer Indicator on the right edge when expanded on desktop */}
        {isOpen && (
          <span
            aria-hidden="true"
            className="hidden lg:block absolute top-1/2 -right-3.5 -translate-y-1/2 w-0 h-0 border-y-[9px] border-y-transparent border-l-13 border-l-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
          />
        )}
      </div>

      {/* Mini SAO [ − | 100% | + ] Size Control Pill */}
      <div
        role="group"
        aria-label="Character Orb Size Controls"
        className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/90 border border-white/20 px-1.5 py-0.5 shadow-lg backdrop-blur-md"
      >
        <button
          type="button"
          onClick={onDecreaseScale}
          disabled={scalePercent <= MIN_ORB_SCALE_PERCENT}
          aria-label="Decrease orb size"
          title="ลดขนาดปุ่มกลม (−10%)"
          className="p-1 rounded-full text-zinc-400 hover:text-amber-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={onResetScale}
          title="คลิกเพื่อรีเซ็ตกลับขนาดมาตรฐาน (100%)"
          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider transition cursor-pointer ${
            scalePercent === DEFAULT_ORB_SCALE_PERCENT
              ? 'text-zinc-300 hover:text-white'
              : 'text-amber-300 hover:text-amber-200'
          }`}
        >
          {scalePercent}%
        </button>

        <button
          type="button"
          onClick={onIncreaseScale}
          disabled={scalePercent >= MAX_ORB_SCALE_PERCENT}
          aria-label="Increase orb size"
          title="เพิ่มขนาดปุ่มกลม (+10%)"
          className="p-1 rounded-full text-zinc-400 hover:text-amber-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
