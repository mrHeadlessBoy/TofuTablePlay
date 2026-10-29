import {
  CHARACTER_CONDITIONS,
  formatInventoryForPrompt,
} from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  COLUMN_EQUIPMENT_SLOT_INDEX,
  isColumnStatId,
  isColumnTextFieldId,
  type CharacterTemplate,
  type SheetCustomValues,
} from '@/features/character/template'
import { abilityModifier, formatModifier } from '@/components/dice/dice'
import type { MemberResourceDescriptor, PartyDamageBenchmark, PartyMemberAction } from './dmTypes'

// Per-character prompt blocks for the AI DM: resource readouts, damage benchmark, defense and sheet details

export function escapeRegexLiteral(str: string): string {
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

// Every resource bar on the member's template with its current/max value and aliases
export function getMemberResourceDescriptors(member: PartyMemberAction): MemberResourceDescriptor[] {
  const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
  const custom = member.sheetCustom

  return tpl.resources.map((res) => {
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

const NO_ACTION_TEXT =
  '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจเคลื่อนไหวหรือโจมตีแทนผู้เล่น)'

// Damage bands shared by the whole table (null when nobody has a vitality bar)
export function computePartyDamageBenchmark(partyActions: PartyMemberAction[]): PartyDamageBenchmark | null {
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

// CON (or an equivalent resilience stat) modifier; a template without one gets no penalty
function getResilienceModifier(
  member: PartyMemberAction,
  tpl: CharacterTemplate,
  custom: SheetCustomValues | undefined,
): { conModifier: number; resilienceStatLabel: string } {
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
  return { conModifier, resilienceStatLabel }
}

// Worn gear counts as armor; hand slots only count when they hold a shield or guard
function countArmorPieces(
  member: PartyMemberAction,
  tpl: CharacterTemplate,
  custom: SheetCustomValues | undefined,
): number {
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

  return armorPiecesCount
}

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
  const { conModifier, resilienceStatLabel } = getResilienceModifier(member, tpl, custom)
  const armorPiecesCount = countArmorPieces(member, tpl, custom)

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

function formatResourcesText(resourceDescriptors: MemberResourceDescriptor[]): string {
  return resourceDescriptors
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
}

function formatStatsText(
  tpl: CharacterTemplate,
  member: PartyMemberAction,
  custom: SheetCustomValues | undefined,
): string {
  return tpl.stats.length > 0
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
}

function formatEquipmentText(
  tpl: CharacterTemplate,
  member: PartyMemberAction,
  custom: SheetCustomValues | undefined,
): string {
  return tpl.equipmentSlots.length > 0
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
}

// Strengths / weaknesses plus any custom bio fields, joined with " / "
function formatTraitsText(
  tpl: CharacterTemplate,
  member: PartyMemberAction,
  custom: SheetCustomValues | undefined,
): string {
  const hasStrengthsField = tpl.textFields.some((f) => f.id === 'strengths')
  const hasWeaknessesField = tpl.textFields.some((f) => f.id === 'weaknesses')

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


  return [
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
}

// The full prompt block for one party member: sheet header, resources, stats, defense, gear, traits and action
export function formatPartyMemberForPrompt(
  member: PartyMemberAction,
  index: number,
  isFirstPlayerTurn: boolean,
  benchmark: PartyDamageBenchmark | null
): string {
  const tpl = member.sheetTemplate ?? CLASSIC_TEMPLATE
  const custom = member.sheetCustom
  const resourceDescriptors = getMemberResourceDescriptors(member)

  const resourcesPromptText = formatResourcesText(resourceDescriptors)

  const allowedConds = tpl.conditions.length > 0 ? tpl.conditions : CHARACTER_CONDITIONS
  const condText = `สถานะ: ${member.condition || allowedConds[0] || 'Normal'} (สถานะของชีทนี้: ${allowedConds.join(', ')})`

  const statsText = formatStatsText(tpl, member, custom)

  const defenseInfo =
    benchmark && resourceDescriptors.length > 0
      ? computeCharacterDefenseInfo(member, benchmark.avgPartyMaxHp)
      : null

  const equipList = formatEquipmentText(tpl, member, custom)

  const invPreview =
    tpl.sections.inventory && member.inventory
      ? formatInventoryForPrompt(member.inventory).slice(0, 600)
      : ''

  const hasAppearanceField = tpl.textFields.some((f) => f.id === 'appearance')
  const hasBackstoryField = tpl.textFields.some((f) => f.id === 'backstory')

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

  const traits = formatTraitsText(tpl, member, custom)

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
