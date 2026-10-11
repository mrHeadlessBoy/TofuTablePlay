import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'
import { OPENING_TURN_NUMBER } from '@/lib/turns'

const ai = new GoogleGenAI()

// One model for every Dungeon Master call (turn narration and the opening scene)
const DM_MODEL = 'gemini-3.5-flash-lite'
// The opening scene is written while the host waits on the Launch button, so give up after this long
const OPENING_TIMEOUT_MS = 15000

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
    party_actions_summary?: string // รองรับการส่งแอ็กชันเทิร์นก่อนหน้า (ถ้ามี)
  }[]
  // One entry per party member (any party size). action is null when that player sent no draft.
  partyActions: { characterName: string; classType: string; action: string | null }[]
}

const NO_ACTION_TEXT =
  '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจแทนผู้เล่น)'

export async function generateDmNarrative(input: DmTurnInput): Promise<string> {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // 1. จัดการสรุปการกระทำของผู้เล่นในเทิร์นปัจจุบัน
  const actionsSummary = partyActions
    .map((a, i) => `${i + 1}. ${a.characterName} (${a.classType}): ${a.action || NO_ACTION_TEXT}`)
    .join('\n')

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
  const loreContext = triggeredLore.length > 0
    ? triggeredLore.map((l) => `[LORE: ${l.title} (${l.category})]: ${l.content}`).join('\n')
    : null

  // 3. STATIC SYSTEM INSTRUCTION (คงที่ 100% ตลอดทั้งแคมเปญ เพื่อให้เกิด Prompt Caching)
  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${campaign.rule_mechanics || 'Standard tabletop rules apply.'}

[CORE DIRECTIVES & RESOLUTION RULES]
1. ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
2. บรรยายผลลัพธ์ อุปสรรค และบรรยากาศ (กระชับแต่น่าติดตาม)
3. กฎความเด็ดขาดและความตาย (High Stakes & Lethality):
   - ห้ามมี Plot Armor หรือปกป้องผู้เล่น: หากการกระทำนั้นมีความเสี่ยงสูง บ้าระห่ำ หรือผลลัพธ์ตามตรรกะนำไปสู่ความตาย ให้บรรยายความร้ายแรงตามความเป็นจริงได้ทันที (บาดเจ็บสาหัส สูญเสียอวัยวะ หรือตัวละครตายถาวร)
   - ผลลัพธ์ความล้มเหลว AI เป็นผู้กำหนดแต่เพียงผู้เดียว: ผู้เล่นจะรู้ผลลัพธ์ก็ต่อเมื่อทอยเสร็จและ AI บรรยายในเทิร์นถัดไปเท่านั้น
4. กฎการตัดสินผลแอ็กชันของผู้เล่น (Action & Roll Resolution):
   - [กรณีไม่ส่งคำตอบ/ไม่ส่งแอ็กชัน]: ให้บรรยายว่าตัวละครนั้น "ยืนนิ่ง ชะงัก หรือลังเลอยู่กับที่" โดยห้ามตัดสินใจเคลื่อนไหวแทนผู้เล่น
   - [กรณีมีเป้าหมายแต่ไม่ระบุแต้มเต๋า]: หากแอ็กชันนั้นต้องอาศัยการทอยสุ่ม แต่ผู้เล่นไม่ระบุแต้มเต๋าที่ทอยได้มา ให้ตัดสินว่า "ล้มเหลวโดยอัตโนมัติ (Automatic Failure)" ทันที และบรรยายผลลัพธ์เชิงลบตามสถานการณ์
5. ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในปาร์ตี้ให้ครบตามเงื่อนไขข้างต้น

[REQUIRED OUTPUT FORMAT]
(เนื้อหาบรรยายเรื่องราวการกระทำและผลลัพธ์ของเทิร์นนี้)

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่และสภาพแวดล้อมโดยย่อและบอกเวลาอย่างชัดเจนว่ากี่นาฬิกา)
สถานการณ์ปัจจุบัน: (สิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยสรุปมห้เข้าใจ)

[ Decision ]
*(เงื่อนไขสำคัญ: แสดงหมวดนี้เฉพาะเมื่อมีตัวละครต้องทอยเต๋าในเทิร์นถัดไปเท่านั้น! หากไม่มี ให้ข้ามและ "ห้ามพิมพ์หัวข้อ [ Decision ] ออกมาเด็ดขาด")*
(หากมีการทอย ให้ระบุเฉพาะตัวละครที่ต้องทอย 1 บรรทัดต่อ 1 คน):
- [ชื่อตัวละคร]: สิ่งที่ทำ: (สิ่งที่ผู้เล่นทำ) | [ประเภทเต๋าที่เหมาะสม เช่น d20/d12/d8/d6 + สเตตัส]`

  // 4. CONSTRUCT MULTI-TURN CONTENTS (Sliding Window 4 เทิร์นล่าสุด)
  // แยกบทบาท user/model ชัดเจนเพื่อให้ AI จำสไตล์การบรรยายของตัวเองได้
  const turnsWindow = recentTurns.slice(-4)
  const contents: { role: 'user' | 'model'; parts: [{ text: string }] }[] = []

  for (const turn of turnsWindow) {
    // Same numbers the players see: the opening narration is not a turn
    const playedTurn = turn.turn_number - OPENING_TURN_NUMBER
    const userPrompt = turn.turn_number === OPENING_TURN_NUMBER
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
  // รวม Dynamic Lore + Actions + ตอกย้ำ Format ที่จุดสุดท้ายเพื่อป้องกัน Format หลุด
  const currentTurnUserParts = [
    loreContext ? `[DYNAMIC LORE INJECTION FOR THIS TURN]\n${loreContext}\n` : '',
    `[CURRENT TURN: SUBMITTED PARTY ACTIONS (${partyActions.length} Members)]\n${actionsSummary || 'The party surveys their surroundings.'}`,
    `\n[SYSTEM REMINDER: AUTHOR'S NOTE]
- จงบรรยายผลลัพธ์ของสมาชิกทุกคนที่มีชื่อด้านบนให้ครบถ้วน
- สรุปผลท้ายข้อความตามรูปแบบ [NARRATIVE], [Overview], และ [Decision] เท่านั้น`,
  ]
    .filter(Boolean)
    .join('\n')

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnUserParts }],
  })

  // 6. ส่งคำขอไปยัง API พร้อม System Instruction แยกต่างหาก
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
 * It introduces the world and is not a played turn: Turn 1 is the first one the party resolves.
 * Throws when the AI gives no answer, so the caller can fall back to a plain line.
 */
export async function generateOpeningNarrative(input: {
  campaign: DmTurnInput['campaign']
  loreEntries: LoreEntry[]
}): Promise<string> {
  const { campaign, loreEntries } = input

  // Nobody has written anything yet, so the lore scan runs on the campaign sheet itself:
  // "Always Active" entries plus any entry whose keyword already appears in the setting or story
  const scanTargetText = `${campaign.world_setting}\n${campaign.core_description}`
  const openingLore = extractTriggeredLore(loreEntries, scanTargetText, true)
  const loreContext = openingLore.length > 0
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
สถานการณ์ปัจจุบัน: (สิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยสรุปให้เข้าใจ)`

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
