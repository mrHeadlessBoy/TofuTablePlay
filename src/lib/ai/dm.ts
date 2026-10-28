import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import {
  CHARACTER_CONDITIONS,
  formatInventoryForPrompt,
  type AbilityScoreKey,
  type CharacterSkill,
} from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  COLUMN_EQUIPMENT_SLOT_INDEX,
  DEFAULT_MECHANICS,
  extractCampaignTemplate,
  isColumnStatId,
  isColumnTextFieldId,
  stripCampaignTemplateFromRules,
  type CharacterTemplate,
  type SheetCustomValues,
  type TemplateDice,
  type TemplateMode,
} from '@/features/character/template'
import { abilityModifier, formatModifier } from '@/components/dice/dice'

const ai = new GoogleGenAI()

// One model for every Dungeon Master call (turn narration and the opening scene)
const DM_MODEL = 'gemini-3.5-flash-lite'
const OPENING_TIMEOUT_MS = 15000

export interface PartyMemberAction {
  characterId?: string
  characterName: string
  classType: string
  currentHp?: number
  maxHp?: number
  currentSkillCost?: number
  maxSkillCost?: number
  condition?: string
  stats?: Record<AbilityScoreKey, number>
  appearance?: string
  inventory?: string
  equipment?: string[]
  strengths?: string
  weaknesses?: string
  backstory?: string
  skills?: CharacterSkill[]
  sheetTemplate?: CharacterTemplate
  sheetCustom?: SheetCustomValues
  action: string | null
}

export interface PartyMemberStateUpdate {
  characterId: string
  characterName: string
  currentHp: number
  maxHp: number
  currentSkillCost: number
  maxSkillCost: number
  condition: string
  customResources: Record<string, { current: number; max: number }>
}

interface MemberResourceDescriptor {
  id: string
  label: string
  shortTag: string
  current: number
  max: number
  aliases: string[]
}

function escapeRegexLiteral(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildResourceAliases(id: string, label: string): string[] {
  const set = new Set<string>()
  const add = (val: string) => {
    const cleaned = val.replace(/[*_`[\]"']/g, '').trim().toLowerCase()
    if (cleaned) set.add(cleaned)
  }

  add(id)
  add(label)
  for (const part of label.split(/[()（）/／|]/)) {
    add(part)
  }

  if (id === 'hp') {
    add('hp')
    add('hit points')
    add('health')
    add('เลือด')
    add('พลังชีวิต')
  } else if (id === 'skill_cost') {
    add('skill cost')
    add('sp')
    add('skill pt')
    add('skill point')
  }

  return Array.from(set).sort((a, b) => b.length - a.length)
}

function getMemberResourceDescriptors(member: PartyMemberAction): MemberResourceDescriptor[] {
  const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
  const custom = member.sheetCustom
  const sourceResources =
    tpl.resources

  return sourceResources.map((res) => {
    if (res.id === 'hp') {
      const max = Math.max(1, Number(member.maxHp ?? res.defaultMax) || 10)
      const current = Math.max(0, Math.min(max, Number(member.currentHp ?? max)))
      const shortTag =
        /^hit\s*points/i.test(res.label) ? 'HP' : res.label.split(/[（(]/)[0].trim() || 'HP'
      return {
        id: res.id,
        label: res.label,
        shortTag,
        current,
        max,
        aliases: buildResourceAliases(res.id, res.label),
      }
    }

    if (res.id === 'skill_cost') {
      const max = Math.max(0, Number(member.maxSkillCost ?? res.defaultMax))
      const current = Math.max(0, Math.min(max, Number(member.currentSkillCost ?? max)))
      const shortTag =
        /^skill\s*cost$/i.test(res.label)
          ? 'Skill Cost'
          : res.label.split(/[（(]/)[0].trim() || 'Skill Cost'
      return {
        id: res.id,
        label: res.label,
        shortTag,
        current,
        max,
        aliases: buildResourceAliases(res.id, res.label),
      }
    }

    const stored = custom?.resources[res.id]
    const max = Math.max(0, Number(stored?.max ?? res.defaultMax))
    const current = Math.max(0, Math.min(max, Number(stored?.current ?? max)))
    const shortTag = res.label.split(/[（(]/)[0].trim() || res.label || res.id
    return {
      id: res.id,
      label: res.label,
      shortTag,
      current,
      max,
      aliases: buildResourceAliases(res.id, res.label),
    }
  })
}

export interface DmTurnInput {
  campaign: {
    title: string
    category: string
    world_setting: string
    core_description: string
    rule_mechanics: string
  }
  loreEntries: LoreEntry[]
  recentTurns: {
    turn_number: number
    narrative_output: string
    party_actions_summary?: string
  }[]
  partyActions: PartyMemberAction[]
}

const NO_ACTION_TEXT =
  '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจเคลื่อนไหวหรือโจมตีแทนผู้เล่น)'

interface PartyDamageBenchmark {
  avgPartyMaxHp: number
  grazeMin: number
  grazeMax: number
  normalMin: number
  normalMax: number
  heavyMin: number
  heavyMax: number
}

function computePartyDamageBenchmark(partyActions: PartyMemberAction[]): PartyDamageBenchmark | null {
  const validMaxHps = partyActions
    .map((m) => {
      const tpl = m.sheetTemplate ?? CLASSIC_TEMPLATE
      const vitId = tpl.mechanics?.vitalityResourceId ?? 'hp'
      if (!vitId) return null
      const descriptors = getMemberResourceDescriptors(m)
      const hpDesc = descriptors.find((d) => d.id === vitId) ?? (vitId === 'hp' ? descriptors[0] : null)
      return hpDesc ? Number(hpDesc.max) : null
    })
    .filter((hp): hp is number => typeof hp === 'number' && Number.isFinite(hp) && hp > 0)

  if (validMaxHps.length === 0) {
    return null
  }

  const avgPartyMaxHp =
    validMaxHps.length > 0
      ? Math.max(10, Math.round(validMaxHps.reduce((sum, v) => sum + v, 0) / validMaxHps.length))
      : 100

  return {
    avgPartyMaxHp,
    grazeMin: Math.max(1, Math.round(avgPartyMaxHp * 0.05)),
    grazeMax: Math.max(2, Math.round(avgPartyMaxHp * 0.1)),
    normalMin: Math.max(2, Math.round(avgPartyMaxHp * 0.15)),
    normalMax: Math.max(4, Math.round(avgPartyMaxHp * 0.25)),
    heavyMin: Math.max(4, Math.round(avgPartyMaxHp * 0.3)),
    heavyMax: Math.max(6, Math.round(avgPartyMaxHp * 0.45)),
  }
}

const SHIELD_OR_GUARD_REGEX = /โล่|เกราะ|ปัดป้อง|shield|buckler|guard|aegis|armor|armour/i
const RESILIENCE_STAT_REGEX =
  /^(con|constitution|physique|endurance|vitality|stamina|willpower|nerves|courage|ความอึด|ความทนทาน|ร่างกาย|จิตใจ|ความกล้า)/i

function computeCharacterDefenseInfo(
  member: PartyMemberAction,
  avgPartyMaxHp: number
): {
  damageReduction: number
  armorPiecesCount: number
  conModifier: number
  summaryText: string
} {
  const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
  const custom = member.sheetCustom

  // Dynamically locate CON or an equivalent resilience stat in the character's template.
  // If the template does not include CON or a resilience stat, do not penalize with abilityModifier(0) = -5!
  const resilienceStat =
    tpl.stats.find((s) => s.id.toUpperCase() === 'CON') ??
    tpl.stats.find(
      (s) => RESILIENCE_STAT_REGEX.test(s.id) || RESILIENCE_STAT_REGEX.test(s.label)
    )

  let conModifier = 0
  let resilienceStatLabel = 'CON'
  if (resilienceStat) {
    const rawScore = isColumnStatId(resilienceStat.id)
      ? (member.stats?.[resilienceStat.id] ?? resilienceStat.default)
      : (custom?.stats[resilienceStat.id] ?? resilienceStat.default)
    conModifier = abilityModifier(rawScore, tpl.mechanics?.statModifier ?? 'dnd')
    resilienceStatLabel =
      resilienceStat.label.split(/[（(]/)[0].trim() || resilienceStat.id
  }

  const equip = member.equipment || []
  let armorPiecesCount = 0

  if (tpl.equipmentSlots.length > 0) {
    for (const slot of tpl.equipmentSlots) {
      const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
      const rawItem =
        colIdx !== undefined ? equip[colIdx] : custom?.equipment[slot.id]
      const item = typeof rawItem === 'string' ? rawItem.trim() : ''
      if (!item) continue
      const isHandSlot = slot.id === 'left_hand' || slot.id === 'right_hand'
      if (!isHandSlot || SHIELD_OR_GUARD_REGEX.test(item)) {
        armorPiecesCount++
      }
    }
  } else {
    for (let i = 0; i < Math.min(equip.length, 6); i++) {
      const item = typeof equip[i] === 'string' ? equip[i].trim() : ''
      if (!item) continue
      if (i <= 3 || SHIELD_OR_GUARD_REGEX.test(item)) {
        armorPiecesCount++
      }
    }
  }

  // Each +1 resilience modifier grants ~3% of avgPartyMaxHp reduction; each armor/gear piece grants ~1.5%
  const rawConMitigation =
    conModifier >= 0
      ? conModifier * (avgPartyMaxHp * 0.03)
      : conModifier * (avgPartyMaxHp * 0.02)
  const rawArmorMitigation = armorPiecesCount * (avgPartyMaxHp * 0.015)

  const maxAllowedReduction = Math.max(1, Math.round(avgPartyMaxHp * 0.15))
  const damageReduction = Math.min(
    maxAllowedReduction,
    Math.round(rawConMitigation + rawArmorMitigation)
  )

  if (damageReduction > 0) {
    return {
      damageReduction,
      armorPiecesCount,
      conModifier,
      summaryText: `ลดทอนความเสียหายที่ได้รับ -${damageReduction} หน่วยต่อครั้ง (จาก ${resilienceStatLabel} ${formatModifier(conModifier)} และอุปกรณ์สวมใส่ ${armorPiecesCount} ชิ้น | ดาเมจสุทธิขั้นต่ำต้องไม่ต่ำกว่า 1 หน่วย)`,
    }
  }

  if (damageReduction < 0) {
    const extraDmg = Math.abs(damageReduction)
    return {
      damageReduction,
      armorPiecesCount,
      conModifier,
      summaryText: `รับความเสียหายเพิ่มขึ้น +${extraDmg} หน่วยต่อครั้ง (เนื่องจากค่า ${resilienceStatLabel} ${formatModifier(conModifier)} ติดลบและไม่มีอุปกรณ์ป้องกันชดเชย)`,
    }
  }

  return {
    damageReduction: 0,
    armorPiecesCount,
    conModifier,
    summaryText: `ไม่มีโบนัสลดทอนความเสียหาย (0 หน่วย — รับดาเมจตามฐานความรุนแรงของศัตรูเต็มจำนวน)`,
  }
}

function formatPartyMemberForPrompt(
  member: PartyMemberAction,
  index: number,
  isFirstPlayerTurn: boolean,
  benchmark: PartyDamageBenchmark | null
): string {
  const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
  const custom = member.sheetCustom
  const resourceDescriptors = getMemberResourceDescriptors(member)

  const resourcesPromptText = resourceDescriptors
    .map((r) => {
      if (r.id === 'hp' && r.shortTag.toUpperCase() !== 'HP') {
        return `${r.shortTag} (HP): ${r.current}/${r.max}`
      }
      if (r.id === 'skill_cost' && r.shortTag.toUpperCase() !== 'SP') {
        return `${r.shortTag} (SP): ${r.current}/${r.max}`
      }
      return `${r.shortTag}: ${r.current}/${r.max}`
    })
    .join(' | ')

  const allowedConds = tpl.conditions.length > 0 ? tpl.conditions : CHARACTER_CONDITIONS
  const condText = `สถานะ: ${member.condition || allowedConds[0] || 'Normal'} (สถานะของชีทนี้: ${allowedConds.join(', ')})`

  const statsText =
    tpl.stats.length > 0
      ? tpl.stats
          .map((stat) => {
            const score = isColumnStatId(stat.id)
              ? (member.stats?.[stat.id] ?? stat.default)
              : (custom?.stats[stat.id] ?? stat.default)
            const modStyle = tpl.mechanics?.statModifier ?? 'dnd'
            const mod = abilityModifier(score, modStyle)
            return modStyle === 'none'
              ? `${stat.label}: ${score}`
              : `${stat.label}: ${score} (${formatModifier(mod)})`
          })
          .join(', ')
      : '(ชีทนี้ไม่มีค่า Stat แยกย่อย)'

  const defenseInfo =
    benchmark && resourceDescriptors.length > 0
      ? computeCharacterDefenseInfo(member, benchmark.avgPartyMaxHp)
      : null

  const equipList =
    tpl.equipmentSlots.length > 0
      ? tpl.equipmentSlots
          .map((slot) => {
            const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
            const rawItem =
              colIdx !== undefined
                ? (member.equipment || [])[colIdx]
                : custom?.equipment[slot.id]
            const trimmed = typeof rawItem === 'string' ? rawItem.trim() : ''
            return trimmed ? `${slot.label}: ${trimmed}` : ''
          })
          .filter(Boolean)
          .join(', ')
      : ''

  const invPreview =
    tpl.sections.inventory && member.inventory
      ? formatInventoryForPrompt(member.inventory).slice(0, 600)
      : ''

  const hasAppearanceField = tpl.textFields.some((f) => f.id === 'appearance')
  const hasBackstoryField = tpl.textFields.some((f) => f.id === 'backstory')
  const hasStrengthsField = tpl.textFields.some((f) => f.id === 'strengths')
  const hasWeaknessesField = tpl.textFields.some((f) => f.id === 'weaknesses')

  const appearancePreview =
    hasAppearanceField && member.appearance
      ? member.appearance.replace(/\n+/g, ' ').trim().slice(0, 300)
      : ''

  const backstoryPreview =
    hasBackstoryField && member.backstory
      ? member.backstory
          .replace(/\n+/g, ' ')
          .trim()
          .slice(0, isFirstPlayerTurn ? 500 : 350)
      : ''

  const skillsList =
    tpl.sections.skills && (member.skills || []).length > 0
      ? (member.skills || [])
          .map((s) => `${s.name} (Cost: ${s.cost}${s.description ? ` - ${s.description}` : ''})`)
          .join(' | ')
      : ''

  const customBioEntries = tpl.textFields
    .filter((f) => !isColumnTextFieldId(f.id))
    .map((f) => {
      const val = (custom?.fields[f.id] || '').replace(/\n+/g, ' ').trim().slice(0, 300)
      return val ? `${f.label}: ${val}` : ''
    })
    .filter(Boolean)

  const strengthsLabel =
    tpl.textFields.find((f) => f.id === 'strengths')?.label || 'จุดเด่น'
  const weaknessesLabel =
    tpl.textFields.find((f) => f.id === 'weaknesses')?.label || 'จุดด้อย'

  const traits = [
    hasStrengthsField && member.strengths
      ? `${strengthsLabel}: ${member.strengths.replace(/\n+/g, ' ')}`
      : '',
    hasWeaknessesField && member.weaknesses
      ? `${weaknessesLabel}: ${member.weaknesses.replace(/\n+/g, ' ')}`
      : '',
    ...customBioEntries,
  ]
    .filter(Boolean)
    .join(' / ')

  const statusLine = resourcesPromptText
    ? `   - [สเตตัสและทรัพยากรปัจจุบัน (Resources & Condition)]: ${resourcesPromptText} | ${condText}`
    : `   - [สถานะปัจจุบัน (Condition)]: ${condText}`

  const lines = [
    `${index + 1}. ชื่อ: ${member.characterName} [คลาสอ้างอิง: ${member.classType} | รูปแบบชีท: ${tpl.name} | โหมด: ${tpl.mechanics?.mode ?? 'combat'} | ระบบเต๋า: ${tpl.mechanics?.dice ?? 'd20'}]`,
    statusLine,
    `   - [ค่าสถานะประจำตัวละคร (Stats & Dice Bonus)]: ${statsText}`,
    ...(defenseInfo ? [`   - [ความทนทาน/การลดทอนดาเมจ (Defense Mitigation)]: ${defenseInfo.summaryText}`] : []),
  ]

  if (appearancePreview) {
    lines.push(
      `   - [รูปลักษณ์ตัวละคร (ใช้อ้างอิงตามความเหมาะสม ห้ามบรรยายซ้ำทุกเทิร์น)]: ${appearancePreview}`
    )
  }
  if (equipList || invPreview) {
    lines.push(
      `   - [อุปกรณ์/ไอเทม]: ${[
        equipList && `สวมใส่ (${equipList})`,
        invPreview && `กระเป๋า (${invPreview})`,
      ]
        .filter(Boolean)
        .join(' || ')}`
    )
  }
  if (skillsList) {
    lines.push(`   - [สกิลที่มี]: ${skillsList}`)
  }
  if (traits) {
    lines.push(
      `   - [เงื่อนไขติดตัว (ห้ามนำมาบรรยายซ้ำหากแอ็กชันไม่เกี่ยวข้องโดยตรง)]: ${traits}`
    )
  }
  if (backstoryPreview) {
    lines.push(
      `   - [ปูมหลังย่อ (ใช้อ้างอิงเมื่อเกี่ยวข้องกับเหตุการณ์เท่านั้น ห้ามเล่าซ้ำทุกเทิร์น)]: ${backstoryPreview}`
    )
  }
  lines.push(`   - [แอ็กชันที่ทำในเทิร์นนี้]: ${member.action || NO_ACTION_TEXT}`)

  return lines.join('\n')
}

export async function generateDmNarrative(input: DmTurnInput): Promise<string> {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // เช็กว่าเป็นเทิร์นแรกที่ผู้เล่นเริ่มเล่นหรือไม่ (มีเฉพาะ Opening Turn อยู่ในประวัติ)
  const isFirstPlayerTurn = recentTurns.length <= 1

  // คำนวณตารางฐานดาเมจกลางของโต๊ะจากค่าเฉลี่ย Max HP ของปาร์ตี้ เพื่อให้คนที่มี HP เยอะกว่าถึกกว่าจริง
  const damageBenchmark = computePartyDamageBenchmark(partyActions)

  // 1. จัดรูปแบบข้อมูลตัวละคร + แอ็กชัน
  const actionsSummary = partyActions
    .map((member, idx) =>
      formatPartyMemberForPrompt(member, idx, isFirstPlayerTurn, damageBenchmark)
    )
    .join('\n\n')

  // 2. สแกน Lorebook ดึงข้อมูลแบบ Dynamic เฉพาะคำที่ถูก Trigger
  const submittedText = partyActions
    .filter((a) => a.action)
    .map((a) => `${a.characterName}: ${a.action}`)
    .join('\n')
  const recentHistoryForScan = recentTurns
    .slice(-4)
    .map((t) => `Turn ${t.turn_number}:\n${t.narrative_output}`)
    .join('\n\n')
  const scanTargetText = `${recentHistoryForScan}\n${submittedText}`

  const triggeredLore = extractTriggeredLore(loreEntries, scanTargetText, true)
  const loreContext =
    triggeredLore.length > 0
      ? triggeredLore.map((l) => `[LORE: ${l.title} (${l.category})]: ${l.content}`).join('\n')
      : null

  // 3. BUILD DYNAMIC PARTY TEMPLATE METADATA FOR SYSTEM INSTRUCTION
  const partyStatLabelsSet = new Set<string>()
  const partyEquipLabelsSet = new Set<string>()
  const partyResourceTagsSet = new Set<string>()
  const partyConditionSet = new Set<string>()
  const partyModes = new Set<TemplateMode>()
  const partyDice = new Set<TemplateDice>()

  for (const action of partyActions) {
    const tpl = action.sheetTemplate ?? CLASSIC_TEMPLATE
    const mech = tpl.mechanics ?? DEFAULT_MECHANICS
    partyModes.add(mech.mode)
    partyDice.add(mech.dice)

    for (const stat of tpl.stats) {
      if (stat.label) partyStatLabelsSet.add(stat.label)
    }
    for (const slot of tpl.equipmentSlots) {
      if (slot.label) partyEquipLabelsSet.add(slot.label)
    }
    for (const res of tpl.resources) {
      const tag = res.label.split(/[（(]/)[0].trim() || res.label || res.id
      partyResourceTagsSet.add(tag)
    }
    for (const cond of tpl.conditions) {
      partyConditionSet.add(cond)
    }
  }

  if (partyModes.size === 0) partyModes.add('combat')
  if (partyDice.size === 0) partyDice.add('d20')

  const hasCombat = damageBenchmark !== null && partyModes.has('combat')
  const hasSocial = partyModes.has('social')
  const hasHorror = partyModes.has('horror')
  const hasNarrative = partyModes.has('narrative') || (!hasCombat && !hasSocial && !hasHorror)

  const dynamicStatsSummary =
    partyStatLabelsSet.size > 0
      ? Array.from(partyStatLabelsSet).join(', ')
      : 'STR, DEX, CON, INT, WIS, CHA'
  const dynamicEquipSummary =
    partyEquipLabelsSet.size > 0
      ? Array.from(partyEquipLabelsSet).join(', ')
      : 'Head, Torso, Leg, Foot, Left Hand, Right Hand'
  const dynamicResourcesSummary =
    partyResourceTagsSet.size > 0
      ? Array.from(partyResourceTagsSet).join(', ')
      : 'ไม่มีทรัพยากรตัวเลข (Zero-Resource Mode)'
  const dynamicConditionsSummary =
    partyConditionSet.size > 0
      ? Array.from(partyConditionSet).join(', ')
      : CHARACTER_CONDITIONS.join(', ')

  // Build dynamic Overview example per character so AI reports every resource in each player's template
  const dynamicPartyStatusFormatExample =
    partyActions.length > 0
      ? partyActions
          .slice(0, 2)
          .map((m) => {
            const resParts = getMemberResourceDescriptors(m)
              .map((r) => `${r.shortTag} ${r.current}/${r.max}`)
              .join(' | ')
            const cond = m.condition || m.sheetTemplate?.conditions[0] || 'Normal'
            return resParts ? `${m.characterName}: ${resParts} | สถานะ: ${cond}` : `${m.characterName}: สถานะ: ${cond}`
          })
          .join(' ; ')
      : 'Shacco: HP 80/100 | Skill Cost 7/10 | สถานะ: Normal'

  // Dynamic middle line of [ Overview ]
  let overviewMiddleSection = ''
  if (hasCombat) {
    overviewMiddleSection = 'สถานะศัตรู : (ระบุชื่อศัตรูทุกตัวในฉากพร้อม HP% คงเหลือล่าสุด เช่น "หมาป่าทมิฬ A: 55%, หมาป่าทมิฬ B: 100%" / หากศัตรูตายให้ระบุว่า "0% (ตายแล้ว)" / หากไม่มีศัตรูในฉากให้เขียนว่า "ไม่มี")'
  } else if (hasSocial && !hasHorror && !hasNarrative) {
    overviewMiddleSection = 'บรรยากาศและความรู้สึก : (ระบุระดับความสัมพันธ์ ความรู้สึกของบุคคลในฉาก หรือบรรยากาศทางอารมณ์)'
  } else if (hasHorror && !hasSocial && !hasNarrative) {
    overviewMiddleSection = 'ระดับความตึงเครียดและสิ่งคุกคาม : (ระดับความสะพรึงกลัว สิ่งผิดปกติ หรือภัยคุกคามที่กำลังคืบคลาน)'
  } else if (hasNarrative && !hasSocial && !hasHorror) {
    overviewMiddleSection = 'สิ่งของสำคัญและเบาะแส : (ระบุเบาะแส วัตถุพยาน หรือไอเทมสำคัญที่ค้นพบในฉาก)'
  } else {
    overviewMiddleSection = 'สถานะอุปสรรคหรือความตึงเครียด : (ระบุอุปสรรค บุคคลต้องสงสัย หรือความกดดันในฉาก เช่น "ยามหน้าคฤหาสน์กำลังตรวจค้น" หรือ "ความตึงเครียดระดับสูง")'
  }

  // Dynamic instructions for [ Decision ]
  const decisionDiceInstructions: string[] = []
  if (partyDice.has('d20')) {
    decisionDiceInstructions.push('- ตัวละครที่ใช้เต๋า d20: [ชื่อตัวละคร]: สิ่งที่ต้องทำ/รับมือ: (สิ่งที่กำลังเผชิญ) | [d20 + <ชื่อ Stat ในชีท> vs DC XX] (DC มาตรฐาน: ง่าย 8-10, ปานกลาง 12-14, ยาก 15-17, วิกฤต 18+)')
  }
  if (partyDice.has('2d6')) {
    decisionDiceInstructions.push('- ตัวละครที่ใช้เต๋า 2d6: [ชื่อตัวละคร]: สิ่งที่ต้องทำ/รับมือ: (สิ่งที่กำลังเผชิญ) | [2d6 + <ชื่อ Stat ในชีท> vs DC XX] (DC มาตรฐาน: สำเร็จบางส่วน 7-9, สำเร็จสมบูรณ์ 10+)')
  }
  if (partyDice.has('d100')) {
    decisionDiceInstructions.push('- ตัวละครที่ใช้เต๋า d100: [ชื่อตัวละคร]: สิ่งที่ต้องทำ/รับมือ: (สิ่งที่กำลังเผชิญ) | [d100 vs <ชื่อ Stat ในชีท> (Roll under เพื่อสำเร็จ)]')
  }
  if (partyDice.has('none')) {
    decisionDiceInstructions.push('- ตัวละครที่ไม่มีเต๋า (none): [ชื่อตัวละคร]: ทางเลือก/การตัดสินใจ: (คำถามหรือทางเลือกเชิงบทบาทสมมติ โดยไม่ต้องทอยเต๋า)')
  }

  let requiredOutputDescription = ''
  if (hasCombat) {
    requiredOutputDescription = '(เนื้อหาบรรยายเรื่องราว ผลลัพธ์การกระทำของทุกคน ฉากการปะทะพร้อมวงเล็บ (HP: X% -> Y%) เมื่อศัตรูได้รับดาเมจ และวงเล็บระบุชื่อตัวละครพร้อมชื่อทรัพยากรตามชีทจริง เช่น (ชื่อตัวละคร — HP: เดิม/Max -> ใหม่/Max [-Z]) หรือ (ชื่อตัวละคร — Skill Cost: เดิม/Max -> ใหม่/Max [-Z]) หรือทรัพยากรอื่นๆ ในชีทของตัวละครนั้นเมื่อมีการเปลี่ยนแปลง)'
  } else if (hasSocial) {
    requiredOutputDescription = '(เนื้อหาบรรยายเรื่องราว บทสนทนา มิติความสัมพันธ์ ผลลัพธ์การกระทำของทุกคน พร้อมวงเล็บระบุการเปลี่ยนแปลงค่าอารมณ์/ความสัมพันธ์ เช่น (ชื่อตัวละคร — Heart: เดิม/Max -> ใหม่/Max [-Z]) หรือการเปลี่ยนสถานะ Condition โดยห้ามกล่าวถึงการลด HP หรือเลือดมอนสเตอร์เด็ดขาด)'
  } else if (hasHorror) {
    requiredOutputDescription = '(เนื้อหาบรรยายเรื่องราว ความตึงเครียด ความหลอน ผลลัพธ์การกระทำของทุกคน พร้อมวงเล็บระบุการลดลงของ Sanity หรือค่าจิตใจ เช่น (ชื่อตัวละคร — Sanity: เดิม/Max -> ใหม่/Max [-Z]) และสถานะทางจิตใจ โดยห้ามกล่าวถึงการลด HP หรือเลือดมอนสเตอร์เด็ดขาด)'
  } else {
    requiredOutputDescription = '(เนื้อหาบรรยายเรื่องราว ผลลัพธ์การกระทำของทุกคน การใช้ไอเทม เบาะแส และการเปลี่ยนแปลงสถานะ Condition ของตัวละคร ห้ามกล่าวถึงการลด HP หรือเลือดมอนสเตอร์เด็ดขาด)'
  }

  // Construct modular rules
  const ruleModules: string[] = []
  ruleModules.push(`1. ความต่อเนื่องของเรื่องราว:
   - ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตฉากหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
   - ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในปาร์ตี้ให้ครบตามรายชื่อ`)

  ruleModules.push(`2. การเคารพข้อมูลตัวละครตามรูปแบบชีทของแต่ละคน (Dynamic Character Sheet Templates, Resources, Stats, Equipment & Skills):
   - ตัวละครแต่ละคนอาจใช้รูปแบบชีท (Character Template) และโหมดที่ต่างกัน ให้คำนึงถึงทรัพยากร (${dynamicResourcesSummary}), ค่าสถานะ (${dynamicStatsSummary}), สถานะผิดปกติ (${dynamicConditionsSummary}), ช่องอุปกรณ์สวมใส่ (${dynamicEquipSummary}) และไอเทมในกระเป๋าตามที่ระบุในบล็อกข้อมูลของตัวละครคนนั้นจริงในการตัดสินผลลัพธ์
   - หากผู้เล่นประกาศใช้ "สกิล (Skill)" หรือทำแอ็กชันที่ใช้ทรัพยากรพิเศษ (เช่น Skill Cost / SP, Sanity, Stress, Heart, Luck ฯลฯ):
     * หากมีสกิลและทรัพยากรเพียงพอ: ต้องหักหรือปรับค่าทรัพยากรนั้นทันที และเขียนวงเล็บระบุชื่อตัวละครพร้อมชื่อทรัพยากรที่เปลี่ยนไปในเนื้อเรื่องเสมอ เช่น "(Shacco — Skill Cost: 10/10 -> 7/10 [-3 SP])" หรือ "(Shacco — Sanity: 50/50 -> 42/50 [-8])" หรือ "(Shacco — Heart: 8/10 -> 6/10 [-2])"
     * หากไม่มีสกิลนั้น หรือทรัพยากรไม่พอ: ให้บรรยายว่าการกระทำนั้นล้มเหลวหรือเกิดผลเสียแทน`)

  ruleModules.push(`3. กฎการตัดสินผลแอ็กชันและลูกเต๋า (Action & Dice Resolution):
   - [กรณีไม่ส่งแอ็กชัน]: ให้บรรยายว่าตัวละครนั้น "ยืนนิ่ง ชะงัก หรือคุมเชิงดูสถานการณ์อยู่กับที่" ห้ามคิดการเคลื่อนไหวหรือสั่งโจมตีแทนผู้เล่นเด็ดขาด
   - [แอ็กชันทั่วไปที่ไม่เสี่ยงอันตราย]: เช่น เดินสำรวจ พูดคุยทั่วไป เปิดประตูที่ไม่ได้ล็อก หยิบของ ให้สำเร็จตามเนื้อผ้าได้โดยไม่ต้องมีผลเต๋า
   - [แอ็กชันที่มีความเสี่ยงหรือท้าทาย]:
     * ยึดตามผลทอยเต๋าที่แนบมาในแอ็กชันอย่างเคร่งครัด (SUCCESS = สำเร็จ, FAIL = ล้มเหลว, NATURAL 20 / CRITICAL = สำเร็จระดับยอดเยี่ยม, NATURAL 1 = พลาดท่าอย่างรุนแรง)
     * หากผู้เล่นทำเรื่องเสี่ยงอันตรายหรือท้าทาย แต่ "ไม่ยอมทอยเต๋าแนบมา" (และชีทไม่ใช่โหมด none) ให้ตัดสินว่าจังหวะนั้นผิดพลาด เสียเปรียบ หรือล้มเหลว และต้องเผชิญผลกระทบตามความสมเหตุสมผล!`)

  if (hasCombat) {
    ruleModules.push(`4. กฎเหล็กด้านสมดุลการต่อสู้และหลอดเลือดมอนสเตอร์ (Enemy HP % & Damage Scaling) [สำคัญที่สุด]:
   - ห้ามให้มอนสเตอร์ตายในแอ็กชันเดียว (NO ONE-SHOT KILLS)! การต่อสู้ต้องมีความตึงเครียดและใช้เวลาหลายเทิร์น (ยกเว้นมอนสเตอร์ตัวนั้นเหลือเลือดต่ำมากอยู่แล้ว หรือเป็นศัตรูที่ไร้ทางสู้ เช่น ถูกลอบโจมตี หรือ เป็นศัตรูที่อ่อนแอมากพอให้สามารถตายได้ในเทิร์นเดียวได้)
   - มอนสเตอร์ทุกตัวเริ่มที่ HP 100% เสมอ และต้องคำนวณลด % เลือดตามความสมเหตุสมผลของอาวุธ สกิล และผลเต๋า ดังนี้:
     * โจมตีด้วยมือเปล่า / อาวุธที่ไม่ถนัด / ท่าก่อกวน / เฉี่ยวชน: ลด 5% - 10%
     * โจมตีปกติด้วยอาวุธประจำตัว (ทอย SUCCESS): ลด 15% - 25%
     * ใช้สกิลโจมตี (Skill) ที่เสีย Skill Cost หรือโจมตีจุดอ่อนสำเร็จ: ลด 25% - 35%
     * ทอยติด NATURAL 20 (Critical Hit) หรือประสานงานคอมโบใหญ่ของปาร์ตี้: ลด 35% - 50%
     * [กรณีมอนสเตอร์ระดับ Elite / หัวหน้าฝูง]: ให้ลดความเสียหายข้างต้นลงครึ่งหนึ่ง (เช่น โจมตีปกติลดแค่ 10% - 15%)
     * [กรณีมอนสเตอร์ระดับ Boss]: โจมตีปกติลดเพียง 5% - 10% และสกิลใหญ่/Critical ลดไม่เกิน 15% - 25% ต่อแอ็กชัน
     * [กรณีทอย FAIL หรือไม่ทอยเต๋าในการโจมตี]: ลด 0% (HP คงเดิม) และต้องถูกโจมตีสวนกลับ
   - ทุกครั้งที่มอนสเตอร์ได้รับความเสียหาย ต้องเขียนวงเล็บระบุการลดลงของเลือดจากค่าเดิมเหลือค่าใหม่ในเนื้อเรื่องเสมอ เช่น "(HP: 100% -> 80%)" และหากโดนรุมตีหลายครั้งในเทิร์นเดียว ให้คิดลดต่อเนื่องกันไปทีละคน เช่น คนแรกตี "(HP: 100% -> 80%)" คนที่สองตีซ้ำ "(HP: 80% -> 55%)"
   - ต้องดึงค่า HP% ล่าสุดของมอนสเตอร์จากหมวด [ Overview ] ของเทิร์นก่อนหน้ามาคำนวณต่อเสมอ ห้ามรีเซ็ตกลับเป็น 100%
   - มอนสเตอร์ที่ยังไม่ตาย (HP > 0%) ต้องมีการโจมตีสวนกลับ ใช้สกิล หรือคุกคามปาร์ตี้คืนในท้ายเทิร์นเสมอ!

5. กฎความเด็ดขาดและการคำนวณดาเมจ/การเปลี่ยนแปลงทรัพยากรของผู้เล่น (High Stakes, Shared Flat Damage Benchmark & Defense Mitigation) [สำคัญที่สุด]:
   - ห้ามมี Plot Armor ปกป้องผู้เล่นเด็ดขาด! หากทอยเต๋าล้มเหลว (FAIL หรือ NATURAL 1) ในจังหวะอันตราย, สั่งโจมตีโดยไม่ทอยเต๋า, ประมาท, หรือถูกมอนสเตอร์ที่ยังไม่ตายโจมตีสวนกลับ ให้บรรยายบาดแผลหรือผลกระทบ คำนวณความเสียหายเป็นจำนวนหน่วยที่ผู้เล่นเสียไปจริง และระบุสถานะผิดปกติ (${dynamicConditionsSummary}) ที่ผู้เล่นได้รับอย่างสมจริงเสมอ!
   - ให้ใช้ "ตารางฐานดาเมจกลางของศัตรูประจำโต๊ะนี้" (คำนวณจากค่าเฉลี่ยพลังหลักของปาร์ตี้ = ${damageBenchmark.avgPartyMaxHp} หน่วย) เป็นตัวเลขคงที่เดียวกันสำหรับทุกคนในฉาก ดังนี้:
     * โดนโจมตีเฉี่ยวๆ / กับดักเล็กน้อย / ปัดป้องหรือหลบได้บางส่วน: ฐานดาเมจ ${damageBenchmark.grazeMin} - ${damageBenchmark.grazeMax} หน่วย
     * โดนศัตรูโจมตีปกติ / ศัตรูสวนกลับท้ายเทิร์น / ทอยเต๋าได้ FAIL ในจังหวะปะทะหรือหลบหลีก / สั่งโจมตีโดยไม่ทอยเต๋า: ฐานดาเมจ ${damageBenchmark.normalMin} - ${damageBenchmark.normalMax} หน่วย
     * โดนท่าไม้ตายศัตรู / ศัตรูระดับ Elite หรือ Boss โจมตีเต็มแรง / ทอยติด NATURAL 1 (Critical Fail) / ประมาทอย่างรุนแรง: ฐานดาเมจ ${damageBenchmark.heavyMin} - ${damageBenchmark.heavyMax} หน่วย
   - [การหักลบด้วยค่าความทนทานและอุปกรณ์ป้องกัน (Defense Mitigation)]:
     * เมื่อได้ "ฐานดาเมจของศัตรู" ข้างต้นแล้ว ให้นำไปหักลบกับค่าในบรรทัด "[ความทนทาน/การลดทอนดาเมจ (Defense Mitigation)]" ของผู้เล่นคนนั้นเสมอ
     * สูตรคำนวณ: ดาเมจสุทธิที่ผู้เล่นได้รับ = (ฐานดาเมจของศัตรู - ค่าลดทอนดาเมจของผู้เล่นคนนั้น) โดยต้องเสียขั้นต่ำอย่างน้อย 1 หน่วยเสมอ
     * หากได้รับผลกระทบทางร่างกายหรือจิตใจอย่างหนัก หรือพลังหลักเหลือน้อยกว่า 30% ให้เปลี่ยนสถานะ Condition ตามรายการสถานะของชีทตัวละครคนนั้น (เช่น ${dynamicConditionsSummary})
   - [บังคับระบุชื่อตัวละครและชื่อ Resource ในวงเล็บทุกครั้งที่มีการเปลี่ยนแปลงค่าในชีท]:
     * ทุกครั้งที่ผู้เล่นเสียหรือฟื้นฟูค่าทรัพยากรใดๆ ในชีท (${dynamicResourcesSummary}) ต้องเขียนวงเล็บระบุ "ชื่อตัวละคร — ชื่อ Resource: ค่าเดิม/Max -> ค่าใหม่/Max [±จำนวน]" ในเนื้อเรื่องทันที เช่น "(Shacco — HP: 120/120 -> 108/120 [-12 HP])" เพื่อไม่ให้สับสนเมื่อมีผู้เล่นหลายคนโดนผลกระทบพร้อมกัน
     * ห้ามบรรยายแค่ว่า "ได้รับบาดเจ็บ" หรือ "เสียสติ" โดยไม่ระบุตัวเลขที่เปลี่ยนแปลงเด็ดขาด!`)
  }

  if (hasSocial) {
    ruleModules.push(`4. กฎการเล่นแนวปฏิสัมพันธ์ทางสังคม/โรแมนติก/ดราม่าความรู้สึก (Social Dynamics, Emotion & Relationships):
   - ให้เน้นมิติทางอารมณ์ บทสนทนา ภาษากาย ความสัมพันธ์ แรงกดดันทางสังคม และเคมีระหว่างตัวละคร
   - หากเกิดผลกระทบทางความรู้สึก ความผูกพัน ความตึงเครียด หรือการหักอก ให้ปรับค่าทรัพยากรด้านอารมณ์ (เช่น Heart, Stress, Trust) ในวงเล็บระบุชัดเจน เช่น "(ชื่อตัวละคร — Heart: 8/10 -> 6/10 [-2 Heart])" หรือ "(ชื่อตัวละคร — Stress: 2/10 -> 4/10 [+2 Stress])"
   - เปลี่ยนสถานะผิดปกติทางอารมณ์หรือสังคมตามชีทของตัวละคร (${dynamicConditionsSummary}) เช่น ขัดเขิน (Flustered), หวั่นไหว (Captivated), ใจสลาย (Heartbroken), หวาดระแวง (Suspicious)
   - ห้ามคิดดาเมจเป็น HP หรือหลอดเลือดมอนสเตอร์เป็น % เว้นแต่ผู้เล่นจะตัดสินใจจับอาวุธต่อสู้จริง`)
  }

  if (hasHorror) {
    ruleModules.push(`5. กฎการเล่นแนวสยองขวัญ/จิตวิทยา/เอาชีวิตรอด (Horror Pacing, Paranoia & Sanity Dread):
   - บรรยายสร้างบรรยากาศบีบคั้น ความไม่น่าไว้วางใจ สภาพแวดล้อมที่ชวนขนลุก และความลึกลับของสิ่งคุกคามที่ไม่เปิดเผยตัวเต็มที่
   - สิ่งคุกคามในแนวนี้มักลี้ลับหรือทรงพลังเหนือมนุษย์ ไม่ใช่เป้าหมายที่จะเอาชนะได้ด้วยการฟันแทงธรรมดา
   - เมื่อเผชิญหน้ากับความสะพรึงกลัว ภาพหลอน หรือช็อก ให้คิดการลดทอนสติสัมปชัญญะ (Sanity / Mental) ในวงเล็บ เช่น "(ชื่อตัวละคร — Sanity: 45/50 -> 36/50 [-9 Sanity])"
   - เปลี่ยนสถานะทางจิตใจตามชีท (${dynamicConditionsSummary}) เช่น ตื่นตระหนก (Panicked), สติแตก (Catatonic), ประสาทหลอน (Hallucinating), หวาดผวา (Shaken)`)
  }

  if (hasNarrative) {
    ruleModules.push(`6. กฎการเล่นแนวสืบสวน/ไขปริศนา/การจัดการไอเทม (Narrative Investigation, Clues & Items):
   - เน้นการค้นหาเบาะแส วัตถุพยาน การสังเกตสภาพแวดล้อม และการประยุกต์ใช้สิ่งของในกระเป๋า
   - หากผู้เล่นใช้ไอเทม ให้บรรยายผลลัพธ์ว่าสำเร็จ หมดไป หรือเสียหาย และระบุการเปลี่ยนแปลงในเนื้อเรื่อง (เช่น "[-1 ไฟฉาย]" หรือ "[+1 กุญแจดอกเก่า]")
   - หากทอยเต๋าล้มเหลวหรือเกิดข้อผิดพลาด ให้เปลี่ยนสถานะตัวละครตามชีท (${dynamicConditionsSummary}) เช่น ตกเป็นผู้ต้องสงสัย (Suspected), เสียเปรียบ (Compromised), หมดแรง (Exhausted)
   - สำหรับชีทที่ไม่มีหลอดเลือด ห้ามคิดดาเมจเป็นตัวเลข HP และห้ามใส่หลอดเลือดมอนสเตอร์เป็น % เด็ดขาด`)
  }

  ruleModules.push(`7. กฎเหล็กห้ามบรรยายซ้ำซาก (STRICT ANTI-REPETITION & NO EPITHETS):
   - เรียกตัวละครด้วย "ชื่อ" เท่านั้น (เช่น "**Shacco**", "**ไมค์**", "**Pantheon**") ห้ามเขียนสร้อยฉายา อาชีพ หรือลักษณะชุดต่อท้ายชื่อซ้ำๆ เด็ดขาด
   - ห้ามนำนิสัยท่าทางเดิมๆ หรือจุดด้อยที่เคยบรรยายไปแล้วในเทิร์นก่อนหน้า มาเขียนซ้ำอีกในเทิร์นนี้ ยกเว้นผู้เล่นจะทอยเต๋าได้ FAIL หรือสั่งทำแอ็กชันที่กระตุ้นจุดด้อยนั้นโดยตรง
   - โฟกัสเฉพาะ "แอ็กชันที่ผู้เล่นสั่งในเทิร์นนี้" และ "ผลลัพธ์ใหม่ที่เกิดขึ้น" เท่านั้น`)

  ruleModules.push(`8. กฎเหล็กห้ามกล่าวถึงผลการทอยลูกเต๋าในเนื้อเรื่อง (DICE RESULTS ARE INVISIBLE TO NARRATIVE):
   - ห้ามพูดถึงตัวเลขผลทอยเต๋า ชื่อเต๋า (d20, d6 ฯลฯ) หรือวลีที่เกี่ยวกับการทอยเต๋าในคำบรรยายเด็ดขาด!
   - ให้ใช้ผลทอยเต๋า (SUCCESS/FAIL/NAT 20/NAT 1) เป็นตัวตัดสินผลลัพธ์เบื้องหลัง แล้วบรรยายผลลัพธ์นั้นออกมาเป็นเหตุการณ์ในเรื่องแทน
   - ในหมวด [ Decision ] ให้ระบุเฉพาะสิ่งที่ตัวละครต้องเผชิญและทอยในเทิร์นถัดไปเท่านั้น ซึ่งเป็นคำสั่งไปข้างหน้า ไม่ใช่การรายงานผลเต๋าในเทิร์นนี้`)

  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${stripCampaignTemplateFromRules(campaign.rule_mechanics) || 'Standard tabletop RPG rules apply.'}

[CORE DIRECTIVES & RESOLUTION RULES]
${ruleModules.join('\n\n')}

[REQUIRED OUTPUT FORMAT]
${requiredOutputDescription}

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่ สภาพแวดล้อมโดยย่อ และเวลาปัจจุบัน เช่น 14:30 น.)
สถานการณ์ปัจจุบัน : (สรุปสิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยย่อ)
${overviewMiddleSection}
สถานะปาร์ตี้ : (ระบุค่าทรัพยากรทุกตัวตามชีทของสมาชิกแต่ละคนและสถานะล่าสุดหลังจบเทิร์นให้ครบทุกคน คั่นแต่ละคนด้วย " ; " เช่น "${dynamicPartyStatusFormatExample}")

[ Decision ]
*(เงื่อนไขสำคัญ: แสดงหมวดนี้เฉพาะเมื่อมีตัวละครต้องตัดสินใจหรือรับมือเหตุการณ์ในเทิร์นถัดไปเท่านั้น! หากไม่มี ให้ตัดหัวข้อ [ Decision ] ทิ้งทันที)*
(ระบุ 1 บรรทัดต่อ 1 คน โดยเลือกใช้ชื่อค่าสถานะที่มีอยู่จริงในชีทของตัวละครคนนั้น เช่น ${dynamicStatsSummary}):
${decisionDiceInstructions.join('\n')}`
  
  // 4. CONSTRUCT MULTI-TURN CONTENTS (Sliding Window 4 เทิร์นล่าสุด)
  const turnsWindow = recentTurns.slice(-4)
  const contents: { role: 'user' | 'model'; parts: [{ text: string }] }[] = []

  for (const turn of turnsWindow) {
    const playedTurn = turn.turn_number - OPENING_TURN_NUMBER
    const userPrompt =
      turn.turn_number === OPENING_TURN_NUMBER
        ? '[OPENING]: The table has just opened and nobody has acted yet. Narrate the opening scene.'
        : turn.party_actions_summary
          ? `[TURN ${playedTurn} PARTY ACTIONS]\n${turn.party_actions_summary}`
          : `[TURN ${playedTurn}]: The party executes their declared actions.`

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    })
    contents.push({
      role: 'model',
      parts: [{ text: turn.narrative_output }],
    })
  }

  // 5. CURRENT TURN PAYLOAD + AUTHOR'S NOTE REMINDER
  const currentTurnUserParts = [
    loreContext ? `[DYNAMIC LORE INJECTION FOR THIS TURN]\n${loreContext}\n` : '',
    `[CURRENT TURN: PARTY STATUS & SUBMITTED ACTIONS (${partyActions.length} Members${damageBenchmark ? ` | Party Avg Primary Max: ${damageBenchmark.avgPartyMaxHp}` : ' | Zero-Resource Mode'})]\n${actionsSummary || 'The party surveys their surroundings.'}`,
    `\n[SYSTEM REMINDER: AUTHOR'S NOTE - ต้องปฏิบัติตามอย่างเคร่งครัด]
- กล่าวถึงผลลัพธ์ของสมาชิกทุกคนตามรายชื่อด้านบน โดยอ้างอิงค่าสถานะประจำชีทของแต่ละคน (${dynamicStatsSummary}), ทรัพยากร (${dynamicResourcesSummary}), อุปกรณ์สวมใส่ และสกิลที่มีจริง
- [ห้ามพูดซ้ำเด็ดขาด]: เรียกตัวละครด้วยชื่อล้วนๆ ห้ามใส่ฉายา อาชีพ หรือคำบรรยายชุด/รูปลักษณ์ต่อท้ายชื่อซ้ำกับเทิร์นก่อนหน้า และห้ามใส่มุกเดิมซ้ำๆ ให้บรรยายเฉพาะแอ็กชันที่ทำในเทิร์นนี้เท่านั้น!
- [ห้ามกล่าวถึงลูกเต๋าในเนื้อเรื่อง]: ห้ามพูดถึงตัวเลขผลทอย ชื่อเต๋า (d20 ฯลฯ) หรือวลีเกี่ยวกับการทอยเต๋าใดๆ ในคำบรรยาย ให้ใช้ผลทอย (SUCCESS/FAIL/NAT 20/NAT 1) เป็นตัวตัดสินผลลัพธ์เบื้องหลังเท่านั้น แล้วบรรยายเป็นเหตุการณ์ในเรื่องแทน!
${damageBenchmark ? `- หากมีการต่อสู้: ห้ามให้มอนสเตอร์ตายในทีเดียว! คำนวณดาเมจศัตรูเป็นเปอร์เซ็นต์ เช่น (HP: 100% -> 80%) โดยคิดต่อเนื่องจากค่า HP% ใน [ Overview ] ของเทิร์นก่อนหน้า
- [ห้ามมี Plot Armor & ใช้ฐานดาเมจกลางของปาร์ตี้หักลบด้วยค่าลดทอนดาเมจ]: เมื่อผู้เล่นถูกศัตรูโจมตี/สวนกลับ ทอยเต๋าล้มเหลว (FAIL / NATURAL 1) หรือโจมตีโดยไม่ทอยเต๋า ให้ใช้ฐานดาเมจกลางของโต๊ะนี้ (เฉี่ยว ${damageBenchmark.grazeMin}-${damageBenchmark.grazeMax}, ปกติ/สวนกลับ/FAIL ${damageBenchmark.normalMin}-${damageBenchmark.normalMax}, รุนแรง/NAT 1/Boss ${damageBenchmark.heavyMin}-${damageBenchmark.heavyMax}) แล้วนำมาหักลบด้วยค่า "[ความทนทาน/การลดทอนดาเมจ (Defense Mitigation)]" ของผู้เล่นคนนั้น และต้องเขียนวงเล็บระบุชื่อตัวละครพร้อมชื่อทรัพยากรที่เปลี่ยนไป เช่น (ชื่อตัวละคร — HP: เดิม/Max -> ใหม่/Max [-X]) หรือทรัพยากรอื่นตามชีท (${dynamicResourcesSummary}) ในเนื้อเรื่องเสมอ!
- สรุปท้ายข้อความตามรูปแบบ [ Overview ] (ที่มีครบทั้งบรรทัด "สถานะศัตรู :" และ "สถานะปาร์ตี้ :" พร้อมทรัพยากรทุกตัวตามชีทของสมาชิกแต่ละคน) และ [ Decision ] (โดยอ้างอิงชื่อ Stat ที่มีอยู่ในชีทของตัวละครคนนั้นจริง) เท่านั้น` : `- [โหมดเนื้อเรื่อง/ไม่มีหลอดเลือด (Zero-Resource Mode)]: ห้ามคิดดาเมจ HP และห้ามใส่เปอร์เซ็นต์เลือดมอนสเตอร์เด็ดขาด ให้ตัดสินเหตุการณ์ผ่านผลของไอเทม เบาะแส และการเปลี่ยนสถานะ Condition (${dynamicConditionsSummary}) ตามความสมเหตุสมผล
- สรุปท้ายข้อความตามรูปแบบ [ Overview ] (ที่มีครบทั้งบรรทัด "สถานะอุปสรรคหรือความตึงเครียด :" และ "สถานะปาร์ตี้ :") และ [ Decision ] (โดยอ้างอิงชื่อ Stat ที่มีอยู่ในชีทของตัวละครคนนั้นจริง) เท่านั้น`}`,
  ]
    .filter(Boolean)
    .join('\n')

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnUserParts }],
  })

  // 6. ส่งคำขอไปยัง API
  const response = await ai.models.generateContent({
    model: DM_MODEL,
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    },
  })

  return response.text || 'The Dungeon Master pauses as the dust settles around the party.'
}

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

/**
 * Extracts updated HP, Skill Cost (SP), Custom Template Resources (Sanity, Stress, Luck, etc.),
 * and Status Condition for each party member from the AI Dungeon Master's narrative and `[ Overview ]` section.
 */
export function extractPartyStateUpdates(
  narrative: string,
  partyActions: PartyMemberAction[]
): PartyMemberStateUpdate[] {
  const updates: PartyMemberStateUpdate[] = []
  const trackedMembers = partyActions.filter(
    (m): m is PartyMemberAction & { characterId: string } => Boolean(m.characterId)
  )
  if (trackedMembers.length === 0) return updates

  const stateByCharId = new Map<string, PartyMemberStateUpdate>()
  const descriptorsByCharId = new Map<string, MemberResourceDescriptor[]>()
  const initialCustomByCharId = new Map<string, Record<string, { current: number; max: number }>>()

  for (const member of trackedMembers) {
    const descriptors = getMemberResourceDescriptors(member)
    descriptorsByCharId.set(member.characterId, descriptors)

    const hpDesc = descriptors.find((d) => d.id === 'hp')
    const spDesc = descriptors.find((d) => d.id === 'skill_cost')

    const maxHp = hpDesc
      ? hpDesc.max
      : Math.max(1, Number(member.maxHp) || 10)
    const currentHp = hpDesc
      ? hpDesc.current
      : Math.max(0, Math.min(maxHp, Number(member.currentHp ?? maxHp)))

    const maxSkillCost = spDesc
      ? spDesc.max
      : Math.max(0, Number(member.maxSkillCost ?? 10))
    const currentSkillCost = spDesc
      ? spDesc.current
      : Math.max(0, Math.min(maxSkillCost, Number(member.currentSkillCost ?? maxSkillCost)))

    const customResources: Record<string, { current: number; max: number }> = {}
    const initialCustom: Record<string, { current: number; max: number }> = {}
    for (const desc of descriptors) {
      if (desc.id !== 'hp' && desc.id !== 'skill_cost') {
        customResources[desc.id] = { current: desc.current, max: desc.max }
        initialCustom[desc.id] = { current: desc.current, max: desc.max }
      }
    }
    initialCustomByCharId.set(member.characterId, initialCustom)

    const defaultCondition =
      member.condition || member.sheetTemplate?.conditions[0] || 'Normal'

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

  // Sort members by characterName length descending so prefix names (e.g. "เรน" vs "เรนเจอร์")
  // never collide when matching names in text or status segments.
  const membersByNameLength = [...trackedMembers].sort(
    (a, b) => b.characterName.trim().length - a.characterName.trim().length
  )

  const cleanCandidateName = (raw: string) =>
    raw.replace(/[*_`[\]"']/g, '').trim().toLowerCase()

  // Match a resource label from AI text against a specific member's resource descriptors
  const matchMemberResource = (
    charId: string,
    rawResourceName: string
  ): MemberResourceDescriptor | undefined => {
    const cleaned = cleanCandidateName(rawResourceName)
    if (!cleaned) return undefined
    const descriptors = descriptorsByCharId.get(charId) ?? []

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

  const applyResourceValueToTarget = (
    target: PartyMemberStateUpdate,
    desc: MemberResourceDescriptor,
    newVal: number
  ) => {
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

  const getCurrentResourceValue = (
    target: PartyMemberStateUpdate,
    desc: MemberResourceDescriptor
  ): { current: number; max: number } => {
    if (desc.id === 'hp') return { current: target.currentHp, max: target.maxHp }
    if (desc.id === 'skill_cost') {
      return { current: target.currentSkillCost, max: target.maxSkillCost }
    }
    return target.customResources[desc.id] ?? { current: desc.current, max: desc.max }
  }

  // Resolve a party member from an explicit name written inside "(Name — Resource: ...)"
  const findMemberByExplicitName = (rawName: string): PartyMemberStateUpdate | undefined => {
    const cleaned = cleanCandidateName(rawName)
    if (!cleaned) return undefined

    for (const member of membersByNameLength) {
      const nameLower = cleanCandidateName(member.characterName)
      if (nameLower && nameLower === cleaned) {
        return stateByCharId.get(member.characterId)
      }
    }

    for (const member of membersByNameLength) {
      const nameLower = cleanCandidateName(member.characterName)
      if (!nameLower) continue
      if (cleaned.includes(nameLower) || (nameLower.length >= 2 && nameLower.includes(cleaned))) {
        return stateByCharId.get(member.characterId)
      }
    }

    return undefined
  }

  // Fallback helper when an inline parenthesis omits the character name (legacy format):
  // Scopes lookbehind to the current clause/line and verifies resource + old/max compatibility.
  const resolveUnnamedFallbackMember = (
    matchIndex: number,
    rawResourceName: string,
    parsedOld?: number,
    parsedMax?: number
  ): { target: PartyMemberStateUpdate; desc: MemberResourceDescriptor } | undefined => {
    if (trackedMembers.length === 1) {
      const sole = stateByCharId.get(trackedMembers[0].characterId)
      const desc = sole
        ? matchMemberResource(sole.characterId, rawResourceName)
        : undefined
      return sole && desc ? { target: sole, desc } : undefined
    }

    const windowStart = Math.max(0, matchIndex - 220)
    const rawSlice = narrative.slice(windowStart, matchIndex)
    const lastBreak = Math.max(rawSlice.lastIndexOf('\n'), rawSlice.lastIndexOf(')'))
    const clauseText = (lastBreak >= 0 ? rawSlice.slice(lastBreak + 1) : rawSlice).toLowerCase()

    const candidatesWithResource = membersByNameLength.flatMap((m) => {
      const st = stateByCharId.get(m.characterId)
      const desc = matchMemberResource(m.characterId, rawResourceName)
      if (!st || !desc) return []
      const { max } = getCurrentResourceValue(st, desc)
      if (typeof parsedMax === 'number' && Number.isFinite(parsedMax) && max !== parsedMax) {
        return []
      }
      return [{ member: m, target: st, desc }]
    })

    if (candidatesWithResource.length === 0) return undefined

    let bestCandidate: { target: PartyMemberStateUpdate; desc: MemberResourceDescriptor } | undefined
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

  // 1. Scan all inline resource changes in the narrative (HP, Skill Cost, Sanity, Stress, Luck, Heart, etc.):
  // Supports "(Shacco — HP: 100/100 -> 80/100 [-20])", "(Shacco — Sanity: 50/50 -> 42/50 [-8])", and legacy "(HP: 100/100 -> 80/100)"
  const inlineResourceRegex =
    /\((?:([^()\n—–\-:]+?)\s*(?:—|–|-|:)\s*)?([^\n:：]+?)\s*[:：]\s*(\d+)\s*\/\s*(\d+)\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+)[^)\n]*\)/gi
  for (const match of narrative.matchAll(inlineResourceRegex)) {
    const explicitName = match[1]
    const rawResourceLabel = match[2]
    const oldVal = Number(match[3])
    const newVal = Number(match[5])
    const parsedMax = Number(match[6])

    if (explicitName) {
      const target = findMemberByExplicitName(explicitName)
      if (target) {
        const desc = matchMemberResource(target.characterId, rawResourceLabel)
        if (desc) {
          applyResourceValueToTarget(target, desc, newVal)
          continue
        }
      }
      // Also handle case where rawResourceLabel had no character name and match[1] was actually part of resource name
      const combinedLabel = `${explicitName} - ${rawResourceLabel}`
      const fallbackCombined = resolveUnnamedFallbackMember(
        match.index ?? 0,
        combinedLabel,
        oldVal,
        parsedMax
      )
      if (fallbackCombined) {
        applyResourceValueToTarget(fallbackCombined.target, fallbackCombined.desc, newVal)
      }
    } else {
      const resolved = resolveUnnamedFallbackMember(
        match.index ?? 0,
        rawResourceLabel,
        oldVal,
        parsedMax
      )
      if (resolved) {
        applyResourceValueToTarget(resolved.target, resolved.desc, newVal)
      }
    }
  }

  // 2. Parse "สถานะปาร์ตี้ :" inside [ Overview ] (authoritative end-of-turn lock for all template resources & condition)
  // Supports both single-line (";"-separated) and multi-line / bulleted party status blocks.
  const partyStatusBlockMatch = narrative.match(
    /สถานะปาร์ตี้\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:\[\s*Decision\s*\]|สถานที่และเวลา|สถานการณ์ปัจจุบัน|สถานะศัตรู)|$)/i
  )
  if (partyStatusBlockMatch) {
    const statusBlock = partyStatusBlockMatch[1].trim()
    const segments = statusBlock
      .split(/\s*;\s*|\r?\n+|\s*,\s*(?=[^:：\n]+[:：]\s*[A-Za-zก-๙])/i)
      .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean)

    const usedSegmentIndices = new Set<number>()

    for (const member of membersByNameLength) {
      const target = stateByCharId.get(member.characterId)
      if (!target) continue

      const nameLower = cleanCandidateName(member.characterName)
      let matchedSegIdx = -1

      if (trackedMembers.length === 1 && segments.length === 1) {
        matchedSegIdx = 0
      } else if (nameLower) {
        matchedSegIdx = segments.findIndex(
          (seg, idx) =>
            !usedSegmentIndices.has(idx) && cleanCandidateName(seg).includes(nameLower)
        )
      }

      if (matchedSegIdx === -1) continue
      usedSegmentIndices.add(matchedSegIdx)
      const matchingSegment = segments[matchedSegIdx]

      // Match every resource defined on this character's template within their status segment
      const descriptors = descriptorsByCharId.get(member.characterId) ?? []
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
          member.sheetTemplate?.conditions
        )
      }
    }
  }

  // 3. Synchronize automatic vitality condition thresholds (respecting template conditions) & collect changed records
  for (const member of trackedMembers) {
    const target = stateByCharId.get(member.characterId)
    if (!target) continue

    const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
    const hasHpResource = tpl.resources.some((r) => r.id === 'hp')
    const hasSpResource = tpl.resources.some((r) => r.id === 'skill_cost')
    const allowedConds = tpl.conditions.length > 0 ? tpl.conditions : CHARACTER_CONDITIONS
    const normalCond =
      allowedConds.find((c) => c.toLowerCase() === 'normal') ?? allowedConds[0] ?? 'Normal'
    const lowHpCond =
      allowedConds.find((c) => c.toLowerCase() === 'bloodied') ??
      allowedConds.find((c) => c.toLowerCase() === 'wounded') ??
      null
    const zeroHpCond =
      allowedConds.find((c) => c.toLowerCase() === 'unconscious') ??
      allowedConds.find((c) => c.toLowerCase() === 'heartbroken') ??
      null

    if (hasHpResource) {
      if (target.currentHp === 0 && zeroHpCond) {
        target.condition = zeroHpCond
      } else if (
        lowHpCond &&
        target.currentHp > 0 &&
        target.currentHp <= Math.floor(target.maxHp * 0.3) &&
        target.condition === normalCond
      ) {
        target.condition = lowHpCond
      } else if (
        lowHpCond &&
        target.currentHp > Math.floor(target.maxHp * 0.3) &&
        target.condition === lowHpCond
      ) {
        target.condition = normalCond
      }
    }

    const origHp = Math.max(0, Math.min(target.maxHp, Number(member.currentHp ?? target.maxHp)))
    const origSp = Math.max(
      0,
      Math.min(target.maxSkillCost, Number(member.currentSkillCost ?? target.maxSkillCost))
    )
    const origCond = member.condition || normalCond
    const initialCustom = initialCustomByCharId.get(member.characterId) ?? {}
    const customChanged = Object.entries(target.customResources).some(
      ([resId, val]) => (initialCustom[resId]?.current ?? val.max) !== val.current
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

/**
 * The opening narration of a new table, written from the campaign sheet before any player has acted.
 */
export async function generateOpeningNarrative(input: {
  campaign: DmTurnInput['campaign']
  loreEntries: LoreEntry[]
}): Promise<string> {
  const { campaign, loreEntries } = input

  const scanTargetText = `${campaign.world_setting}\n${campaign.core_description}`
  const openingLore = extractTriggeredLore(loreEntries, scanTargetText, true)
  const loreContext =
    openingLore.length > 0
      ? openingLore.map((l) => `[LORE: ${l.title} (${l.category})]: ${l.content}`).join('\n')
      : null

  const campaignTpl = extractCampaignTemplate(campaign)
  const isCombatCampaign =
    campaignTpl.mechanics.mode === 'combat' && campaignTpl.mechanics.vitalityResourceId !== null

  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${stripCampaignTemplateFromRules(campaign.rule_mechanics) || 'Standard tabletop rules apply.'}

[OPENING SCENE DIRECTIVES]
1. นี่คือคำบรรยายเปิดเรื่องก่อนเริ่มเทิร์นแรก ยังไม่มีผู้เล่นคนใดส่งแอ็กชัน จงเปิดฉากแรกของการผจญภัยจากข้อมูลแคมเปญข้างต้น ให้ผู้เล่นเข้าใจว่าโลกนี้เป็นอย่างไรและตอนนี้กำลังเกิดอะไรขึ้น
2. บรรยายสถานที่ เวลา บรรยากาศ และเหตุการณ์ที่กำลังเกิดขึ้นตรงหน้าปาร์ตี้ ให้มีจุดเริ่มเรื่องที่ชัดเจนพอให้ผู้เล่นตัดสินใจได้ว่าจะทำอะไรต่อ (กระชับแต่น่าติดตาม 2-3 ย่อหน้า)
3. ผู้เล่นยังไม่ได้เลือกตัวละคร ห้ามตั้งชื่อ กำหนดอาชีพ หรือตัดสินใจแทนตัวละครผู้เล่น ให้เรียกรวมว่า "ปาร์ตี้" หรือ "พวกคุณ"
4. ช่วงเปิดเรื่องยังไม่มีการทอยเต๋า ห้ามขอให้ทอยเต๋า และห้ามพิมพ์หัวข้อ [ Decision ] ออกมา
5. จบคำบรรยายด้วยคำถามสั้นๆ ที่ชวนให้ผู้เล่นประกาศแอ็กชันแรกของตัวเอง

[REQUIRED OUTPUT FORMAT]
(เนื้อหาบรรยายฉากเปิดของเรื่อง)

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่และสภาพแวดล้อมโดยย่อและบอกเวลาอย่างชัดเจนว่ากี่นาฬิกา)
สถานการณ์ปัจจุบัน : (สิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยสรุปให้เข้าใจ)
${isCombatCampaign ? 'สถานะศัตรู : (หากในฉากเปิดมีศัตรูปรากฏตัว ให้ระบุชื่อและ HP: 100% / หากยังไม่มีศัตรูให้เขียนว่า "ไม่มี")' : 'สถานะอุปสรรคหรือความตึงเครียด : (หากในฉากเปิดมีอุปสรรค ปริศนา หรือความตึงเครียด ให้ระบุโดยย่อ / หากยังไม่มีให้เขียนว่า "ไม่มี")'}`

  const openingRequest = [
    loreContext ? `[LORE FOR THE OPENING SCENE]\n${loreContext}\n` : '',
    '[OPENING]: โต๊ะเพิ่งเปิด ปาร์ตี้มารวมตัวกันแล้ว จงบรรยายฉากเปิดของการผจญภัย',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await ai.models.generateContent({
    model: DM_MODEL,
    contents: [{ role: 'user', parts: [{ text: openingRequest }] }],
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(OPENING_TIMEOUT_MS),
    },
  })

  const text = response.text?.trim()
  if (!text) throw new Error('The AI returned an empty opening scene')
  return text
}
