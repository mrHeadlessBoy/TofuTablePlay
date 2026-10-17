import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'
import { OPENING_TURN_NUMBER } from '@/lib/turns'

const ai = new GoogleGenAI()

// One model for every Dungeon Master call (turn narration and the opening scene)
const DM_MODEL = 'gemini-3.5-flash-lite' // or 'gemini-2.5-flash-lite'
// The opening scene is written while the host waits on the Launch button, so give up after this long
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
  skills?: { name: string; cost?: number; description: string }[]
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
  '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจแทนผู้เล่น)'

export async function generateDmNarrative(input: DmTurnInput): Promise<string> {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // 1. แยก Profile ข้อมูลคงที่ (Strengths, Weaknesses, Backstory, Skill) ออกมาเก็บเป็น Reference Sheet
  // ส่งเข้าไปใน System Instruction เพื่อให้ AI รู้ภูมิหลังโดยไม่มองว่าเป็นสิ่งที่เกิดขึ้นในเทิร์นนี้
  const partyProfiles = partyActions
    .map((a) => {
      const skillsText = (a.skills || [])
        .filter((s) => s.name?.trim() || s.description?.trim())
        .map((s) => {
          const name = s.name?.trim() || 'Unnamed Skill'
          const cost = Number.isFinite(Number(s.cost)) ? Number(s.cost) : 0
          const desc = s.description?.trim()
          return desc
            ? `${name} (Skill Cost: ${cost}, Description: ${desc})`
            : `${name} (Skill Cost: ${cost})`
        })
        .join(', ')

      const traits = [
        a.strengths?.trim() && `จุดเด่น: ${a.strengths.trim()}`,
        a.weaknesses?.trim() && `จุดอ่อน: ${a.weaknesses.trim()}`,
        a.backstory?.trim() && `ปูมหลัง: ${a.backstory.trim()}`,
        skillsText && `สกิล (Skill): ${skillsText}`,
      ]
        .filter(Boolean)
        .join(' | ')

      return `- ${a.characterName} (${a.classType}): ${traits || 'ไม่มีข้อมูลเพิ่มเติม'}`
    })
    .join('\n')

  // 2. จัดรูปแบบ Turn Payload สรุปเฉพาะสถานะทางกายภาพ อุปกรณ์ และ "แอ็กชันในเทิร์นนี้" เท่านั้น
  const actionsSummary = partyActions
    .map((a, i) => {
      const hpText = `HP ${a.currentHp ?? '?'}/${a.maxHp ?? '?'}`
      const skillCostText = `Skill Cost ${a.currentSkillCost ?? '?'}/${a.maxSkillCost ?? '?'}`
      const equipList = (a.equipment || []).filter(Boolean).join(', ')
      const invPreview = a.inventory ? a.inventory.replace(/\n+/g, ', ').slice(0, 120) : ''
      const gear = [equipList && `สวมใส่: ${equipList}`, invPreview && `ไอเทม: ${invPreview}`]
        .filter(Boolean)
        .join(' | ')

      const detailLines: string[] = []
      detailLines.push(`   - [สภาพร่างกาย]: ${hpText} | ${skillCostText}`)
      if (gear) {
        detailLines.push(`   - [อุปกรณ์/ไอเทม]: ${gear}`)
      }
      detailLines.push(`   - [แอ็กชันในเทิร์นนี้]: ${a.action || NO_ACTION_TEXT}`)

      return `${i + 1}. ${a.characterName} (${a.classType})\n${detailLines.join('\n')}`
    })
    .join('\n\n')

  // 3. สแกน Lorebook โดยตัด characterBioText ออก เพื่อป้องกัน Lore ติดลูปทุกเทิร์น
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

  // STATIC SYSTEM INSTRUCTION
  const systemInstruction = `คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

[WORLD SETTING & TONE]
${campaign.world_setting}

[OVERARCHING STORY]
${campaign.core_description}

[ACTIVE MECHANICS / RULES]
${campaign.rule_mechanics || 'Standard tabletop rules apply.'}

[PARTY REFERENCE SHEET (PASSIVE LORE ONLY)]
${partyProfiles}

[CORE DIRECTIVES & RESOLUTION RULES]
1. ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่องและเป็นธรรมชาติ ห้ามรีเซ็ตหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
2. บรรยายผลลัพธ์ อุปสรรค และบรรยากาศ (กระชับ น่าติดตาม ดำเนินเรื่องแบบ cinematic และร้อยเรียงฉากเข้าด้วยกัน)
3. กฎความเด็ดขาดและความตาย (High Stakes & Lethality):
   - ห้ามมี Plot Armor หรือปกป้องผู้เล่น: หากการกระทำนั้นมีความเสี่ยงสูง บ้าระห่ำ หรือผลลัพธ์ตามตรรกะนำไปสู่ความตาย ให้บรรยายความร้ายแรงตามความเป็นจริงได้ทันที (บาดเจ็บสาหัส สูญเสียอวัยวะ หรือตัวละครตายถาวร)
   - ผลลัพธ์ความล้มเหลว AI เป็นผู้กำหนดแต่เพียงผู้เดียว: ผู้เล่นจะรู้ผลลัพธ์ก็ต่อเมื่อทอยเสร็จและ AI บรรยายในเทิร์นถัดไปเท่านั้น
4. กฎการตัดสินผลแอ็กชันของผู้เล่น (Action & Roll Resolution):
   - [กรณีไม่ส่งคำตอบ/ไม่ส่งแอ็กชัน]: ให้บรรยายว่าตัวละครนั้น "ยืนนิ่ง ชะงัก หรือลังเลอยู่กับที่" โดยห้ามตัดสินใจเคลื่อนไหวแทนผู้เล่น
   - [กรณีมีเป้าหมายแต่ไม่ระบุแต้มเต๋า]: หากแอ็กชันนั้นต้องอาศัยการทอยสุ่ม แต่ผู้เล่นไม่ระบุแต้มเต๋าที่ทอยได้มา ให้ตัดสินว่า "ล้มเหลวโดยอัตโนมัติ (Automatic Failure)" ทันที และบรรยายผลลัพธ์เชิงลบตามสถานการณ์
5. ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในปาร์ตี้ให้ครบตามเงื่อนไขข้างต้น
6. กฎการใช้ข้อมูลตัวละคร (Strict Anti-Repetition Rule):
   - ข้อมูลใน [PARTY REFERENCE SHEET] เป็นเพียงข้อมูลอ้างอิงเบื้องหลังสำหรับใช้คำนวณความได้เปรียบ/เสียเปรียบเมื่อเกิดสถานการณ์ที่เกี่ยวข้องโดยตรงเท่านั้น
   - ห้ามหยิบยก จุดเด่น, จุดอ่อน, มุกเดิมๆ หรือปูมหลัง มากล่าวซ้ำซากในทุกๆ เทิร์นเด็ดขาด (เช่น ห้ามพูดซ้ำเรื่องกลัวเมีย, กลิ่นเหล้า, ซุ่มซ่ามทำของตก, หรือกลัวความสูง หากเหตุการณ์หรือแอ็กชันในเทิร์นนั้นไม่ได้กระตุ้นเรื่องดังกล่าวโดยตรง)
   - มุ่งเน้นการบรรยายที่ "แอ็กชันปัจจุบัน" และ "สิ่งที่อยู่ตรงหน้า" ของตัวละครเป็นหลัก เพื่อให้เรื่องราวดำเนินไปข้างหน้าอย่างเป็นธรรมชาติ

[REQUIRED OUTPUT FORMAT]
(เนื้อหาบรรยายเรื่องราวการกระทำและผลลัพธ์ของเทิร์นนี้ โดยไม่ต้องใส่หัวข้อนำหน้า)

[ Overview ]
สถานที่และเวลา : (ชื่อสถานที่และสภาพแวดล้อมโดยย่อ และระบุเวลา เช่น 00:30 น.)
สถานการณ์ปัจจุบัน: (สิ่งที่ปาร์ตี้กำลังเผชิญหน้าโดยสรุปให้ชัดเจน)

[สภาพร่างกาย]
(ระบุเฉพาะ HP และ Skill Cost ของตัวละครทุกคน เช่น - Oracle: HP 100/100 | Skill Cost 10/10)

[ Decision ]
*(เงื่อนไขสำคัญ: แสดงหมวดนี้เฉพาะเมื่อมีตัวละครต้องทอยเต๋าในเทิร์นถัดไปเท่านั้น! หากไม่มี ให้ข้ามและ "ห้ามพิมพ์หัวข้อ [ Decision ] ออกมาเด็ดขาด")*
(หากมีการทอย ให้ระบุเฉพาะตัวละครที่ต้องทอย 1 บรรทัดต่อ 1 คน):
- [ชื่อตัวละคร]: สิ่งที่ทำ(ห้ามบอกว่าผู้เล่นควรทำอะไร): | [ประเภทเต๋าที่เหมาะสม เช่น d20/d12/d8/d6 + สเตตัส]`

  // CONSTRUCT MULTI-TURN CONTENTS (Sliding Window 4 เทิร์นล่าสุด)
  const turnsWindow = recentTurns.slice(-4)
  const contents: { role: 'user' | 'model'; parts: [{ text: string }] }[] = []

  for (const turn of turnsWindow) {
    const playedTurn = turn.turn_number - OPENING_TURN_NUMBER
    const userPrompt = turn.turn_number === OPENING_TURN_NUMBER
      ? '[OPENING]: The table has just opened and nobody has acted yet. Narrate the opening scene.'
      : turn.party_actions_summary
        ? `[TURN ${playedTurn} PARTY ACTIONS]\n${turn.party_actions_summary}`
        : `[TURN ${playedTurn}]: The party executes their declared actions.`

    contents.push({ role: 'user', parts: [{ text: userPrompt }] })
    contents.push({ role: 'model', parts: [{ text: turn.narrative_output }] })
  }

  // CURRENT TURN PAYLOAD + AUTHOR'S NOTE REMINDER
  const currentTurnUserParts = [
    loreContext ? `[DYNAMIC LORE INJECTION FOR THIS TURN]\n${loreContext}\n` : '',
    `[CURRENT TURN: SUBMITTED PARTY ACTIONS (${partyActions.length} Members)]\n${actionsSummary || 'The party surveys their surroundings.'}`,
    `\n[SYSTEM REMINDER: AUTHOR'S NOTE]
- จงบรรยายผลลัพธ์ของสมาชิกทุกคนตาม [แอ็กชันในเทิร์นนี้] ให้ครบถ้วนและลื่นไหล
- ห้ามคัดลอกแพทเทิร์นหรือกล่าวซ้ำจุดเด่น/จุดอ่อน/ปูมหลังเดิมๆ จากเทิร์นก่อนหน้า ให้โฟกัสที่การตอบสนองต่อแอ็กชันและเหตุการณ์ปัจจุบัน
- แสดงผลสรุปท้ายข้อความตามรูปแบบ [ Overview ], [สภาพร่างกาย] และ [ Decision ] (ถ้ามี) เท่านั้น`,
  ]
    .filter(Boolean)
    .join('\n')

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnUserParts }],
  })

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

export async function generateOpeningNarrative(input: {
  campaign: DmTurnInput['campaign']
  loreEntries: LoreEntry[]
}): Promise<string> {
  const { campaign, loreEntries } = input

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