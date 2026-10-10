'use client'

import { useState, type FormEvent } from 'react'
import { Dices, Footprints, Heart, MapPin, Minus, PenLine, Plus, Shield, Skull, Trash2, UserPlus, Users, X } from 'lucide-react'
import { abilityModifier, formatModifier } from '@/components/dice/dice'
import type { CodexCharacter } from '@/lib/board/session'
import { ABILITY_KEYS, type AbilityKey, type RollRequest, type SceneSummary, type Token } from '@/lib/board/types'

// Shared HUD styling: see-through dark glass so the map stays the focus.
export const GLASS = 'rounded-xl border border-white/10 bg-black/45 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md'
export const LABEL = 'font-mono text-[10px] uppercase tracking-[0.18em] text-white/45'

export type PlacingDraft = { kind: 'enemy' | 'npc'; name: string; hp: number; ac: number }

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
  const tone = ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.25 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

// ---------- party roster ----------

type PartyRosterProps = {
  heroes: Token[]
  ready: Record<string, boolean>
  drafts: Record<string, string>
  selectedId: string | null
  locked: boolean
  benched: CodexCharacter[]
  onSelect: (id: string) => void
  onToggleReady: (id: string) => void
  onReadyAll: () => void
  onAddCharacter: (character: CodexCharacter) => void
  onAddQuickHero: (name: string, classType: string) => void
}

export function PartyRoster({
  heroes,
  ready,
  drafts,
  selectedId,
  locked,
  benched,
  onSelect,
  onToggleReady,
  onReadyAll,
  onAddCharacter,
  onAddQuickHero,
}: PartyRosterProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [classType, setClassType] = useState('')
  const readyCount = heroes.filter((hero) => ready[hero.id]).length

  const submitQuickHero = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    onAddQuickHero(name, classType)
    setName('')
    setClassType('')
    setAdding(false)
  }

  return (
    <section className={`${GLASS} p-3`}>
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-amber-400" /> Party Roster
        </span>
        <span className={LABEL}>
          {readyCount}/{heroes.length} ready
        </span>
      </header>

      <ul className="mt-2.5 space-y-1.5">
        {heroes.map((hero) => {
          const isReady = Boolean(ready[hero.id])
          const hasDraft = Boolean(drafts[hero.id]?.trim())
          return (
            <li key={hero.id}>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                  hero.id === selectedId ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-black/30 hover:border-white/25'
                }`}
              >
                <button type="button" onClick={() => onSelect(hero.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hero.color }} />
                    <span className="truncate text-xs font-semibold text-white">{hero.name}</span>
                    {hasDraft && <PenLine className="h-3 w-3 shrink-0 text-sky-300" aria-label="Action drafted" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-white/50">
                    <span className="truncate">{hero.classType}</span>
                    <span className="shrink-0 font-mono text-white/70">
                      {hero.hp}/{hero.maxHp}
                    </span>
                  </span>
                  <span className="mt-1.5 block">
                    <HpBar hp={hero.hp} maxHp={hero.maxHp} />
                  </span>
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onToggleReady(hero.id)}
                  className={`shrink-0 rounded px-2 py-1 font-mono text-[10px] font-semibold tracking-wider transition disabled:opacity-50 ${
                    isReady
                      ? 'border border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                      : 'border border-white/10 bg-white/5 text-white/55 hover:text-white'
                  }`}
                >
                  {isReady ? 'READY' : 'DRAFTING'}
                </button>
              </div>
            </li>
          )
        })}
        {heroes.length === 0 && <li className="text-xs italic text-white/40">ยังไม่มีตัวละครบนกระดาน</li>}
      </ul>

      <div className="mt-2.5 flex gap-1.5">
        <button
          type="button"
          disabled={locked || heroes.length === 0 || readyCount === heroes.length}
          onClick={onReadyAll}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          Ready all
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => setAdding((open) => !open)}
          className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          {adding ? <X className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />} Hero
        </button>
      </div>

      {adding && (
        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/40 p-2">
          {benched.length > 0 && (
            <div className="space-y-1">
              <p className={LABEL}>From Character Codex</p>
              {benched.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => {
                    onAddCharacter(character)
                    setAdding(false)
                  }}
                  className="flex w-full items-center justify-between rounded border border-white/10 px-2 py-1 text-left text-xs text-white/80 hover:border-amber-400/60"
                >
                  <span className="truncate">{character.name}</span>
                  <span className="shrink-0 text-[10px] text-white/45">{character.class_archetype || 'No class'}</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submitQuickHero} className="space-y-1.5">
            <p className={LABEL}>Quick hero</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={24}
              placeholder="Name"
              className="w-full rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400"
            />
            <div className="flex gap-1.5">
              <input
                value={classType}
                onChange={(event) => setClassType(event.target.value)}
                maxLength={24}
                placeholder="Class"
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400"
              />
              <button type="submit" className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black hover:bg-amber-400">
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

// ---------- enemies and NPCs ----------

type ThreatListProps = {
  tokens: Token[]
  selectedId: string | null
  locked: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onStartPlacing: (draft: PlacingDraft) => void
}

export function ThreatList({ tokens, selectedId, locked, onSelect, onRemove, onStartPlacing }: ThreatListProps) {
  const [formKind, setFormKind] = useState<PlacingDraft['kind'] | null>(null)
  const [name, setName] = useState('')
  const [hp, setHp] = useState('12')
  const [ac, setAc] = useState('12')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formKind) return
    onStartPlacing({
      kind: formKind,
      name: name.trim() || (formKind === 'enemy' ? 'Enemy' : 'Stranger'),
      hp: Number.parseInt(hp, 10) || 10,
      ac: Number.parseInt(ac, 10) || 10,
    })
    setFormKind(null)
    setName('')
  }

  const numeric = (setter: (value: string) => void) => (value: string) => setter(value.replace(/\D/g, '').slice(0, 3))

  return (
    <section className={`${GLASS} p-3`}>
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Skull className="h-4 w-4 text-red-400" /> Encounter
        </span>
        <span className="flex gap-1">
          {(['enemy', 'npc'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={locked}
              onClick={() => setFormKind((current) => (current === kind ? null : kind))}
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition disabled:opacity-40 ${
                formKind === kind ? 'border-amber-400/70 text-amber-300' : 'border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Plus className="h-3 w-3" /> {kind}
            </button>
          ))}
        </span>
      </header>

      {formKind && (
        <form onSubmit={submit} className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/40 p-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            placeholder={formKind === 'enemy' ? 'Enemy name' : 'NPC name'}
            className="w-full rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-amber-400"
          />
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-[10px] text-white/50">
              HP
              <input
                value={hp}
                onChange={(event) => numeric(setHp)(event.target.value)}
                inputMode="numeric"
                className="w-11 rounded border border-white/15 bg-black/60 px-1.5 py-1 text-center font-mono text-xs text-white outline-none focus:border-amber-400"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-white/50">
              AC
              <input
                value={ac}
                onChange={(event) => numeric(setAc)(event.target.value)}
                inputMode="numeric"
                className="w-11 rounded border border-white/15 bg-black/60 px-1.5 py-1 text-center font-mono text-xs text-white outline-none focus:border-amber-400"
              />
            </label>
            <button
              type="submit"
              className="ml-auto flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-black hover:bg-amber-400"
            >
              <MapPin className="h-3 w-3" /> Place
            </button>
          </div>
        </form>
      )}

      <ul className="mt-2 space-y-1">
        {tokens.map((token) => (
          <li
            key={token.id}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
              token.id === selectedId ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-black/30'
            }`}
          >
            <button type="button" onClick={() => onSelect(token.id)} className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${token.kind === 'enemy' ? 'bg-red-400' : 'bg-slate-400'}`} />
                <span className="truncate text-xs font-medium text-white">{token.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-white/60">
                  {token.hp}/{token.maxHp}
                </span>
              </span>
              <span className="mt-1 block">
                <HpBar hp={token.hp} maxHp={token.maxHp} />
              </span>
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => onRemove(token.id)}
              aria-label={`Remove ${token.name}`}
              className="shrink-0 text-white/35 transition hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {tokens.length === 0 && !formKind && (
          <li className="text-xs italic text-white/40">ยังไม่มีศัตรูหรือ NPC วางเองได้ หรือให้ DM เรียกออกมา</li>
        )}
      </ul>
    </section>
  )
}

// ---------- dice the DM asked for ----------

type RollRequestsProps = {
  requests: RollRequest[]
  heroes: Token[]
  locked: boolean
  onRoll: (request: RollRequest) => void
  onDismiss: (request: RollRequest) => void
}

export function RollRequests({ requests, heroes, locked, onRoll, onDismiss }: RollRequestsProps) {
  if (requests.length === 0) return null
  return (
    <section className={`${GLASS} border-amber-400/40 p-3`}>
      <header className="flex items-center gap-2 text-sm font-semibold text-white">
        <Dices className="h-4 w-4 text-amber-400" /> DM asks for a roll
      </header>
      <ul className="mt-2 space-y-1.5">
        {requests.map((request) => {
          const hero = heroes.find((entry) => entry.name === request.character)
          const modifier = abilityModifier(hero?.stats[request.ability])
          return (
            <li key={request.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{request.character}</p>
                  <p className="font-mono text-[10px] text-amber-300">
                    {request.ability} check · DC {request.dc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(request)}
                  aria-label="Skip this roll"
                  className="shrink-0 text-white/35 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {request.reason && <p className="mt-1 text-[11px] leading-snug text-white/65">{request.reason}</p>}
              <button
                type="button"
                disabled={locked}
                onClick={() => onRoll(request)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-amber-500 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Dices className="h-3 w-3" /> Roll d20 {formatModifier(modifier)}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------- selected token ----------

type TokenInspectorProps = {
  token: Token
  remainingFeet: number
  locked: boolean
  onHp: (delta: number) => void
  onRemove: () => void
  onCheck: (ability: AbilityKey) => void
}

const KIND_BADGE: Record<Token['kind'], string> = {
  hero: 'border-amber-400/50 text-amber-300',
  enemy: 'border-red-400/50 text-red-300',
  npc: 'border-slate-400/50 text-slate-300',
}

export function TokenInspector({ token, remainingFeet, locked, onHp, onRemove, onCheck }: TokenInspectorProps) {
  return (
    <section className={`${GLASS} p-3`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={LABEL}>Selected</p>
          <h2 className="truncate text-base font-bold text-white">{token.name}</h2>
          <p className="truncate text-xs text-white/55">{token.classType}</p>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${KIND_BADGE[token.kind]}`}>
          {token.kind}
        </span>
      </header>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-white/70">
            <Heart className="h-3.5 w-3.5 text-red-400" /> HP
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={() => onHp(-1)}
              aria-label="Lower HP"
              className="grid h-5 w-5 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-40"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-14 text-center font-mono text-sm font-bold tabular-nums text-white">
              {token.hp}/{token.maxHp}
            </span>
            <button
              type="button"
              disabled={locked}
              onClick={() => onHp(1)}
              aria-label="Raise HP"
              className="grid h-5 w-5 place-items-center rounded border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="mt-2">
          <HpBar hp={token.hp} maxHp={token.maxHp} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white/70">
          <Shield className="h-3.5 w-3.5 text-sky-400" /> AC <span className="ml-auto font-mono font-bold text-white">{token.ac}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-white/70">
          <Footprints className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="ml-auto whitespace-nowrap font-mono font-bold text-white">{Math.max(0, remainingFeet)} ft</span>
        </div>
      </div>

      {token.condition && token.condition !== 'Normal' && (
        <p className="mt-2 rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
          Condition: {token.condition}
        </p>
      )}

      <p className={`${LABEL} mt-3`}>Ability check · click to roll</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {ABILITY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={locked}
            onClick={() => onCheck(key)}
            className="rounded-lg border border-white/10 bg-black/30 py-1.5 text-center transition hover:border-amber-400/60 hover:bg-amber-400/10 disabled:opacity-50"
          >
            <span className="block font-mono text-[9px] uppercase tracking-wider text-white/45">{key}</span>
            <span className="block text-sm font-bold leading-tight text-white">{token.stats[key]}</span>
            <span className="block font-mono text-[10px] text-amber-300">{formatModifier(abilityModifier(token.stats[key]))}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={onRemove}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" /> Remove from board
      </button>
    </section>
  )
}

// ---------- scene summary ----------

export function SceneCard({ scene, mapName }: { scene: SceneSummary | null; mapName: string }) {
  const rows: [string, string][] = scene
    ? [
        ['Location', scene.location],
        ['Threat', scene.threat],
        ['Goal', scene.goal],
      ]
    : [['Location', mapName]]
  return (
    <section className={`${GLASS} p-3`}>
      <p className={LABEL}>Current state</p>
      <dl className="mt-1.5 space-y-1.5">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-400/80">{label}</dt>
              <dd className="text-xs leading-snug text-white/85">{value}</dd>
            </div>
          ))}
      </dl>
      {!scene && <p className="mt-2 text-[11px] leading-snug text-white/40">สรุปสถานการณ์จะขึ้นตรงนี้หลัง DM เล่าเทิร์นแรก</p>}
    </section>
  )
}
