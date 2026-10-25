'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/supabase/auth'
import { generateBoardNarrative, type BoardCampaign } from '@/lib/ai/boardDm'
import type { LoreEntry } from '@/lib/ai/lorebook'
import type { DmTokenInput, DmTurnInput, DmTurnResult, MapTheme, TokenKind } from './lib/types'

const MAX_TOKENS = 40
const MAX_ACTION_LENGTH = 600
const THEMES: MapTheme[] = ['forest', 'ruins', 'dungeon']
const KINDS: TokenKind[] = ['hero', 'enemy', 'npc']

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : []
}

// Server Functions are reachable by direct POST, so the payload is rebuilt field by field
// instead of being trusted as typed. This also keeps the prompt to a bounded size.
function sanitise(input: DmTurnInput): DmTurnInput {
  const tokens: DmTokenInput[] = list(input?.tokens)
    .slice(0, MAX_TOKENS)
    .map((token) => ({
      name: text(token.name, 40) || 'Unknown',
      kind: KINDS.includes(token.kind as TokenKind) ? (token.kind as TokenKind) : 'npc',
      classType: text(token.classType, 40) || 'Wanderer',
      x: int(token.x, 0, 99, 0),
      y: int(token.y, 0, 99, 0),
      hp: int(token.hp, 0, 999, 0),
      maxHp: int(token.maxHp, 1, 999, 1),
      ac: int(token.ac, 0, 40, 10),
      condition: text(token.condition, 40) || 'Normal',
    }))

  const scene = input?.scene && typeof input.scene === 'object' ? input.scene : null

  return {
    campaignId: text(input?.campaignId, 64) || null,
    turn: int(input?.turn, 1, 100000, 1),
    mapName: text(input?.mapName, 80) || 'Battle Board',
    mapTheme: THEMES.includes(input?.mapTheme) ? input.mapTheme : 'forest',
    cols: int(input?.cols, 1, 99, 18),
    rows: int(input?.rows, 1, 99, 14),
    tokens,
    actions: list(input?.actions)
      .slice(0, MAX_TOKENS)
      .map((entry) => ({
        character: text(entry.character, 40) || 'Unknown Adventurer',
        classType: text(entry.classType, 40) || 'Wanderer',
        action: text(entry.action, MAX_ACTION_LENGTH) || null,
      })),
    rolls: (Array.isArray(input?.rolls) ? input.rolls : []).slice(-20).map((roll) => text(roll, 300)).filter(Boolean),
    history: list(input?.history)
      .slice(-4)
      .map((entry) => ({ turn: int(entry.turn, 1, 100000, 1), text: text(entry.text, 4000) })),
    scene: scene
      ? { location: text(scene.location, 200), threat: text(scene.threat, 300), goal: text(scene.goal, 300) }
      : null,
  }
}

/** One turn of the solo Battle Board: every hero's action goes in, the narration and board changes come out. */
export async function narrateBoardTurn(input: DmTurnInput): Promise<DmTurnResult> {
  const { supabase } = await requireAuthenticatedUser()



  const turn = sanitise(input)

  let campaign: BoardCampaign | null = null
  let loreEntries: LoreEntry[] = []

  if (turn.campaignId) {
    const { data: campaignRow, error: campaignErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', turn.campaignId)
      .maybeSingle()
    if (campaignErr) throw new Error(`Failed to load campaign: ${campaignErr.message}`)

    if (campaignRow) {
      campaign = campaignRow
      const db = createAdminClient() || supabase
      const { data: lore, error: loreErr } = await db
        .from('lorebook_entries')
        .select('*')
        .eq('campaign_id', turn.campaignId)
      if (loreErr) throw new Error(`Failed to fetch lorebook entries: ${loreErr.message}`)
      loreEntries = lore || []
    }
  }

  return generateBoardNarrative(turn, campaign, loreEntries)
}
