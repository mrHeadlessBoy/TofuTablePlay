import { GoogleGenAI } from '@google/genai'
import { extractTriggeredLore, type LoreEntry } from './lorebook'
import { extractCampaignTemplate } from '@/features/character/template'
import { computePartyDamageBenchmark, formatPartyMemberForPrompt } from './dmParty'
import {
  buildCurrentTurnMessage,
  buildDecisionDiceInstructions,
  buildOpeningSystemInstruction,
  buildPartyStatusFormatExample,
  buildRecentTurnContents,
  buildRuleModules,
  buildTurnSystemInstruction,
  formatLoreContext,
  getOverviewMiddleSection,
  getPromptModeFlags,
  getRequiredOutputDescription,
  summarizePartySheets,
} from './dmPrompt'
import type { DmTurnInput } from './dmTypes'

export type { DmTurnInput, PartyMemberAction, PartyMemberStateUpdate } from './dmTypes'
export { extractPartyStateUpdates } from './dmStateExtraction'

const ai = new GoogleGenAI()

// One model for every Dungeon Master call (turn narration and the opening scene)
const DM_MODEL = 'gemini-3.5-flash-lite'
const OPENING_TIMEOUT_MS = 15000

export async function generateDmNarrative(input: DmTurnInput): Promise<string> {
  const { campaign, loreEntries, recentTurns, partyActions, language = 'th' } = input
  const isEn = language === 'en'

  // เช็กว่าเป็นเทิร์นแรกที่ผู้เล่นเริ่มเล่นหรือไม่ (มีเฉพาะ Opening Turn อยู่ในประวัติ)
  const isFirstPlayerTurn = recentTurns.length <= 1

  // คำนวณตารางฐานดาเมจกลางของโต๊ะจากค่าเฉลี่ย Max HP ของปาร์ตี้ เพื่อให้คนที่มี HP เยอะกว่าถึกกว่าจริง
  const damageBenchmark = computePartyDamageBenchmark(partyActions)

  // 1. จัดรูปแบบข้อมูลตัวละคร + แอ็กชัน
  const actionsSummary = partyActions
    .map((member, idx) =>
      formatPartyMemberForPrompt(member, idx, isFirstPlayerTurn, damageBenchmark)
    )
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
  const loreContext = formatLoreContext(triggeredLore)

  // 3. BUILD DYNAMIC PARTY TEMPLATE METADATA FOR SYSTEM INSTRUCTION
  const sheetSummary = summarizePartySheets(partyActions)
  const modeFlags = getPromptModeFlags(sheetSummary.partyModes, damageBenchmark)
  const systemInstruction = buildTurnSystemInstruction({
    campaign,
    isEn,
    ruleModules: buildRuleModules({ damageBenchmark, ...modeFlags, ...sheetSummary }),
    requiredOutputDescription: getRequiredOutputDescription(modeFlags),
    overviewMiddleSection: getOverviewMiddleSection(modeFlags),
    dynamicPartyStatusFormatExample: buildPartyStatusFormatExample(partyActions),
    dynamicStatsSummary: sheetSummary.dynamicStatsSummary,
    decisionDiceInstructions: buildDecisionDiceInstructions(sheetSummary.partyDice),
  })

  // 4. CONSTRUCT MULTI-TURN CONTENTS (Sliding Window 4 เทิร์นล่าสุด)
  const contents = buildRecentTurnContents(recentTurns)

  // 5. CURRENT TURN PAYLOAD + AUTHOR'S NOTE REMINDER
  const currentTurnUserParts = buildCurrentTurnMessage({
    loreContext,
    partyActions,
    damageBenchmark,
    actionsSummary,
    dynamicStatsSummary: sheetSummary.dynamicStatsSummary,
    dynamicResourcesSummary: sheetSummary.dynamicResourcesSummary,
    dynamicConditionsSummary: sheetSummary.dynamicConditionsSummary,
  })

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
  language?: 'th' | 'en'
}): Promise<string> {
  const { campaign, loreEntries, language = 'th' } = input
  const isEn = language === 'en'

  const scanTargetText = `${campaign.world_setting}\n${campaign.core_description}`
  const openingLore = extractTriggeredLore(loreEntries, scanTargetText, true)
  const loreContext = formatLoreContext(openingLore)

  const campaignTpl = extractCampaignTemplate(campaign)
  const isCombatCampaign =
    campaignTpl.mechanics.mode === 'combat' && campaignTpl.mechanics.vitalityResourceId !== null

  const systemInstruction = buildOpeningSystemInstruction(campaign, isEn, isCombatCampaign)

  const openingRequest = [
    loreContext ? `[LORE FOR THE OPENING SCENE]\n${loreContext}\n` : '',
    isEn ? '[OPENING]: The table has just opened and the party is assembled. Narrate the opening scene.' : '[OPENING]: โต๊ะเพิ่งเปิด ปาร์ตี้มารวมตัวกันแล้ว จงบรรยายฉากเปิดของการผจญภัย',
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
