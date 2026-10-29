import { CHARACTER_CONDITIONS } from '@/features/character/domain'
import { CLASSIC_TEMPLATE } from '@/features/character/template'
import { escapeRegexLiteral, getMemberResourceDescriptors } from './dmParty'
import type { MemberResourceDescriptor, PartyMemberAction, PartyMemberStateUpdate } from './dmTypes'

// Reads the AI DM's reply back into numbers: inline "(Name — HP: a/b -> c/d)" changes,
// the authoritative "สถานะปาร์ตี้ / Party Status" block, and low-vitality conditions.

const THAI_CONDITION_MAP: Record<string, (typeof CHARACTER_CONDITIONS)[number]> = {
  ปกติ: 'Normal',
  บาดเจ็บ: 'Bloodied',
  เลือดอาบ: 'Bloodied',
  สาหัส: 'Bloodied',
  ติดพิษ: 'Poisoned',
  พิษ: 'Poisoned',
  มึนงง: 'Stunned',
  สตัน: 'Stunned',
  ตาบอด: 'Blinded',
  มองไม่เห็น: 'Blinded',
  หมดสติ: 'Unconscious',
  สลบ: 'Unconscious',
  ได้รับพร: 'Blessed',
  หลงใหล: 'Charmed',
  อ่อนล้า: 'Exhausted',
  เหนื่อยล้า: 'Exhausted',
}

function normalizeParsedCondition(
  raw: string,
  fallback: string,
  allowedConditions?: readonly string[]
): string {
  const cleaned = raw.replace(/[*[\]()]/g, '').trim()
  if (!cleaned) return fallback

  if (allowedConditions && allowedConditions.length > 0) {
    const tplMatch = allowedConditions.find(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    )
    if (tplMatch) return tplMatch
  }

  const exactMatch = CHARACTER_CONDITIONS.find(
    (c) => c.toLowerCase() === cleaned.toLowerCase()
  )
  if (exactMatch) return exactMatch

  for (const [thaiKey, mapped] of Object.entries(THAI_CONDITION_MAP)) {
    if (cleaned.includes(thaiKey)) return mapped
  }
  return fallback
}

type TrackedMember = PartyMemberAction & { characterId: string }
type ResourceValue = { current: number; max: number }
type ResolvedResource = { target: PartyMemberStateUpdate; desc: MemberResourceDescriptor }

// Everything the parsing steps share: the reply, the members and their working state
type ExtractionContext = {
  narrative: string
  trackedMembers: TrackedMember[]
  // Longest names first so prefix names (e.g. "เรน" vs "เรนเจอร์") never collide when matching text
  membersByNameLength: TrackedMember[]
  stateByCharId: Map<string, PartyMemberStateUpdate>
  descriptorsByCharId: Map<string, MemberResourceDescriptor[]>
  initialCustomByCharId: Map<string, Record<string, ResourceValue>>
}

function cleanCandidateName(raw: string): string {
  return raw.replace(/[*_`[\]"']/g, '').trim().toLowerCase()
}

/**
 * Extracts updated HP, Skill Cost (SP), Custom Template Resources (Sanity, Stress, Luck, etc.),
 * and Status Condition for each party member from the AI Dungeon Master's narrative and `[ Overview ]` section.
 */
export function extractPartyStateUpdates(
  narrative: string,
  partyActions: PartyMemberAction[],
): PartyMemberStateUpdate[] {
  const trackedMembers = partyActions.filter((m): m is TrackedMember => Boolean(m.characterId))
  if (trackedMembers.length === 0) return []

  const ctx = createExtractionContext(narrative, trackedMembers)

  // 1. Inline resource changes anywhere in the narrative
  applyInlineResourceChanges(ctx)
  // 2. "สถานะปาร์ตี้ :" inside [ Overview ] (authoritative end-of-turn values)
  applyPartyStatusBlock(ctx)
  // 3. Low / zero vitality conditions, then keep only members whose sheet actually changed
  return collectChangedMembers(ctx)
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

function createExtractionContext(narrative: string, trackedMembers: TrackedMember[]): ExtractionContext {
  const stateByCharId = new Map<string, PartyMemberStateUpdate>()
  const descriptorsByCharId = new Map<string, MemberResourceDescriptor[]>()
  const initialCustomByCharId = new Map<string, Record<string, ResourceValue>>()

  for (const member of trackedMembers) {
    const descriptors = getMemberResourceDescriptors(member)
    descriptorsByCharId.set(member.characterId, descriptors)

    const hpDesc = descriptors.find((d) => d.id === 'hp')
    const spDesc = descriptors.find((d) => d.id === 'skill_cost')

    const maxHp = hpDesc ? hpDesc.max : Math.max(1, Number(member.maxHp) || 10)
    const currentHp = hpDesc
      ? hpDesc.current
      : Math.max(0, Math.min(maxHp, Number(member.currentHp ?? maxHp)))

    const maxSkillCost = spDesc ? spDesc.max : Math.max(0, Number(member.maxSkillCost ?? 10))
    const currentSkillCost = spDesc
      ? spDesc.current
      : Math.max(0, Math.min(maxSkillCost, Number(member.currentSkillCost ?? maxSkillCost)))

    const customResources: Record<string, ResourceValue> = {}
    const initialCustom: Record<string, ResourceValue> = {}
    for (const desc of descriptors) {
      if (desc.id !== 'hp' && desc.id !== 'skill_cost') {
        customResources[desc.id] = { current: desc.current, max: desc.max }
        initialCustom[desc.id] = { current: desc.current, max: desc.max }
      }
    }
    initialCustomByCharId.set(member.characterId, initialCustom)

    const defaultCondition = member.condition || member.sheetTemplate?.conditions[0] || 'Normal'

    stateByCharId.set(member.characterId, {
      characterId: member.characterId,
      characterName: member.characterName,
      currentHp,
      maxHp,
      currentSkillCost,
      maxSkillCost,
      condition: defaultCondition,
      customResources,
    })
  }

  const membersByNameLength = [...trackedMembers].sort(
    (a, b) => b.characterName.trim().length - a.characterName.trim().length,
  )

  return {
    narrative,
    trackedMembers,
    membersByNameLength,
    stateByCharId,
    descriptorsByCharId,
    initialCustomByCharId,
  }
}

/* ------------------------------------------------------------------ */
/* Resource & member lookup                                            */
/* ------------------------------------------------------------------ */

// Match a resource label from AI text against a specific member's resource descriptors
function matchMemberResource(
  ctx: ExtractionContext,
  charId: string,
  rawResourceName: string,
): MemberResourceDescriptor | undefined {
  const cleaned = cleanCandidateName(rawResourceName)
  if (!cleaned) return undefined
  const descriptors = ctx.descriptorsByCharId.get(charId) ?? []

  // 1. Exact alias match
  for (const desc of descriptors) {
    if (desc.aliases.includes(cleaned)) return desc
  }

  // 2. Substring alias match (longest alias first)
  for (const desc of descriptors) {
    for (const alias of desc.aliases) {
      if (alias.length >= 2 && (cleaned.includes(alias) || alias.includes(cleaned))) {
        return desc
      }
    }
  }

  return undefined
}

function applyResourceValueToTarget(
  target: PartyMemberStateUpdate,
  desc: MemberResourceDescriptor,
  newVal: number,
) {
  if (!Number.isFinite(newVal)) return
  const rounded = Math.round(newVal)
  if (desc.id === 'hp') {
    target.currentHp = Math.max(0, Math.min(target.maxHp, rounded))
  } else if (desc.id === 'skill_cost') {
    target.currentSkillCost = Math.max(0, Math.min(target.maxSkillCost, rounded))
  } else {
    const existing = target.customResources[desc.id] ?? {
      current: desc.current,
      max: desc.max,
    }
    target.customResources[desc.id] = {
      current: Math.max(0, Math.min(existing.max, rounded)),
      max: existing.max,
    }
  }
}

function getCurrentResourceValue(
  target: PartyMemberStateUpdate,
  desc: MemberResourceDescriptor,
): ResourceValue {
  if (desc.id === 'hp') return { current: target.currentHp, max: target.maxHp }
  if (desc.id === 'skill_cost') {
    return { current: target.currentSkillCost, max: target.maxSkillCost }
  }
  return target.customResources[desc.id] ?? { current: desc.current, max: desc.max }
}

// Resolve a party member from an explicit name written inside "(Name — Resource: ...)"
function findMemberByExplicitName(
  ctx: ExtractionContext,
  rawName: string,
): PartyMemberStateUpdate | undefined {
  const cleaned = cleanCandidateName(rawName)
  if (!cleaned) return undefined

  for (const member of ctx.membersByNameLength) {
    const nameLower = cleanCandidateName(member.characterName)
    if (nameLower && nameLower === cleaned) {
      return ctx.stateByCharId.get(member.characterId)
    }
  }

  for (const member of ctx.membersByNameLength) {
    const nameLower = cleanCandidateName(member.characterName)
    if (!nameLower) continue
    if (cleaned.includes(nameLower) || (nameLower.length >= 2 && nameLower.includes(cleaned))) {
      return ctx.stateByCharId.get(member.characterId)
    }
  }

  return undefined
}

// Fallback helper when an inline parenthesis omits the character name (legacy format):
// Scopes lookbehind to the current clause/line and verifies resource + old/max compatibility.
function resolveUnnamedFallbackMember(
  ctx: ExtractionContext,
  matchIndex: number,
  rawResourceName: string,
  parsedOld?: number,
  parsedMax?: number,
): ResolvedResource | undefined {
  const { trackedMembers, membersByNameLength, stateByCharId } = ctx

  if (trackedMembers.length === 1) {
    const sole = stateByCharId.get(trackedMembers[0].characterId)
    const desc = sole ? matchMemberResource(ctx, sole.characterId, rawResourceName) : undefined
    return sole && desc ? { target: sole, desc } : undefined
  }

  const windowStart = Math.max(0, matchIndex - 220)
  const rawSlice = ctx.narrative.slice(windowStart, matchIndex)
  const lastBreak = Math.max(rawSlice.lastIndexOf('\n'), rawSlice.lastIndexOf(')'))
  const clauseText = (lastBreak >= 0 ? rawSlice.slice(lastBreak + 1) : rawSlice).toLowerCase()

  const candidatesWithResource = membersByNameLength.flatMap((m) => {
    const st = stateByCharId.get(m.characterId)
    const desc = matchMemberResource(ctx, m.characterId, rawResourceName)
    if (!st || !desc) return []
    const { max } = getCurrentResourceValue(st, desc)
    if (typeof parsedMax === 'number' && Number.isFinite(parsedMax) && max !== parsedMax) {
      return []
    }
    return [{ member: m, target: st, desc }]
  })

  if (candidatesWithResource.length === 0) return undefined

  // Prefer the member named closest before the parenthesis in the same clause
  let bestCandidate: ResolvedResource | undefined
  let bestEndPos = -1

  for (const cand of candidatesWithResource) {
    const nameLower = cleanCandidateName(cand.member.characterName)
    if (!nameLower) continue
    const pos = clauseText.lastIndexOf(nameLower)
    if (pos >= 0) {
      const endPos = pos + nameLower.length
      if (endPos > bestEndPos) {
        bestEndPos = endPos
        bestCandidate = { target: cand.target, desc: cand.desc }
      }
    }
  }

  if (bestCandidate) return bestCandidate

  if (typeof parsedMax === 'number' && typeof parsedOld === 'number') {
    const exactStatMatches = candidatesWithResource.filter((cand) => {
      const { current } = getCurrentResourceValue(cand.target, cand.desc)
      return current === parsedOld
    })
    if (exactStatMatches.length === 1) {
      return { target: exactStatMatches[0].target, desc: exactStatMatches[0].desc }
    }
  }

  if (candidatesWithResource.length === 1) {
    return { target: candidatesWithResource[0].target, desc: candidatesWithResource[0].desc }
  }

  return undefined
}

/* ------------------------------------------------------------------ */
/* Step 1: inline resource changes                                     */
/* ------------------------------------------------------------------ */

// Scan all inline resource changes in the narrative (HP, Skill Cost, Sanity, Stress, Luck, Heart, etc.):
// Supports "(Shacco — HP: 100/100 -> 80/100 [-20])", "(Shacco — Sanity: 50/50 -> 42/50 [-8])", and legacy "(HP: 100/100 -> 80/100)"
function applyInlineResourceChanges(ctx: ExtractionContext) {
  const inlineResourceRegex =
    /\((?:([^()\n—–\-:]+?)\s*(?:—|–|-|:)\s*)?([^\n:：]+?)\s*[:：]\s*(\d+)\s*\/\s*(\d+)\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+)[^)\n]*\)/gi
  for (const match of ctx.narrative.matchAll(inlineResourceRegex)) {
    const explicitName = match[1]
    const rawResourceLabel = match[2]
    const oldVal = Number(match[3])
    const newVal = Number(match[5])
    const parsedMax = Number(match[6])
    const matchIndex = match.index ?? 0

    if (explicitName) {
      const target = findMemberByExplicitName(ctx, explicitName)
      if (target) {
        const desc = matchMemberResource(ctx, target.characterId, rawResourceLabel)
        if (desc) {
          applyResourceValueToTarget(target, desc, newVal)
          continue
        }
      }
      // Also handle case where rawResourceLabel had no character name and match[1] was actually part of resource name
      const combinedLabel = `${explicitName} - ${rawResourceLabel}`
      const fallbackCombined = resolveUnnamedFallbackMember(ctx, matchIndex, combinedLabel, oldVal, parsedMax)
      if (fallbackCombined) {
        applyResourceValueToTarget(fallbackCombined.target, fallbackCombined.desc, newVal)
      }
    } else {
      const resolved = resolveUnnamedFallbackMember(ctx, matchIndex, rawResourceLabel, oldVal, parsedMax)
      if (resolved) {
        applyResourceValueToTarget(resolved.target, resolved.desc, newVal)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Step 2: party status block                                          */
/* ------------------------------------------------------------------ */

// Parse "สถานะปาร์ตี้ :" inside [ Overview ] (authoritative end-of-turn lock for all template resources & condition)
// Supports both single-line (";"-separated) and multi-line / bulleted party status blocks.
function applyPartyStatusBlock(ctx: ExtractionContext) {
  const partyStatusBlockMatch = ctx.narrative.match(
    /(?:สถานะปาร์ตี้|Party\s+Status)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:\[\s*Decision\s*\]|สถานที่และเวลา|สถานการณ์ปัจจุบัน|สถานะศัตรู|Location\s*(?:&|and)\s*Time|Current\s+Situation|Enemy\s+Status)|$)/i
  )
  if (!partyStatusBlockMatch) return

  const statusBlock = partyStatusBlockMatch[1].trim()
  const segments = statusBlock
    .split(/\s*;\s*|\r?\n+|\s*,\s*(?=[^:：\n]+[:：]\s*[A-Za-zก-๙])/i)
    .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)

  const usedSegmentIndices = new Set<number>()

  for (const member of ctx.membersByNameLength) {
    const target = ctx.stateByCharId.get(member.characterId)
    if (!target) continue

    const nameLower = cleanCandidateName(member.characterName)
    let matchedSegIdx = -1

    if (ctx.trackedMembers.length === 1 && segments.length === 1) {
      matchedSegIdx = 0
    } else if (nameLower) {
      matchedSegIdx = segments.findIndex(
        (seg, idx) => !usedSegmentIndices.has(idx) && cleanCandidateName(seg).includes(nameLower),
      )
    }

    if (matchedSegIdx === -1) continue
    usedSegmentIndices.add(matchedSegIdx)

    applyStatusSegment(ctx, member, target, segments[matchedSegIdx])
  }
}

// Match every resource defined on this character's template, then the condition, within their status segment
function applyStatusSegment(
  ctx: ExtractionContext,
  member: TrackedMember,
  target: PartyMemberStateUpdate,
  matchingSegment: string,
) {
  const descriptors = ctx.descriptorsByCharId.get(member.characterId) ?? []
  for (const desc of descriptors) {
    for (const alias of desc.aliases) {
      const escapedAlias = escapeRegexLiteral(alias)
      const resRegex = new RegExp(
            `(?:^|[|;,:\\s(（])${escapedAlias}(?:\\s*\\([^)]*\\))?\\s*[:：]?\\s*(\\d+)\\s*\\/\\s*(\\d+)(?:\\s*(?:->|→|=>)\\s*(\\d+)\\s*\\/\\s*(\\d+))?`,
            'i'
      )
      const resMatch = matchingSegment.match(resRegex)
      if (resMatch) {
        const latestVal = Number(resMatch[3] ?? resMatch[1])
        if (Number.isFinite(latestVal)) {
          applyResourceValueToTarget(target, desc, latestVal)
          break
        }
      }
    }
  }

  const condMatch = matchingSegment.match(/(?:สถานะ|Condition)\s*[:：]\s*([^|;,\n]+)/i)
  if (condMatch) {
    target.condition = normalizeParsedCondition(
      condMatch[1],
      target.condition,
      member.sheetTemplate?.conditions,
    )
  }
}

/* ------------------------------------------------------------------ */
/* Step 3: vitality conditions & change detection                      */
/* ------------------------------------------------------------------ */

// Synchronize automatic vitality condition thresholds (respecting template conditions) & collect changed records
function collectChangedMembers(ctx: ExtractionContext): PartyMemberStateUpdate[] {
  const updates: PartyMemberStateUpdate[] = []

  for (const member of ctx.trackedMembers) {
    const target = ctx.stateByCharId.get(member.characterId)
    if (!target) continue

    const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
    const hasHpResource = tpl.resources.some((r) => r.id === 'hp')
    const hasSpResource = tpl.resources.some((r) => r.id === 'skill_cost')
    const allowedConds = tpl.conditions.length > 0 ? tpl.conditions : CHARACTER_CONDITIONS
    const normalCond =
      allowedConds.find((c) => c.toLowerCase() === 'normal') ?? allowedConds[0] ?? 'Normal'

    if (hasHpResource) {
      syncVitalityCondition(target, allowedConds, normalCond)
    }

    const origHp = Math.max(0, Math.min(target.maxHp, Number(member.currentHp ?? target.maxHp)))
    const origSp = Math.max(
      0,
      Math.min(target.maxSkillCost, Number(member.currentSkillCost ?? target.maxSkillCost)),
    )
    const origCond = member.condition || normalCond
    const initialCustom = ctx.initialCustomByCharId.get(member.characterId) ?? {}
    const customChanged = Object.entries(target.customResources).some(
      ([resId, val]) => (initialCustom[resId]?.current ?? val.max) !== val.current,
    )

    const hpChanged = hasHpResource && target.currentHp !== origHp
    const spChanged = hasSpResource && target.currentSkillCost !== origSp
    const condChanged = target.condition !== origCond
    if (hpChanged || spChanged || condChanged || customChanged) {
      updates.push(target)
    }
  }

  return updates
}

// 0 HP -> Unconscious (or Heartbroken); <= 30% -> Bloodied (or Wounded) from Normal; back to Normal above 30%.
// Only uses conditions the member's template actually has.
function syncVitalityCondition(
  target: PartyMemberStateUpdate,
  allowedConds: readonly string[],
  normalCond: string,
) {
  const lowHpCond =
    allowedConds.find((c) => c.toLowerCase() === 'bloodied') ??
    allowedConds.find((c) => c.toLowerCase() === 'wounded') ??
    null
  const zeroHpCond =
    allowedConds.find((c) => c.toLowerCase() === 'unconscious') ??
    allowedConds.find((c) => c.toLowerCase() === 'heartbroken') ??
    null
  const lowHpThreshold = Math.floor(target.maxHp * 0.3)

  if (target.currentHp === 0 && zeroHpCond) {
    target.condition = zeroHpCond
  } else if (
    lowHpCond &&
    target.currentHp > 0 &&
    target.currentHp <= lowHpThreshold &&
    target.condition === normalCond
  ) {
    target.condition = lowHpCond
  } else if (lowHpCond && target.currentHp > lowHpThreshold && target.condition === lowHpCond) {
    target.condition = normalCond
  }
}
