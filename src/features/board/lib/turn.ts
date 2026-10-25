import { findFreeTiles } from './maps'
import { appendLog, logEntry, makeToken, uniqueName, type BoardSession } from './session'
import { newId } from './utils'
import type { BoardMap, DmTurnInput, DmTurnResult, LogEntry, RollRequest, Token } from './types'

const HISTORY_TURNS = 4
const PAGE_LENGTH = 230
const MAX_SPAWNS_PER_TURN = 6
const MAX_TOKENS = 40
const THAI_COMBINING = /[\u0E31\u0E33-\u0E3A\u0E47-\u0E4E]/

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Everything the Dungeon Master needs to know about this turn. Every hero on the board is included. */
export function buildDmInput(session: BoardSession, map: BoardMap): DmTurnInput {
  const heroes = session.tokens.filter((token) => token.kind === 'hero')
  const history = session.log
    .filter((entry) => entry.kind === 'narration')
    .slice(-HISTORY_TURNS)
    .map((entry) => ({ turn: entry.turn, text: entry.text }))

  return {
    campaignId: session.campaignId,
    turn: session.turn,
    mapName: map.name,
    mapTheme: map.theme,
    cols: map.cols,
    rows: map.rows,
    tokens: session.tokens.map((token) => ({
      name: token.name,
      kind: token.kind,
      classType: token.classType,
      x: token.x,
      y: token.y,
      hp: token.hp,
      maxHp: token.maxHp,
      ac: token.ac,
      condition: token.condition,
    })),
    actions: heroes.map((hero) => ({
      character: hero.name,
      classType: hero.classType,
      action: session.drafts[hero.id]?.trim() || null,
    })),
    rolls: session.pendingRolls,
    history,
    scene: session.scene,
  }
}

/** Break the narration into text-box pages, cutting at spaces so no word is split. */
export function toPages(paragraphs: string[]): string[] {
  const pages: string[] = []
  for (const paragraph of paragraphs) {
    let rest = paragraph.replace(/\s+/g, ' ').trim()
    while (rest.length > PAGE_LENGTH) {
      let cut = rest.lastIndexOf(' ', PAGE_LENGTH)
      if (cut < PAGE_LENGTH * 0.5) {
        // Thai often has no space nearby: take the next one, or cut hard without orphaning a vowel or tone mark.
        const next = rest.indexOf(' ', PAGE_LENGTH)
        cut = next !== -1 && next < PAGE_LENGTH * 1.5 ? next : PAGE_LENGTH
        while (cut < rest.length && THAI_COMBINING.test(rest[cut])) cut++
      }
      pages.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) pages.push(rest)
  }
  return pages.length > 0 ? pages : ['...']
}

/** Fold the Dungeon Master's answer into the table and start the next turn. */
export function applyDmResult(session: BoardSession, map: BoardMap, input: DmTurnInput, result: DmTurnResult): BoardSession {
  const turn = session.turn
  const entries: LogEntry[] = []

  for (const action of input.actions) {
    entries.push(logEntry(turn, 'action', action.character, action.action ?? '(ไม่ได้ส่งแอ็กชัน)'))
  }
  entries.push(logEntry(turn, 'narration', 'AI Dungeon Master', result.narration.join('\n\n')))

  let tokens: Token[] = session.tokens.map((token) => ({ ...token }))

  for (const change of result.hpChanges) {
    const target = tokens.find((token) => sameName(token.name, change.target))
    if (!target || !Number.isFinite(change.delta) || change.delta === 0) continue
    const before = target.hp
    target.hp = Math.max(0, Math.min(target.maxHp, target.hp + Math.round(change.delta)))
    if (target.hp === before) continue
    if (target.kind === 'hero') target.condition = target.hp === 0 ? 'Unconscious' : target.condition === 'Unconscious' ? 'Normal' : target.condition
    entries.push(logEntry(turn, 'system', 'Board', `${target.name}: HP ${before} → ${target.hp}`))
  }

  // Creatures the DM declared dead, plus any non-hero that dropped to 0 HP.
  const fallen = tokens.filter(
    (token) =>
      token.kind !== 'hero' && (token.hp <= 0 || result.defeated.some((name) => sameName(name, token.name)))
  )
  if (fallen.length > 0) {
    const gone = new Set(fallen.map((token) => token.id))
    tokens = tokens.filter((token) => !gone.has(token.id))
    entries.push(logEntry(turn, 'system', 'Board', `ออกจากกระดาน: ${fallen.map((token) => token.name).join(', ')}`))
  }

  for (const spawn of result.spawns.slice(0, MAX_SPAWNS_PER_TURN)) {
    if (tokens.length >= MAX_TOKENS) break
    const anchorToken = spawn.near ? tokens.find((token) => sameName(token.name, spawn.near ?? '')) : null
    const anchor = anchorToken ?? map.anchors.threat
    // Appear a couple of tiles away from the named token, not right on top of it.
    const [spot] = findFreeTiles(map, tokens, anchor, anchorToken ? 14 : 1).slice(-1)
    if (!spot) continue
    const created = makeToken(
      spawn.kind,
      { name: uniqueName(tokens, spawn.name), hp: spawn.hp, ac: spawn.ac },
      spot
    )
    tokens.push(created)
    entries.push(logEntry(turn, 'system', 'Board', `${created.name} ปรากฏบนกระดาน (HP ${created.hp}, AC ${created.ac})`))
  }

  const heroNames = tokens.filter((token) => token.kind === 'hero').map((token) => token.name)
  const rollRequests: RollRequest[] = result.rolls
    .filter((roll) => heroNames.some((name) => sameName(name, roll.character)))
    .map((roll) => ({
      id: newId('req'),
      character: heroNames.find((name) => sameName(name, roll.character)) ?? roll.character,
      ability: roll.ability,
      dc: roll.dc,
      reason: roll.reason,
    }))

  return {
    ...session,
    turn: turn + 1,
    tokens,
    drafts: {},
    ready: {},
    movedFeet: {},
    log: appendLog(session.log, entries),
    scene: result.scene ?? session.scene,
    rollRequests,
    pendingRolls: [],
    dialogue: { id: newId('dlg'), speaker: 'AI Dungeon Master', pages: toPages(result.narration) },
  }
}
