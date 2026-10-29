'use client'

import { Minus, Plus } from 'lucide-react'
import { SaoDualSemicircleDial } from './SaoDualSemicircleDial'
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
  viewportHeight: number,
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
              ? 'scale-[1.02] drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]'
              : 'hover:scale-[1.02] drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)] hover:brightness-105'
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
            className="hidden lg:block absolute top-1/2 -right-3.5 -translate-y-1/2 w-0 h-0 border-y-[9px] border-y-transparent border-l-13 border-l-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>

      <OrbSizeControls
        scalePercent={scalePercent}
        onDecrease={onDecreaseScale}
        onIncrease={onIncreaseScale}
        onReset={onResetScale}
      />
    </div>
  )
}

const SIZE_STEP_BUTTON_CLASS =
  'p-1 rounded-full text-zinc-400 hover:text-amber-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer'

// Mini SAO [ − | 100% | + ] Size Control Pill
function OrbSizeControls({
  scalePercent,
  onDecrease,
  onIncrease,
  onReset,
}: {
  scalePercent: number
  onDecrease: () => void
  onIncrease: () => void
  onReset: () => void
}) {
  return (
    <div
      role="group"
      aria-label="Character Orb Size Controls"
      className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/80 border border-zinc-800/80 px-2 py-0.5 shadow-lg backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onDecrease}
        disabled={scalePercent <= MIN_ORB_SCALE_PERCENT}
        aria-label="Decrease orb size"
        title="ลดขนาดปุ่มกลม (−10%)"
        className={SIZE_STEP_BUTTON_CLASS}
      >
        <Minus className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={onReset}
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
        onClick={onIncrease}
        disabled={scalePercent >= MAX_ORB_SCALE_PERCENT}
        aria-label="Increase orb size"
        title="เพิ่มขนาดปุ่มกลม (+10%)"
        className={SIZE_STEP_BUTTON_CLASS}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}
