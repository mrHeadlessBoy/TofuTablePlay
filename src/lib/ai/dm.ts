import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import {
  ABILITY_SCORE_KEYS,
  CHARACTER_CONDITIONS,
  EQUIPMENT_LABELS,
  type AbilityScoreKey,
  type CharacterSkill,
} from '@/app/characters/equipment'
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

function formatPartyMemberForPrompt(
  member: PartyMemberAction,
  index: number,
  isFirstPlayerTurn: boolean
): string {
  const hpText = `HP: ${member.currentHp ?? '?'}/${member.maxHp ?? '?'}`
  const spText = `Skill Cost (SP): ${member.currentSkillCost ?? '?'}/${member.maxSkillCost ?? '?'}`
  const condText = `สถานะ: ${member.condition || 'Normal'}`

  const statsText = ABILITY_SCORE_KEYS.map((key) => {
    const score = member.stats?.[key] ?? 0
    const mod = formatModifier(abilityModifier(score))
    return `${key}: ${score} (${mod})`
  }).join(', ')

  const equipList = (member.equipment || [])
    .map((item, idx) => {
      const trimmed = typeof item === 'string' ? item.trim() : ''
      if (!trimmed) return ''
      const slotLabel = EQUIPMENT_LABELS[idx] ?? `Slot ${idx + 1}`
      return `${slotLabel}: ${trimmed}`
    })
    .filter(Boolean)
    .join(', ')

  const invPreview = member.inventory
    ? member.inventory.replace(/\n+/g, ', ').trim().slice(0, 600)
    : ''

  const appearancePreview = member.appearance
    ? member.appearance.replace(/\n+/g, ' ').trim().slice(0, 300)
    : ''

  const backstoryPreview = member.backstory
    ? member.backstory
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, isFirstPlayerTurn ? 500 : 350)
    : ''

  const skillsList = (member.skills || [])
    .map((s) => `${s.name} (Cost: ${s.cost}${s.description ? ` - ${s.description}` : ''})`)
    .join(' | ')

  const traits = [
    member.strengths ? `จุดเด่น: ${member.strengths.replace(/\n+/g, ' ')}` : '',
    member.weaknesses ? `จุดด้อย: ${member.weaknesses.replace(/\n+/g, ' ')}` : '',
  ]
    .filter(Boolean)
    .join(' / ')

  const lines = [
    `${index + 1}. ชื่อ: ${member.characterName} [คลาสอ้างอิง: ${member.classType}]`,
    `   - [สเตตัสปัจจุบัน]: ${hpText} | ${spText} | ${condText}`,
    `   - [ค่าสถานะทั้ง 6 (Stats & Dice Bonus)]: ${statsText}`,
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

  // 1. จัดรูปแบบข้อมูลตัวละคร + แอ็กชัน
  const actionsSummary = partyActions
    .map((member, idx) => formatPartyMemberForPrompt(member, idx, isFirstPlayerTurn))
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

  // 3. STATIC SYSTEM INSTRUCTION
  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${campaign.rule_mechanics || 'Standard tabletop RPG rules apply.'}

[CORE DIRECTIVES & RESOLUTION RULES]
1. ความต่อเนื่องของเรื่องราว:
   - ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตฉากหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
   - ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในปาร์ตี้ให้ครบตามรายชื่อ

2. การเคารพข้อมูลตัวละครอย่างครบถ้วน (Character Stats, Equipment, Inventory & Skills):
   - คำนึงถึงค่า HP, ค่าสถานะทั้ง 6 (STR, DEX, CON, INT, WIS, CHA), สถานะผิดปกติ (Condition), อุปกรณ์ที่สวมใส่ในแต่ละช่อง (Head, Torso, Leg, Foot, Left Hand, Right Hand) และไอเทมในกระเป๋าจริงในการตัดสินผลลัพธ์
   - หากผู้เล่นประกาศใช้ "สกิล (Skill)" หรือ "ไอเทม": ให้ตรวจสอบว่ามีอยู่ในข้อมูลตัวละครหรือไม่ และมีค่า Skill Cost (SP) เพียงพอหรือไม่:
     * หากมีสกิลและ Skill Cost เพียงพอ: ต้องหักค่า Skill Cost ตาม Cost ของสกิลนั้นทันที และเขียนวงเล็บระบุการลดลงของ Skill Cost ในเนื้อเรื่องด้วย เช่น "(Skill Cost: 10/10 -> 7/10 [-3 SP])"
     * หากไม่มีสกิลนั้น หรือ Skill Cost ปัจจุบันไม่พอ: ให้บรรยายว่าการร่ายสกิลล้มเหลวหรือเกิดผลเสียแทน

3. กฎการตัดสินผลแอ็กชันและลูกเต๋า (Action & Dice Resolution):
   - [กรณีไม่ส่งแอ็กชัน]: ให้บรรยายว่าตัวละครนั้น "ยืนนิ่ง ชะงัก หรือคุมเชิงดูสถานการณ์อยู่กับที่" ห้ามคิดการเคลื่อนไหวหรือสั่งโจมตีแทนผู้เล่นเด็ดขาด
   - [แอ็กชันทั่วไปที่ไม่เสี่ยงอันตราย]: เช่น เดินสำรวจ พูดคุยทั่วไป เปิดประตูที่ไม่ได้ล็อก หยิบของ ให้สำเร็จตามเนื้อผ้าได้โดยไม่ต้องมีผลเต๋า
   - [แอ็กชันต่อสู้หรือมีความเสี่ยงสูง]:
     * ยึดตามผลทอยเต๋าที่แนบมาในแอ็กชันอย่างเคร่งครัด (SUCCESS = สำเร็จ, FAIL = ล้มเหลว, NATURAL 20 = สำเร็จระดับคริติคอล, NATURAL 1 = พลาดท่าอย่างรุนแรง)
     * หากผู้เล่นสั่งโจมตีศัตรูหรือทำเรื่องเสี่ยงตาย แต่ "ไม่ยอมทอยเต๋าแนบมา" ให้ตัดสินว่าจังหวะนั้นพลาดเป้า ถูกศัตรูปัดป้องได้ หรือล้มเหลวทันที และต้องถูกศัตรูโจมตีสวนกลับ!

4. กฎเหล็กด้านสมดุลการต่อสู้และหลอดเลือดมอนสเตอร์ (Enemy HP % & Damage Scaling) [สำคัญที่สุด]:
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

5. กฎความเด็ดขาดและการคำนวณดาเมจต่อผู้เล่น (High Stakes, Player HP Loss Calculation & NO Plot Armor) [สำคัญที่สุด]:
   - ห้ามมี Plot Armor ปกป้องผู้เล่นเด็ดขาด! (ไม่ว่าจะเล่นคนเดียว Solo หรือเล่นเป็นปาร์ตี้) หากทอยเต๋าล้มเหลว (FAIL หรือ NATURAL 1) ในจังหวะอันตราย, สั่งโจมตีโดยไม่ทอยเต๋า, ประมาท, หรือถูกมอนสเตอร์ที่ยังไม่ตายโจมตีสวนกลับ ให้บรรยายบาดแผล คำนวณความเสียหายเป็นจำนวนหน่วย HP ที่ผู้เล่นเสียไปจริง และระบุสถานะผิดปกติที่ผู้เล่นได้รับอย่างสมจริงเสมอ!
   - เกณฑ์คำนวณความเสียหายต่อ HP ของผู้เล่น (คิดเป็นสัดส่วน % ของค่า Max HP ของผู้เล่นคนนั้น แล้วแปลงเป็นจำนวนเต็มหน่วย HP ขั้นต่ำอย่างน้อย 1 HP):
     * โดนโจมตีเฉี่ยวๆ / กับดักเล็กน้อย / ปัดป้องหรือหลบได้บางส่วน: เสียเลือด 5% - 10% ของ Max HP (ขั้นต่ำ 1 HP)
     * โดนศัตรูโจมตีปกติ / ศัตรูสวนกลับท้ายเทิร์น / ทอยเต๋าได้ FAIL ในจังหวะปะทะหรือหลบหลีก / สั่งโจมตีโดยไม่ทอยเต๋า: เสียเลือด 15% - 25% ของ Max HP
     * โดนท่าไม้ตายศัตรู / ศัตรูระดับ Elite หรือ Boss โจมตีเต็มแรง / ทอยติด NATURAL 1 (Critical Fail) / ประมาทอย่างรุนแรง: เสียเลือด 30% - 45% ของ Max HP
     * (ให้นำค่า CON และอุปกรณ์ป้องกันในช่อง "สวมใส่" ของผู้เล่นมาพิจารณาปรับลดหรือเพิ่มดาเมจภายในช่วง % ข้างต้นตามความสมเหตุสมผล และหากการโจมตีมีพิษ มึนงง คำสาป หรือบาดเจ็บสาหัส ให้เปลี่ยนสถานะ Condition เป็น Bloodied, Poisoned, Stunned, Blinded, Exhausted หรือ Unconscious เมื่อ HP เหลือ 0)
   - [บังคับเขียนตัวเลข HP ของผู้เล่นในเนื้อเรื่องทุกครั้งที่เสียเลือดหรือฟื้นฟูเลือด]:
     * ทุกครั้งที่ผู้เล่นได้รับความเสียหายหรือฟื้นฟู HP ต้องเขียนวงเล็บระบุค่า HP เดิม -> ค่า HP ใหม่ พร้อมจำนวนหน่วยที่ลดลง/เพิ่มขึ้นในเนื้อเรื่องทันที เช่น "(HP: 100/100 -> 80/100 [-20 HP])" หรือ "(HP: 20/20 -> 16/20 [-4 HP])"
     * ห้ามบรรยายแค่ว่า "ได้รับบาดเจ็บ" หรือ "ถูกโจมตี" โดยไม่ระบุตัวเลขหน่วย HP ที่ลดลงเด็ดขาด!

6. กฎเหล็กห้ามบรรยายซ้ำซาก (STRICT ANTI-REPETITION & NO EPITHETS):
   - เรียกตัวละครด้วย "ชื่อ" เท่านั้น (เช่น "**Shacco**", "**ไมค์**", "**Pantheon**") ห้ามเขียนสร้อยฉายา อาชีพ หรือลักษณะชุดต่อท้ายชื่อซ้ำๆ เด็ดขาด (เช่น ห้ามเขียน "Shacco นักฆ่าในชุดตัวตลก...", "ไมค์ นักบวชผู้ควบคุมเปลวไฟ...", "Pantheon ทหารรับจ้างสไตล์สปาร์ตา...")
   - ห้ามนำนิสัยท่าทางเดิมๆ หรือจุดด้อย (เช่น ความซุ่มซ่ามเกือบสะดุดล้ม, ฝีเท้าหนักแน่นและเชื่องช้า, รังสีความน่ากลัว) ที่เคยบรรยายไปแล้วในเทิร์นก่อนหน้า มาเขียนซ้ำอีกในเทิร์นนี้ ยกเว้นผู้เล่นจะทอยเต๋าได้ FAIL หรือสั่งทำแอ็กชันที่กระตุ้นจุดด้อยนั้นโดยตรง
   - โฟกัสเฉพาะ "แอ็กชันที่ผู้เล่นสั่งในเทิร์นนี้" และ "ผลลัพธ์ใหม่ที่เกิดขึ้น" เท่านั้น
  
[REQUIRED OUTPUT FORMAT]
(เนื้อหาบรรยายเรื่องราว ผลลัพธ์การกระทำของทุกคน ฉากการปะทะพร้อมวงเล็บ (HP: X% -> Y%) เมื่อศัตรูได้รับดาเมจ และวงเล็บ (HP: เดิม/Max -> ใหม่/Max [-Z HP]) หรือ (Skill Cost: เดิม/Max -> ใหม่/Max [-Z SP]) เมื่อผู้เล่นเสียเลือดหรือใช้สกิล)

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่ สภาพแวดล้อมโดยย่อ และเวลาปัจจุบัน เช่น 14:30 น.)
สถานการณ์ปัจจุบัน : (สรุปสิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยย่อ)
สถานะศัตรู : (ระบุชื่อศัตรูทุกตัวในฉากพร้อม HP% คงเหลือล่าสุด เช่น "หมาป่าทมิฬ A: 55%, หมาป่าทมิฬ B: 100%" / หากศัตรูตายให้ระบุว่า "0% (ตายแล้ว)" / หากไม่มีศัตรูในฉากให้เขียนว่า "ไม่มี")
สถานะปาร์ตี้ : (ระบุสถานะล่าสุดหลังจบเทิร์นของสมาชิกทุกคนในปาร์ตี้ คั่นแต่ละคนด้วย " ; " ตามรูปแบบ: "ชื่อตัวละคร: HP X/MaxHP | SP Y/MaxSP | สถานะ: Normal" เช่น "Shacco: HP 80/100 | SP 7/10 | สถานะ: Normal")

[ Decision ]
*(เงื่อนไขสำคัญ: แสดงหมวดนี้เฉพาะเมื่อมีตัวละครต้องทอยเต๋าเพื่อโจมตี ป้องกัน หรือรับมือเหตุการณ์ในเทิร์นถัดไปเท่านั้น! หากไม่มี ให้ตัดหัวข้อ [ Decision ] ทิ้งทันที)*
(ระบุ 1 บรรทัดต่อ 1 คน พร้อมกำหนดค่า DC มาตรฐาน: ง่าย DC 8-10, ปานกลาง DC 12-14, ยาก DC 15-17, วิกฤต DC 18+):
- [ชื่อตัวละคร]: สิ่งที่ต้องทำ/รับมือ: (สิ่งที่กำลังเผชิญ) | [d20 + สเตตัส (STR/DEX/CON/INT/WIS/CHA) vs DC XX]`

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
    `[CURRENT TURN: PARTY STATUS & SUBMITTED ACTIONS (${partyActions.length} Members)]\n${actionsSummary || 'The party surveys their surroundings.'}`,
    `\n[SYSTEM REMINDER: AUTHOR'S NOTE - ต้องปฏิบัติตามอย่างเคร่งครัด]
- กล่าวถึงผลลัพธ์ของสมาชิกทุกคนตามรายชื่อด้านบน โดยอ้างอิงค่าสถานะทั้ง 6 (STR, DEX, CON, INT, WIS, CHA) อุปกรณ์สวมใส่ และสกิลที่มีจริง
- [ห้ามพูดซ้ำเด็ดขาด]: เรียกตัวละครด้วยชื่อล้วนๆ (เช่น **Shacco**, **ไมค์**, **Pantheon**) ห้ามใส่ฉายา อาชีพ หรือคำบรรยายชุด/รูปลักษณ์ต่อท้ายชื่อซ้ำกับเทิร์นก่อนหน้า และห้ามใส่มุกเดิมซ้ำๆ ให้บรรยายเฉพาะแอ็กชันที่ทำในเทิร์นนี้เท่านั้น!
- หากมีการต่อสู้: ห้ามให้มอนสเตอร์ตายในทีเดียว! คำนวณดาเมจศัตรูเป็นเปอร์เซ็นต์ เช่น (HP: 100% -> 80%) โดยคิดต่อเนื่องจากค่า HP% ใน [ Overview ] ของเทิร์นก่อนหน้า
- [ห้ามมี Plot Armor & ต้องคำนวณดาเมจผู้เล่นเป็นตัวเลขเสมอ]: เมื่อผู้เล่นถูกศัตรูโจมตี/สวนกลับ ทอยเต๋าล้มเหลว (FAIL / NATURAL 1) ในจังหวะอันตราย หรือโจมตีโดยไม่ทอยเต๋า ต้องคำนวณหน่วย HP ที่ผู้เล่นเสียไปตามสัดส่วน Max HP (เฉี่ยว 5-10%, ปกติ/สวนกลับ/FAIL 15-25%, รุนแรง/NAT 1/Boss 30-45%) และต้องเขียนวงเล็บ (HP: เดิม/Max -> ใหม่/Max [-X HP]) ในเนื้อเรื่องเสมอ! หากใช้สกิลต้องหัก Skill Cost และเขียน (Skill Cost: เดิม/Max -> ใหม่/Max [-Y SP]) ด้วย!
- สรุปท้ายข้อความตามรูปแบบ [ Overview ] (ที่มีครบทั้งบรรทัด "สถานะศัตรู :" และ "สถานะปาร์ตี้ :") และ [ Decision ] เท่านั้น`,
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

function normalizeParsedCondition(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[*[\]()]/g, '').trim()
  if (!cleaned) return fallback

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
 * Extracts updated HP, Skill Cost (SP), and Status Condition for each party member
 * from the AI Dungeon Master's narrative and `[ Overview ]` section.
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
  for (const member of trackedMembers) {
    const maxHp = Math.max(1, Number(member.maxHp) || 10)
    const currentHp = Math.max(0, Math.min(maxHp, Number(member.currentHp ?? maxHp)))
    const maxSkillCost = Math.max(0, Number(member.maxSkillCost ?? 10))
    const currentSkillCost = Math.max(
      0,
      Math.min(maxSkillCost, Number(member.currentSkillCost ?? maxSkillCost))
    )
    stateByCharId.set(member.characterId, {
      characterId: member.characterId,
      characterName: member.characterName,
      currentHp,
      maxHp,
      currentSkillCost,
      maxSkillCost,
      condition: member.condition || 'Normal',
    })
  }

  // Helper to find which member a match at `matchIndex` belongs to
  const resolveTargetMember = (matchIndex: number, parsedMax?: number) => {
    if (trackedMembers.length === 1) {
      return stateByCharId.get(trackedMembers[0].characterId)
    }

    const beforeText = narrative.slice(Math.max(0, matchIndex - 350), matchIndex).toLowerCase()
    let bestMember: PartyMemberStateUpdate | undefined
    let bestPos = -1

    for (const member of trackedMembers) {
      const nameLower = member.characterName.trim().toLowerCase()
      if (!nameLower) continue
      const pos = beforeText.lastIndexOf(nameLower)
      if (pos > bestPos) {
        bestPos = pos
        bestMember = stateByCharId.get(member.characterId)
      }
    }

    if (bestMember) return bestMember

    if (typeof parsedMax === 'number') {
      const matchingMax = trackedMembers.filter((m) => (m.maxHp ?? 10) === parsedMax)
      if (matchingMax.length === 1) {
        return stateByCharId.get(matchingMax[0].characterId)
      }
    }

    return undefined
  }

  // 1. Scan inline player HP changes in the narrative: e.g. "(HP: 100/100 -> 80/100 [-20 HP])"
  const inlineHpRegex =
    /\(HP:\s*(\d+)\s*\/\s*(\d+)\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+)[^)\n]*\)/gi
  for (const match of narrative.matchAll(inlineHpRegex)) {
    const newHp = Number(match[3])
    const parsedMax = Number(match[4])
    const target = resolveTargetMember(match.index ?? 0, parsedMax)
    if (target && Number.isFinite(newHp)) {
      target.currentHp = Math.max(0, Math.min(target.maxHp, Math.round(newHp)))
    }
  }

  // 2. Scan inline Skill Cost changes in the narrative: e.g. "(Skill Cost: 10/10 -> 7/10 [-3 SP])"
  const inlineSpRegex =
    /\((?:Skill\s*Cost|SP):\s*(\d+)\s*\/\s*(\d+)\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+)[^)\n]*\)/gi
  for (const match of narrative.matchAll(inlineSpRegex)) {
    const newSp = Number(match[3])
    const target = resolveTargetMember(match.index ?? 0)
    if (target && Number.isFinite(newSp)) {
      target.currentSkillCost = Math.max(0, Math.min(target.maxSkillCost, Math.round(newSp)))
    }
  }

  // 3. Parse "สถานะปาร์ตี้ :" line inside [ Overview ] (authoritative end-of-turn summary)
  const partyStatusLineMatch = narrative.match(/สถานะปาร์ตี้\s*[:：]\s*([^\n]+)/i)
  if (partyStatusLineMatch) {
    const statusLine = partyStatusLineMatch[1]
    const segments = statusLine.split(/\s*;\s*|\s*,\s*(?=[^:：]+[:：]\s*HP)/i)

    for (const member of trackedMembers) {
      const target = stateByCharId.get(member.characterId)
      if (!target) continue

      const nameLower = member.characterName.trim().toLowerCase()
      const matchingSegment =
        trackedMembers.length === 1
          ? statusLine
          : segments.find((seg) => seg.toLowerCase().includes(nameLower))

      if (!matchingSegment) continue

      const hpMatch = matchingSegment.match(
        /HP\s*[:：]?\s*(\d+)\s*\/\s*(\d+)(?:\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+))?/i
      )
      if (hpMatch) {
        const latestHp = Number(hpMatch[3] ?? hpMatch[1])
        if (Number.isFinite(latestHp)) {
          target.currentHp = Math.max(0, Math.min(target.maxHp, Math.round(latestHp)))
        }
      }

      const spMatch = matchingSegment.match(
        /(?:Skill\s*Cost|SP)\s*[:：]?\s*(\d+)\s*\/\s*(\d+)(?:\s*(?:->|→|=>)\s*(\d+)\s*\/\s*(\d+))?/i
      )
      if (spMatch) {
        const latestSp = Number(spMatch[3] ?? spMatch[1])
        if (Number.isFinite(latestSp)) {
          target.currentSkillCost = Math.max(
            0,
            Math.min(target.maxSkillCost, Math.round(latestSp))
          )
        }
      }

      const condMatch = matchingSegment.match(/(?:สถานะ|Condition)\s*[:：]\s*([^|;,\n]+)/i)
      if (condMatch) {
        target.condition = normalizeParsedCondition(condMatch[1], target.condition)
      }
    }
  }

  // 4. Synchronize automatic Bloodied / Unconscious condition thresholds & collect changed records
  for (const member of trackedMembers) {
    const target = stateByCharId.get(member.characterId)
    if (!target) continue

    if (target.currentHp === 0) {
      target.condition = 'Unconscious'
    } else if (
      target.currentHp <= Math.floor(target.maxHp * 0.5) &&
      target.condition === 'Normal'
    ) {
      target.condition = 'Bloodied'
    } else if (
      target.currentHp > Math.floor(target.maxHp * 0.5) &&
      target.condition === 'Bloodied'
    ) {
      target.condition = 'Normal'
    }

    const origHp = Math.max(0, Math.min(target.maxHp, Number(member.currentHp ?? target.maxHp)))
    const origSp = Math.max(
      0,
      Math.min(target.maxSkillCost, Number(member.currentSkillCost ?? target.maxSkillCost))
    )
    const origCond = member.condition || 'Normal'

    if (
      target.currentHp !== origHp ||
      target.currentSkillCost !== origSp ||
      target.condition !== origCond
    ) {
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

  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${campaign.rule_mechanics || 'Standard tabletop rules apply.'}

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
สถานะศัตรู : (หากในฉากเปิดมีศัตรูปรากฏตัว ให้ระบุชื่อและ HP: 100% / หากยังไม่มีศัตรูให้เขียนว่า "ไม่มี")`

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
