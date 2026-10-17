'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, Dices, Loader2, Minus, Plus, RotateCcw, ScrollText, TriangleAlert, X } from 'lucide-react'
import { useAlert } from '@/components/ui/AlertModal'
import BoardScene, { type BoardSceneHandle, type SceneInsets } from './BoardScene'
import DialogueBox from './DialogueBox'
import StoryLog from './StoryLog'
import { GLASS, LABEL, PartyRoster, RollRequests, SceneCard, ThreatList, TokenInspector, type PlacingDraft } from './BoardPanels'
import { DiceRoller, abilityModifier, describeRoll, rollDice, type DiceActor, type DiceRoll } from '@/components/dice'
import { playDiceRollSound, playSystemSound } from '@/lib/sound'
import { FEET_PER_TILE, MAP_THEMES, findFreeTiles, generateMap, reachableTiles, tileAt, tileIndex } from '@/lib/board/maps'
import {
  appendLog,
  createSession,
  heroFromCharacter,
  initialSession,
  logEntry,
  makeToken,
  heroColor,
  saveSession,
  uniqueName,
  type BoardSession,
  type CampaignOption,
  type CodexCharacter,
} from '@/lib/board/session'
import { applyDmResult, buildDmInput } from '@/lib/board/turn'
import { ABILITY_KEYS, type AbilityKey, type MapTheme, type NarrateAction, type Point, type RollRequest, type Token } from '@/lib/board/types'

type BoardPlaygroundProps = {
  userId: string
  characters: CodexCharacter[]
  campaigns: CampaignOption[]
  narrateAction: NarrateAction
}

const COUNTDOWN_MS = 3000
const NO_REACH = new Map<number, number>()
// Room the HUD takes. The side columns are see-through, so the map is allowed to run a little way under them.
const HUD_INSETS: SceneInsets = { top: 52, right: 170, bottom: 196, left: 130 }

type Notice = { tone: 'error' | 'info'; text: string }

export default function BoardPlayground({ userId, characters, campaigns, narrateAction }: BoardPlaygroundProps) {
  const { showConfirm } = useAlert()
  const [session, setSession] = useState<BoardSession>(() => initialSession(userId, characters))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placing, setPlacing] = useState<PlacingDraft | null>(null)
  const [hoverTile, setHoverTile] = useState<Point | null>(null)
  const [zoom, setZoom] = useState(100)
  const [logOpen, setLogOpen] = useState(false)
  const [diceOpen, setDiceOpen] = useState(false)
  const [activeRoll, setActiveRoll] = useState<DiceRoll | null>(null)
  const [rollHistory, setRollHistory] = useState<DiceRoll[]>([])
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const sceneRef = useRef<BoardSceneHandle>(null)
  const draftInputRef = useRef<HTMLInputElement>(null)
  const resolveRef = useRef<() => void>(() => {})

  const map = useMemo(() => generateMap(session.theme, session.seed), [session.theme, session.seed])
  const { tokens, ready, drafts, movedFeet } = session
  const heroes = useMemo(() => tokens.filter((token) => token.kind === 'hero'), [tokens])
  const others = useMemo(() => tokens.filter((token) => token.kind !== 'hero'), [tokens])
  const selected = tokens.find((token) => token.id === selectedId) ?? null
  const counting = countdownEnd !== null
  const locked = resolving

  // The hero whose action is being written: the selected one, else the first who is not ready yet.
  const activeHero =
    (selected?.kind === 'hero' ? selected : null) ?? heroes.find((hero) => !ready[hero.id]) ?? heroes[0] ?? null
  const activeReady = activeHero ? Boolean(ready[activeHero.id]) : false

  const remainingFeet = selected ? selected.speed - (movedFeet[selected.id] ?? 0) : 0
  const reachable = useMemo(
    () => (selected && !locked && !placing ? reachableTiles(map, tokens, selected, remainingFeet) : NO_REACH),
    [map, tokens, selected, remainingFeet, locked, placing]
  )

  // Heroes as the dice tray sees them: a name plus the ability bonuses they can roll with.
  const diceActors = useMemo<DiceActor[]>(
    () =>
      heroes.map((hero) => ({
        id: hero.id,
        name: hero.name,
        modifiers: Object.fromEntries(ABILITY_KEYS.map((key) => [key, abilityModifier(hero.stats[key])])),
      })),
    [heroes]
  )

  const benched = useMemo(() => {
    const seated = new Set(tokens.map((token) => token.characterId).filter(Boolean))
    return characters.filter((character) => !seated.has(character.id))
  }, [characters, tokens])

  useEffect(() => {
    playSystemSound('player_enter_table')
  }, [])

  // Keep the table in localStorage so a reload picks up where it left off.
  useEffect(() => {
    const timer = window.setTimeout(() => saveSession(userId, session), 300)
    return () => window.clearTimeout(timer)
  }, [userId, session])

  const flash = (tone: Notice['tone'], text: string) => {
    if (tone === 'error') {
      playSystemSound('error')
    }
    setNotice({ tone, text })
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 6000)
  }

  // ---------- turn flow ----------

  const resolveTurn = async () => {
    if (resolving) return
    setCountdownEnd(null)
    setResolving(true)
    const input = buildDmInput(session, map)
    try {
      const result = await narrateAction(input)
      setSession((current) => applyDmResult(current, map, input, result))
      setSelectedId(heroes[0]?.id ?? null)
      playSystemSound('ai_reply')
    } catch (error: unknown) {
      console.error(error)
      setSession((current) => ({ ...current, ready: {} }))
      flash('error', error instanceof Error && error.message ? error.message : 'Dungeon Master ตอบกลับไม่สำเร็จ ลองกด READY อีกครั้ง')
    } finally {
      setResolving(false)
    }
  }

  useEffect(() => {
    resolveRef.current = () => void resolveTurn()
  })

  // Short countdown once every hero is ready. Un-readying anyone cancels it.
  useEffect(() => {
    if (countdownEnd === null) return
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        window.clearInterval(timer)
        resolveRef.current()
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [countdownEnd])

  const applyReady = (nextReady: Record<string, boolean>) => {
    setSession((current) => ({ ...current, ready: nextReady }))
    if (heroes.length > 0 && heroes.every((hero) => nextReady[hero.id])) {
      setSecondsLeft(Math.ceil(COUNTDOWN_MS / 1000))
      setCountdownEnd(Date.now() + COUNTDOWN_MS)
    } else {
      setCountdownEnd(null)
    }
  }

  const selectToken = (id: string, focusCamera: boolean) => {
    setSelectedId(id)
    const token = tokens.find((entry) => entry.id === id)
    if (token && focusCamera) sceneRef.current?.focus(token)
  }

  const toggleReady = (heroId: string) => {
    if (locked) return
    const nextReady = { ...ready, [heroId]: !ready[heroId] }
    applyReady(nextReady)
    if (nextReady[heroId]) {
      const next = heroes.find((hero) => !nextReady[hero.id])
      if (next) {
        selectToken(next.id, true)
        draftInputRef.current?.focus()
      }
    }
  }

  const readyAll = () => {
    if (locked) return
    applyReady(Object.fromEntries(heroes.map((hero) => [hero.id, true])))
  }

  const setDraft = (heroId: string, text: string) => {
    setSession((current) => ({ ...current, drafts: { ...current.drafts, [heroId]: text.slice(0, 600) } }))
  }

  // ---------- board ----------

  const handleTileClick = (point: Point) => {
    if (locked) return
    const tile = tileAt(map, point.x, point.y)
    if (!tile) return

    if (placing) {
      const occupied = tokens.some((token) => token.x === point.x && token.y === point.y)
      if (tile.blocked || occupied) {
        flash('info', 'ช่องนี้วางไม่ได้ เลือกช่องว่างที่เดินได้')
        return
      }
      const created = makeToken(placing.kind, { ...placing, name: uniqueName(tokens, placing.name) }, point)
      setSession((current) => ({
        ...current,
        tokens: [...current.tokens, created],
        log: appendLog(current.log, [logEntry(current.turn, 'system', 'Board', `วาง ${created.name} ลงกระดาน (HP ${created.hp}, AC ${created.ac})`)]),
      }))
      setPlacing(null)
      setSelectedId(created.id)
      return
    }

    if (!selected) return
    const cost = reachable.get(tileIndex(map, point.x, point.y))
    if (cost === undefined) return
    setSession((current) => ({
      ...current,
      tokens: current.tokens.map((token) => (token.id === selected.id ? { ...token, x: point.x, y: point.y } : token)),
      movedFeet: { ...current.movedFeet, [selected.id]: (current.movedFeet[selected.id] ?? 0) + cost },
    }))
  }

  const changeHp = (tokenId: string, delta: number) => {
    setSession((current) => ({
      ...current,
      tokens: current.tokens.map((token) =>
        token.id === tokenId ? { ...token, hp: Math.max(0, Math.min(token.maxHp, token.hp + delta)) } : token
      ),
    }))
  }

  const removeToken = async (tokenId: string) => {
    const token = tokens.find((entry) => entry.id === tokenId)
    if (!token || locked) return
    if (token.kind === 'hero') {
      const confirmed = await showConfirm({
        title: 'นำตัวละครออกจากปาร์ตี้',
        message: `ต้องการนำ ${token.name} ออกจากปาร์ตี้ใช่หรือไม่?`,
        confirmText: 'นำออก',
        cancelText: 'ยกเลิก',
      })
      if (!confirmed) return
    }
    setCountdownEnd(null)
    setSession((current) => ({
      ...current,
      tokens: current.tokens.filter((entry) => entry.id !== tokenId),
      ready: token.kind === 'hero' ? {} : current.ready,
      rollRequests: current.rollRequests.filter((request) => request.character !== token.name),
      log: appendLog(current.log, [logEntry(current.turn, 'system', 'Board', `${token.name} ออกจากกระดาน`)]),
    }))
    if (selectedId === tokenId) setSelectedId(null)
  }

  const addHero = (build: (at: Point, colorIndex: number) => Token) => {
    if (locked) return
    const [spot] = findFreeTiles(map, tokens, heroes[0] ?? map.anchors.party, 1)
    if (!spot) {
      flash('info', 'ไม่มีช่องว่างให้วางตัวละครเพิ่ม')
      return
    }
    const hero = build(spot, heroes.length)
    hero.name = uniqueName(tokens, hero.name)
    setCountdownEnd(null)
    setSession((current) => ({
      ...current,
      tokens: [...current.tokens, hero],
      ready: {},
      log: appendLog(current.log, [logEntry(current.turn, 'system', 'Board', `${hero.name} (${hero.classType}) เข้าร่วมปาร์ตี้`)]),
    }))
    setSelectedId(hero.id)
  }

  const startNewTable = async (theme: MapTheme) => {
    if (locked) return
    const confirmed = await showConfirm({
      title: 'เริ่มโต๊ะใหม่',
      message: 'การเริ่มโต๊ะใหม่จะล้างข้อมูลกระดาน เทิร์น และบันทึกเหตุการณ์ปัจจุบันทั้งหมด ต้องการดำเนินการต่อหรือไม่?',
      confirmText: 'เริ่มใหม่',
      cancelText: 'ยกเลิก',
    })
    if (!confirmed) return
    setCountdownEnd(null)
    setPlacing(null)
    setSelectedId(null)
    setActiveRoll(null)
    setRollHistory([])
    setSession(createSession(theme, characters, session.campaignId))
    sceneRef.current?.fit()
  }

  // ---------- dice ----------

  /** Every roll at the table ends up here: show it in the tray, log it, and queue it for the DM. */
  const recordRoll = (roll: DiceRoll, context = '') => {
    playDiceRollSound(roll.total)
    const who = roll.roller || 'Party'
    const what = context ? `${roll.label} · ${context}` : roll.label
    setActiveRoll(roll)
    setRollHistory((history) => [roll, ...history].slice(0, 20))
    setDiceOpen(true)
    setSession((current) => ({
      ...current,
      log: appendLog(current.log, [logEntry(current.turn, 'roll', who, `${what}\n${describeRoll(roll)}`)]),
      pendingRolls: [...current.pendingRolls, `${who} — ${what}: ${describeRoll(roll)}`].slice(-20),
    }))
  }

  const dismissRequest = (request: RollRequest) => {
    setSession((current) => ({ ...current, rollRequests: current.rollRequests.filter((entry) => entry.id !== request.id) }))
  }

  const answerRequest = (request: RollRequest) => {
    const hero = heroes.find((entry) => entry.name === request.character)
    recordRoll(
      rollDice({
        sides: 20,
        modifier: abilityModifier(hero?.stats[request.ability]),
        roller: request.character,
        label: `${request.ability} check`,
        dc: request.dc,
      }),
      request.reason
    )
    dismissRequest(request)
  }

  const quickCheck = (token: Token, ability: AbilityKey) => {
    recordRoll(
      rollDice({ sides: 20, modifier: abilityModifier(token.stats[ability]), roller: token.name, label: `${ability} check` })
    )
  }

  // Esc leaves placing mode, then closes panels.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (placing) setPlacing(null)
      else if (logOpen) setLogOpen(false)
      else if (diceOpen) setDiceOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [placing, logOpen, diceOpen])

  // ---------- derived labels ----------

  const hoverInfo = (() => {
    if (!hoverTile) return null
    const tile = tileAt(map, hoverTile.x, hoverTile.y)
    if (!tile) return null
    const cost = reachable.get(tileIndex(map, hoverTile.x, hoverTile.y))
    const occupant = tokens.find((token) => token.x === hoverTile.x && token.y === hoverTile.y)
    return {
      label: `${hoverTile.x},${hoverTile.y} · ${tile.prop ?? tile.terrain}`,
      detail: occupant ? occupant.name : cost !== undefined ? `move ${cost} ft` : tile.blocked ? 'blocked' : '',
    }
  })()

  const phaseLabel = resolving ? 'DM is narrating' : counting ? `All ready · ${secondsLeft}s` : 'Drafting'

  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#141b24_0%,#070a0e_55%,#030406_100%)] font-sans text-white">
      <BoardScene
        ref={sceneRef}
        map={map}
        tokens={tokens}
        selectedId={selectedId}
        reachable={reachable}
        insets={HUD_INSETS}
        onTileClick={handleTileClick}
        onTokenClick={(id) => !placing && selectToken(id, false)}
        onHoverTile={setHoverTile}
        onZoomChange={setZoom}
      />

      {/* Everything below floats over the map. Only the panels themselves take pointer events. */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top bar */}
        <header className="pointer-events-auto absolute inset-x-0 top-0 flex h-12 items-center gap-3 border-b border-white/10 bg-black/50 px-3 backdrop-blur-md">
          <Link href="/hub" className="flex items-center gap-1.5 text-xs text-white/60 transition hover:text-amber-400">
            <ArrowLeft className="h-3.5 w-3.5" /> Hub
          </Link>
          <span className="h-5 w-px bg-white/10" />
          <div className="hidden min-w-0 sm:block">
            <p className={`${LABEL} leading-none`}>Battle Board · Solo prototype</p>
            <p className="truncate text-sm font-semibold leading-tight text-white">{map.name}</p>
          </div>

          <label className="ml-2 hidden items-center gap-1.5 lg:flex">
            <span className={LABEL}>Map</span>
            <select
              value={session.theme}
              disabled={locked}
              onChange={(event) => startNewTable(event.target.value as MapTheme)}
              className="rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white outline-none focus:border-amber-400 disabled:opacity-50"
            >
              {MAP_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={locked}
            onClick={() => startNewTable(session.theme)}
            title="New table on a fresh map"
            className="hidden items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-50 lg:flex cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> New table
          </button>

          <div className="mx-auto flex items-center gap-2">
            <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
              Turn {session.turn}
            </span>
            <span
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${
                resolving || counting ? 'border-amber-400/50 text-amber-200' : 'border-white/15 text-white/60'
              }`}
            >
              {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : counting ? <Clock className="h-3 w-3" /> : null}
              {phaseLabel}
            </span>
          </div>

          <label className="hidden items-center gap-1.5 xl:flex">
            <span className={LABEL}>Campaign</span>
            <select
              value={session.campaignId ?? ''}
              disabled={locked}
              onChange={(event) => setSession((current) => ({ ...current, campaignId: event.target.value || null }))}
              className="max-w-44 rounded border border-white/15 bg-black/60 px-2 py-1 text-xs text-white outline-none focus:border-amber-400 disabled:opacity-50"
            >
              <option value="">Freeform adventure</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center overflow-hidden rounded border border-white/15">
            <button type="button" onClick={() => sceneRef.current?.zoomBy(1 / 1.25)} aria-label="Zoom out" className="grid h-7 w-7 place-items-center text-white/70 hover:bg-white/10 cursor-pointer">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 border-x border-white/15 text-center font-mono text-[11px] tabular-nums text-white/80">{zoom}%</span>
            <button type="button" onClick={() => sceneRef.current?.fit()} className="border-r border-white/15 px-2 font-mono text-[10px] uppercase tracking-wider text-white/70 hover:bg-white/10 cursor-pointer">
              Fit
            </button>
            <button type="button" onClick={() => sceneRef.current?.zoomBy(1.25)} aria-label="Zoom in" className="grid h-7 w-7 place-items-center text-white/70 hover:bg-white/10 cursor-pointer">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLogOpen((open) => !open)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition ${
              logOpen ? 'border-amber-400/70 bg-amber-400/15 text-amber-200' : 'border-white/15 text-white/70 hover:bg-white/10'
            } cursor-pointer`}
          >
            <ScrollText className="h-3.5 w-3.5" /> Log
          </button>
        </header>

        {/* Left column: what is selected, and where the story stands (wide screens only) */}
        <aside className="pointer-events-auto absolute left-3 top-15 hidden max-h-[calc(100%-4.5rem)] w-60 flex-col gap-3 overflow-y-auto pb-1 lg:flex">
          {selected ? (
            <TokenInspector
              token={selected}
              remainingFeet={remainingFeet}
              locked={locked}
              onHp={(delta) => changeHp(selected.id, delta)}
              onRemove={() => removeToken(selected.id)}
              onCheck={(ability) => quickCheck(selected, ability)}
            />
          ) : (
            <section className={`${GLASS} p-3`}>
              <p className={LABEL}>No token selected</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">คลิกตัวละครบนแมพหรือในรายชื่อทางขวาเพื่อดูค่าพลังและสั่งเดิน</p>
            </section>
          )}
          <SceneCard scene={session.scene} mapName={map.name} />
        </aside>

        {/* Right column: who is at the table (hidden on very narrow windows) */}
        <aside className="pointer-events-auto absolute right-3 top-15 hidden max-h-[calc(100%-22.5rem)] w-72 flex-col gap-3 overflow-y-auto pb-1 md:flex lg:max-h-[calc(100%-8rem)]">
          <RollRequests requests={session.rollRequests} heroes={heroes} locked={locked} onRoll={answerRequest} onDismiss={dismissRequest} />
          <PartyRoster
            heroes={heroes}
            ready={ready}
            drafts={drafts}
            selectedId={selectedId}
            locked={locked}
            benched={benched}
            onSelect={(id) => selectToken(id, true)}
            onToggleReady={toggleReady}
            onReadyAll={readyAll}
            onAddCharacter={(character) => addHero((at, colorIndex) => heroFromCharacter(character, colorIndex, at))}
            onAddQuickHero={(name, classType) =>
              addHero((at, colorIndex) => makeToken('hero', { name, classType, hp: 20, ac: 13, color: heroColor(colorIndex) }, at))
            }
          />
          <ThreatList
            tokens={others}
            selectedId={selectedId}
            locked={locked}
            onSelect={(id) => selectToken(id, true)}
            onRemove={removeToken}
            onStartPlacing={(draft) => {
              setPlacing(draft)
              setSelectedId(null)
            }}
          />
        </aside>

        {/* Bottom centre: narration text box and the action bar */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3 lg:left-64 lg:right-76">
          <div className="pointer-events-auto w-full max-w-3xl space-y-2">
            {notice && (
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-md ${
                  notice.tone === 'error' ? 'border-red-400/50 bg-red-950/70 text-red-100' : 'border-white/15 bg-black/60 text-white/80'
                }`}
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{notice.text}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {placing && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/50 bg-amber-950/60 px-3 py-2 text-xs text-amber-100 backdrop-blur-md">
                <span>
                  คลิกช่องว่างบนแมพเพื่อวาง <strong>{placing.name}</strong> ({placing.kind})
                </span>
                <button type="button" onClick={() => setPlacing(null)} className="font-mono text-[10px] uppercase tracking-wider text-amber-200/80 hover:text-white cursor-pointer">
                  Esc · cancel
                </button>
              </div>
            )}

            <DialogueBox
              key={session.dialogue.id}
              speaker={session.dialogue.speaker}
              pages={session.dialogue.pages}
              busy={resolving}
              onOpenLog={() => setLogOpen(true)}
            />

            <div className={`${GLASS} flex items-center gap-2 p-2`}>
              {activeHero ? (
                <span className="flex max-w-36 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs font-semibold text-white">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: activeHero.color }} />
                  <span className="truncate">{activeHero.name}</span>
                </span>
              ) : null}
              <input
                ref={draftInputRef}
                type="text"
                value={activeHero ? drafts[activeHero.id] ?? '' : ''}
                disabled={!activeHero || activeReady || locked}
                onChange={(event) => activeHero && setDraft(activeHero.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && activeHero) toggleReady(activeHero.id)
                }}
                placeholder={
                  !activeHero
                    ? 'Add a hero to start'
                    : activeReady
                      ? `${activeHero.name} is locked in. Click READY again to edit.`
                      : `Draft ${activeHero.name}'s action...`
                }
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-amber-400 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!activeHero || locked}
                onClick={() => activeHero && toggleReady(activeHero.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] transition disabled:opacity-50 ${
                  activeReady ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-amber-500 text-black hover:bg-amber-400'
                } cursor-pointer`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {activeReady ? 'Ready!' : 'Ready up'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom left: what the cursor is over */}
        <div className="absolute bottom-3 left-3 hidden w-56 lg:block">
          <div className={`${GLASS} px-3 py-2`}>
            <p className={LABEL}>{hoverInfo ? hoverInfo.label : 'Wheel zoom · drag pan · right-drag rotate'}</p>
            <p className="mt-0.5 h-4 text-xs text-white/75">{hoverInfo?.detail || `1 tile = ${FEET_PER_TILE} ft`}</p>
          </div>
        </div>

        {/* Bottom right: dice */}
        <div className="pointer-events-auto absolute bottom-62 right-3 flex flex-col items-end gap-2 lg:bottom-3">
          {diceOpen && (
            <DiceRoller
              actors={diceActors}
              roll={activeRoll}
              history={rollHistory}
              onRoll={(roll) => recordRoll(roll)}
              onClose={() => setDiceOpen(false)}
              hint="เลือกลูกเต๋าแล้วกด ROLL ผลทอยจะถูกเก็บลง Log และส่งให้ DM ในเทิร์นถัดไป"
            />
          )}
          <button
            type="button"
            onClick={() => setDiceOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.18em] shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition ${
              diceOpen ? 'border-amber-400/70 bg-amber-400/20 text-amber-200' : 'border-white/15 bg-black/55 text-white/85 hover:border-amber-400/60'
            } cursor-pointer`}
          >
            <Dices className="h-4 w-4 text-amber-400" /> Dice
            {session.rollRequests.length > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] text-black">{session.rollRequests.length}</span>
            )}
          </button>
        </div>

        {/* Story log drawer */}
        {logOpen && (
          <div className="pointer-events-auto absolute bottom-3 right-3 top-15 z-10">
            <StoryLog entries={session.log} onClose={() => setLogOpen(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
