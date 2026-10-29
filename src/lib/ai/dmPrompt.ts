import { CHARACTER_CONDITIONS } from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  DEFAULT_MECHANICS,
  type TemplateDice,
  type TemplateMode,
} from '@/features/character/template'
import { formatRuleMechanicsForPrompt } from '@/features/campaign/rules'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import type { LoreEntry } from './lorebook'
import { getMemberResourceDescriptors } from './dmParty'
import type { DmTurnInput, PartyDamageBenchmark, PartyMemberAction } from './dmTypes'

// Builders for the AI DM's system instruction and messages. The prompt wording lives here unchanged.

export type DmContent = { role: 'user' | 'model'; parts: [{ text: string }] }

export type PartySheetSummary = {
  partyModes: Set<TemplateMode>
  partyDice: Set<TemplateDice>
  dynamicStatsSummary: string
  dynamicEquipSummary: string
  dynamicResourcesSummary: string
  dynamicConditionsSummary: string
}

export type PromptModeFlags = {
  hasCombat: boolean
  hasSocial: boolean
  hasHorror: boolean
  hasNarrative: boolean
}

// "[LORE: Title (Category)]: content" lines, or null when nothing was triggered
export function formatLoreContext(lore: LoreEntry[]): string | null {
  return lore.length > 0
    ? lore.map((l) => `[LORE: ${l.title} (${l.category})]: ${l.content}`).join('\n')
    : null
}

// Union of every member's template: modes, dice, stat / gear / resource / condition labels
export function summarizePartySheets(partyActions: PartyMemberAction[]): PartySheetSummary {
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

  return {
    partyModes,
    partyDice,
    dynamicStatsSummary,
    dynamicEquipSummary,
    dynamicResourcesSummary,
    dynamicConditionsSummary,
  }
}

// Which rule modules apply. Combat needs both a combat sheet and a vitality bar (damage benchmark).
export function getPromptModeFlags(
  partyModes: Set<TemplateMode>,
  damageBenchmark: PartyDamageBenchmark | null,
): PromptModeFlags {
  const hasCombat = damageBenchmark !== null && partyModes.has('combat')
  const hasSocial = partyModes.has('social')
  const hasHorror = partyModes.has('horror')
  const hasNarrative = partyModes.has('narrative') || (!hasCombat && !hasSocial && !hasHorror)
  return { hasCombat, hasSocial, hasHorror, hasNarrative }
}

// Build dynamic Overview example per character so AI reports every resource in each player's template
export function buildPartyStatusFormatExample(partyActions: PartyMemberAction[]): string {
  return (
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
  )
}

// Dynamic middle line of [ Overview ]
export function getOverviewMiddleSection({
  hasCombat,
  hasSocial,
  hasHorror,
  hasNarrative,
}: PromptModeFlags): string {
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
  return overviewMiddleSection
}

// Dynamic instructions for [ Decision ], one line per dice system in the party
export function buildDecisionDiceInstructions(partyDice: Set<TemplateDice>): string[] {
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
  return decisionDiceInstructions
}

export function getRequiredOutputDescription({ hasCombat, hasSocial, hasHorror }: PromptModeFlags): string {
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
  return requiredOutputDescription
}

// Construct modular rules (core rules always, combat / social / horror / narrative by party mode)
export function buildRuleModules({
  damageBenchmark,
  hasCombat,
  hasSocial,
  hasHorror,
  hasNarrative,
  dynamicResourcesSummary,
  dynamicStatsSummary,
  dynamicConditionsSummary,
  dynamicEquipSummary,
}: PromptModeFlags &
  Omit<PartySheetSummary, 'partyModes' | 'partyDice'> & {
    damageBenchmark: PartyDamageBenchmark | null
  }): string[] {
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

  if (hasCombat && damageBenchmark) {
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

  return ruleModules
}

export function buildTurnSystemInstruction({
  campaign,
  isEn,
  ruleModules,
  requiredOutputDescription,
  overviewMiddleSection,
  dynamicPartyStatusFormatExample,
  dynamicStatsSummary,
  decisionDiceInstructions,
}: {
  campaign: DmTurnInput['campaign']
  isEn: boolean
  ruleModules: string[]
  requiredOutputDescription: string
  overviewMiddleSection: string
  dynamicPartyStatusFormatExample: string
  dynamicStatsSummary: string
  decisionDiceInstructions: string[]
}): string {
  return isEn
    ? `You are the AI Dungeon Master, supreme referee, storyteller, and immersive world-builder for the tabletop RPG campaign titled "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${formatRuleMechanicsForPrompt(campaign.rule_mechanics)}

[LANGUAGE DIRECTIVE]
Output all narrative descriptions, atmospheric prose, character dialogues, [ Overview ], and [ Decision ] strictly in natural, fluent, and evocative English.

[CORE DIRECTIVES & RESOLUTION RULES]
${ruleModules.join('\n\n')}

[REQUIRED OUTPUT FORMAT]
${requiredOutputDescription}

[ Overview ]
Location & Time : (Location name, environment brief, and current time)
Current Situation : (Concise summary of immediate party circumstances)
${overviewMiddleSection}
Party Status : (Report all resources from each member's sheet and latest condition, separated by " ; " e.g. "${dynamicPartyStatusFormatExample}")

[ Decision ]
*(Important: Only include this section if members must make an urgent decision or skill check in the next turn! Otherwise omit [ Decision ] completely)*
(1 line per character, citing real stats from that character's sheet e.g. ${dynamicStatsSummary}):
${decisionDiceInstructions.join('\n')}`
    : `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${formatRuleMechanicsForPrompt(campaign.rule_mechanics)}

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
}

// Sliding window of the last 4 turns as user (actions) / model (narration) pairs
export function buildRecentTurnContents(recentTurns: DmTurnInput['recentTurns']): DmContent[] {
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

  return contents
}

// Current turn payload: triggered lore, every member's sheet + action, and the author's-note reminder
export function buildCurrentTurnMessage({
  loreContext,
  partyActions,
  damageBenchmark,
  actionsSummary,
  dynamicStatsSummary,
  dynamicResourcesSummary,
  dynamicConditionsSummary,
}: {
  loreContext: string | null
  partyActions: PartyMemberAction[]
  damageBenchmark: PartyDamageBenchmark | null
  actionsSummary: string
  dynamicStatsSummary: string
  dynamicResourcesSummary: string
  dynamicConditionsSummary: string
}): string {
  return [
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
}

export function buildOpeningSystemInstruction(
  campaign: DmTurnInput['campaign'],
  isEn: boolean,
  isCombatCampaign: boolean,
): string {
  return isEn
    ? `You are the AI Dungeon Master, supreme referee, storyteller, and immersive world-builder for the tabletop RPG campaign titled "${campaign.title}" (${campaign.category}). Output all narrative descriptions, atmospheric prose, and structured output strictly in vivid, engaging, and evocative English.

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${formatRuleMechanicsForPrompt(campaign.rule_mechanics)}

[OPENING SCENE DIRECTIVES]
1. This is the opening scene prologue before any player has acted. Introduce the world and set the stage using the campaign details above.
2. Describe the location, time of day, atmosphere, and the immediate situation unfolding before the adventurers in 2-3 compelling paragraphs.
3. Players have not yet bound characters or acted. Do not name specific characters or invent personal backstories; refer to them collectively as "the party" or "you".
4. There are no dice rolls yet. Do NOT ask for checks and do NOT output [ Decision ].
5. Conclude with a brief call to action prompting players for their opening moves.

[REQUIRED OUTPUT FORMAT]
(Opening story narrative text)

[ Overview ]
Location & Time : (Location name, environment summary, and explicit time of day)
Current Situation : (Concise summary of the immediate situation facing the party)
${isCombatCampaign ? 'Enemy Status : (If hostiles appear in the opening, name them with HP: 100% / if none yet, write "None")' : 'Obstacle & Tension Status : (If obstacles, mysteries, or tension exist, state them briefly / if none yet, write "None")'}`
    : `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${formatRuleMechanicsForPrompt(campaign.rule_mechanics)}

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
}
