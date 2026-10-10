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
  // One entry per party member (any party size). action is null when that player sent no draft.
  partyActions: { characterName: string; classType: string; action: string | null }[]
}

const NO_ACTION_TEXT =
  '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจแทนผู้เล่น)'

export async function generateDmNarrative(input: DmTurnInput) {
  const { campaign, loreEntries, recentTurns, partyActions } = input

  // One numbered line per party member, however many are seated, so nobody is dropped from the prompt
  const actionsSummary = partyActions
    .map((a, i) => `${i + 1}. ${a.characterName} (${a.classType}): ${a.action || NO_ACTION_TEXT}`)
    .join('\n')

  // Consolidate recent context for the lore scanner (only what players actually wrote)
  const submittedText = partyActions
    .filter((a) => a.action)
    .map((a) => `${a.characterName}: ${a.action}`)
    .join('\n')
  const recentHistory = recentTurns.slice(-4).map(t => `Turn ${t.turn_number}:\n${t.narrative_output}`).join('\n\n')
  const scanTargetText = `${recentHistory}\n${submittedText}`

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

SUBMITTED PARTY ACTIONS FOR THIS TURN (การกระทำของปาร์ตี้ในเทิร์นนี้ — สมาชิก ${partyActions.length} คน):
${actionsSummary || 'The party surveys their surroundings.'}

DIRECTIVES:
1. ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
2. บรรยายผลลัพธ์ อุปสรรค และบรรยากาศ
3. ตอนท้ายต้องมีสรุปสถานะปัจจุบันและข้อกำหนดการทอยเต๋าตามรูปแบบด้านล่างอย่างเคร่งครัด
4. ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในรายการข้างต้นให้ครบ ห้ามข้ามหรือรวบตัวละครใด และในส่วน [ACTION / DICE REQUIREMENT] ให้เขียนหนึ่งบรรทัดต่อตัวละครหนึ่งคนที่ส่งแอ็กชันมา

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