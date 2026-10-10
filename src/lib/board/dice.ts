import type { AbilityKey, DiceRoll, DieSides, RollMode, Stats } from './types'

export const DIE_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20, 100]

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${random}`
}

/** Uniform integer in 1..sides. Uses the crypto RNG so there is no modulo bias. */
export function rollDie(sides: number): number {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    return Math.floor(Math.random() * sides) + 1
  }
  const limit = Math.floor(0x100000000 / sides) * sides
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return (value % sides) + 1
}

/** D&D 5e ability modifier: 10 -> +0, 14 -> +2, 8 -> -1. */
export function abilityModifier(score: number | string | undefined): number {
  const value = Number(score)
  if (!Number.isFinite(value)) return 0
  return Math.floor((value - 10) / 2)
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

export function normaliseStats(stats: Partial<Record<string, number | string>> | null | undefined): Stats {
  const read = (key: AbilityKey) => {
    const value = Number(stats?.[key])
    return Number.isFinite(value) ? value : 10
  }
  return { STR: read('STR'), DEX: read('DEX'), CON: read('CON'), INT: read('INT'), WIS: read('WIS'), CHA: read('CHA') }
}

type RollOptions = {
  sides: DieSides
  count?: number
  modifier?: number
  mode?: RollMode
  roller?: string
  label?: string
  dc?: number | null
}

export function rollDice(options: RollOptions): DiceRoll {
  const { sides, modifier = 0, roller = '', dc = null } = options
  // Advantage and disadvantage only exist for a single d20.
  const mode: RollMode = sides === 20 && (options.count ?? 1) === 1 ? options.mode ?? 'normal' : 'normal'
  const count = Math.max(1, Math.min(20, Math.floor(options.count ?? 1)))

  let kept: number[]
  let dropped: number | null = null

  if (mode === 'normal') {
    kept = Array.from({ length: count }, () => rollDie(sides))
  } else {
    const first = rollDie(20)
    const second = rollDie(20)
    const keepHigh = mode === 'advantage'
    const keep = keepHigh ? Math.max(first, second) : Math.min(first, second)
    kept = [keep]
    dropped = keep === first ? second : first
  }

  const total = kept.reduce((sum, value) => sum + value, 0) + modifier

  let critical: DiceRoll['critical'] = null
  if (sides === 20 && kept.length === 1) {
    if (kept[0] === 20) critical = 'hit'
    else if (kept[0] === 1) critical = 'fail'
  }

  return {
    id: newId('roll'),
    roller,
    label: options.label ?? `${count}d${sides}`,
    sides,
    count,
    modifier,
    mode,
    kept,
    dropped,
    total,
    dc,
    success: dc === null ? null : total >= dc,
    critical,
    at: Date.now(),
  }
}

/** "d20 (14) +2 = 16 vs DC 12 → SUCCESS" */
export function describeRoll(roll: DiceRoll): string {
  const dice = `${roll.count > 1 ? roll.count : ''}d${roll.sides}`
  const faces =
    roll.dropped === null ? `(${roll.kept.join(' + ')})` : `(${roll.kept[0]}, ทิ้ง ${roll.dropped})`
  const modifier = roll.modifier !== 0 ? ` ${formatModifier(roll.modifier)}` : ''
  const mode = roll.mode === 'advantage' ? ' [ADV]' : roll.mode === 'disadvantage' ? ' [DIS]' : ''
  let text = `${dice}${mode} ${faces}${modifier} = ${roll.total}`
  if (roll.dc !== null) text += ` vs DC ${roll.dc} → ${roll.success ? 'SUCCESS' : 'FAIL'}`
  if (roll.critical === 'hit') text += ' · NATURAL 20'
  if (roll.critical === 'fail') text += ' · NATURAL 1'
  return text
}
