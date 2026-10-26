'use client'

import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { getHpColorHex } from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  isColumnStatId,
  readCharacterTemplate,
  readCustomValues,
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

export type SaoDualSemicircleDialProps = {
  activeChar: Character | null | undefined
  currentSkillCost: number
  maxSkillCost: number
  isOpen?: boolean
  variant: 'orb' | 'crest'
}

/**
 * 2-Part Semicircle SAO HUD Dial:
 * - Upper Semicircle (ด้านบน): { HP, Skill Point } curved gauges + concentric curved SVG <textPath> readouts
 * - Lower Semicircle (ด้านล่าง): { Stat ทั้ง 6 } (STR, DEX, CON, INT, WIS, CHA) in 6 radial sectors
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

  const curHp = activeChar?.current_hp ?? 0
  const maxHp = Math.max(1, activeChar?.max_hp ?? 1)
  const hpRatio = activeChar ? Math.max(0, Math.min(1, curHp / maxHp)) : 0

  const curSp = activeChar ? currentSkillCost : 0
  const maxSp = Math.max(1, maxSkillCost || 1)
  const spRatio = activeChar
    ? maxSkillCost > 0
      ? Math.max(0, Math.min(1, curSp / maxSp))
      : 0
    : 0

  const hpColor = activeChar ? getSaoHpStroke(hpRatio) : '#52525b'
  const spColor = activeChar ? '#38bdf8' : '#52525b'

  const activeTemplate = activeChar ? readCharacterTemplate(activeChar) : CLASSIC_TEMPLATE
  const customValues = activeChar ? readCustomValues(activeChar) : { stats: {}, resources: {}, fields: {}, equipment: {} }
  const hpRes = activeTemplate.resources.find((r) => r.id === 'hp')
  const spRes = activeTemplate.resources.find((r) => r.id === 'skill_cost')
  const hpArcLabel = (hpRes?.label || 'HP').toUpperCase().slice(0, 10)
  const spArcLabel = (
    spRes?.id === 'skill_cost' && spRes.label === 'Skill Cost' ? 'SKILL PT' : spRes?.label || 'SKILL PT'
  )
    .toUpperCase()
    .slice(0, 10)

  const dialStats =
    activeTemplate.stats.length > 0 ? activeTemplate.stats.slice(0, 6) : CLASSIC_TEMPLATE.stats.slice(0, 6)
  const sectorCount = Math.max(1, dialStats.length)
  const sectorSpanDeg = 174 / sectorCount

  // Upper Semicircle gauge arcs (r = 84):
  // Left upper quadrant (HP): 184° -> 266° (82° sweep rising from left horizon to top clockwise)
  const hpTrackPath = describeClockwiseArc(cx, cy, 84, 184, 266)

  // Right upper quadrant (Skill Point): 356° -> 274° (82° sweep rising from right horizon to top counter-clockwise)
  const spTrackPath = describeCounterClockwiseArc(cx, cy, 84, 356, 274)

  // Concentric curved text paths inside Upper-Left (184° -> 266°) and Upper-Right (274° -> 356°):
  // Outer arc (r = 65): curved label ("HP" / "SKILL PT")
  // Inner arc (r = 48): curved numeric value ("20/20" / "10/10")
  const hpLabelArcPath = describeClockwiseArc(cx, cy, 65, 184, 266)
  const hpValueArcPath = describeClockwiseArc(cx, cy, 48, 184, 266)
  const spLabelArcPath = describeClockwiseArc(cx, cy, 65, 274, 356)
  const spValueArcPath = describeClockwiseArc(cx, cy, 48, 274, 356)

  // Lower Semicircle outer frame: 3° -> 177° (174° sweep along bottom for the Stats)
  const lowerOuterArc = describeClockwiseArc(cx, cy, 89, 3, 177)
  const lowerInnerArc = describeClockwiseArc(cx, cy, 40, 4, 176)

  // Internal divider angles splitting 177°..3° into equal sectors
  const statDividerAngles = Array.from({ length: Math.max(0, sectorCount - 1) }, (_, idx) =>
    177 - (idx + 1) * sectorSpanDeg
  )

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

        {/* Curved guide paths for Upper-Left HP & Upper-Right SKILL PT text readouts */}
        <path id={hpLabelPathId} d={hpLabelArcPath} fill="none" />
        <path id={hpValuePathId} d={hpValueArcPath} fill="none" />
        <path id={spLabelPathId} d={spLabelArcPath} fill="none" />
        <path id={spValuePathId} d={spValueArcPath} fill="none" />
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

      {/* ================= UPPER SEMICIRCLE: { HP, Skill Point } ================= */}
      {/* Upper subtle quadrant wedges */}
      <path
        d={describeSectorWedge(cx, cy, 40, 76, 183, 268)}
        fill="rgba(74,222,128,0.045)"
      />
      <path
        d={describeSectorWedge(cx, cy, 40, 76, 272, 357)}
        fill="rgba(56,189,248,0.045)"
      />

      {/* Upper inner guide arc */}
      <path
        d={describeClockwiseArc(cx, cy, 40, 184, 356)}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
      />

      {/* Top vertical split tick between HP (left) and Skill Point (right) */}
      <line
        x1={100}
        y1={10}
        x2={100}
        y2={58}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.5"
      />

      {/* HP Track & Active Gauge (Upper-Left) — Exact Stroke Length via pathLength & strokeDashoffset */}
      <path
        d={hpTrackPath}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {hpRatio > 0 && (
        <path
          d={hpTrackPath}
          fill="none"
          stroke={hpColor}
          strokeWidth="8.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={(1 - hpRatio) * 100}
          filter={`url(#${glowFilterId})`}
        />
      )}

      {/* Skill Point Track & Active Gauge (Upper-Right) — Symmetrical Counter-Clockwise Stroke */}
      <path
        d={spTrackPath}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {spRatio > 0 && (
        <path
          d={spTrackPath}
          fill="none"
          stroke={spColor}
          strokeWidth="8.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={(1 - spRatio) * 100}
          filter={`url(#${glowFilterId})`}
        />
      )}

      {/* Curved HP Text Readout (Upper-Left, following 184° -> 266° curve) */}
      <text
        fill="#d4d4d8"
        fontSize="8.8"
        fontFamily="monospace"
        fontWeight="800"
        letterSpacing="0.14em"
        textAnchor="middle"
      >
        <textPath href={`#${hpLabelPathId}`} startOffset="50%">
          {hpArcLabel}
        </textPath>
      </text>
      <text
        fill={activeChar ? hpColor : '#71717a'}
        fontSize="12.5"
        fontFamily="monospace"
        fontWeight="900"
        letterSpacing="0.04em"
        textAnchor="middle"
      >
        <textPath href={`#${hpValuePathId}`} startOffset="50%">
          {activeChar ? `${curHp}/${activeChar.max_hp ?? 0}` : '--/--'}
        </textPath>
      </text>

      {/* Curved Skill Point Text Readout (Upper-Right, following 274° -> 356° curve) */}
      <text
        fill="#d4d4d8"
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="800"
        letterSpacing="0.1em"
        textAnchor="middle"
      >
        <textPath href={`#${spLabelPathId}`} startOffset="50%">
          {spArcLabel}
        </textPath>
      </text>
      <text
        fill={activeChar ? '#38bdf8' : '#71717a'}
        fontSize="12.5"
        fontFamily="monospace"
        fontWeight="900"
        letterSpacing="0.04em"
        textAnchor="middle"
      >
        <textPath href={`#${spValuePathId}`} startOffset="50%">
          {activeChar ? `${curSp}/${maxSkillCost}` : '--/--'}
        </textPath>
      </text>

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

      {/* ================= LOWER SEMICIRCLE: { Stats } ================= */}
      {/* Alternating subtle sector backgrounds for crisp visual separation */}
      {dialStats.map((stat, idx) => {
        const endDeg = 177 - idx * sectorSpanDeg
        const startDeg = endDeg - sectorSpanDeg
        return (
          <path
            key={`wedge-${stat.id}`}
            d={describeSectorWedge(cx, cy, 40, 89, startDeg, endDeg)}
            fill={idx % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(245,158,11,0.045)'}
          />
        )
      })}

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

      {/* Radial dividers for the stats */}
      {statDividerAngles.map((deg) => {
        const innerPt = polarToCartesian(cx, cy, 40, deg)
        const outerPt = polarToCartesian(cx, cy, 89, deg)
        return (
          <line
            key={deg}
            x1={innerPt.x}
            y1={innerPt.y}
            x2={outerPt.x}
            y2={outerPt.y}
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="1.2"
          />
        )
      })}

      {/* Stats arranged left-to-right across the Lower Semicircle */}
      {dialStats.map((stat, idx) => {
        const centerDeg = 177 - (idx * sectorSpanDeg + sectorSpanDeg / 2)
        const labelPos = polarToCartesian(cx, cy, 55, centerDeg)
        const valPos = polarToCartesian(cx, cy, 74.5, centerDeg)
        const rawScore = activeChar
          ? isColumnStatId(stat.id)
            ? (activeChar.stats?.[stat.id] ?? stat.default)
            : (customValues.stats[stat.id] ?? activeChar.stats?.[stat.id] ?? stat.default)
          : '--'
        const shortStatLabel = isColumnStatId(stat.id)
          ? stat.id
          : (stat.label || stat.id).toUpperCase().slice(0, 4)

        return (
          <g key={stat.id}>
            <text
              x={labelPos.x}
              y={labelPos.y + 3}
              textAnchor="middle"
              fill="#d4d4d8"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="800"
            >
              {shortStatLabel}
            </text>
            <text
              x={valPos.x}
              y={valPos.y + 4}
              textAnchor="middle"
              fill={isOpen ? '#fde68a' : '#ffffff'}
              fontSize="12.5"
              fontFamily="monospace"
              fontWeight="900"
            >
              {String(rawScore)}
            </text>
          </g>
        )
      })}

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
