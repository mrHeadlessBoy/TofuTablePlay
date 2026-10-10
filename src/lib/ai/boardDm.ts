import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, type LoreEntry } from './lorebook'
import { ABILITY_KEYS, type AbilityKey, type DmTokenInput, type DmTurnInput, type DmTurnResult, type SceneSummary } from '@/lib/board/types'

const ai = new GoogleGenAI()

export type BoardCampaign = {
  title: string
  category: string
  world_setting: string
  core_description: string
  rule_mechanics: string
}

const NO_ACTION_TEXT = '(ไม่ได้ส่งแอ็กชันในเทิร์นนี้ — ตัวละครยังอยู่ในฉาก แต่ห้ามตัดสินใจแทนผู้เล่น)'
const FEET_PER_TILE = 5

const THEME_DESCRIPTION: Record<DmTurnInput['mapTheme'], string> = {
  forest: 'ถนนดินกลางป่าฤดูใบไม้ร่วง มีลำธาร สะพานไม้ และซากปรักหักพังเล็ก ๆ',
  ruins: 'ย่านเมืองร้าง ถนนลาดยาง ซากรถ และตึกที่พังเหลือแต่ผนัง',
  dungeon: 'โถงดันเจี้ยนใต้ดิน พื้นหิน เสา กำแพง และเหวที่มีสะพานข้าม',
}

function describeToken(token: DmTokenInput, all: DmTokenInput[]): string {
  const tag = token.kind === 'hero' ? 'HERO' : token.kind === 'enemy' ? 'ENEMY' : 'NPC'
  let line = `- [${tag}] ${token.name} (${token.classType}) ที่ช่อง (${token.x},${token.y}) HP ${token.hp}/${token.maxHp} AC ${token.ac} สถานะ ${token.condition || 'Normal'}`

  // The model is bad at grid arithmetic, so hand it the distance to the nearest opponent.
  const opponents = all.filter((other) => (token.kind === 'enemy' ? other.kind === 'hero' : other.kind === 'enemy'))
  let nearest: { name: string; feet: number } | null = null
  for (const other of opponents) {
    const feet = Math.max(Math.abs(other.x - token.x), Math.abs(other.y - token.y)) * FEET_PER_TILE
    if (!nearest || feet < nearest.feet) nearest = { name: other.name, feet }
  }
  if (nearest) line += ` · ${token.kind === 'enemy' ? 'ฮีโร่' : 'ศัตรู'}ที่ใกล้สุด: ${nearest.name} ห่าง ${nearest.feet} ฟุต`
  return line
}

export function buildBoardPrompt(input: DmTurnInput, campaign: BoardCampaign | null, loreEntries: LoreEntry[]): string {
  // One numbered line per hero, however many are on the board, so nobody is dropped from the prompt.
  const actionsSummary = input.actions
    .map((entry, index) => `${index + 1}. ${entry.character} (${entry.classType}): ${entry.action || NO_ACTION_TEXT}`)
    .join('\n')

  const submittedText = input.actions
    .filter((entry) => entry.action)
    .map((entry) => `${entry.character}: ${entry.action}`)
    .join('\n')
  const historyText = input.history.map((entry) => `Turn ${entry.turn}:\n${entry.text}`).join('\n\n')

  const triggeredLore = extractTriggeredLore(loreEntries, `${historyText}\n${submittedText}`, true)
  const loreContext = triggeredLore.map((lore) => `[LORE: ${lore.title} (${lore.category})] - ${lore.content}`).join('\n')

  const campaignBlock = campaign
    ? `แคมเปญ: "${campaign.title}" (${campaign.category})

WORLD SETTING & TONE (ฉากหลังของโลกและโทนเรื่อง):
${campaign.world_setting}

OVERARCHING STORY (เนื้อเรื่องหลัก):
${campaign.core_description}

ACTIVE MECHANICS / RULES (กลไกและกฎที่ใช้งาน):
${campaign.rule_mechanics || 'Standard tabletop rules apply.'}

DYNAMIC LORE INJECTION (ข้อมูล Lore เพิ่มเติม):
${loreContext || 'No specific lore triggered this turn.'}`
    : `แคมเปญ: การผจญภัยอิสระ ไม่ได้ผูกกับแคมเปญใด ให้แต่งโลกและโทนเรื่องให้เข้ากับแผนที่และแอ็กชันของผู้เล่น ใช้กฎ tabletop มาตรฐาน`

  const sceneBlock = input.scene
    ? `- สถานที่: ${input.scene.location}\n- ภัยคุกคาม: ${input.scene.threat}\n- เป้าหมาย: ${input.scene.goal}`
    : 'ยังไม่มีสรุปฉาก นี่คือช่วงเปิดเรื่อง'

  return `
คุณคือ Dungeon Master AI ผู้มีอำนาจตัดสินใจและสร้างบรรยากาศที่สมจริง สำหรับเกม tabletop RPG ที่เล่นบนกระดานตาราง

${campaignBlock}

BOARD (กระดาน):
แผนที่ "${input.mapName}" — ${THEME_DESCRIPTION[input.mapTheme]}
ขนาด ${input.cols}x${input.rows} ช่อง 1 ช่อง = ${FEET_PER_TILE} ฟุต พิกัด (x,y) เริ่มนับจากมุมซ้ายบน

TOKENS ON THE BOARD (ตัวละครบนกระดาน):
${input.tokens.map((token) => describeToken(token, input.tokens)).join('\n') || '(กระดานว่าง)'}

SCENE SO FAR (สรุปฉากล่าสุด):
${sceneBlock}

PREVIOUS TURN HISTORY (ประวัติเทิร์นก่อนหน้า - ล่าสุด):
${historyText || 'This is the start of the adventure.'}

DICE RESULTS SINCE THE LAST NARRATION (ผลทอยเต๋าหลังการเล่าครั้งก่อน):
${input.rolls.map((roll) => `- ${roll}`).join('\n') || '(ไม่มี)'}

SUBMITTED PARTY ACTIONS FOR TURN ${input.turn} (การกระทำของปาร์ตี้ — สมาชิก ${input.actions.length} คน):
${actionsSummary || 'The party surveys their surroundings.'}

DIRECTIVES:
1. ร้อยเรียงการกระทำของผู้เล่นเข้ากับเหตุการณ์ก่อนหน้าอย่างต่อเนื่อง ห้ามรีเซ็ตหรือลืมเหตุการณ์ที่เพิ่งเกิดขึ้น
2. เคารพตำแหน่งและระยะบนกระดาน และเคารพผลทอยเต๋า: ผลที่ SUCCESS ต้องสำเร็จ ผลที่ FAIL ต้องล้มเหลว
3. ต้องกล่าวถึงผลลัพธ์ของตัวละครทุกคนในรายการให้ครบ ห้ามข้ามหรือรวบตัวละครใด และห้ามตัดสินใจแทนคนที่ไม่ได้ส่งแอ็กชัน
4. ขอทอยเต๋าเฉพาะเมื่อผลยังไม่แน่นอน ใช้ ability check แบบ D&D 5e (d20 + modifier เทียบ DC 5-25) ไม่เกินหนึ่งรายการต่อตัวละคร
5. ถ้ามีสิ่งมีชีวิตใหม่โผล่มาในเรื่อง ให้ใส่ใน spawns ถ้ามีใครเสียหรือได้ HP ให้ใส่ใน hpChanges (ค่าลบคือเสียเลือด) ถ้าศัตรูหรือ NPC ตายหรือออกจากฉาก ให้ใส่ชื่อใน defeated
6. narration เขียนเป็นภาษาไทย 2-4 ย่อหน้า ย่อหน้าละ 1-3 ประโยค เพราะจะแสดงทีละย่อหน้าในกล่องข้อความ
7. ใช้ชื่อตัวละครให้ตรงกับรายการข้างบนทุกตัวอักษร

ตอบเป็น JSON อย่างเดียว ห้ามมีข้อความอื่นนอก JSON ตามรูปแบบนี้:
{
  "narration": ["ย่อหน้าที่ 1", "ย่อหน้าที่ 2"],
  "scene": { "location": "ที่อยู่ปัจจุบันของปาร์ตี้", "threat": "กำลังเผชิญกับอะไร 1-2 ประโยค", "goal": "ปาร์ตี้ต้องทำอะไรต่อ" },
  "rolls": [{ "character": "ชื่อฮีโร่", "ability": "STR | DEX | CON | INT | WIS | CHA", "dc": 12, "reason": "ทอยเพื่ออะไร" }],
  "hpChanges": [{ "target": "ชื่อตัวละคร", "delta": -4 }],
  "spawns": [{ "name": "ชื่อ", "kind": "enemy | npc", "near": "ชื่อตัวละครที่อยู่ใกล้ หรือ null", "hp": 10, "ac": 10 }],
  "defeated": ["ชื่อ"]
}
`
}

// ---------- reading the answer ----------

function asText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback
}

/** Pull the JSON object out of the reply even when the model wraps it in a code fence or adds a sentence. */
function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Turn whatever the model returned into a safe, fully typed result. Never throws. */
export function parseBoardReply(text: string): DmTurnResult {
  const data = asRecord(extractJson(text))

  let narration = asList(data.narration).map((entry) => asText(entry, 900)).filter(Boolean)
  if (narration.length === 0) {
    // No usable JSON: treat the whole reply as the story, one paragraph per blank line.
    const fallback = asText(data.narration, 4000) || (Object.keys(data).length === 0 ? text.trim().slice(0, 4000) : '')
    narration = fallback.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  }
  if (narration.length === 0) narration = ['Dungeon Master เงียบไปครู่หนึ่ง ฝุ่นค่อย ๆ จางลงรอบตัวปาร์ตี้']

  const sceneData = asRecord(data.scene)
  const scene: SceneSummary | null =
    sceneData.location || sceneData.threat || sceneData.goal
      ? { location: asText(sceneData.location, 200), threat: asText(sceneData.threat, 300), goal: asText(sceneData.goal, 300) }
      : null

  const rolls = asList(data.rolls)
    .map(asRecord)
    .map((roll) => ({
      character: asText(roll.character, 60),
      ability: asText(roll.ability, 3).toUpperCase() as AbilityKey,
      dc: clampInt(roll.dc, 5, 30, 12),
      reason: asText(roll.reason, 200),
    }))
    .filter((roll) => roll.character && ABILITY_KEYS.includes(roll.ability))
    .slice(0, 12)

  const hpChanges = asList(data.hpChanges)
    .map(asRecord)
    .map((change) => ({ target: asText(change.target, 60), delta: clampInt(change.delta, -200, 200, 0) }))
    .filter((change) => change.target && change.delta !== 0)
    .slice(0, 24)

  const spawns = asList(data.spawns)
    .map(asRecord)
    .map((spawn) => ({
      name: asText(spawn.name, 24),
      kind: spawn.kind === 'npc' ? ('npc' as const) : ('enemy' as const),
      near: asText(spawn.near, 60) || null,
      hp: clampInt(spawn.hp, 1, 300, 10),
      ac: clampInt(spawn.ac, 1, 30, 10),
    }))
    .filter((spawn) => spawn.name)
    .slice(0, 6)

  const defeated = asList(data.defeated).map((entry) => asText(entry, 60)).filter(Boolean).slice(0, 24)

  return { narration: narration.slice(0, 8), scene, rolls, hpChanges, spawns, defeated }
}

export async function generateBoardNarrative(
  input: DmTurnInput,
  campaign: BoardCampaign | null,
  loreEntries: LoreEntry[]
): Promise<DmTurnResult> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: buildBoardPrompt(input, campaign, loreEntries),
    config: { responseMimeType: 'application/json' },
  })
  return parseBoardReply(response.text || '')
}
