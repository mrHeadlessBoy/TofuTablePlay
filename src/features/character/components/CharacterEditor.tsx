'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { saveCharacter, deleteCharacter, getCampaignRequiredTemplate, CharacterFormData } from '../actions'
import {
  EMPTY_EQUIPMENT,
  clampHpValues,
  clampSkillCostValues,
  extractCharacterInventory,
  extractCharacterSkillCost,
  extractCharacterSkills,
  getHpTailwindClass,
  sanitizeAbilityScores,
  sanitizeCharacterSkills,
  sanitizeInventoryItems,
  type CharacterInventoryItem,
} from '../domain'
import {
  BUILTIN_TEMPLATES,
  CLASSIC_TEMPLATE,
  COLUMN_EQUIPMENT_SLOT_INDEX,
  COLUMN_RESOURCE_IDS,
  clampStatValue,
  isBuiltinTemplateId,
  isColumnStatId,
  isColumnTextFieldId,
  readCharacterTemplate,
  readCustomValues,
  templateStatsPayload,
  type CharacterTemplate,
  type SheetCustomValues,
  type ResourceColor,
} from '../template'
import TemplateModal from './TemplateModal'
import { playSystemSound } from '@/lib/sound'
import { Plus, Trash2, Loader2, Package, Sparkles, Sliders, Heart } from 'lucide-react'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type CharacterRecord = CharacterFormData & { id?: string | number; user_id?: string | null }

const RESOURCE_COLOR_BORDER: Record<ResourceColor, string> = {
  red: 'border-red-500/40 focus-within:border-red-500',
  amber: 'border-amber-500/40 focus-within:border-amber-500',
  cyan: 'border-cyan-500/40 focus-within:border-cyan-500',
  emerald: 'border-emerald-500/40 focus-within:border-emerald-500',
  violet: 'border-violet-500/40 focus-within:border-violet-500',
  rose: 'border-rose-500/40 focus-within:border-rose-500',
  sky: 'border-sky-500/40 focus-within:border-sky-500',
  zinc: 'border-zinc-500/40 focus-within:border-zinc-500',
}

const RESOURCE_COLOR_TEXT: Record<ResourceColor, string> = {
  red: 'text-red-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  violet: 'text-violet-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
  zinc: 'text-zinc-400',
}

function createBlankCharacterForTemplate(tpl: CharacterTemplate): CharacterRecord {
  const initialCustomStats: Record<string, number> = {}
  for (const s of tpl.stats) {
    initialCustomStats[s.id] = s.default
  }
  const hpDef = tpl.resources.find((r) => r.id === 'hp')
  const spDef = tpl.resources.find((r) => r.id === 'skill_cost')
  const hpVal = hpDef ? hpDef.defaultMax : (tpl.resources.length === 0 ? 0 : 10)
  const spVal = spDef ? spDef.defaultMax : 0

  return {
    name: '',
    class_archetype: '',
    current_hp: hpVal,
    max_hp: hpVal,
    armor_class: spVal,
    current_skill_cost: spVal,
    max_skill_cost: spVal,
    stats: {
      ...initialCustomStats,
      sheet_template: tpl,
    },
    appearance: '',
    backstory: '',
    strengths: '',
    weaknesses: '',
    inventory: [],
    status_condition: tpl.conditions[0] || 'Normal',
    equipment: [...EMPTY_EQUIPMENT],
    skills: [],
  }
}

function createInitialCustomValues(tpl: CharacterTemplate): SheetCustomValues {
  const initialStats: Record<string, number> = {}
  for (const s of tpl.stats) {
    initialStats[s.id] = s.default
  }
  const initialRes: Record<string, { current: number; max: number }> = {}
  for (const r of tpl.resources) {
    initialRes[r.id] = { current: r.defaultMax, max: r.defaultMax }
  }
  return { stats: initialStats, resources: initialRes, fields: {}, equipment: {} }
}

function getCharacterInventoryItems(char: CharacterRecord | null): CharacterInventoryItem[] {
  if (!char) return []
  if (Array.isArray(char.inventory)) {
    return char.inventory as CharacterInventoryItem[]
  }
  return extractCharacterInventory(char)
}

export default function CharacterEditor({
  characters,
  currentUserId,
}: {
  characters: CharacterRecord[]
  currentUserId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignIdParam = searchParams.get('campaignId')
  const tableCodeParam = searchParams.get('tableCode')
  const templateIdParam = searchParams.get('templateId')
  const returnToParam = searchParams.get('returnTo')
  const { showAlert, showConfirm } = useAlert()
  const { t, language } = useLanguage()
  const builtinInitial = templateIdParam ? BUILTIN_TEMPLATES.find((t) => t.id === templateIdParam) : null
  const [activeTemplate, setActiveTemplate] = useState<CharacterTemplate>(() => {
    return builtinInitial ?? CLASSIC_TEMPLATE
  })
  const [customValues, setCustomValues] = useState<SheetCustomValues>(() => {
    return builtinInitial
      ? createInitialCustomValues(builtinInitial)
      : { stats: {}, resources: {}, fields: {}, equipment: {} }
  })
  const [selectedChar, setSelectedChar] = useState<CharacterRecord | null>(() => {
    if (!builtinInitial || !returnToParam) return null
    return createBlankCharacterForTemplate(builtinInitial)
  })
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Track whether the campaign's required template has already been loaded for this session
  const hasInitializedCampaignTemplateRef = useRef(Boolean(builtinInitial && returnToParam))

  const isOwner = (char: CharacterRecord) => {
    if (!currentUserId || !char.user_id) return true
    return char.user_id === currentUserId
  }

  const handleDelete = async (char: CharacterRecord) => {
    if (!char.id) return
    const charName = char.name?.trim() || 'this character'
    const confirmed = await showConfirm({
      title: 'ยืนยันการลบตัวละคร',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบตัวละคร "${charName}"? แผ่นชีทนี้จะถูกลบถาวรและไม่สามารถกู้คืนได้ (This sheet will be permanently removed)`,
      confirmText: 'ลบตัวละคร',
      cancelText: 'ยกเลิก',
    })
    if (!confirmed) {
      return
    }

    setDeletingId(String(char.id))
    try {
      await deleteCharacter(String(char.id))
      if (selectedChar?.id === char.id) {
        setSelectedChar(null)
      }
      router.refresh()
    } catch (err: unknown) {
      playSystemSound('error')
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบตัวละคร (Failed to delete character)'
      showAlert({
        title: 'ไม่สามารถลบตัวละครได้',
        status: 'error',
        message,
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectCharacter = (char: CharacterRecord) => {
    const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(char)
    const tpl = readCharacterTemplate(char)
    const custom = readCustomValues(char)

    setActiveTemplate(tpl)
    setCustomValues(custom)
    setSelectedChar({
      ...char,
      current_skill_cost: currentSkillCost,
      max_skill_cost: maxSkillCost,
      skills: extractCharacterSkills(char),
      inventory: extractCharacterInventory(char),
    })
  }

  const handleNew = useCallback((targetTpl?: unknown) => {
    setActiveTemplate((currentActive) => {
      const tpl = (targetTpl && typeof targetTpl === 'object' && 'v' in targetTpl)
        ? (targetTpl as CharacterTemplate)
        : currentActive
      setCustomValues(createInitialCustomValues(tpl))
      setSelectedChar(createBlankCharacterForTemplate(tpl))
      return tpl
    })
  }, [])

  // Automatically fetch campaign's required template (including custom templates) if directed from a campaign/table
  useEffect(() => {
    const targetParam = campaignIdParam || tableCodeParam || templateIdParam
    if (!targetParam) return

    // If already initialized with a builtin template or already fetched, no async fetch needed
    if (hasInitializedCampaignTemplateRef.current) {
      return
    }

    if (templateIdParam && BUILTIN_TEMPLATES.some((t) => t.id === templateIdParam)) {
      hasInitializedCampaignTemplateRef.current = true
      return
    }

    let isCancelled = false
    getCampaignRequiredTemplate(targetParam)
      .then((tpl) => {
        if (!isCancelled && tpl) {
          hasInitializedCampaignTemplateRef.current = true
          setActiveTemplate(tpl)
          setCustomValues((prev) => {
            const initial = createInitialCustomValues(tpl)
            return {
              stats: { ...initial.stats, ...prev.stats },
              resources: { ...initial.resources, ...prev.resources },
              fields: { ...prev.fields },
              equipment: { ...prev.equipment },
            }
          })
          setSelectedChar((prev) => {
            // If user has already begun typing, preserve their entered values
            if (prev && (prev.name || prev.class_archetype || prev.id)) {
              return {
                ...prev,
                stats: {
                  ...prev.stats,
                  sheet_template: tpl,
                },
              }
            }
            return createBlankCharacterForTemplate(tpl)
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load campaign template:', err)
      })

    return () => {
      isCancelled = true
    }
  }, [campaignIdParam, tableCodeParam, templateIdParam])

  const handleSwitchTemplate = async (targetTemplateId: string) => {
    if (!selectedChar) return
    const target = BUILTIN_TEMPLATES.find((t) => t.id === targetTemplateId)
    if (!target) return

    const confirmed = await showConfirm(
      `เปลี่ยนโครงสร้างชีตเป็น "${target.name}"? ฟิลด์ที่มีชื่อหรือ ID ตรงกันจะถูกเก็บรักษาไว้`
    )
    if (!confirmed) return

    applyTemplateToState(target)
  }

  const applyTemplateToState = (nextTemplate: CharacterTemplate) => {
    if (!selectedChar) return

    // Update active template
    setActiveTemplate(nextTemplate)

    // Ensure custom values have keys for new template fields
    const nextCustom: SheetCustomValues = {
      stats: { ...customValues.stats },
      resources: { ...customValues.resources },
      fields: { ...customValues.fields },
      equipment: { ...customValues.equipment },
    }

    // Initialize missing custom resources with defaultMax
    for (const res of nextTemplate.resources) {
      if (!COLUMN_RESOURCE_IDS.some((columnId) => columnId === res.id)) {
        if (!nextCustom.resources[res.id]) {
          nextCustom.resources[res.id] = { current: res.defaultMax, max: res.defaultMax }
        }
      }
    }

    // Initialize missing stats with default
    const nextCharStats = { ...selectedChar.stats }
    for (const st of nextTemplate.stats) {
      if (isColumnStatId(st.id)) {
        if (nextCharStats[st.id] === undefined) {
          nextCharStats[st.id] = st.default
        }
      } else if (nextCustom.stats[st.id] === undefined) {
        nextCustom.stats[st.id] = st.default
      }
    }

    const nextCondition = nextTemplate.conditions.includes(selectedChar.status_condition)
      ? selectedChar.status_condition
      : nextTemplate.conditions[0] || 'Normal'

    setSelectedChar({
      ...selectedChar,
      stats: nextCharStats,
      status_condition: nextCondition,
    })
    setCustomValues(nextCustom)
  }

  // Handle stat change (handles both classic ability scores and custom stats)
  const handleStatChange = (statId: string, rawValue: string) => {
    if (!selectedChar) return
    const statDef = activeTemplate.stats.find((s) => s.id === statId)

    if (rawValue === '' || rawValue === '-') {
      if (isColumnStatId(statId)) {
        setSelectedChar({
          ...selectedChar,
          stats: { ...selectedChar.stats, [statId]: rawValue as unknown as number },
        })
      } else {
        setCustomValues({
          ...customValues,
          stats: { ...customValues.stats, [statId]: rawValue as unknown as number },
        })
      }
      return
    }

    const num = Number(rawValue)
    if (!Number.isNaN(num)) {
      const finalVal = statDef ? clampStatValue(statDef, num) : num

      if (isColumnStatId(statId)) {
        setSelectedChar({
          ...selectedChar,
          stats: { ...selectedChar.stats, [statId]: finalVal },
        })
      } else {
        setCustomValues({
          ...customValues,
          stats: { ...customValues.stats, [statId]: finalVal },
        })
      }
    }
  }

  // Handle custom text field change
  const handleTextFieldChange = (fieldId: string, val: string) => {
    if (!selectedChar) return
    if (isColumnTextFieldId(fieldId)) {
      setSelectedChar({
        ...selectedChar,
        [fieldId]: val,
      })
    } else {
      setCustomValues({
        ...customValues,
        fields: { ...customValues.fields, [fieldId]: val },
      })
    }
  }

  // Handle equipment slot change (maps standard 6 slots via COLUMN_EQUIPMENT_SLOT_INDEX, custom slots via customValues.equipment)
  const handleEquipmentChange = (slotId: string, val: string) => {
    if (!selectedChar) return
    const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slotId]
    if (colIdx !== undefined) {
      const nextEq = [...(selectedChar.equipment ?? EMPTY_EQUIPMENT)] as CharacterFormData['equipment']
      nextEq[colIdx] = val
      setSelectedChar({ ...selectedChar, equipment: nextEq })
    } else {
      setCustomValues({
        ...customValues,
        equipment: { ...customValues.equipment, [slotId]: val },
      })
    }
  }

  // Handle custom resource change (e.g. Stress, Sanity, Luck)
  const handleCustomResourceChange = (
    resId: string,
    key: 'current' | 'max',
    val: number
  ) => {
    const resDef = activeTemplate.resources.find((r) => r.id === resId)
    const defaultMax = resDef?.defaultMax ?? 10
    const existing = customValues.resources[resId] || { current: defaultMax, max: defaultMax }
    const nextMax = key === 'max' ? Math.max(0, val) : existing.max
    let nextCurrent = key === 'current' ? Math.max(0, val) : existing.current
    if (nextCurrent > nextMax) nextCurrent = nextMax

    setCustomValues({
      ...customValues,
      resources: {
        ...customValues.resources,
        [resId]: { current: nextCurrent, max: nextMax },
      },
    })
  }

  // Skills handlers
  const handleAddSkill = () => {
    if (!selectedChar) return
    const currentSkills = selectedChar.skills ?? extractCharacterSkills(selectedChar)
    setSelectedChar({
      ...selectedChar,
      skills: [...currentSkills, { name: '', cost: 0, description: '' }],
    })
  }

  const handleSkillChange = (
    index: number,
    field: 'name' | 'cost' | 'description',
    value: string | number
  ) => {
    if (!selectedChar) return
    const currentSkills = [...(selectedChar.skills ?? extractCharacterSkills(selectedChar))]
    currentSkills[index] = {
      ...currentSkills[index],
      [field]: value,
    }
    setSelectedChar({
      ...selectedChar,
      skills: currentSkills,
    })
  }

  const handleRemoveSkill = (index: number) => {
    if (!selectedChar) return
    const currentSkills = (selectedChar.skills ?? extractCharacterSkills(selectedChar)).filter(
      (_, i) => i !== index
    )
    setSelectedChar({
      ...selectedChar,
      skills: currentSkills,
    })
  }

  // Inventory handlers
  const handleAddInventoryItem = () => {
    if (!selectedChar) return
    const currentItems = getCharacterInventoryItems(selectedChar)
    setSelectedChar({
      ...selectedChar,
      inventory: [...currentItems, { name: '', quantity: 1, description: '' }],
    })
  }

  const handleInventoryItemChange = (
    index: number,
    field: 'name' | 'quantity' | 'description',
    value: string | number
  ) => {
    if (!selectedChar) return
    const currentItems = [...getCharacterInventoryItems(selectedChar)]
    currentItems[index] = {
      ...currentItems[index],
      [field]: value,
    }
    setSelectedChar({
      ...selectedChar,
      inventory: currentItems,
    })
  }

  const handleRemoveInventoryItem = (index: number) => {
    if (!selectedChar) return
    const currentItems = getCharacterInventoryItems(selectedChar).filter((_, i) => i !== index)
    setSelectedChar({
      ...selectedChar,
      inventory: currentItems,
    })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChar) return

    // Client-side validations
    if (!selectedChar.name?.trim()) {
      playSystemSound('error')
      showAlert({
        title: 'กรุณากรอกชื่อตัวละคร',
        status: 'warning',
        badge: 'Character Name Required',
        message: 'กรุณาระบุชื่อตัวละครของคุณก่อนทำการบันทึกข้อมูล (Character name is required)',
      })
      return
    }

    if (selectedChar.name.trim().length > 60) {
      playSystemSound('error')
      showAlert({
        title: 'ชื่อตัวละครยาวเกินไป',
        status: 'warning',
        badge: 'Name Too Long',
        message: 'ชื่อตัวละครต้องมีความยาวไม่เกิน 60 ตัวอักษร (Character name cannot exceed 60 characters)',
      })
      return
    }

    setIsSaving(true)
    try {
      const { currentHp, maxHp } = clampHpValues(selectedChar.current_hp, selectedChar.max_hp)
      const { currentSkillCost, maxSkillCost } = clampSkillCostValues(
        selectedChar.current_skill_cost ?? selectedChar.armor_class,
        selectedChar.max_skill_cost ?? selectedChar.armor_class
      )
      const sanitizedStats = sanitizeAbilityScores(selectedChar.stats, 0)
      const sanitizedSkills = sanitizeCharacterSkills(
        selectedChar.skills ?? extractCharacterSkills(selectedChar)
      )
      const sanitizedInventory = sanitizeInventoryItems(
        selectedChar.inventory ?? extractCharacterInventory(selectedChar)
      )

      await saveCharacter({
        ...selectedChar,
        current_hp: currentHp,
        max_hp: maxHp,
        armor_class: currentSkillCost,
        current_skill_cost: currentSkillCost,
        max_skill_cost: maxSkillCost,
        stats: {
          ...sanitizedStats,
          ...customValues.stats,
          ...templateStatsPayload(activeTemplate, customValues),
        },
        skills: sanitizedSkills,
        inventory: sanitizedInventory,
      })
      setSelectedChar(null)
      router.refresh()
      if (returnToParam) {
        router.push(returnToParam)
      }
    } catch (err: unknown) {
      playSystemSound('error')
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกตัวละคร (Failed to save character)'
      showAlert({
        title: 'ไม่สามารถบันทึกตัวละครได้',
        status: 'error',
        message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {returnToParam && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {t('character.campaignNotice')} <strong>{activeTemplate.name}</strong> (ผู้สร้างเทมเพลต: <strong>{activeTemplate.author || 'Campaign Creator'}</strong>)
            </span>
          </div>
          <Link
            href={returnToParam}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition"
          >
            {t('character.backToRoom')}
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Template Customizer & Key Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        currentTemplate={activeTemplate}
        onApplyTemplate={applyTemplateToState}
      />

      {/* Character Cards Roster */}
      <div className="md:col-span-1 space-y-4">
        <button
          onClick={() => handleNew()}
          className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition cursor-pointer shadow-sm"
        >
          {t('character.createNew')}
        </button>

        <div className="space-y-3">
          {characters.map((char) => {
            const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(char)
            const tpl = readCharacterTemplate(char)
            const hpResource = tpl.resources.find((r) => r.id === 'hp')
            const spResource = tpl.resources.find((r) => r.id === 'skill_cost')
            const hpLabel = hpResource?.label || 'HP'
            const spLabel = spResource?.label || 'Skill Cost'
            const hpColors = getHpTailwindClass(char.current_hp, char.max_hp)

            return (
              <div
                key={char.id}
                onClick={() => handleSelectCharacter(char)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  selectedChar?.id === char.id
                    ? 'border-amber-500 bg-zinc-900 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-white truncate">{char.name}</h3>
                      {tpl.id !== 'builtin-classic' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800/80 text-amber-400 font-mono">
                          {tpl.name} (โดย: {tpl.author || 'D&D Playground'})
                        </span>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 inline-block mt-1">
                      {char.class_archetype || t('character.noClass')}
                    </span>
                  </div>
                  {char.id && isOwner(char) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(char)
                      }}
                      disabled={deletingId !== null}
                      title="Delete character sheet"
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {deletingId === String(char.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-2 truncate">
                  <span className={hpColors.text}>
                    {hpLabel}: {char.current_hp}/{char.max_hp}
                  </span>{' '}
                  | {spLabel}: {currentSkillCost}/{maxSkillCost} | Status: {char.status_condition}
                </p>
              </div>
            )
          })}
          {characters.length === 0 && (
            <p className="text-zinc-500 text-xs italic">No characters saved yet.</p>
          )}
        </div>
      </div>

      {/* Editor Form */}
      <div className="md:col-span-2">
        {selectedChar ? (
          <form
            onSubmit={onSubmit}
            className="surface-panel rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl"
          >
            {/* Header: Replaced static 'Draft' badge with interactive Template Selector & Customizer bar */}
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-zinc-800/40 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selectedChar.id ? t('character.editTitle') : t('character.newTitle')}
                </h2>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {activeTemplate.name} • {t('common.sheetAuthor')}: {activeTemplate.author || 'D&D Playground'}
                </span>
              </div>

              {/* Template Controls Replacing 'Draft' Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-black/40 border border-zinc-800/80 rounded-xl px-3 py-1.5 text-xs">
                  <span className="text-[10px] uppercase font-mono text-zinc-500">{t('character.template')}:</span>
                  <select
                    value={activeTemplate.id}
                    onChange={(e) => handleSwitchTemplate(e.target.value)}
                    className="bg-transparent text-amber-400 font-medium outline-none cursor-pointer text-xs"
                  >
                    {BUILTIN_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id} className="bg-zinc-900 text-white">
                        {t.name}
                      </option>
                    ))}
                    {!isBuiltinTemplateId(activeTemplate.id) && (
                      <option value={activeTemplate.id} className="bg-zinc-900 text-amber-300 font-semibold">
                        ★ {activeTemplate.name} (Custom)
                      </option>
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  title="ปรับแต่งโครงสร้างชีต หรือแชร์/นำเข้า Template Key"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-900/60 hover:bg-zinc-800/80 hover:text-white text-zinc-200 border border-zinc-800/80 rounded-xl transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isBuiltinTemplateId(activeTemplate.id) ? t('character.templateCustomizer') : (language === 'en' ? 'Edit Structure / Key' : 'แก้ไขโครงสร้าง / Key')}</span>
                </button>
              </div>
            </div>

            {/* Core Identity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase">{t('character.name')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Roland of Gilead"
                  value={selectedChar.name}
                  onChange={(e) => setSelectedChar({ ...selectedChar, name: e.target.value })}
                  className="w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">{t('character.archetype')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gunslinger, Paladin, Student..."
                  value={selectedChar.class_archetype}
                  onChange={(e) =>
                    setSelectedChar({ ...selectedChar, class_archetype: e.target.value })
                  }
                  className="w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all"
                />
              </div>
            </div>

            {/* Dynamic Resource Bars (HP, Skill Cost, Stress, Sanity, Energy...) */}
            <div className="space-y-3">
              <label className="text-xs text-zinc-400 uppercase flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-500" /> Resource Bars (หลอดพลัง/เลือด)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeTemplate.resources.map((res) => {
                  const colorBorder = RESOURCE_COLOR_BORDER[res.color] || 'border-zinc-700'
                  const colorText = RESOURCE_COLOR_TEXT[res.color] || 'text-zinc-400'

                  if (res.id === 'hp') {
                    return (
                      <div
                        key={res.id}
                        className={`p-3.5 bg-black/30 border rounded-xl space-y-2 ${colorBorder}`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-semibold ${colorText}`}>{res.label}</span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {selectedChar.current_hp} / {selectedChar.max_hp}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-zinc-500 font-mono">Current</label>
                            <input
                              type="number"
                              min={0}
                              max={selectedChar.max_hp}
                              value={selectedChar.current_hp}
                              onChange={(e) => {
                                const nextVal = Number(e.target.value)
                                const clamped = Number.isNaN(nextVal)
                                  ? 0
                                  : Math.max(0, Math.min(selectedChar.max_hp, nextVal))
                                setSelectedChar({ ...selectedChar, current_hp: clamped })
                              }}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 font-mono">Max</label>
                            <input
                              type="number"
                              min={1}
                              value={selectedChar.max_hp}
                              onChange={(e) => {
                                const nextMax = Math.max(1, Number(e.target.value) || 1)
                                const nextCur = Math.min(nextMax, selectedChar.current_hp)
                                setSelectedChar({ ...selectedChar, max_hp: nextMax, current_hp: nextCur })
                              }}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (res.id === 'skill_cost') {
                    const currentCost = selectedChar.current_skill_cost ?? selectedChar.armor_class ?? 10
                    const maxCost = selectedChar.max_skill_cost ?? selectedChar.armor_class ?? 10
                    return (
                      <div
                        key={res.id}
                        className={`p-3.5 bg-black/30 border rounded-xl space-y-2 ${colorBorder}`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-semibold ${colorText}`}>{res.label}</span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {currentCost} / {maxCost}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-zinc-500 font-mono">Current</label>
                            <input
                              type="number"
                              min={0}
                              max={maxCost}
                              value={currentCost}
                              onChange={(e) => {
                                const raw = Number(e.target.value)
                                const clamped = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(maxCost, raw))
                                setSelectedChar({
                                  ...selectedChar,
                                  current_skill_cost: clamped,
                                  armor_class: clamped,
                                })
                              }}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 font-mono">Max</label>
                            <input
                              type="number"
                              min={0}
                              value={maxCost}
                              onChange={(e) => {
                                const nextMax = Math.max(0, Number(e.target.value) || 0)
                                const nextCur = Math.min(nextMax, currentCost)
                                setSelectedChar({
                                  ...selectedChar,
                                  max_skill_cost: nextMax,
                                  current_skill_cost: nextCur,
                                  armor_class: nextCur,
                                })
                              }}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Custom Resource (Stress, Sanity, Luck, Mana...)
                  const customRes = customValues.resources[res.id] || {
                    current: res.defaultMax,
                    max: res.defaultMax,
                  }
                  return (
                    <div
                      key={res.id}
                      className={`p-3.5 bg-black/30 border rounded-xl space-y-2 ${colorBorder}`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-semibold ${colorText}`}>{res.label}</span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {customRes.current} / {customRes.max}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono">Current</label>
                          <input
                            type="number"
                            min={0}
                            max={customRes.max}
                            value={customRes.current}
                            onChange={(e) =>
                              handleCustomResourceChange(res.id, 'current', Number(e.target.value) || 0)
                            }
                            className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 font-mono">Max</label>
                          <input
                            type="number"
                            min={0}
                            value={customRes.max}
                            onChange={(e) =>
                              handleCustomResourceChange(res.id, 'max', Number(e.target.value) || 0)
                            }
                            className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Status Condition (Populated dynamically from template.conditions) */}
            <div>
              <label className="text-xs text-zinc-400 uppercase">{t('character.statusCondition')}</label>
              <select
                value={selectedChar.status_condition || activeTemplate.conditions[0] || 'Normal'}
                onChange={(e) =>
                  setSelectedChar({ ...selectedChar, status_condition: e.target.value })
                }
                className="w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all cursor-pointer"
              >
                {activeTemplate.conditions.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
                {!activeTemplate.conditions.includes(selectedChar.status_condition || '') &&
                  selectedChar.status_condition && (
                    <option value={selectedChar.status_condition}>
                      {selectedChar.status_condition} (Custom)
                    </option>
                  )}
              </select>
            </div>

            {/* Dynamic Ability Scores / Stats */}
            {activeTemplate.stats.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-zinc-400 uppercase">
                    {t('character.statsAndAttributes')} ({activeTemplate.stats.length})
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {activeTemplate.stats.map((stat) => {
                    const isCol = isColumnStatId(stat.id)
                    const rawVal = isCol
                      ? (selectedChar.stats as Record<string, unknown>)?.[stat.id] ?? stat.default
                      : customValues.stats[stat.id] ?? stat.default
                    const val = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0

                    return (
                      <div
                        key={stat.id}
                        className="bg-black/30 border border-zinc-800/70 rounded-xl p-2.5 text-center"
                      >
                        <span
                          className="text-[10px] text-zinc-400 font-mono block truncate"
                          title={stat.label}
                        >
                          {stat.label}
                        </span>
                        <input
                          type="number"
                          value={val}
                          min={stat.min ?? undefined}
                          max={stat.max ?? undefined}
                          onChange={(e) => handleStatChange(stat.id, e.target.value)}
                          className="w-full bg-transparent text-center font-bold text-sm text-white outline-none mt-1"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Text Fields (Strengths, Weaknesses, Appearance, Backstory, Crush, etc.) */}
            <div className="space-y-4">
              {activeTemplate.textFields.map((field) => {
                const isCol = isColumnTextFieldId(field.id)
                const charMap = selectedChar as unknown as Record<string, unknown>
                const val = isCol
                  ? (charMap[field.id] as string) || ''
                  : customValues.fields[field.id] || ''

                return (
                  <div key={field.id}>
                    <label className="text-xs text-zinc-400 uppercase">{field.label}</label>
                    <textarea
                      rows={field.rows || 2}
                      placeholder={field.placeholder}
                      value={val}
                      onChange={(e) => handleTextFieldChange(field.id, e.target.value)}
                      className="w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all"
                    />
                  </div>
                )
              })}
            </div>

            {/* Dynamic Equipment Slots */}
            {activeTemplate.equipmentSlots.length > 0 && (
              <div>
                <label className="text-xs text-zinc-400 uppercase block mb-2">
                  {t('character.equipmentSlots')} ({activeTemplate.equipmentSlots.length})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activeTemplate.equipmentSlots.map((slot) => {
                    const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
                    const val =
                      colIdx !== undefined
                        ? (selectedChar.equipment ?? EMPTY_EQUIPMENT)[colIdx] || ''
                        : customValues.equipment[slot.id] || ''

                    return (
                      <div key={slot.id}>
                        <label className="text-[10px] text-zinc-500 font-mono uppercase truncate block">
                          {slot.label}
                        </label>
                        <input
                          type="text"
                          placeholder={`${slot.label} slot...`}
                          value={val}
                          onChange={(e) => handleEquipmentChange(slot.id, e.target.value)}
                          className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Skill Slots (Shown only if template enables skills) */}
            {activeTemplate.sections.skills && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {t('character.skills')}
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {(selectedChar.skills ?? extractCharacterSkills(selectedChar)).length} slot(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {(selectedChar.skills ?? extractCharacterSkills(selectedChar)).map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-500 font-mono uppercase">
                          Skill #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(idx)}
                          title="Remove skill"
                          className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-1">
                          <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                            Skill Name :
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Fireball, Shadow Step..."
                            value={skill.name}
                            onChange={(e) => handleSkillChange(idx, 'name', e.target.value)}
                            className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                            Skill Cost :
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={skill.cost ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              handleSkillChange(idx, 'cost', Number.isNaN(val) ? 0 : Math.max(0, val))
                            }}
                            className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                            Description :
                          </label>
                          <input
                            type="text"
                            placeholder="Describe what this skill does..."
                            value={skill.description}
                            onChange={(e) => handleSkillChange(idx, 'description', e.target.value)}
                            className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {(selectedChar.skills ?? extractCharacterSkills(selectedChar)).length === 0 && (
                    <p className="text-xs text-zinc-500 italic">
                      No skills added yet. Click &quot;Add Skill&quot; below to add a skill slot.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('character.addSkill')}
                </button>
              </div>
            )}

            {/* Inventory Item Slots (Shown only if template enables inventory) */}
            {activeTemplate.sections.inventory && (() => {
              const inventoryItems = getCharacterInventoryItems(selectedChar)
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 uppercase flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400" /> {t('character.inventory')}
                    </label>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {inventoryItems.length} item(s)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {inventoryItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-500 font-mono uppercase">
                            Item #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInventoryItem(idx)}
                            title="Remove item"
                            className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                              Item Name :
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Health Potion, Rope..."
                              value={item.name}
                              onChange={(e) => handleInventoryItemChange(idx, 'name', e.target.value)}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                              Quantity :
                            </label>
                            <input
                              type="number"
                              min={1}
                              placeholder="1"
                              value={item.quantity ?? 1}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                handleInventoryItemChange(
                                  idx,
                                  'quantity',
                                  Number.isNaN(val) ? 1 : Math.max(1, Math.round(val))
                                )
                              }}
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                              Description :
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Restores 20 HP, 50ft length..."
                              value={item.description || ''}
                              onChange={(e) =>
                                handleInventoryItemChange(idx, 'description', e.target.value)
                              }
                              className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {inventoryItems.length === 0 && (
                      <p className="text-xs text-zinc-500 italic">
                        No items in inventory yet. Click &quot;Add Item&quot; below to add an item.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInventoryItem}
                    className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('character.addItem')}
                  </button>
                </div>
              )
            })()}

            <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
              {selectedChar.id && isOwner(selectedChar) ? (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedChar)}
                  disabled={deletingId !== null || isSaving}
                  className="px-3 py-2 text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deletingId === String(selectedChar.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {t('character.deleteChar')}
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChar(null)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || deletingId !== null}
                  className="px-5 py-2.5 text-xs bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 rounded-xl font-semibold cursor-pointer disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                >
                  {isSaving ? t('character.savingChar') : t('character.saveChar')}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="h-full border border-dashed border-zinc-800/80 rounded-2xl flex items-center justify-center p-12 text-zinc-500 text-sm">
            Select a character to view or edit, or create a new one.
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
