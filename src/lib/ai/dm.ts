import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, LoreEntry } from './lorebook'

const ai = new GoogleGenAI()

interface DmTurnInput {
  campaign: {
    title: string
    category: string
    world_setting: string
    core_description: string
    rule_mechanics: string
  }
  loreEntries: LoreEntry[]
  recentTurns: { turn_number: number; narrative_output: string }[]
  partyActions: { characterName: string; classType: string; action: string }[]
}

export async function generateDmNarrative(input: DmTurnInput) {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // Consolidate recent context for the lore scanner
  const actionsSummary = partyActions.map((a) => `${a.characterName}: ${a.action}`).join('\n')
  const recentHistory = recentTurns.map((t) => t.narrative_output).slice(-2).join('\n')
  const scanTargetText = `${recentHistory}\n${actionsSummary}`

  // Pull relevant lore entries dynamically
  const triggeredLore = extractTriggeredLore(loreEntries, scanTargetText, true)

  const loreContext = triggeredLore
    .map((l) => `[LORE: ${l.title} (${l.category})] - ${l.content}`)
    .join('\n')

  const prompt = `
คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับแคมเปญเกม tabletop RPG เรื่อง "${campaign.title}" (${campaign.category}).

WORLD SETTING & TONE (ฉากหลังของโลกและโทนเรื่อง):
${campaign.world_setting}

OVERARCHING STORY (เนื้อเรื่องหลัก):
${campaign.core_description}

ACTIVE MECHANICS / RULES (กลไกและกฎที่ใช้งาน):
${campaign.rule_mechanics || 'Standard tabletop rules apply.'}

DYNAMIC LORE INJECTION (ข้อมูล Lore เพิ่มเติม):
${loreContext || 'No specific lore triggered this turn.'}

PREVIOUS TURN HISTORY (ประวัติเทิร์นก่อนหน้า):
${recentTurns.length > 0 ? recentTurns.map(t => `Turn ${t.turn_number}:${t.narrative_output}`).join('\n\n') : 'This is the start of the adventure.'}

SUBMITTED PARTY ACTIONS FOR THIS TURN (การกระทำของปาร์ตี้ในเทิร์นนี้):
${actionsSummary || 'The party surveys their surroundings.'}

DIRECTIVES (คำสั่งการทำงาน):
1.ร้อยเรียงการกระทำของสมาชิกทุกคนในปาร์ตี้เข้าด้วยกันอย่างกลมกลืน ให้เป็นการดำเนินเรื่องในฉากเดียวกันที่เห็นภาพชัดเจน
2.ตัดสินผลลัพธ์ทั้งความสำเร็จ ความตึงเครียด อุปสรรค หรือผลสืบเนื่อง โดยอิงตามกฎของแคมเปญและ Lore ที่ระบุไว้
3.ควบคุมโทนของเรื่องให้ตรงตามแนว (genre) สรุปปิดท้ายการบรรยายด้วยการฉายภาพสถานการณ์ปัจจุบัน พร้อมกระตุ้นให้ปาร์ตี้เลือกการกระทำถัดไป
4.แสดงผลลัพธ์เฉพาะเนื้อหาบรรยายเรื่องราวเท่านั้น ความยาว 2-4 ย่อหน้าที่ชวนดื่มด่ำกับบรรยากาศ (ห้ามมีข้อความอื่นนอกเหนือจากนี้)
5.มีการทอยลูกเต๋าโดยให้กำหนดเพลเยอร์ที่จะต้องทอยลูกเต๋าในท้ายการตอบข้อความและบอก condition / require stat พร้อม mod จาก character sheet ของ ${actionsSummary}
`

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: prompt,
  })

  return response.text || 'The Dungeon Master pauses as the dust settles around the party.'
}