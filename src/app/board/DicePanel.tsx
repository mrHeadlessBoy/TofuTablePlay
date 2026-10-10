'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Dices, Minus, Plus, X } from 'lucide-react'
import { DIE_SIDES, abilityModifier, describeRoll, formatModifier, rollDie } from '@/lib/board/dice'
import { ABILITY_KEYS, type AbilityKey, type DiceRoll, type DieSides, type RollMode, type Token } from '@/lib/board/types'

export type RollOrder = {
  sides: DieSides
  count: number
  modifier: number
  mode: RollMode
  roller: string
  label: string
  dc: number | null
}

type DicePanelProps = {
  heroes: Token[]
  /** The roll to show in the tray. Changes whenever anything on the table rolls. */
  activeRoll: DiceRoll | null
  history: DiceRoll[]
  onRoll: (order: RollOrder) => void
  onClose: () => void
}

const ROLL_ANIMATION_MS = 850

function dieGeometry(sides: DieSides): THREE.BufferGeometry[] {
  switch (sides) {
    case 4:
      return [new THREE.TetrahedronGeometry(1.05)]
    case 6:
      return [new THREE.BoxGeometry(1.25, 1.25, 1.25)]
    case 8:
      return [new THREE.OctahedronGeometry(1.05)]
    case 12:
      return [new THREE.DodecahedronGeometry(1)]
    case 20:
      return [new THREE.IcosahedronGeometry(1.05)]
    default: {
      // d10 and d100: a ten-sided bipyramid made of two five-sided cones.
      const upper = new THREE.ConeGeometry(0.95, 0.95, 5)
      upper.translate(0, 0.475, 0)
      const lower = new THREE.ConeGeometry(0.95, 0.95, 5)
      lower.rotateX(Math.PI)
      lower.rotateY(Math.PI / 5)
      lower.translate(0, -0.475, 0)
      return [upper, lower]
    }
  }
}

/** A small tumbling 3D die. It spins hard whenever `rollId` changes, then settles. */
function Die3D({ sides, rollId, tone }: { sides: DieSides; rollId: string | null; tone: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const spinRef = useRef(0)
  const toneRef = useRef(tone)

  useEffect(() => {
    toneRef.current = tone
  }, [tone])

  useEffect(() => {
    if (rollId) spinRef.current = 1
  }, [rollId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const size = host.clientWidth || 132
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(size, size)
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20)
    camera.position.set(0, 0, 4.6)
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(2, 3, 4)
    scene.add(key)

    const die = new THREE.Group()
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#1a1d25', metalness: 0.35, roughness: 0.35, flatShading: true })
    const edgeMaterial = new THREE.LineBasicMaterial({ color: toneRef.current })
    const geometries = dieGeometry(sides)
    const edges = geometries.map((geometry) => new THREE.EdgesGeometry(geometry, 1))
    geometries.forEach((geometry, index) => {
      die.add(new THREE.Mesh(geometry, bodyMaterial), new THREE.LineSegments(edges[index], edgeMaterial))
    })
    die.rotation.set(0.5, 0.6, 0.1)
    scene.add(die)

    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      spinRef.current = Math.max(0, spinRef.current - delta / (ROLL_ANIMATION_MS / 1000))
      const speed = 0.35 + spinRef.current * spinRef.current * 16
      die.rotation.x += delta * speed
      die.rotation.y += delta * speed * 1.3
      die.rotation.z += delta * speed * 0.4
      edgeMaterial.color.set(toneRef.current)
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      for (const geometry of [...geometries, ...edges]) geometry.dispose()
      bodyMaterial.dispose()
      edgeMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [sides])

  return <div ref={hostRef} className="h-[132px] w-[132px]" />
}

/** The number on top of the die: it flickers while rolling, then lands on the total. */
function RollNumber({ roll }: { roll: DiceRoll }) {
  const [settled, setSettled] = useState(false)
  const [flicker, setFlicker] = useState(roll.total)

  useEffect(() => {
    const spin = window.setInterval(() => setFlicker(rollDie(roll.sides) * roll.count + roll.modifier), 60)
    const stop = window.setTimeout(() => {
      window.clearInterval(spin)
      setSettled(true)
    }, ROLL_ANIMATION_MS)
    return () => {
      window.clearInterval(spin)
      window.clearTimeout(stop)
    }
  }, [roll])

  const tone =
    !settled ? 'text-white/70' : roll.critical === 'hit' ? 'text-amber-300' : roll.critical === 'fail' ? 'text-red-400' : 'text-white'

  return (
    <span
      className={`font-mono text-4xl font-bold tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-transform duration-200 ${tone} ${settled ? 'scale-110' : 'scale-90'}`}
    >
      {settled ? roll.total : flicker}
    </span>
  )
}

function Stepper({ label, value, onChange, min, max, format }: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  format?: (value: number) => string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-6 w-6 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-9 text-center font-mono text-sm tabular-nums text-white">{format ? format(value) : value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-6 w-6 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export default function DicePanel({ heroes, activeRoll, history, onRoll, onClose }: DicePanelProps) {
  const [sides, setSides] = useState<DieSides>(20)
  const [count, setCount] = useState(1)
  const [modifier, setModifier] = useState(0)
  const [mode, setMode] = useState<RollMode>('normal')
  const [rollerId, setRollerId] = useState('')
  const [ability, setAbility] = useState<AbilityKey | ''>('')
  const [dc, setDc] = useState('')

  const roller = heroes.find((hero) => hero.id === rollerId) ?? null
  const abilityBonus = roller && ability ? abilityModifier(roller.stats[ability]) : 0
  const totalModifier = modifier + abilityBonus
  const modeAllowed = sides === 20 && count === 1
  const shownSides = activeRoll?.sides ?? sides

  const tone = !activeRoll
    ? '#f59e0b'
    : activeRoll.critical === 'hit'
      ? '#fcd34d'
      : activeRoll.critical === 'fail' || activeRoll.success === false
        ? '#f87171'
        : activeRoll.success
          ? '#4ade80'
          : '#f59e0b'

  const submit = () => {
    const parsedDc = Number.parseInt(dc, 10)
    const what = ability ? `${ability} check` : `${count > 1 ? count : ''}d${sides}`
    onRoll({
      sides,
      count,
      modifier: totalModifier,
      mode: modeAllowed ? mode : 'normal',
      roller: roller?.name ?? '',
      label: what,
      dc: Number.isFinite(parsedDc) && parsedDc > 0 ? parsedDc : null,
    })
  }

  return (
    <div className="w-80 rounded-xl border border-white/10 bg-black/60 p-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-400">
          <Dices className="h-4 w-4" /> Dice Tray
        </span>
        <button type="button" onClick={onClose} aria-label="Close dice tray" className="text-white/50 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40">
          <div className="absolute inset-0">
            <Die3D sides={shownSides} rollId={activeRoll?.id ?? null} tone={tone} />
          </div>
          <div className="pointer-events-none relative">
            {activeRoll ? (
              <RollNumber key={activeRoll.id} roll={activeRoll} />
            ) : (
              <span className="font-mono text-lg font-bold text-white/60">d{sides}</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-xs">
          {activeRoll ? (
            <>
              <p className="truncate font-semibold text-white">{activeRoll.roller || 'Free roll'}</p>
              <p className="truncate text-white/60">{activeRoll.label}</p>
              <p className="mt-1.5 break-words font-mono text-[11px] leading-relaxed text-white/80">{describeRoll(activeRoll)}</p>
            </>
          ) : (
            <p className="text-white/50">เลือกลูกเต๋าแล้วกด ROLL ผลทอยจะถูกเก็บลง Log และส่งให้ DM ในเทิร์นถัดไป</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DIE_SIDES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSides(value)}
            className={`rounded py-1.5 font-mono text-[11px] transition ${
              sides === value ? 'bg-amber-500 text-black' : 'border border-white/15 text-white/70 hover:bg-white/10'
            }`}
          >
            d{value}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <Stepper label="Dice" value={count} onChange={setCount} min={1} max={10} />
        <Stepper label="Modifier" value={modifier} onChange={setModifier} min={-10} max={20} format={formatModifier} />

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Mode</span>
          <div className="flex overflow-hidden rounded border border-white/15">
            {(['normal', 'advantage', 'disadvantage'] as RollMode[]).map((value) => (
              <button
                key={value}
                type="button"
                disabled={!modeAllowed}
                onClick={() => setMode(value)}
                className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition disabled:opacity-35 ${
                  modeAllowed && mode === value ? 'bg-white/20 text-white' : 'text-white/55 hover:bg-white/10'
                }`}
              >
                {value === 'normal' ? 'Normal' : value === 'advantage' ? 'Adv' : 'Dis'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
          <select
            value={rollerId}
            onChange={(event) => setRollerId(event.target.value)}
            aria-label="Roll as"
            className="min-w-0 rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white outline-none focus:border-amber-400"
          >
            <option value="">Free roll</option>
            {heroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                {hero.name}
              </option>
            ))}
          </select>
          <select
            value={ability}
            onChange={(event) => setAbility(event.target.value as AbilityKey | '')}
            disabled={!roller}
            aria-label="Ability"
            className="rounded border border-white/15 bg-black/60 px-1.5 py-1 font-mono text-xs text-white outline-none focus:border-amber-400 disabled:opacity-35"
          >
            <option value="">—</option>
            {ABILITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <input
            value={dc}
            onChange={(event) => setDc(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            placeholder="DC"
            aria-label="Difficulty class"
            className="w-12 rounded border border-white/15 bg-black/60 px-2 py-1 text-center font-mono text-xs text-white placeholder-white/30 outline-none focus:border-amber-400"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-amber-400"
      >
        <Dices className="h-4 w-4" />
        Roll {count > 1 ? count : ''}d{sides}
        {totalModifier !== 0 ? ` ${formatModifier(totalModifier)}` : ''}
      </button>

      {history.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/10 pt-2">
          {history.slice(0, 4).map((roll) => (
            <li key={roll.id} className="flex justify-between gap-2 font-mono text-[10px] text-white/50">
              <span className="truncate">
                {roll.roller || 'Free'} · {roll.label}
              </span>
              <span className="shrink-0 text-white/80">{roll.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
