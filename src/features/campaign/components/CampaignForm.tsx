'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { createCampaign, updateCampaign, type LoreEntryInput } from '../actions'
import {
  createEmptyTemplate,
  extractCampaignTemplate,
  getPresetTemplateForCategory,
  isBuiltinTemplateId,
  newTemplateId,
  stripCampaignTemplateFromRules,
  type CharacterTemplate,
} from '@/features/character/template'
import {
  parseRuleMechanics,
  serializeRuleMechanics,
  type CampaignRuleMechanic,
} from '@/features/campaign/rules'
import TemplateModal from '@/features/character/components/TemplateModal'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import CampaignFoundationSection, { type CampaignFoundationValues } from './CampaignFoundationSection'
import CampaignTemplatePicker from './CampaignTemplatePicker'
import { LorebookRegistrySection, useLorebookDraft } from './CampaignLorebookEditor'

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

type ValidationAlert = { title: string; badge: string; message: string }

// Client-side validations, in the order the user should fix them
function validateCampaignForm(
  values: CampaignFoundationValues,
  template: CharacterTemplate | null,
  isLoreDraftIncomplete: boolean,
): ValidationAlert | null {
  const title = values.title.trim()
  if (!title || title.length < 2) {
    return {
      title: 'ชื่อแคมเปญสั้นเกินไป',
      badge: 'Title Too Short',
      message: 'ชื่อแคมเปญต้องมีความยาวระหว่าง 2 ถึง 100 ตัวอักษร',
    }
  }
  if (title.length > 100) {
    return {
      title: 'ชื่อแคมเปญยาวเกินไป',
      badge: 'Title Too Long',
      message: 'ชื่อแคมเปญต้องมีความยาวไม่เกิน 100 ตัวอักษร',
    }
  }
  if (values.category === 'Custom' && !values.customCategory.trim()) {
    return {
      title: 'กรุณาระบุชื่อหมวดหมู่ที่กำหนดเอง',
      badge: 'Custom Genre Required',
      message:
        'คุณได้เลือกหมวดหมู่เป็น Custom กรุณาระบุชื่อแนว/ธีมที่คุณต้องการในช่อง Custom Genre Name',
    }
  }
  if (!values.worldSetting.trim()) {
    return {
      title: 'กรุณากรอกข้อมูล World Setting',
      badge: 'World Setting Required',
      message: 'กรุณาระบุสภาพแวดล้อม กฎเกณฑ์ หรือบรรยากาศของโลกในแคมเปญนี้อย่างน้อยพอสังเขป',
    }
  }
  if (!values.coreDescription.trim()) {
    return {
      title: 'กรุณากรอก Core Narrative',
      badge: 'Core Narrative Required',
      message:
        'กรุณาระบุคำอธิบายเนื้อเรื่องหลักหรือเป้าหมายของการผจญภัย เพื่อให้ AI DM นำไปดำเนินเรื่องได้อย่างแม่นยำ',
    }
  }
  if (!template || !template.id) {
    return {
      title: 'กรุณาเลือกรูปแบบแผ่นตัวละคร',
      badge: 'Sheet Template Required',
      message: 'กรุณาเลือก Preset Template หรือ Custom Template ที่ต้องการให้ผู้เล่นในแคมเปญนี้ใช้',
    }
  }
  // A drafted lore entry with only one of title/content filled in
  if (isLoreDraftIncomplete) {
    return {
      title: 'ข้อมูลบันทึกลอว์บุ๊กไม่ครบถ้วน',
      badge: 'Incomplete Lore Draft',
      message:
        'คุณมีร่างบันทึกลอว์บุ๊กที่ยังกรอกไม่ครบ (ต้องมีทั้งหัวข้อและเนื้อหา) กรุณากรอกให้ครบหรือลบข้อความออกก่อนบันทึก',
    }
  }
  return null
}

export default function CampaignForm({ mode, campaignId, initial }: CampaignFormProps) {
  const router = useRouter()
  const { showAlert } = useAlert()
  const { t, language } = useLanguage()
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)

  const [foundation, setFoundation] = useState<CampaignFoundationValues>({
    title: initial?.title ?? '',
    category: initial?.category || 'Fantasy',
    customCategory: initial?.custom_category ?? '',
    worldSetting: initial?.world_setting ?? '',
    coreDescription: initial?.core_description ?? '',
  })
  const [ruleMechanicsList, setRuleMechanicsList] = useState<CampaignRuleMechanic[]>(() => {
    return parseRuleMechanics(stripCampaignTemplateFromRules(initial?.rule_mechanics))
  })

  const initialTpl =
    initial?.sheet_template ??
    extractCampaignTemplate({
      category: initial?.category || 'Fantasy',
      rule_mechanics: initial?.rule_mechanics,
    })
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate>(initialTpl)
  const [isCustomTemplate, setIsCustomTemplate] = useState<boolean>(!isBuiltinTemplateId(initialTpl.id))
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  const lorebook = useLorebookDraft(initial?.loreEntries ?? [])

  const handleFoundationChange = (patch: Partial<CampaignFoundationValues>) => {
    setFoundation((prev) => ({ ...prev, ...patch }))
    // Changing genre follows its preset sheet unless the campaign uses a custom sheet
    if (patch.category !== undefined && !isCustomTemplate) {
      setSelectedTemplate(getPresetTemplateForCategory(patch.category))
    }
  }

  /* ---------------- Sheet template choices ---------------- */

  const blankTemplateName = () =>
    foundation.title.trim() ? `${foundation.title.trim()} Sheet` : 'Custom Campaign Sheet'

  const handleSelectPreset = (preset: CharacterTemplate) => {
    setSelectedTemplate(preset)
    setIsCustomTemplate(false)
  }

  // Fork a preset into a custom template and open it in the builder
  const handleCustomizePreset = (preset: CharacterTemplate) => {
    const forked: CharacterTemplate = {
      ...JSON.parse(JSON.stringify(preset)),
      id: newTemplateId(),
      name: `${preset.name} (Custom)`,
    }
    setSelectedTemplate(forked)
    setIsCustomTemplate(true)
    setIsTemplateModalOpen(true)
  }

  // Open the builder on the current custom sheet, starting a blank one if none exists yet
  const handleStartCustom = () => {
    setIsCustomTemplate(true)
    if (!isCustomTemplate || isBuiltinTemplateId(selectedTemplate.id)) {
      setSelectedTemplate(createEmptyTemplate(blankTemplateName()))
    }
    setIsTemplateModalOpen(true)
  }

  const handleResetToBlank = () => {
    setSelectedTemplate(createEmptyTemplate(blankTemplateName()))
    setIsCustomTemplate(true)
    setIsTemplateModalOpen(true)
  }

  /* ---------------- Submit ---------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const invalid = validateCampaignForm(foundation, selectedTemplate, lorebook.isDraftIncomplete)
    if (invalid) {
      showAlert({ ...invalid, status: 'warning' })
      return
    }

    setLoading(true)
    try {
      const payload = {
        title: foundation.title,
        category: foundation.category,
        custom_category: foundation.customCategory,
        world_setting: foundation.worldSetting,
        core_description: foundation.coreDescription,
        rule_mechanics: serializeRuleMechanics(ruleMechanicsList),
        sheet_template: selectedTemplate,
        // A complete lore draft the user forgot to attach is saved too
        loreEntries: lorebook.entriesForSubmit(),
      }

      const res = isEdit ? await updateCampaign(campaignId, payload) : await createCampaign(payload)

      if (res?.success) {
        router.push(isEdit ? `/campaigns/${campaignId}` : '/hub')
        router.refresh()
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
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

  const submitLabel = loading
    ? isEdit
      ? t('common.saving')
      : language === 'en'
        ? 'Creating Campaign...'
        : 'กำลังสร้างแคมเปญ...'
    : isEdit
      ? t('campaign.saveChanges')
      : t('campaign.createCampaign')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/40 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500/90" />{' '}
              {isEdit ? t('campaign.editTitle') : t('campaign.newTitle')}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm">
              {t('campaign.campaignSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <LanguageToggle />
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('common.backToHub')}</span>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <CampaignFoundationSection
            values={foundation}
            onChange={handleFoundationChange}
            rules={ruleMechanicsList}
            onRulesChange={setRuleMechanicsList}
          />

          <CampaignTemplatePicker
            selectedTemplate={selectedTemplate}
            isCustomTemplate={isCustomTemplate}
            onSelectPreset={handleSelectPreset}
            onCustomizePreset={handleCustomizePreset}
            onStartCustom={handleStartCustom}
            onResetToBlank={handleResetToBlank}
          />

          <LorebookRegistrySection lorebook={lorebook} />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 font-semibold rounded-xl text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer shadow-md"
          >
            {submitLabel}
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
