// Character sheet templates: which stats, resource bars, text fields, equipment slots and
// conditions a sheet shows. Pure functions only, so both server actions and client components can
// import this file.

import { ABILITY_SCORE_KEYS, CHARACTER_CONDITIONS, type AbilityScoreKey } from './domain'

export const TEMPLATE_SCHEMA_VERSION = 1

export const RESOURCE_COLORS = ['red', 'amber', 'cyan', 'emerald', 'violet', 'rose', 'sky', 'zinc'] as const
export type ResourceColor = (typeof RESOURCE_COLORS)[number]

export type TemplateStat = {
  id: string
  label: string
  min: number | null
  max: number | null
  default: number
}

export type TemplateResource = {
  id: string
  label: string
  defaultMax: number
  color: ResourceColor
}

export type TemplateTextField = {
  id: string
  label: string
  placeholder: string
  rows: number
}

export type TemplateEquipmentSlot = {
  id: string
  label: string
}

export type CharacterTemplate = {
  v: typeof TEMPLATE_SCHEMA_VERSION
  id: string
  name: string
  description: string
  author: string
  stats: TemplateStat[]
  resources: TemplateResource[]
  textFields: TemplateTextField[]
  equipmentSlots: TemplateEquipmentSlot[]
  conditions: string[]
  sections: { skills: boolean; inventory: boolean }
}

/** Values of template fields that have no database column of their own. */
export type SheetCustomValues = {
  stats: Record<string, number>
  resources: Record<string, { current: number; max: number }>
  fields: Record<string, string>
  equipment: Record<string, string>
}

export const EMPTY_CUSTOM_VALUES: SheetCustomValues = { stats: {}, resources: {}, fields: {}, equipment: {} }

// ---------------------------------------------------------------------------------------------
// Built-in ids that map to existing database columns
// ---------------------------------------------------------------------------------------------

export const COLUMN_RESOURCE_IDS = ['hp', 'skill_cost'] as const
export const COLUMN_TEXT_FIELD_IDS = ['appearance', 'backstory', 'strengths', 'weaknesses'] as const
/** Index into the `characters.equipment` array. */
export const COLUMN_EQUIPMENT_SLOT_INDEX: Record<string, number> = {
  head: 0,
  torso: 1,
  leg: 2,
  foot: 3,
  left_hand: 4,
  right_hand: 5,
}

export type ColumnTextFieldId = (typeof COLUMN_TEXT_FIELD_IDS)[number]

export function isColumnStatId(id: string): id is AbilityScoreKey {
  return (ABILITY_SCORE_KEYS as readonly string[]).includes(id)
}

export function isColumnTextFieldId(id: string): id is ColumnTextFieldId {
  return (COLUMN_TEXT_FIELD_IDS as readonly string[]).includes(id)
}

// ---------------------------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------------------------

export const CLASSIC_TEMPLATE_ID = 'builtin-classic'

export const CLASSIC_TEMPLATE: CharacterTemplate = {
  v: TEMPLATE_SCHEMA_VERSION,
  id: CLASSIC_TEMPLATE_ID,
  name: 'Classic Fantasy RPG',
  description: 'The standard sheet: HP, Skill Cost, the six ability scores, six equipment slots, skills and inventory.',
  author: 'D&D Playground',
  stats: ABILITY_SCORE_KEYS.map((key) => ({ id: key, label: key, min: null, max: null, default: 0 })),
  resources: [
    { id: 'hp', label: 'Hit Points (HP)', defaultMax: 100, color: 'red' },
    { id: 'skill_cost', label: 'Skill Cost', defaultMax: 10, color: 'cyan' },
  ],
  textFields: [
    { id: 'strengths', label: 'Strengths & Perks', placeholder: 'Sharp vision, high pain tolerance...', rows: 2 },
    { id: 'weaknesses', label: 'Weaknesses & Flaws', placeholder: 'Arrogant, fear of heights...', rows: 2 },
    { id: 'appearance', label: 'Appearance Description', placeholder: 'Physical build, clothing, notable scars or aura...', rows: 2 },
    { id: 'backstory', label: 'Backstory & Bio', placeholder: 'Origins, motivations, past events...', rows: 3 },
  ],
  equipmentSlots: [
    { id: 'head', label: 'Head' },
    { id: 'torso', label: 'Torso' },
    { id: 'leg', label: 'Leg' },
    { id: 'foot', label: 'Foot' },
    { id: 'left_hand', label: 'Left Hand' },
    { id: 'right_hand', label: 'Right Hand' },
  ],
  conditions: [...CHARACTER_CONDITIONS],
  sections: { skills: true, inventory: true },
}

export const ROMANCE_TEMPLATE: CharacterTemplate = {
  v: TEMPLATE_SCHEMA_VERSION,
  id: 'builtin-romance',
  name: 'Romance / Slice of Life',
  description: 'Relationships and feelings instead of combat. Heart stands in for HP; Stress builds up under pressure.',
  author: 'D&D Playground',
  stats: [
    { id: 'charm', label: 'Charm (เสน่ห์)', min: null, max: null, default: 10 },
    { id: 'wit', label: 'Wit (ไหวพริบ)', min: null, max: null, default: 10 },
    { id: 'empathy', label: 'Empathy (ความเข้าใจคน)', min: null, max: null, default: 10 },
    { id: 'courage', label: 'Courage (ความกล้า)', min: null, max: null, default: 10 },
    { id: 'style', label: 'Style (สไตล์)', min: null, max: null, default: 10 },
  ],
  resources: [
    { id: 'hp', label: 'Heart (พลังใจ/HP)', defaultMax: 20, color: 'rose' },
    { id: 'stress', label: 'Stress (ความเครียด)', defaultMax: 10, color: 'violet' },
  ],
  textFields: [
    { id: 'appearance', label: 'Appearance', placeholder: 'Look, style, first impression...', rows: 2 },
    { id: 'backstory', label: 'Backstory', placeholder: 'Family, school, what brought them here...', rows: 3 },
    { id: 'strengths', label: 'Charms (จุดเด่น)', placeholder: 'Great listener, good cook...', rows: 2 },
    { id: 'weaknesses', label: 'Flaws (จุดอ่อน)', placeholder: 'Jealous, bad at saying no...', rows: 2 },
    { id: 'crush', label: 'Crush (คนที่แอบชอบ)', placeholder: 'Who they have feelings for...', rows: 1 },
    { id: 'relationships', label: 'Relationships', placeholder: 'Friends, rivals, family ties...', rows: 2 },
  ],
  equipmentSlots: [
    { id: 'outfit', label: 'Outfit' },
    { id: 'accessory', label: 'Accessory' },
    { id: 'keepsake', label: 'Keepsake' },
  ],
  conditions: ['Normal', 'Flustered', 'Confident', 'Jealous', 'Heartbroken', 'Exhausted'],
  sections: { skills: false, inventory: true },
}

export const HORROR_TEMPLATE: CharacterTemplate = {
  v: TEMPLATE_SCHEMA_VERSION,
  id: 'builtin-horror',
  name: 'Horror Investigation',
  description: 'Investigators facing the unknown. Sanity drains as the horror grows; Luck can save a bad roll.',
  author: 'D&D Playground',
  stats: [
    { id: 'STR', label: 'STR', min: null, max: null, default: 10 },
    { id: 'DEX', label: 'DEX', min: null, max: null, default: 10 },
    { id: 'CON', label: 'CON', min: null, max: null, default: 10 },
    { id: 'INT', label: 'INT', min: null, max: null, default: 10 },
    { id: 'willpower', label: 'Willpower (จิตใจ)', min: null, max: null, default: 10 },
    { id: 'perception', label: 'Perception (การสังเกต)', min: null, max: null, default: 10 },
  ],
  resources: [
    { id: 'hp', label: 'Hit Points (HP)', defaultMax: 15, color: 'red' },
    { id: 'sanity', label: 'Sanity (สติสัมปชัญญะ)', defaultMax: 50, color: 'violet' },
    { id: 'luck', label: 'Luck (โชค)', defaultMax: 50, color: 'emerald' },
  ],
  textFields: [
    { id: 'appearance', label: 'Appearance', placeholder: 'How they look and dress...', rows: 2 },
    { id: 'backstory', label: 'Background', placeholder: 'Occupation, past, why they investigate...', rows: 3 },
    { id: 'strengths', label: 'Expertise', placeholder: 'Library use, first aid, firearms...', rows: 2 },
    { id: 'weaknesses', label: 'Phobias & Manias', placeholder: 'Fear of the dark, compulsive note-taking...', rows: 2 },
  ],
  equipmentSlots: [
    { id: 'left_hand', label: 'Left Hand' },
    { id: 'right_hand', label: 'Right Hand' },
    { id: 'torso', label: 'Clothing' },
    { id: 'pocket', label: 'Pocket' },
  ],
  conditions: ['Normal', 'Shaken', 'Terrified', 'Wounded', 'Bout of Madness', 'Unconscious'],
  sections: { skills: true, inventory: true },
}

export const DRAMA_INVENTORY_TEMPLATE_ID = 'builtin-drama-inventory'

export const DRAMA_INVENTORY_TEMPLATE: CharacterTemplate = {
  v: TEMPLATE_SCHEMA_VERSION,
  id: DRAMA_INVENTORY_TEMPLATE_ID,
  name: 'Drama & Mystery (Inventory & Clues Only)',
  description:
    'Pure narrative, social intrigue, and mystery. No HP or SP bars. Conflict is resolved through items, clues, disguises, and social conditions.',
  author: 'D&D Playground',
  stats: [
    { id: 'reputation', label: 'Reputation / Clout (บารมี)', min: 0, max: 20, default: 10 },
    { id: 'composure', label: 'Composure (ความนิ่ง/การคุมอารมณ์)', min: 0, max: 20, default: 10 },
    { id: 'subterfuge', label: 'Subterfuge (เล่ห์เหลี่ยม/ไหวพริบ)', min: 0, max: 20, default: 10 },
  ],
  resources: [],
  textFields: [
    {
      id: 'secret_agenda',
      label: 'Secret Agenda (เป้าหมายลับ)',
      placeholder: 'What are you secretly trying to achieve, conceal, or investigate?',
      rows: 2,
    },
    {
      id: 'alibi',
      label: 'Alibi / Cover Story (ตัวตนบังหน้า/ข้ออ้าง)',
      placeholder: 'Who do people think you are, and why are you at this scene?',
      rows: 2,
    },
    {
      id: 'connections',
      label: 'Allies & Foes (สายสัมพันธ์และความขัดแย้ง)',
      placeholder: 'Whom do you trust, owe, suspect, or fear?',
      rows: 2,
    },
    {
      id: 'appearance',
      label: 'Appearance & Demeanor',
      placeholder: 'Attire, gait, tells, notable expressions...',
      rows: 2,
    },
  ],
  equipmentSlots: [
    { id: 'outfit', label: 'Attire / Disguise (ชุดที่สวม/เครื่องแบบ)' },
    { id: 'pocket', label: 'Pockets (ของพกติดตัว/กระเป๋าเสื้อ)' },
    { id: 'bag', label: 'Bag / Briefcase (กระเป๋าถือ/เป้)' },
    { id: 'accessory', label: 'Keepsake / Badge (ตราประจำตัว/ของสำคัญ)' },
  ],
  conditions: [
    'Normal',
    'Suspected (ถูกสงสัย)',
    'Favored (เป็นที่โปรดปราน)',
    'Blackmailed (ถูกแบล็กเมล)',
    'Compromised (ความลับแตก)',
    'Exiled (ถูกขับไล่)',
  ],
  sections: { skills: false, inventory: true },
}

export const BUILTIN_TEMPLATES: readonly CharacterTemplate[] = [
  CLASSIC_TEMPLATE,
  DRAMA_INVENTORY_TEMPLATE,
  ROMANCE_TEMPLATE,
  HORROR_TEMPLATE,
]

export function createEmptyTemplate(name = 'Custom Campaign Sheet'): CharacterTemplate {
  return {
    v: TEMPLATE_SCHEMA_VERSION,
    id: newTemplateId(),
    name,
    description: 'Custom character sheet tailored for this campaign.',
    author: 'Campaign Creator',
    stats: [],
    resources: [],
    textFields: [],
    equipmentSlots: [],
    conditions: ['Normal'],
    sections: { skills: true, inventory: true },
  }
}

export function isBuiltinTemplateId(id: string | null | undefined): boolean {
  return BUILTIN_TEMPLATES.some((t) => t.id === id)
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const LIMITS = {
  name: 60,
  description: 300,
  author: 40,
  label: 40,
  placeholder: 120,
  condition: 30,
  stats: 24,
  resources: 8,
  textFields: 12,
  equipmentSlots: 12,
  conditions: 24,
  number: 9999,
  textValue: 4000,
} as const

const ID_PATTERN = /^[A-Za-z0-9_]{1,32}$/
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function cleanText(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max)
}

function cleanNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'string' && value.trim() === '' ? NaN : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(-LIMITS.number, Math.min(LIMITS.number, Math.round(num)))
}

function cleanOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? cleanNumber(num, 0) : null
}

export function isValidFieldId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id) && !FORBIDDEN_IDS.has(id)
}

export function makeFieldId(label: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'field'
  let id = base
  for (let n = 2; used.has(id) || !isValidFieldId(id); n++) {
    id = `${base}_${n}`.slice(0, 32)
    if (n > 999) {
      id = `f_${Math.random().toString(36).slice(2, 10)}`
      break
    }
  }
  return id
}

function uniqueById<T extends { id: string }>(items: T[], limit: number): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

function sanitizeList<T extends { id: string }>(
  raw: unknown,
  limit: number,
  map: (entry: Record<string, unknown>, id: string) => T
): T[] {
  if (!Array.isArray(raw)) return []
  const mapped = raw
    .slice(0, limit * 2)
    .map(asRecord)
    .filter((entry) => isValidFieldId(entry.id))
    .map((entry) => map(entry, entry.id as string))
  return uniqueById(mapped, limit)
}

export function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizeTemplate(raw: unknown): CharacterTemplate | null {
  const input = asRecord(raw)
  if (Object.keys(input).length === 0) return null

  const stats = sanitizeList<TemplateStat>(input.stats, LIMITS.stats, (entry, id) => {
    let min = cleanOptionalNumber(entry.min)
    let max = cleanOptionalNumber(entry.max)
    if (min !== null && max !== null && min > max) [min, max] = [max, min]
    let def = cleanNumber(entry.default, 0)
    if (min !== null) def = Math.max(min, def)
    if (max !== null) def = Math.min(max, def)
    return { id, label: cleanText(entry.label, LIMITS.label, id) || id, min, max, default: def }
  })

  const resources = sanitizeList<TemplateResource>(input.resources, LIMITS.resources, (entry, id) => ({
    id,
    label: cleanText(entry.label, LIMITS.label, id) || id,
    defaultMax: Math.max(0, cleanNumber(entry.defaultMax, 10)),
    color: (RESOURCE_COLORS as readonly string[]).includes(entry.color as string)
      ? (entry.color as ResourceColor)
      : 'zinc',
  }))

  const textFields = sanitizeList<TemplateTextField>(input.textFields, LIMITS.textFields, (entry, id) => ({
    id,
    label: cleanText(entry.label, LIMITS.label, id) || id,
    placeholder: cleanText(entry.placeholder, LIMITS.placeholder),
    rows: Math.max(1, Math.min(6, cleanNumber(entry.rows, 2))),
  }))

  const equipmentSlots = sanitizeList<TemplateEquipmentSlot>(
    input.equipmentSlots,
    LIMITS.equipmentSlots,
    (entry, id) => ({ id, label: cleanText(entry.label, LIMITS.label, id) || id })
  )

  const conditions = Array.from(
    new Set(
      (Array.isArray(input.conditions) ? input.conditions : [])
        .slice(0, LIMITS.conditions * 2)
        .map((c) => cleanText(c, LIMITS.condition))
        .filter(Boolean)
    )
  ).slice(0, LIMITS.conditions)

  const sections = asRecord(input.sections)

  return {
    v: TEMPLATE_SCHEMA_VERSION,
    id: typeof input.id === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(input.id) ? input.id : newTemplateId(),
    name: cleanText(input.name, LIMITS.name) || 'Untitled Template',
    description: cleanText(input.description, LIMITS.description),
    author: cleanText(input.author, LIMITS.author),
    stats,
    resources,
    textFields,
    equipmentSlots,
    conditions: conditions.length > 0 ? conditions : ['Normal'],
    sections: {
      skills: sections.skills === undefined ? true : Boolean(sections.skills),
      inventory: sections.inventory === undefined ? true : Boolean(sections.inventory),
    },
  }
}

export function sanitizeCustomValues(raw: unknown): SheetCustomValues {
  const input = asRecord(raw)
  const result: SheetCustomValues = { stats: {}, resources: {}, fields: {}, equipment: {} }

  for (const [id, value] of Object.entries(asRecord(input.stats)).slice(0, 64)) {
    if (isValidFieldId(id)) result.stats[id] = cleanNumber(value, 0)
  }
  for (const [id, value] of Object.entries(asRecord(input.resources)).slice(0, 32)) {
    if (!isValidFieldId(id)) continue
    const entry = asRecord(value)
    const max = Math.max(0, cleanNumber(entry.max, 0))
    result.resources[id] = { max, current: Math.max(0, Math.min(max, cleanNumber(entry.current, max))) }
  }
  for (const [id, value] of Object.entries(asRecord(input.fields)).slice(0, 48)) {
    if (isValidFieldId(id)) result.fields[id] = cleanText(value, LIMITS.textValue)
  }
  for (const [id, value] of Object.entries(asRecord(input.equipment)).slice(0, 48)) {
    if (isValidFieldId(id)) result.equipment[id] = cleanText(value, 200)
  }
  return result
}

export function clampStatValue(stat: TemplateStat, value: unknown): number {
  let num = cleanNumber(value, stat.default)
  if (stat.min !== null) num = Math.max(stat.min, num)
  if (stat.max !== null) num = Math.min(stat.max, num)
  return num
}

// ---------------------------------------------------------------------------------------------
// Reading character template and values
// ---------------------------------------------------------------------------------------------

type CharacterLike = { stats?: Record<string, unknown> | null } | null | undefined

export function readCharacterTemplate(character: CharacterLike): CharacterTemplate {
  const embedded = character?.stats?.sheet_template
  return sanitizeTemplate(embedded) ?? CLASSIC_TEMPLATE
}

export function readCustomValues(character: CharacterLike): SheetCustomValues {
  return sanitizeCustomValues(character?.stats?.sheet_custom)
}

export function templateStatsPayload(
  template: CharacterTemplate | null | undefined,
  custom: SheetCustomValues | null | undefined
): { sheet_template?: CharacterTemplate; sheet_custom?: SheetCustomValues } {
  const payload: { sheet_template?: CharacterTemplate; sheet_custom?: SheetCustomValues } = {}
  const cleanTemplate = template ? sanitizeTemplate(template) : null
  if (cleanTemplate && cleanTemplate.id !== CLASSIC_TEMPLATE_ID) payload.sheet_template = cleanTemplate
  const cleanCustom = sanitizeCustomValues(custom)
  const hasCustom =
    Object.keys(cleanCustom.stats).length > 0 ||
    Object.keys(cleanCustom.resources).length > 0 ||
    Object.keys(cleanCustom.fields).length > 0 ||
    Object.keys(cleanCustom.equipment).length > 0
  if (hasCustom) payload.sheet_custom = cleanCustom
  return payload
}

// ---------------------------------------------------------------------------------------------
// Campaign templates
// ---------------------------------------------------------------------------------------------

export const CAMPAIGN_TEMPLATE_COMMENT_REGEX = /<!--\s*CAMPAIGN_TEMPLATE:\s*([\s\S]*?)\s*-->/

export type CampaignLike = {
  category?: string | null
  rule_mechanics?: string | null
  sheet_template?: unknown
} | null | undefined

export function getPresetTemplateForCategory(category: string | null | undefined): CharacterTemplate {
  const normalized = (category || '').toLowerCase()
  if (normalized.includes('drama')) return DRAMA_INVENTORY_TEMPLATE
  if (
    normalized.includes('romance') ||
    normalized.includes('slice of life') ||
    normalized.includes('cozy')
  ) {
    return ROMANCE_TEMPLATE
  }
  if (normalized.includes('horror')) return HORROR_TEMPLATE
  return CLASSIC_TEMPLATE
}

export function extractCampaignTemplate(campaign: CampaignLike): CharacterTemplate {
  if (campaign?.sheet_template) {
    const direct = sanitizeTemplate(campaign.sheet_template)
    if (direct) return direct
  }
  if (typeof campaign?.rule_mechanics === 'string') {
    const match = campaign.rule_mechanics.match(CAMPAIGN_TEMPLATE_COMMENT_REGEX)
    if (match?.[1]) {
      try {
        const raw = JSON.parse(match[1])
        const parsed = sanitizeTemplate(raw)
        if (parsed) return parsed
      } catch {
        // Fallback to category preset on parse failure
      }
    }
  }
  return getPresetTemplateForCategory(campaign?.category)
}

export function stripCampaignTemplateFromRules(rules: string | null | undefined): string {
  if (!rules) return ''
  return rules.replace(CAMPAIGN_TEMPLATE_COMMENT_REGEX, '').trim()
}

export function packCampaignTemplateIntoRules(
  rules: string | null | undefined,
  template: CharacterTemplate | null | undefined
): string {
  const stripped = stripCampaignTemplateFromRules(rules)
  const cleanTpl = sanitizeTemplate(template) ?? CLASSIC_TEMPLATE
  const marker = `\n\n<!-- CAMPAIGN_TEMPLATE: ${JSON.stringify(cleanTpl)} -->`
  return stripped ? `${stripped}${marker}` : marker.trim()
}

// ---------------------------------------------------------------------------------------------
// Share keys
// ---------------------------------------------------------------------------------------------

const KEY_PREFIX_COMPRESSED = 'CST1.'
const KEY_PREFIX_PLAIN = 'CST0.'
const MAX_KEY_LENGTH = 40_000
const MAX_DECODED_BYTES = 128 * 1024

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function readStreamCapped(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('This template key is too large.')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function toShareable(template: CharacterTemplate) {
  const { id: _localId, ...rest } = template
  void _localId
  return rest
}

export async function encodeTemplateKey(template: CharacterTemplate): Promise<string> {
  const clean = sanitizeTemplate(template)
  if (!clean) throw new Error('This template is empty.')
  const json = new TextEncoder().encode(JSON.stringify(toShareable(clean)))

  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = streamFromBytes(json).pipeThrough(
        new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
      )
      const compressed = await readStreamCapped(stream, MAX_DECODED_BYTES)
      return KEY_PREFIX_COMPRESSED + bytesToBase64Url(compressed)
    } catch {
      // Fallback to plain base64url if compression fails
    }
  }
  return KEY_PREFIX_PLAIN + bytesToBase64Url(json)
}

export async function decodeTemplateKey(input: string): Promise<CharacterTemplate> {
  const key = input.replace(/\s+/g, '')
  if (!key) throw new Error('กรุณาวาง Template Key ก่อนนำเข้า (Paste a template key first)')
  if (key.length > MAX_KEY_LENGTH) throw new Error('คีย์มีขนาดใหญ่เกินกำหนด (Template key is too large)')

  let jsonText: string
  try {
    if (key.startsWith(KEY_PREFIX_COMPRESSED)) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการคลายบีบอัดคีย์ (This browser cannot open compressed keys)')
      }
      const stream = streamFromBytes(base64UrlToBytes(key.slice(KEY_PREFIX_COMPRESSED.length))).pipeThrough(
        new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
      )
      const bytes = await readStreamCapped(stream, MAX_DECODED_BYTES)
      jsonText = new TextDecoder().decode(bytes)
    } else if (key.startsWith(KEY_PREFIX_PLAIN)) {
      jsonText = new TextDecoder().decode(base64UrlToBytes(key.slice(KEY_PREFIX_PLAIN.length)))
    } else if (input.trim().startsWith('{')) {
      jsonText = input.trim()
    } else {
      throw new Error('รูปแบบคีย์ไม่ถูกต้อง คีย์สำหรับแชร์ต้องขึ้นต้นด้วย "CST1." หรือ "CST0." (Keys start with CST1. or CST0.)')
    }
  } catch (err) {
    if (err instanceof Error && /Template Key|เบราว์เซอร์|รูปแบบคีย์|CST/.test(err.message)) throw err
    throw new Error('คีย์นี้ชำรุดหรือไม่สมบูรณ์ กรุณาคัดลอกคีย์ทั้งหมดแล้วลองใหม่อีกครั้ง (Template key is damaged or incomplete)')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('คีย์นี้ชำรุดหรือไม่สมบูรณ์ กรุณาคัดลอกคีย์ทั้งหมดแล้วลองใหม่อีกครั้ง (Template key is damaged or incomplete)')
  }

  const template = sanitizeTemplate({ ...asRecord(parsed), id: undefined })
  if (!template) throw new Error('ไม่พบโครงสร้างแผ่นตัวละครในคีย์นี้ (No sheet structure in this template key)')
  return { ...template, id: newTemplateId() }
}

