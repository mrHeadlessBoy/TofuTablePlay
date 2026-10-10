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
  const recentHistory = recentTurns.slice(-4).map(t => `Turn ${t.turn_number}:\n${t.narrative_output}`).join('\n\n')
  const scanTargetText = `${recentHistory}\n${actionsSummary}`

  // Pull relevant lore entries dynamically
  const triggeredLore = extractTriggeredLore(loreEntries, scanTargetText, true)
  const loreContext = triggeredLore
    .map((l) => `[LORE: ${l.title} (${l.category})] - ${l.content}`)
    .join('\n')

  // Limit previous turn history to a rolling window (last 5 turns) so the prompt doesn't grow unbounded
  const turnsWindow = recentTurns.slice(-5)
  const historyText = turnsWindow.length > 0
    ? `${recentTurns.length > 5 ? '[Earlier turns archived for brevity]\n\n' : ''}${turnsWindow.map((t) => `Turn ${t.turn_number}:\n${t.narrative_output}`).join('\n\n')}`
    : 'This is the start of the adventure.'

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

PREVIOUS TURN HISTORY (ประวัติเทิร์นก่อนหน้า - ล่าสุด):
${historyText}

SUBMITTED PARTY ACTIONS FOR THIS TURN (การกระทำของปาร์ตี้ในเทิร์นนี้):
${actionsSummary || 'The party surveys their surroundings.'}

DIRECTIVES:
1. ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
2. บรรยายผลลัพธ์ อุปสรรค และบรรยากาศ
3. ตอนท้ายต้องมีสรุปสถานะปัจจุบันและข้อกำหนดการทอยเต๋าตามรูปแบบด้านล่างอย่างเคร่งครัด

รูปแบบการตอบ (FORMAT):
[NARRATIVE]
(เนื้อหาบรรยายเรื่องราวการกระทำและผลลัพธ์ของเทิร์นนี้)

[CURRENT STATE & SUMMARY]
- พิกัด/สถานที่ปัจจุบัน: (ระบุที่อยู่ปัจจุบันของปาร์ตี้)
- ภัยคุกคาม/สถานการณ์ขณะนี้: (สรุป 1-2 ประโยคว่ากำลังเผชิญหน้ากับอะไร)
- เป้าหมายระยะสั้น: (ปาร์ตี้ต้องทำอะไรต่อไป)

[ACTION / DICE REQUIREMENT]
*ชื่อตัวละคร*: [ทอยเต๋า: d20 + Mod] เพื่อ... (Condition: ความสำเร็จ/ล้มเหลว)
`

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
  })

  return response.text || 'The Dungeon Master pauses as the dust settles around the party.'
}