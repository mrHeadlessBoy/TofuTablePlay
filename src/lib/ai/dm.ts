import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'
import { OPENING_TURN_NUMBER } from '@/lib/turns'
import type { CharacterSkill } from '@/app/characters/equipment'

const ai = new GoogleGenAI()

// One model for every Dungeon Master call (turn narration and the opening scene)
const DM_MODEL = 'gemini-3.5-flash-lite'
const OPENING_TIMEOUT_MS = 15000

export interface PartyMemberAction {
  characterName: string
  classType: string
  currentHp?: number
  maxHp?: number
  currentSkillCost?: number
  maxSkillCost?: number
  condition?: string
  inventory?: string
  equipment?: string[]
  strengths?: string
  weaknesses?: string
  backstory?: string
  skills?: CharacterSkill[]
  action: string | null
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

function formatPartyMemberForPrompt(member: PartyMemberAction, index: number): string {
  const hpText = `HP: ${member.currentHp ?? '?'}/${member.maxHp ?? '?'}`
  const spText = `Skill Cost: ${member.currentSkillCost ?? '?'}/${member.maxSkillCost ?? '?'}`
  const condText = `สถานะ: ${member.condition || 'Normal'}`

  const equipList = (member.equipment || []).map((e) => e.trim()).filter(Boolean).join(', ')
  const invPreview = member.inventory ? member.inventory.replace(/\n+/g, ', ').trim().slice(0, 150) : ''

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
    `${index + 1}. ${member.characterName} (${member.classType})`,
    `   - [สเตตัสปัจจุบัน]: ${hpText} | ${spText} | ${condText}`,
  ]

  if (equipList || invPreview) {
    lines.push(
      `   - [อุปกรณ์/ไอเทม]: ${[equipList && `สวมใส่: ${equipList}`, invPreview && `กระเป๋า: ${invPreview}`].filter(Boolean).join(' || ')}`
    )
  }
  if (skillsList) {
    lines.push(`   - [สกิลที่มี]: ${skillsList}`)
  }
  if (traits) {
    lines.push(`   - [ลักษณะเฉพาะ]: ${traits}`)
  }
  lines.push(`   - [แอ็กชันที่ทำในเทิร์นนี้]: ${member.action || NO_ACTION_TEXT}`)

  return lines.join('\n')
}

export async function generateDmNarrative(input: DmTurnInput): Promise<string> {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // 1. จัดรูปแบบข้อมูลตัวละคร + แอ็กชัน
  const actionsSummary = partyActions
    .map((member, idx) => formatPartyMemberForPrompt(member, idx))
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

2. การเคารพข้อมูลตัวละคร (Character State, Equipment & Skills):
   - คำนึงถึงค่า HP, สถานะผิดปกติ (Condition), จุดเด่น/จุดด้อย และอุปกรณ์ที่สวมใส่จริง
   - หากผู้เล่นประกาศใช้ "สกิล (Skill)" หรือ "ไอเทม": ให้ตรวจสอบว่ามีอยู่ในข้อมูลตัวละครหรือไม่ และมีค่า Skill Cost เพียงพอหรือไม่ (หากไม่มีสกิลนั้น หรือ Skill Cost ปัจจุบันไม่พอ ให้บรรยายว่าการร่ายสกิลล้มเหลวหรือเกิดผลเสียแทน)

3. กฎการตัดสินผลแอ็กชันและลูกเต๋า (Action & Dice Resolution):
   - [กรณีไม่ส่งแอ็กชัน]: ให้บรรยายว่าตัวละครนั้น "ยืนนิ่ง ชะงัก หรือคุมเชิงดูสถานการณ์อยู่กับที่" ห้ามคิดการเคลื่อนไหวหรือสั่งโจมตีแทนผู้เล่นเด็ดขาด
   - [แอ็กชันทั่วไปที่ไม่เสี่ยงอันตราย]: เช่น เดินสำรวจ พูดคุยทั่วไป เปิดประตูที่ไม่ได้ล็อก หยิบของ ให้สำเร็จตามเนื้อผ้าได้โดยไม่ต้องมีผลเต๋า
   - [แอ็กชันต่อสู้หรือมีความเสี่ยงสูง]:
     * ยึดตามผลทอยเต๋าที่แนบมาในแอ็กชันอย่างเคร่งครัด (SUCCESS = สำเร็จ, FAIL = ล้มเหลว, NATURAL 20 = สำเร็จระดับคริติคอล, NATURAL 1 = พลาดท่าอย่างรุนแรง)
     * หากผู้เล่นสั่งโจมตีศัตรูหรือทำเรื่องเสี่ยงตาย แต่ "ไม่ยอมทอยเต๋าแนบมา" ให้ตัดสินว่าจังหวะนั้นพลาดเป้า ถูกศัตรูปัดป้องได้ หรือล้มเหลวทันที

4. กฎเหล็กด้านสมดุลการต่อสู้และหลอดเลือดมอนสเตอร์ (Enemy HP % & Damage Scaling) [สำคัญที่สุด]:
   - ห้ามให้มอนสเตอร์ตายในแอ็กชันเดียว (NO ONE-SHOT KILLS)! การต่อสู้ต้องมีความตึงเครียดและใช้เวลาหลายเทิร์น (ยกเว้นมอนสเตอร์ตัวนั้นเหลือเลือดต่ำมากอยู่แล้ว หรือเป็นศตรูที่ไร้ทางสู้ เช่น ถูกลอบโจมตี หรือ เป็นศตรูที่อ่อนแอมากพอให้สามารถตายได้ในเทิร์นเดียวได้)
   - มอนสเตอร์ทุกตัวเริ่มที่ HP 100% เสมอ และต้องคำนวณลด % เลือดตามความสมเหตุสมผลของอาวุธ สกิล และผลเต๋า ดังนี้:
     * โจมตีด้วยมือเปล่า / อาวุธที่ไม่ถนัด / ท่าก่อกวน / เฉี่ยวชน: ลด 5% - 10%
     * โจมตีปกติด้วยอาวุธประจำตัว (ทอย SUCCESS): ลด 15% - 25%
     * ใช้สกิลโจมตี (Skill) ที่เสีย Skill Cost หรือโจมตีจุดอ่อนสำเร็จ: ลด 25% - 35%
     * ทอยติด NATURAL 20 (Critical Hit) หรือประสานงานคอมโบใหญ่ของปาร์ตี้: ลด 35% - 50%
     * [กรณีมอนสเตอร์ระดับ Elite / หัวหน้าฝูง]: ให้ลดความเสียหายข้างต้นลงครึ่งหนึ่ง (เช่น โจมตีปกติลดแค่ 10% - 15%)
     * [กรณีมอนสเตอร์ระดับ Boss]: โจมตีปกติลดเพียง 5% - 10% และสกิลใหญ่/Critical ลดไม่เกิน 15% - 25% ต่อแอ็กชัน
     * [กรณีทอย FAIL หรือไม่ทอยเต๋าในการโจมตี]: ลด 0% (HP คงเดิม) และอาจถูกสวนกลับ
   - ทุกครั้งที่มอนสเตอร์ได้รับความเสียหาย ต้องเขียนวงเล็บระบุการลดลงของเลือดจากค่าเดิมเหลือค่าใหม่ในเนื้อเรื่องเสมอ เช่น "(HP: 100% -> 80%)" และหากโดนรุมตีหลายครั้งในเทิร์นเดียว ให้คิดลดต่อเนื่องกันไปทีละคน เช่น คนแรกตี "(HP: 100% -> 80%)" คนที่สองตีซ้ำ "(HP: 80% -> 55%)"
   - ต้องดึงค่า HP% ล่าสุดของมอนสเตอร์จากหมวด [ Overview ] ของเทิร์นก่อนหน้ามาคำนวณต่อเสมอ ห้ามรีเซ็ตกลับเป็น 100%
   - มอนสเตอร์ที่ยังไม่ตาย (HP > 0%) ต้องมีการโจมตีสวนกลับ ใช้สกิล หรือคุกคามปาร์ตี้คืนในท้ายเทิร์นเสมอ!

5. กฎความเด็ดขาด (High Stakes & Lethality):
   - ห้ามมี Plot Armor ปกป้องผู้เล่น หากทอยเต๋าล้มเหลวในจังหวะอันตราย หรือประมาท ให้บรรยายบาดแผล ความเสียหายต่อ HP หรือสถานะผิดปกติที่ผู้เล่นได้รับอย่างสมจริง

6. กฎการใช้ข้อมูลตัวละคร (Strict Anti-Repetition Rule):
   - ข้อมูลใน [PARTY REFERENCE SHEET] เป็นเพียงข้อมูลอ้างอิงเบื้องหลังสำหรับใช้คำนวณความได้เปรียบ/เสียเปรียบเมื่อเกิดสถานการณ์ที่เกี่ยวข้องโดยตรงเท่านั้น
   - ห้ามหยิบยก จุดเด่น, จุดอ่อน, มุกเดิมๆ หรือปูมหลัง มากล่าวซ้ำซากในทุกๆ เทิร์นเด็ดขาด (เช่น ห้ามพูดซ้ำเรื่องกลัวเมีย, กลิ่นเหล้า, ซุ่มซ่ามทำของตก, หรือกลัวความสูง หากเหตุการณ์หรือแอ็กชันในเทิร์นนั้นไม่ได้กระตุ้นเรื่องดังกล่าวโดยตรง)
   - มุ่งเน้นการบรรยายที่ "แอ็กชันปัจจุบัน" และ "สิ่งที่อยู่ตรงหน้า" ของตัวละครเป็นหลัก เพื่อให้เรื่องราวดำเนินไปข้างหน้าอย่างเป็นธรรมชาติ
  
[REQUIRED OUTPUT FORMAT]
(เนื้อหาบรรยายเรื่องราว ผลลัพธ์การกระทำของทุกคน ฉากการปะทะพร้อมวงเล็บ (HP: X% -> Y%) เมื่อศัตรูได้รับดาเมจ และการสวนกลับของศัตรู)

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่ สภาพแวดล้อมโดยย่อ และเวลาปัจจุบัน เช่น 14:30 น.)
สถานการณ์ปัจจุบัน : (สรุปสิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยย่อ)
สถานะศัตรู : (ระบุชื่อศัตรูทุกตัวในฉากพร้อม HP% คงเหลือล่าสุด เช่น "หมาป่าทมิฬ A: 55%, หมาป่าทมิฬ B: 100%" / หากศัตรูตายให้ระบุว่า "0% (ตายแล้ว)" / หากไม่มีศัตรูในฉากให้เขียนว่า "ไม่มี")

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
    `\n[SYSTEM REMINDER: AUTHOR'S NOTE]
- กล่าวถึงผลลัพธ์ของสมาชิกทุกคนตามรายชื่อด้านบน
- หากมีการต่อสู้: ห้ามให้มอนสเตอร์ตายในทีเดียว! คำนวณดาเมจให้สมเหตุสมผลกับอาวุธ/สกิล/ผลเต๋า และต้องแสดงหลอดเลือดเป็นเปอร์เซ็นต์ เช่น (HP: 100% -> 80%) โดยคิดต่อเนื่องจากค่า HP% ใน [ Overview ] ของเทิร์นก่อนหน้า
- สรุปท้ายข้อความตามรูปแบบ [ Overview ] (ที่มีบรรทัด "สถานะศัตรู :") และ [ Decision ] เท่านั้น`,
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