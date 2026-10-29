'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { saveCharacter, deleteCharacter, getCampaignRequiredTemplate, type CharacterFormData } from '../actions'
import {
  EMPTY_EQUIPMENT,
  clampHpValues,
  clampSkillCostValues,
  extractCharacterInventory,
  extractCharacterSkillCost,
  extractCharacterSkills,
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
  isColumnStatId,
  isColumnTextFieldId,
  readCharacterTemplate,
  readCustomValues,
  templateStatsPayload,
  type CharacterTemplate,
  type SheetCustomValues,
} from '../template'
import TemplateModal from './TemplateModal'
import CharacterRoster from './CharacterRoster'
import {
  ConditionField,
  EquipmentSection,
  IdentityFields,
  InventorySection,
  ResourceBarsSection,
  SheetFormActions,
  SheetFormHeader,
  SkillsSection,
  StatsSection,
  TextFieldsSection,
  type CharacterRecord,
} from './CharacterSheetSections'
import { playSystemSound } from '@/lib/sound'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

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
        <CampaignTemplateNotice template={activeTemplate} returnTo={returnToParam} />
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
        <CharacterRoster
          characters={characters}
          selectedId={selectedChar?.id}
          deletingId={deletingId}
          canDelete={isOwner}
          onCreate={() => handleNew()}
          onSelect={handleSelectCharacter}
          onDelete={handleDelete}
        />

        {/* Editor Form */}
        <div className="md:col-span-2">
          {selectedChar ? (
            <form
              onSubmit={onSubmit}
              className="surface-panel rounded-2xl p-6 sm:p-7 space-y-6 shadow-xl"
            >
              <SheetFormHeader
                isNew={!selectedChar.id}
                template={activeTemplate}
                onSwitchTemplate={handleSwitchTemplate}
                onOpenCustomizer={() => setIsTemplateModalOpen(true)}
              />

              <IdentityFields
                name={selectedChar.name}
                archetype={selectedChar.class_archetype}
                onNameChange={(name) => setSelectedChar({ ...selectedChar, name })}
                onArchetypeChange={(class_archetype) =>
                  setSelectedChar({ ...selectedChar, class_archetype })
                }
              />

              <ResourceBarsSection
                template={activeTemplate}
                character={selectedChar}
                customValues={customValues}
                onCharacterChange={(patch) => setSelectedChar({ ...selectedChar, ...patch })}
                onCustomResourceChange={handleCustomResourceChange}
              />

              <ConditionField
                template={activeTemplate}
                value={selectedChar.status_condition}
                onChange={(status_condition) =>
                  setSelectedChar({ ...selectedChar, status_condition })
                }
              />

              {activeTemplate.stats.length > 0 && (
                <StatsSection
                  template={activeTemplate}
                  character={selectedChar}
                  customValues={customValues}
                  onStatChange={handleStatChange}
                />
              )}

              <TextFieldsSection
                template={activeTemplate}
                character={selectedChar}
                customValues={customValues}
                onFieldChange={handleTextFieldChange}
              />

              {activeTemplate.equipmentSlots.length > 0 && (
                <EquipmentSection
                  template={activeTemplate}
                  equipment={selectedChar.equipment}
                  customValues={customValues}
                  onSlotChange={handleEquipmentChange}
                />
              )}

              {/* Skill Slots (Shown only if template enables skills) */}
              {activeTemplate.sections.skills && (
                <SkillsSection
                  skills={selectedChar.skills ?? extractCharacterSkills(selectedChar)}
                  onAdd={handleAddSkill}
                  onChange={handleSkillChange}
                  onRemove={handleRemoveSkill}
                />
              )}

              {/* Inventory Item Slots (Shown only if template enables inventory) */}
              {activeTemplate.sections.inventory && (
                <InventorySection
                  items={getCharacterInventoryItems(selectedChar)}
                  onAdd={handleAddInventoryItem}
                  onChange={handleInventoryItemChange}
                  onRemove={handleRemoveInventoryItem}
                />
              )}

              <SheetFormActions
                canDelete={Boolean(selectedChar.id) && isOwner(selectedChar)}
                isDeletingThis={deletingId === String(selectedChar.id)}
                isDeletingAny={deletingId !== null}
                isSaving={isSaving}
                onDelete={() => handleDelete(selectedChar)}
                onCancel={() => setSelectedChar(null)}
              />
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

// Banner shown when the Codex was opened from a campaign/table that requires a specific template
function CampaignTemplateNotice({
  template,
  returnTo,
}: {
  template: CharacterTemplate
  returnTo: string
}) {
  const { t } = useLanguage()

  return (
    <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-amber-200">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          {t('character.campaignNotice')} <strong>{template.name}</strong> (ผู้สร้างเทมเพลต:{' '}
          <strong>{template.author || 'Campaign Creator'}</strong>)
        </span>
      </div>
      <Link
        href={returnTo}
        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition"
      >
        {t('character.backToRoom')}
      </Link>
    </div>
  )
}
