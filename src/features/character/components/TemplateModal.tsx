'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Download, Sliders, Upload, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  BUILTIN_TEMPLATES,
  decodeTemplateKey,
  isBuiltinTemplateId,
  newTemplateId,
  sanitizeTemplate,
  type CharacterTemplate,
} from '../template'
import TemplateBuilderTab from './TemplateBuilderTab'
import { TemplateExportTab, TemplateImportTab } from './TemplateKeyTabs'

type TemplateModalTab = 'customize' | 'export' | 'import'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  currentTemplate: CharacterTemplate
  onApplyTemplate: (template: CharacterTemplate) => void
}

// Deep copy so edits in the builder never touch the sheet's live template
function cloneTemplate(template: CharacterTemplate): CharacterTemplate {
  return JSON.parse(JSON.stringify(template))
}

export default function TemplateModal({
  isOpen,
  onClose,
  currentTemplate,
  onApplyTemplate,
}: TemplateModalProps) {
  const { t, language } = useLanguage()
  const [tab, setTab] = useState<TemplateModalTab>('customize')

  // Working copy of the template being edited in the visual builder
  const [workingTemplate, setWorkingTemplate] = useState<CharacterTemplate>(() =>
    cloneTemplate(currentTemplate),
  )

  // Import State (kept here so it survives switching tabs)
  const [importInput, setImportInput] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CharacterTemplate | null>(null)

  // Sync workingTemplate when modal opens
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setWorkingTemplate(cloneTemplate(currentTemplate))
      setImportInput('')
      setImportError(null)
      setPreviewTemplate(null)
    })

    return () => {
      cancelled = true
    }
  }, [isOpen, currentTemplate])

  if (!isOpen) return null

  const handleApplyCustomization = () => {
    let toApply = { ...workingTemplate }
    if (isBuiltinTemplateId(toApply.id)) {
      // Fork from built-in preset to custom template
      const isUntouchedName = BUILTIN_TEMPLATES.some(
        (b) => b.id === toApply.id && b.name === toApply.name,
      )
      toApply = {
        ...toApply,
        id: newTemplateId(),
        name: isUntouchedName ? `${toApply.name} (Custom)` : toApply.name,
      }
    }
    const sanitized = sanitizeTemplate(toApply)
    if (sanitized) {
      onApplyTemplate(sanitized)
      onClose()
    }
  }

  const handleParseImport = async () => {
    setImportError(null)
    setPreviewTemplate(null)
    if (!importInput.trim()) {
      setImportError('กรุณาวาง Template Key ก่อนนำเข้า (Please paste a template key first)')
      return
    }
    try {
      const decoded = await decodeTemplateKey(importInput)
      setPreviewTemplate(decoded)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'รูปแบบ Template Key ไม่ถูกต้อง (Invalid template key)',
      )
    }
  }

  const handleConfirmImport = () => {
    if (previewTemplate) {
      onApplyTemplate(previewTemplate)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/40 bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-white">Character Sheet Template</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800/40 bg-zinc-900/20 px-6 gap-2 pt-2">
          <TabButton isActive={tab === 'customize'} onClick={() => setTab('customize')}>
            <Sliders className="w-3.5 h-3.5" />
            ปรับแต่งโครงสร้าง (Customize)
          </TabButton>
          <TabButton isActive={tab === 'export'} onClick={() => setTab('export')}>
            <Upload className="w-3.5 h-3.5" />
            ส่งออกรหัส (Export Key)
          </TabButton>
          <TabButton isActive={tab === 'import'} onClick={() => setTab('import')}>
            <Download className="w-3.5 h-3.5" />
            นำเข้ารหัส (Import Key)
          </TabButton>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'customize' && (
            <TemplateBuilderTab template={workingTemplate} onChange={setWorkingTemplate} />
          )}
          {tab === 'export' && <TemplateExportTab template={workingTemplate} />}
          {tab === 'import' && (
            <TemplateImportTab
              input={importInput}
              error={importError}
              preview={previewTemplate}
              onInputChange={setImportInput}
              onPreview={handleParseImport}
              onConfirm={handleConfirmImport}
            />
          )}
        </div>

        {/* Footer */}
        {tab === 'customize' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/40 bg-zinc-900/40">
            <span className="text-[11px] text-zinc-500 font-mono">
              {workingTemplate.stats.length} Stats, {workingTemplate.resources.length} Bars
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleApplyCustomization}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow"
              >
                {language === 'en' ? 'Apply Template' : 'บันทึกการปรับแต่ง (Apply)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
        isActive
          ? 'border-amber-500 text-amber-400 font-semibold'
          : 'border-transparent text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
