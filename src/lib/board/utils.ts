import type { AbilityKey, Stats } from './types'

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${random}`
}

export function normaliseStats(stats: Partial<Record<string, number | string>> | null | undefined): Stats {
  const read = (key: AbilityKey) => {
    const value = Number(stats?.[key])
    return Number.isFinite(value) ? value : 10
  }
  return { STR: read('STR'), DEX: read('DEX'), CON: read('CON'), INT: read('INT'), WIS: read('WIS'), CHA: read('CHA') }
}
