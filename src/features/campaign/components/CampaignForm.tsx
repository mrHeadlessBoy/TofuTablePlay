'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign, updateCampaign, LoreEntryInput } from '../actions'
import { Trash2, Plus, BookOpen, Sparkles, Pencil, Sliders, Check, RotateCcw } from 'lucide-react'
import {
  BUILTIN_TEMPLATES,
  createEmptyTemplate,
  extractCampaignTemplate,
  stripCampaignTemplateFromRules,
  getPresetTemplateForCategory,
  isBuiltinTemplateId,
  newTemplateId,
  type CharacterTemplate,
} from '@/features/character/template'
import {
  parseRuleMechanics,
  serializeRuleMechanics,
  type CampaignRuleMechanic,
} from '@/features/campaign/rules'
import TemplateModal from '@/features/character/components/TemplateModal'
import Link from 'next/link'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

const CATEGORIES = [
  'Fantasy', 'Sci-Fi', 'Horror', 'Comedy', 'Romance',
  'Slice of Life / Cozy', 'Post-Apocalyptic', 'Drama', 'Custom'
]

const LORE_CATEGORIES = ['Faction', 'Location', 'NPC', 'Item/Artifact', 'History/Event', 'Custom'] as const
const ACTIVATION_MODES = ['Always Active', 'Keyword Triggered', 'Secret / DM-Only'] as const

type LoreCategory = (typeof LORE_CATEGORIES)[number]
type ActivationMode = (typeof ACTIVATION_MODES)[number]

export type CampaignFormInitial = {
  title: string
  category: string
  custom_category: string
  world_setting: string
  core_description: string
  rule_mechanics: string
  sheet_template?: CharacterTemplate | null
  loreEntries: LoreEntryInput[]
}

type CampaignFormProps =
  | { mode: 'create'; campaignId?: undefined; initial?: undefined }
  | { mode: 'edit'; campaignId: string; initial: CampaignFormInitial }

const EMPTY_ENTRY: LoreEntryInput = {
  title: '',
  trigger_keys: [],
  content: '',
  category: 'Faction',
  activation_mode: 'Keyword Triggered',
}

export default function CampaignForm({ mode, campaignId, initial }: CampaignFormProps) {
  const router = useRouter()
  const { showAlert, showConfirm } = useAlert()
  const { t, language } = useLanguage()
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState(initial?.category || 'Fantasy')
  const [customCategory, setCustomCategory] = useState(initial?.custom_category ?? '')
  const [worldSetting, setWorldSetting] = useState(initial?.world_setting ?? '')
  const [coreDescription, setCoreDescription] = useState(initial?.core_description ?? '')
  const [ruleMechanicsList, setRuleMechanicsList] = useState<CampaignRuleMechanic[]>(() => {
    return parseRuleMechanics(stripCampaignTemplateFromRules(initial?.rule_mechanics))
  })

  const handleAddRule = () => {
    setRuleMechanicsList((prev) => [
      ...prev,
      { id: `rule-${Date.now()}`, title: '', category: '', description: '' },
    ])
  }

  const handleRuleChange = (
    index: number,
    field: keyof CampaignRuleMechanic,
    value: string
  ) => {
    setRuleMechanicsList((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
      }
      return updated
    })
  }

  const handleRemoveRule = (index: number) => {
    setRuleMechanicsList((prev) => prev.filter((_, i) => i !== index))
  }
  const initialTpl =
    initial?.sheet_template ??
    extractCampaignTemplate({
      category: initial?.category || 'Fantasy',
      rule_mechanics: initial?.rule_mechanics,
    })
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate>(initialTpl)
  const [isCustomTemplate, setIsCustomTemplate] = useState<boolean>(!isBuiltinTemplateId(initialTpl.id))
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  // Lorebook state
  const [loreEntries, setLoreEntries] = useState<LoreEntryInput[]>(initial?.loreEntries ?? [])
  const [triggerInput, setTriggerInput] = useState('')
  const [newEntry, setNewEntry] = useState<LoreEntryInput>(EMPTY_ENTRY)

  const addTriggerKey = () => {
    if (!triggerInput.trim()) return
    const keys = triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
    setNewEntry((prev) => ({
      ...prev,
      trigger_keys: Array.from(new Set([...prev.trigger_keys, ...keys])),
    }))
    setTriggerInput('')
  }

  const removeTriggerKey = (key: string) => {
    setNewEntry((prev) => ({
      ...prev,
      trigger_keys: prev.trigger_keys.filter((k) => k !== key),
    }))
  }

  const handleAddLoreEntry = () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) return
    // Also capture any uncommitted trigger keys currently in triggerInput
    const pendingKeys = triggerInput.trim()
      ? triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
      : []
    const finalTriggerKeys = Array.from(new Set([...newEntry.trigger_keys, ...pendingKeys]))

    setLoreEntries([...loreEntries, { ...newEntry, trigger_keys: finalTriggerKeys }])
    setNewEntry(EMPTY_ENTRY)
    setTriggerInput('')
  }

  const handleRemoveLoreEntry = (index: number) => {
    setLoreEntries(loreEntries.filter((_, i) => i !== index))
  }

  // Moves an attached entry back into the draft editor (keeping its id so it is updated, not duplicated)
  const handleEditLoreEntry = async (index: number) => {
    if (newEntry.title.trim() || newEntry.content.trim()) {
      const confirmed = await showConfirm('Discard the lore entry currently in the draft editor?')
      if (!confirmed) return
    }
    setNewEntry(loreEntries[index])
    setTriggerInput('')
    setLoreEntries(loreEntries.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validations
    if (!title.trim()) {
      showAlert({
        title: 'กรุณากรอกชื่อแคมเปญ',
        status: 'warning',
        badge: 'Campaign Title Required',
        message: 'กรุณาระบุชื่อสำหรับแคมเปญของคุณก่อนบันทึกข้อมูล',
      })
      return
    }

    if (title.trim().length > 100) {
      showAlert({
        title: 'ชื่อแคมเปญยาวเกินไป',
        status: 'warning',
        badge: 'Title Too Long',
        message: 'ชื่อแคมเปญต้องมีความยาวไม่เกิน 100 ตัวอักษร',
      })
      return
    }

    if (category === 'Custom' && !customCategory.trim()) {
      showAlert({
        title: 'กรุณาระบุชื่อหมวดหมู่ที่กำหนดเอง',
        status: 'warning',
        badge: 'Custom Genre Required',
        message: 'คุณได้เลือกหมวดหมู่เป็น Custom กรุณาระบุชื่อแนว/ธีมที่คุณต้องการในช่อง Custom Genre Name',
      })
      return
    }

    if (!worldSetting.trim()) {
      showAlert({
        title: 'กรุณากรอกข้อมูล World Setting',
        status: 'warning',
        badge: 'World Setting Required',
        message: 'กรุณาระบุสภาพแวดล้อม กฎเกณฑ์ หรือบรรยากาศของโลกในแคมเปญนี้อย่างน้อยพอสังเขป',
      })
      return
    }

    if (!coreDescription.trim()) {
      showAlert({
        title: 'กรุณากรอก Core Narrative',
        status: 'warning',
        badge: 'Core Narrative Required',
        message: 'กรุณาระบุคำอธิบายเนื้อเรื่องหลักหรือเป้าหมายของการผจญภัย เพื่อให้ AI DM นำไปดำเนินเรื่องได้อย่างแม่นยำ',
      })
      return
    }

    if (!selectedTemplate || !selectedTemplate.id) {
      showAlert({
        title: 'กรุณาเลือกรูปแบบแผ่นตัวละคร',
        status: 'warning',
        badge: 'Sheet Template Required',
        message: 'กรุณาเลือก Preset Template หรือ Custom Template ที่ต้องการให้ผู้เล่นในแคมเปญนี้ใช้',
      })
      return
    }

    // Check if user drafted an incomplete lore entry (one field filled but not the other)
    if ((newEntry.title.trim() && !newEntry.content.trim()) || (!newEntry.title.trim() && newEntry.content.trim())) {
      showAlert({
        title: 'ข้อมูลบันทึกลอว์บุ๊กไม่ครบถ้วน',
        status: 'warning',
        badge: 'Incomplete Lore Draft',
        message: 'คุณมีร่างบันทึกลอว์บุ๊กที่ยังกรอกไม่ครบ (ต้องมีทั้งหัวข้อและเนื้อหา) กรุณากรอกให้ครบหรือลบข้อความออกก่อนบันทึก',
      })
      return
    }

    setLoading(true)
    try {
      // If user filled in a lore draft but forgot to click "Attach Entry to Lorebook", include it
      const finalEntries = [...loreEntries]
      if (newEntry.title.trim() && newEntry.content.trim()) {
        const pendingKeys = triggerInput.trim()
          ? triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
          : []
        finalEntries.push({
          ...newEntry,
          trigger_keys: Array.from(new Set([...newEntry.trigger_keys, ...pendingKeys])),
        })
      }

      const payload = {
        title,
        category,
        custom_category: customCategory,
        world_setting: worldSetting,
        core_description: coreDescription,
        rule_mechanics: serializeRuleMechanics(ruleMechanicsList),
        sheet_template: selectedTemplate,
        loreEntries: finalEntries,
      }

      const res = isEdit
        ? await updateCampaign(campaignId, payload)
        : await createCampaign(payload)

      if (res?.success) {
        router.push(isEdit ? `/campaigns/${campaignId}` : '/hub')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : `เกิดข้อผิดพลาดในการ${isEdit ? 'บันทึกการแก้ไข' : 'สร้าง'}แคมเปญ กรุณาลองใหม่อีกครั้ง`
      showAlert({
        title: isEdit ? 'ไม่สามารถบันทึกแคมเปญได้' : 'ไม่สามารถสร้างแคมเปญได้',
        status: 'error',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-amber-500" /> {isEdit ? t('campaign.editTitle') : t('campaign.newTitle')}
            </h1>
            <p className="text-zinc-400 text-sm">Author your campaign universe and configure context triggers for the AI DM.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <LanguageToggle />
            <Link
            href="/hub"
            className="text-xs text-amber-500 hover:text-amber-400 underline"
          >
            {t('common.backToHub')}
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Campaign Overview */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">{t('campaign.foundation')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">{t('campaign.campaignTitle')}</label>
                <input
                  type="text"
                  required
                  placeholder="The Citadel of Ash"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">{t('campaign.genre')}</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const nextCat = e.target.value
                    setCategory(nextCat)
                    if (!isCustomTemplate) {
                      setSelectedTemplate(getPresetTemplateForCategory(nextCat))
                    }
                  }}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {category === 'Custom' && (
              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">{t('campaign.genreCustom')}</label>
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-400 uppercase font-medium">{t('campaign.coreBrief')}</label>
              <textarea
                required
                rows={3}
                placeholder="Brief summary of the overarching journey and party objectives..."
                value={coreDescription}
                onChange={(e) => setCoreDescription(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase font-medium">{t('campaign.worldSetting')}</label>
              <textarea
                required
                rows={3}
                placeholder="Geographic layout, political tensions, environmental tone..."
                value={worldSetting}
                onChange={(e) => setWorldSetting(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>

            {/* Rule Mechanics & Custom Systems (Structured like Skills & Inventory) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 uppercase flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {t('campaign.ruleMechanics')}
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {ruleMechanicsList.length} rule(s)
                </span>
              </div>

              <div className="space-y-3">
                {ruleMechanicsList.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-500 font-mono uppercase">
                        Rule #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        title="Remove rule"
                        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                          Rule Name :
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Sanity Meter, Perma-death..."
                          value={rule.title}
                          onChange={(e) => handleRuleChange(idx, 'title', e.target.value)}
                          className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                          Category / Tag :
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Survival, Combat..."
                          value={rule.category || ''}
                          onChange={(e) => handleRuleChange(idx, 'category', e.target.value)}
                          className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                          Description :
                        </label>
                        <input
                          type="text"
                          placeholder="Describe how this rule works..."
                          value={rule.description}
                          onChange={(e) => handleRuleChange(idx, 'description', e.target.value)}
                          className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {ruleMechanicsList.length === 0 && (
                  <p className="text-xs text-zinc-500 italic">
                    No custom rule mechanics added yet. Standard tabletop RPG rules apply. Click &quot;Add Rule Mechanic&quot; below to add custom rules.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddRule}
                className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> {t('campaign.addRule')}
              </button>
            </div>
          </div>

          {/* Section 2: Character Sheet Template Requirement */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-white">{t('campaign.requiredSheetTemplate')}</h2>
              </div>
              <span className="text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                {t('campaign.mandatoryFormat')}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Every player joining this campaign will play using this character sheet format. Choose a built-in genre preset or design your own custom sheet template.
            </p>

            {/* Built-in Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BUILTIN_TEMPLATES.map((preset) => {
                const isSelected = !isCustomTemplate && selectedTemplate.id === preset.id
                return (
                  <div
                    key={preset.id}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30'
                        : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                          {preset.name} <span className="text-[10px] text-zinc-500 font-mono font-normal">(โดย {preset.author || 'D&D Playground'})</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                        {preset.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                        {preset.resources.length > 0 ? (
                          preset.resources.map((r) => (
                            <span
                              key={r.id}
                              className="bg-zinc-900 border border-zinc-700/60 text-zinc-300 px-2 py-0.5 rounded"
                            >
                              {r.label}
                            </span>
                          ))
                        ) : (
                          <span className="bg-amber-950/60 border border-amber-800/80 text-amber-300 px-2 py-0.5 rounded font-medium">
                            0 Resource Bars (Item & Gear Only)
                          </span>
                        )}
                        <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          {preset.stats.length} Stats
                        </span>
                        <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          {preset.equipmentSlots.length} Gear Slots
                        </span>
                      </div>

                      <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplate(preset)
                            setIsCustomTemplate(false)
                          }}
                          className={`flex-1 py-1.5 px-2.5 text-xs rounded-lg font-medium transition cursor-pointer text-center ${
                            isSelected
                              ? 'bg-amber-600 text-white font-semibold shadow'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                          }`}
                        >
                          {isSelected ? t('campaign.selected') : t('campaign.selectPreset')}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const forked: CharacterTemplate = {
                              ...JSON.parse(JSON.stringify(preset)),
                              id: newTemplateId(),
                              name: `${preset.name} (Custom)`,
                            }
                            setSelectedTemplate(forked)
                            setIsCustomTemplate(true)
                            setIsTemplateModalOpen(true)
                          }}
                          className="flex items-center gap-1 py-1.5 px-2.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg transition cursor-pointer shrink-0"
                          title={`ปรับแต่งโดยใช้ ${preset.name} เป็นโครงสร้างเริ่มต้น`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{t('campaign.customizeFromPreset')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Custom Campaign Sheet Option */}
            <div
              onClick={() => {
                setIsCustomTemplate(true)
                if (!isCustomTemplate || isBuiltinTemplateId(selectedTemplate.id)) {
                  const blank = createEmptyTemplate(
                    title.trim() ? `${title.trim()} Sheet` : 'Custom Campaign Sheet'
                  )
                  setSelectedTemplate(blank)
                }
                setIsTemplateModalOpen(true)
              }}
              className={`p-4 rounded-xl border transition cursor-pointer ${
                isCustomTemplate
                  ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30'
                  : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      {t('campaign.customTemplate')}
                    </span>
                    {isCustomTemplate ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active Selection
                      </span>
                    ) : (
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded">
                        ชีทว่างเปล่า (Blank Canvas)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isCustomTemplate
                      ? `"${selectedTemplate.name}" (โดย ${selectedTemplate.author || 'Campaign Creator'}) — ${selectedTemplate.resources.length === 0 ? '0 Resource Bars (Item-Only)' : `${selectedTemplate.resources.length} resources`}, ${selectedTemplate.stats.length} stats, ${selectedTemplate.equipmentSlots.length} equipment slots, ${selectedTemplate.conditions.length} conditions.`
                      : 'ออกแบบโครงสร้างแผ่นตัวละครด้วยตัวเอง เริ่มต้นจากชีทว่างเปล่าโดยไม่มีสเตตัสหรือหลอดพลังงานค้างไว้ (สามารถใส่เฉพาะไอเทม หรือสเตตัสเฉพาะตามใจชอบ)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCustomTemplate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const blank = createEmptyTemplate(
                          title.trim() ? `${title.trim()} Sheet` : 'Custom Campaign Sheet'
                        )
                        setSelectedTemplate(blank)
                        setIsCustomTemplate(true)
                        setIsTemplateModalOpen(true)
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition cursor-pointer border border-zinc-700"
                      title="Reset to a blank sheet canvas"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Reset to Blank' : 'ล้างเป็นชีทว่างใหม่'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCustomTemplate(true)
                      if (!isCustomTemplate || isBuiltinTemplateId(selectedTemplate.id)) {
                        const blank = createEmptyTemplate(
                          title.trim() ? `${title.trim()} Sheet` : 'Custom Campaign Sheet'
                        )
                        setSelectedTemplate(blank)
                      }
                      setIsTemplateModalOpen(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition font-medium cursor-pointer shadow"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{isCustomTemplate ? t('campaign.editInBuilder') : t('campaign.createBlankSheet')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Lorebook Registry */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-white">Dynamic Lorebook Registry</h2>
            </div>
            <p className="text-xs text-zinc-400">
              Entries are dynamically injected into the AI context window when keyword triggers match player input actions or recent turns.
            </p>

            {/* List Existing Entries */}
            {loreEntries.length > 0 && (
              <div className="space-y-3">
                {loreEntries.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{entry.title}</span>
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{entry.category}</span>
                        <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800">
                          {entry.activation_mode}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{entry.content}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.trigger_keys.map((k) => (
                          <span key={k} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditLoreEntry(idx)}
                        title="Edit entry"
                        className="text-zinc-500 hover:text-amber-400 p-1 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLoreEntry(idx)}
                        title="Remove entry"
                        className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Lore Entry Draft */}
            <div className="border border-dashed border-zinc-800 rounded-lg p-4 space-y-4 bg-zinc-950/40">
              <span className="text-xs font-semibold uppercase text-zinc-400">Add Lore Entry</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    placeholder="Entry Title (e.g. Order of the Sun)"
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <select
                    value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value as LoreCategory })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  >
                    {LORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <select
                    value={newEntry.activation_mode}
                    onChange={(e) => setNewEntry({ ...newEntry, activation_mode: e.target.value as ActivationMode })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  >
                    {ACTIVATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  placeholder="Lore details, behavioral traits, or hidden secrets..."
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                />
              </div>

              {/* Keyword Trigger Chips */}
              {(newEntry.activation_mode === 'Keyword Triggered' ||
                newEntry.activation_mode === 'Secret / DM-Only') && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={
                        newEntry.activation_mode === 'Secret / DM-Only'
                          ? 'Optional keywords (leave blank to always send to AI DM)'
                          : 'Add comma-separated keywords (e.g. paladin, dawn, solar)'
                      }
                      value={triggerInput}
                      onChange={(e) => setTriggerInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTriggerKey(); } }}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={addTriggerKey}
                      className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs rounded text-zinc-200 cursor-pointer"
                    >
                      Add Keys
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {newEntry.trigger_keys.map((k) => (
                      <span
                        key={k}
                        onClick={() => removeTriggerKey(k)}
                        className="inline-flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-red-950 hover:text-red-300 text-zinc-300 px-2 py-0.5 rounded cursor-pointer"
                      >
                        {k} &times;
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddLoreEntry}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium rounded flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Attach Entry to Lorebook
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? (isEdit ? t('common.saving') : (language === 'en' ? 'Creating Campaign...' : 'กำลังสร้างแคมเปญ...'))
              : (isEdit ? t('campaign.saveChanges') : t('campaign.createCampaign'))}
          </button>
        </form>

        {/* Template Modal for Custom Campaign Sheet */}
        <TemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          currentTemplate={selectedTemplate}
          onApplyTemplate={(newTpl) => {
            setSelectedTemplate(newTpl)
            setIsCustomTemplate(true)
            setIsTemplateModalOpen(false)
          }}
        />
      </div>
    </div>
  )
}