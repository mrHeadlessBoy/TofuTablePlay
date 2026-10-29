'use client'

import { useEffect, useState } from 'react'
import { Dices, Minus, Plus, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Die3D, { ROLL_ANIMATION_MS } from './Die3D'
import {
  DIE_SIDES,
  MAX_DICE_MODIFIER,
  MIN_DICE_MODIFIER,
  clampModifier,
  describeRoll,
  formatModifier,
  rollDice,
  rollDie,
  type DiceRoll,
  type DieSides,
  type RollMode,
} from './dice'

/**
 * Shared dice tray: d4 to d100, several dice at once, a modifier, advantage / disadvantage and an optional DC.
 *
 * Simplest use, anywhere in the app:
 *
 *   import { DiceRoller } from '@/components/dice'
 *   <DiceRoller onRoll={(roll) => console.log(roll.total)} />
 *
 * Let people roll as a character, with that character's bonuses:
 *
 *   <DiceRoller actors={[{ id: '1', name: 'Kael', modifiers: { STR: 3, DEX: 1 } }]} />
 *
 * If rolls can also be made outside the tray (a "roll initiative" button, say), keep the latest
 * roll in the parent and pass it back with `roll` so the tray shows that one too.
 */

/** Someone who can roll. `modifiers` are the bonuses offered in the tray, keyed by what they are called. */
export type DiceActor = {
  id: string
  name: string
  modifiers?: Record<string, number>
  defaultSides?: DieSides
  defaultCount?: number
}

export type DiceRollerProps = {
  /** Who can roll. Leave it out for a plain dice tray. */
  actors?: DiceActor[]
  /** Show this roll in the tray. Leave it out and the tray remembers its own last roll. */
  roll?: DiceRoll | null
  /** Recent rolls, newest first. Leave it out and the tray keeps its own list. */
  history?: DiceRoll[]
  /** Called with the finished roll every time ROLL is pressed. */
  onRoll?: (roll: DiceRoll) => void
  /** A close button appears when this is given. */
  onClose?: () => void
  title?: string
  /** Shown before the first roll. */
  hint?: string
  className?: string
}

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.18em] text-white/45'
const FIELD_CLASS =
  'rounded-xl border border-zinc-800/80 bg-black/40 py-1.5 px-2 text-xs text-zinc-100 outline-none focus:border-zinc-600 disabled:opacity-35 transition-all'
const ROLL_MODES: RollMode[] = ['normal', 'advantage', 'disadvantage']

/** The number on top of the die: it flickers while rolling, then lands on the total. */
function RollNumber({ roll }: { roll: DiceRoll }) {
  const [settled, setSettled] = useState(false)
  const [flicker, setFlicker] = useState(roll.total)

  useEffect(() => {
    const spin = window.setInterval(
      () => setFlicker(rollDie(roll.sides) * roll.count + roll.modifier),
      60,
    )
    const stop = window.setTimeout(() => {
      window.clearInterval(spin)
      setSettled(true)
    }, ROLL_ANIMATION_MS)
    return () => {
      window.clearInterval(spin)
      window.clearTimeout(stop)
    }
  }, [roll])

  const tone = !settled
    ? 'text-white/70'
    : roll.critical === 'hit'
      ? 'text-amber-300'
      : roll.critical === 'fail'
        ? 'text-red-400'
        : 'text-white'

  return (
    <span
      className={`font-mono text-4xl font-bold tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-transform duration-200 ${tone} ${settled ? 'scale-110' : 'scale-90'}`}
    >
      {settled ? roll.total : flicker}
    </span>
  )
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  format,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  format?: (value: number) => string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={LABEL}>{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-6 w-6 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-9 text-center font-mono text-sm tabular-nums text-white">
          {format ? format(value) : value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-6 w-6 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function edgeTone(roll: DiceRoll | null): string {
  if (!roll) return '#f59e0b'
  if (roll.critical === 'hit') return '#fcd34d'
  if (roll.critical === 'fail' || roll.success === false) return '#f87171'
  if (roll.success) return '#4ade80'
  return '#f59e0b'
}

export default function DiceRoller({
  actors = [],
  roll,
  history,
  onRoll,
  onClose,
  title = 'Dice Tray',
  hint = 'เลือกลูกเต๋าแล้วกด ROLL',
  className,
}: DiceRollerProps) {
  const { language } = useLanguage()
  const [sides, setSides] = useState<DieSides>(() => actors[0]?.defaultSides ?? 20)
  const [count, setCount] = useState<number>(() => actors[0]?.defaultCount ?? 1)
  const [modifier, setModifier] = useState(0)
  const [mode, setMode] = useState<RollMode>('normal')
  const [actorId, setActorId] = useState<string>(() => actors[0]?.id ?? '')
  const [bonusKey, setBonusKey] = useState('')
  const [dc, setDc] = useState('')
  const [ownRoll, setOwnRoll] = useState<DiceRoll | null>(null)
  const [ownHistory, setOwnHistory] = useState<DiceRoll[]>([])

  // The parent decides what is shown when it passes `roll` / `history`; otherwise the tray does.
  const shownRoll = roll === undefined ? ownRoll : roll
  const shownHistory = history ?? ownHistory

  const actor = actors.find((entry) => entry.id === actorId) ?? null
  const bonusKeys = Object.keys(actor?.modifiers ?? {})
  // A bonus only counts while the selected actor really has it, so switching back to a free roll drops it.
  const activeBonus = actor && bonusKeys.includes(bonusKey) ? bonusKey : ''
  const totalModifier = clampModifier(modifier + (activeBonus ? actor?.modifiers?.[activeBonus] ?? 0 : 0))
  const modeAllowed = sides === 20 && count === 1

  const submit = () => {
    const parsedDc = Number.parseInt(dc, 10)
    const result = rollDice({
      sides,
      count,
      modifier: totalModifier,
      mode: modeAllowed ? mode : 'normal',
      roller: actor?.name ?? '',
      label: activeBonus ? `${activeBonus} check` : `${count > 1 ? count : ''}d${sides}`,
      dc: Number.isFinite(parsedDc) && parsedDc > 0 ? parsedDc : null,
    })
    setOwnRoll(result)
    setOwnHistory((previous) => [result, ...previous].slice(0, 20))
    onRoll?.(result)
  }

  const handleActorChange = (nextId: string) => {
    setActorId(nextId)
    const picked = actors.find((entry) => entry.id === nextId)
    if (picked?.defaultSides) setSides(picked.defaultSides)
    if (picked?.defaultCount) setCount(picked.defaultCount)
  }

  return (
    <div
      className={twMerge(
        'w-80 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl backdrop-blur-xl',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-400">
          <Dices className="h-4 w-4" /> {title}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dice tray"
            className="text-white/50 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <RollDisplay roll={shownRoll} sides={sides} hint={hint} />

      <DieSidesPicker sides={sides} onChange={setSides} />

      <div className="mt-3 space-y-2">
        <Stepper
          label={language === 'en' ? 'Dice' : 'เต๋า'}
          value={count}
          onChange={setCount}
          min={1}
          max={10}
        />
        <Stepper
          label={language === 'en' ? 'Modifier' : 'ตัวบวก'}
          value={modifier}
          onChange={setModifier}
          min={MIN_DICE_MODIFIER}
          max={MAX_DICE_MODIFIER}
          format={formatModifier}
        />

        <RollModeToggle mode={mode} allowed={modeAllowed} onChange={setMode} />

        {actors.length > 0 ? (
          <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
            <select
              value={actor ? actorId : ''}
              onChange={(event) => handleActorChange(event.target.value)}
              aria-label="Roll as"
              className={`min-w-0 px-2 ${FIELD_CLASS}`}
            >
              <option value="">{language === 'en' ? 'Free roll' : 'ทอยอิสระ'}</option>
              {actors.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select
              value={activeBonus}
              onChange={(event) => setBonusKey(event.target.value)}
              disabled={bonusKeys.length === 0}
              aria-label="Bonus"
              className={`px-1.5 font-mono ${FIELD_CLASS}`}
            >
              <option value="">—</option>
              {bonusKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <DcInput value={dc} onChange={setDc} placeholder="DC" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className={LABEL}>DC (optional)</span>
            <DcInput value={dc} onChange={setDc} placeholder="—" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-amber-400 cursor-pointer"
      >
        <Dices className="h-4 w-4" />
        {language === 'en' ? 'Roll' : 'ทอย'} {count > 1 ? count : ''}d{sides}
        {totalModifier !== 0 ? ` ${formatModifier(totalModifier)}` : ''}
      </button>

      {shownHistory.length > 0 && <RollHistory rolls={shownHistory} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tray sections                                                       */
/* ------------------------------------------------------------------ */

// 3D die with the rolling number on top, plus who rolled and the breakdown
function RollDisplay({ roll, sides, hint }: { roll: DiceRoll | null; sides: DieSides; hint: string }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="relative grid h-33 w-33 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40">
        <div className="absolute inset-0">
          <Die3D sides={roll?.sides ?? sides} rollId={roll?.id ?? null} tone={edgeTone(roll)} />
        </div>
        <div className="pointer-events-none relative">
          {roll ? (
            <RollNumber key={roll.id} roll={roll} />
          ) : (
            <span className="font-mono text-lg font-bold text-white/60">d{sides}</span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 text-xs">
        {roll ? (
          <>
            <p className="truncate font-semibold text-white">{roll.roller || 'Free roll'}</p>
            <p className="truncate text-white/60">{roll.label}</p>
            <p className="mt-1.5 wrap-break-words font-mono text-[11px] leading-relaxed text-white/80">
              {describeRoll(roll)}
            </p>
          </>
        ) : (
          <p className="text-white/50">{hint}</p>
        )}
      </div>
    </div>
  )
}

function DieSidesPicker({ sides, onChange }: { sides: DieSides; onChange: (sides: DieSides) => void }) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {DIE_SIDES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`rounded py-1.5 font-mono text-[11px] transition ${
            sides === value
              ? 'bg-amber-500 text-black'
              : 'border border-white/15 text-white/70 hover:bg-white/10'
          } cursor-pointer`}
        >
          d{value}
        </button>
      ))}
    </div>
  )
}

// Advantage / disadvantage only apply to a single d20
function RollModeToggle({
  mode,
  allowed,
  onChange,
}: {
  mode: RollMode
  allowed: boolean
  onChange: (mode: RollMode) => void
}) {
  const { t, language } = useLanguage()
  const labelFor = (value: RollMode) => {
    if (value === 'normal') return t('dice.normal')
    if (value === 'advantage') return language === 'en' ? 'Adv' : 'ได้เปรียบ'
    return language === 'en' ? 'Dis' : 'เสียเปรียบ'
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className={LABEL}>{t('dice.mode')}</span>
      <div className="flex overflow-hidden rounded border border-white/15">
        {ROLL_MODES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={!allowed}
            onClick={() => onChange(value)}
            className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition disabled:opacity-35 ${
              allowed && mode === value ? 'bg-white/20 text-white' : 'text-white/55 hover:bg-white/10'
            } cursor-pointer`}
          >
            {labelFor(value)}
          </button>
        ))}
      </div>
    </div>
  )
}

// Two-digit difficulty class; anything that is not a digit is dropped
function DcInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
      inputMode="numeric"
      placeholder={placeholder}
      aria-label="Difficulty class"
      className={`w-12 px-2 text-center font-mono placeholder-white/30 ${FIELD_CLASS}`}
    />
  )
}

function RollHistory({ rolls }: { rolls: DiceRoll[] }) {
  return (
    <ul className="mt-3 space-y-1 border-t border-white/10 pt-2">
      {rolls.slice(0, 4).map((entry) => (
        <li key={entry.id} className="flex justify-between gap-2 font-mono text-[10px] text-white/50">
          <span className="truncate">
            {entry.roller || 'Free'} · {entry.label}
          </span>
          <span className="shrink-0 text-white/80">{entry.total}</span>
        </li>
      ))}
    </ul>
  )
}
