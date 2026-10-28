'use client'

import React, { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  X,
  Copy,
  Check,
  Download,
  Upload,
  Sliders,
  Plus,
  Trash2,
  Sparkles,
  Heart,
  Package,
  FileText,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import {
  RESOURCE_COLORS,
  makeFieldId,
  encodeTemplateKey,
  decodeTemplateKey,
  sanitizeTemplate,
  isBuiltinTemplateId,
  newTemplateId,
  BUILTIN_TEMPLATES,
  DEFAULT_MECHANICS,
  type CharacterTemplate,
  type ResourceColor,
  type TemplateStat,
  type TemplateResource,
  type TemplateTextField,
  type TemplateEquipmentSlot,
  type TemplateMechanics,
  type TemplateMode,
  type TemplateDice,
  type TemplateStatModifier,
} from '../template'

type TemplateModalTab = 'customize' | 'export' | 'import'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  currentTemplate: CharacterTemplate
  onApplyTemplate: (template: CharacterTemplate) => void
}

const COLOR_MAP: Record<ResourceColor, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500' },
  zinc: { bg: 'bg-zinc-500', text: 'text-zinc-400', border: 'border-zinc-500' },
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
    JSON.parse(JSON.stringify(currentTemplate))
  )

  // Working mechanics fallback
  const currentMechanics = workingTemplate.mechanics ?? DEFAULT_MECHANICS

  // Export State
  const [exportKey, setExportKey] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Import State
  const [importInput, setImportInput] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<CharacterTemplate | null>(null)

  // New condition input
  const [newCondition, setNewCondition] = useState('')

  // Sync workingTemplate when modal opens
  React.useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setWorkingTemplate(JSON.parse(JSON.stringify(currentTemplate)))
      setImportInput('')
      setImportError(null)
      setPreviewTemplate(null)
      setCopied(false)
    })

    return () => {
      cancelled = true
    }
  }, [isOpen, currentTemplate])

  // Generate export key on tab switch
  React.useEffect(() => {
    if (tab === 'export') {
      Promise.resolve().then(() => setIsExporting(true))
      encodeTemplateKey(workingTemplate)
        .then((key) => {
          setExportKey(key)
        })
        .catch((err) => {
          setExportKey(err instanceof Error ? err.message : 'Error generating key')
        })
        .finally(() => setIsExporting(false))
    }
  }, [tab, workingTemplate])

  if (!isOpen) return null

  // ---------------------------------------------------------------------------------
  // Visual Builder Actions
  // ---------------------------------------------------------------------------------

  const handleAddStat = () => {
    const takenIds = workingTemplate.stats.map((s) => s.id)
    const newId = makeFieldId('New Stat', takenIds)
    const newStat: TemplateStat = {
      id: newId,
      label: 'New Stat',
      min: null,
      max: null,
      default: 10,
    }
    setWorkingTemplate({
      ...workingTemplate,
      stats: [...workingTemplate.stats, newStat],
    })
  }

  const handleUpdateStat = (index: number, updates: Partial<TemplateStat>) => {
    const nextStats = [...workingTemplate.stats]
    nextStats[index] = { ...nextStats[index], ...updates }
    setWorkingTemplate({ ...workingTemplate, stats: nextStats })
  }

  const handleRemoveStat = (index: number) => {
    setWorkingTemplate({
      ...workingTemplate,
      stats: workingTemplate.stats.filter((_, i) => i !== index),
    })
  }

  const handleAddResource = () => {
    const takenIds = workingTemplate.resources.map((r) => r.id)
    const newId = makeFieldId('Resource', takenIds)
    const newRes: TemplateResource = {
      id: newId,
      label: 'Energy',
      defaultMax: 20,
      color: 'amber',
    }
    setWorkingTemplate({
      ...workingTemplate,
      resources: [...workingTemplate.resources, newRes],
    })
  }

  const handleUpdateResource = (index: number, updates: Partial<TemplateResource>) => {
    const next = [...workingTemplate.resources]
    next[index] = { ...next[index], ...updates }
    setWorkingTemplate({ ...workingTemplate, resources: next })
  }

  const handleUpdateMechanics = (updates: Partial<TemplateMechanics>) => {
    setWorkingTemplate({
      ...workingTemplate,
      mechanics: {
        ...(workingTemplate.mechanics ?? DEFAULT_MECHANICS),
        ...updates,
      },
    })
  }

  const handleRemoveResource = (index: number) => {
    const removed = workingTemplate.resources[index]
    const nextResources = workingTemplate.resources.filter((_, i) => i !== index)
    const currentVitality = workingTemplate.mechanics?.vitalityResourceId
    const nextVitalityId =
      currentVitality === removed?.id
        ? nextResources.find((r) => r.id === 'hp')?.id ?? nextResources[0]?.id ?? null
        : currentVitality ?? null

    setWorkingTemplate({
      ...workingTemplate,
      resources: nextResources,
      mechanics: {
        ...(workingTemplate.mechanics ?? DEFAULT_MECHANICS),
        vitalityResourceId: nextVitalityId,
      },
    })
  }

  const handleAddTextField = () => {
    const takenIds = workingTemplate.textFields.map((f) => f.id)
    const newId = makeFieldId('Custom Field', takenIds)
    const newField: TemplateTextField = {
      id: newId,
      label: 'New Field',
      placeholder: 'Enter details...',
      rows: 2,
    }
    setWorkingTemplate({
      ...workingTemplate,
      textFields: [...workingTemplate.textFields, newField],
    })
  }

  const handleUpdateTextField = (index: number, updates: Partial<TemplateTextField>) => {
    const next = [...workingTemplate.textFields]
    next[index] = { ...next[index], ...updates }
    setWorkingTemplate({ ...workingTemplate, textFields: next })
  }

  const handleRemoveTextField = (index: number) => {
    setWorkingTemplate({
      ...workingTemplate,
      textFields: workingTemplate.textFields.filter((_, i) => i !== index),
    })
  }

  const handleAddEquipmentSlot = () => {
    const takenIds = workingTemplate.equipmentSlots.map((s) => s.id)
    const newId = makeFieldId('Slot', takenIds)
    const newSlot: TemplateEquipmentSlot = {
      id: newId,
      label: 'Accessory',
    }
    setWorkingTemplate({
      ...workingTemplate,
      equipmentSlots: [...workingTemplate.equipmentSlots, newSlot],
    })
  }

  const handleUpdateEquipmentSlot = (index: number, updates: Partial<TemplateEquipmentSlot>) => {
    const next = [...workingTemplate.equipmentSlots]
    next[index] = { ...next[index], ...updates }
    setWorkingTemplate({ ...workingTemplate, equipmentSlots: next })
  }

  const handleRemoveEquipmentSlot = (index: number) => {
    setWorkingTemplate({
      ...workingTemplate,
      equipmentSlots: workingTemplate.equipmentSlots.filter((_, i) => i !== index),
    })
  }

  const handleAddCondition = () => {
    const trimmed = newCondition.trim()
    if (!trimmed || workingTemplate.conditions.includes(trimmed)) return
    setWorkingTemplate({
      ...workingTemplate,
      conditions: [...workingTemplate.conditions, trimmed],
    })
    setNewCondition('')
  }

  const handleRemoveCondition = (index: number) => {
    setWorkingTemplate({
      ...workingTemplate,
      conditions: workingTemplate.conditions.filter((_, i) => i !== index),
    })
  }

  const handleApplyCustomization = () => {
    let toApply = { ...workingTemplate }
    if (isBuiltinTemplateId(toApply.id)) {
      // Fork from built-in preset to custom template
      const isUntouchedName = BUILTIN_TEMPLATES.some((b) => b.id === toApply.id && b.name === toApply.name)
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

  // ---------------------------------------------------------------------------------
  // Import Flow
  // ---------------------------------------------------------------------------------

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
      setImportError(err instanceof Error ? err.message : 'รูปแบบ Template Key ไม่ถูกต้อง (Invalid template key)')
    }
  }

  const handleConfirmImport = () => {
    if (previewTemplate) {
      onApplyTemplate(previewTemplate)
      onClose()
    }
  }

  // ---------------------------------------------------------------------------------
  // Copy Export Key
  // ---------------------------------------------------------------------------------

  const handleCopyKey = async () => {
    if (!exportKey) return
    try {
      await navigator.clipboard.writeText(exportKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
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
          <button
            onClick={() => setTab('customize')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              tab === 'customize'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            ปรับแต่งโครงสร้าง (Customize)
          </button>

          <button
            onClick={() => setTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              tab === 'export'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            ส่งออกรหัส (Export Key)
          </button>

          <button
            onClick={() => setTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer ${
              tab === 'import'
                ? 'border-amber-500 text-amber-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            นำเข้ารหัส (Import Key)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'customize' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-zinc-400">
                  กำหนดโครงสร้างสเตตัส หลอดพลัง และช่องสวมใส่ตามที่คุณต้องการ
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWorkingTemplate({
                      ...workingTemplate,
                      resources: [],
                      stats: [],
                      equipmentSlots: [],
                      conditions: ['Normal'],
                      textFields: [],
                    })
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition cursor-pointer border border-zinc-700/80 shadow-sm"
                  title="Clear all fields to a blank canvas"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Start from Blank Sheet' : 'ล้างเป็นชีทว่าง (Start from Blank)'}</span>
                </button>
              </div>

              {isBuiltinTemplateId(workingTemplate.id) && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      คุณกำลังปรับแต่งจากเทมเพลตเริ่มต้น: <strong>{workingTemplate.name}</strong> (เมื่อบันทึก ระบบจะแปลงเป็นชีท Custom ให้อัตโนมัติ)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/60 shrink-0 font-medium">
                    Fork to Custom
                  </span>
                </div>
              )}

              {/* Template Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-xl border border-zinc-800/70">
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400">Template Name</label>
                  <input
                    type="text"
                    value={workingTemplate.name}
                    onChange={(e) => setWorkingTemplate({ ...workingTemplate, name: e.target.value })}
                    placeholder="e.g., Romance / Slice of Life"
                    className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400">Author</label>
                  <input
                    type="text"
                    value={workingTemplate.author}
                    onChange={(e) => setWorkingTemplate({ ...workingTemplate, author: e.target.value })}
                    placeholder="Author name"
                    className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] font-mono uppercase text-zinc-400">Description</label>
                  <input
                    type="text"
                    value={workingTemplate.description}
                    onChange={(e) =>
                      setWorkingTemplate({ ...workingTemplate, description: e.target.value })
                    }
                    placeholder="Brief description of this template's theme and rules..."
                    className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Rules & Mechanics (AI DM Profile) */}
              <div className="space-y-3 p-4 bg-black/30 border border-zinc-800/70 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase text-zinc-300">
                    Rules & Mechanics / กติกาและกลไก (AI DM Profile)
                  </h3>
                </div>
                <p className="text-[11px] text-zinc-400">
                  กำหนดรูปแบบการตัดสินและกลไกของ AI ให้เข้ากับแนวของแคมเปญ (เช่น ต่อสู้, โรแมนติก, เนื้อเรื่อง/สืบสวน หรือสยองขวัญ)
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Mode */}
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                      Gameplay Mode (โหมดการเล่น)
                    </label>
                    <select
                      value={currentMechanics.mode}
                      onChange={(e) => handleUpdateMechanics({ mode: e.target.value as TemplateMode })}
                      className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 cursor-pointer transition-all"
                    >
                      <option value="combat">Combat RPG (ต่อสู้ / แอ็กชันแฟนตาซี)</option>
                      <option value="narrative">Narrative / Mystery (เน้นเนื้อเรื่อง / สืบสวน / ไอเทม)</option>
                      <option value="social">Social / Romance (โรแมนติก / บทสนทนา / ความรู้สึก)</option>
                      <option value="horror">Horror / Survival (สยองขวัญ / สติสัมปชัญญะ / เอาชีวิตรอด)</option>
                    </select>
                  </div>

                  {/* Vitality Resource Picker */}
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                      Vitality Resource (หลอดพลังชีวิตหลัก)
                    </label>
                    <select
                      value={currentMechanics.vitalityResourceId ?? ''}
                      onChange={(e) =>
                        handleUpdateMechanics({
                          vitalityResourceId: e.target.value ? e.target.value : null,
                        })
                      }
                      className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 cursor-pointer transition-all"
                    >
                      <option value="">ไม่มีหลอดเลือด (No Damage System)</option>
                      {workingTemplate.resources.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.label || res.id} (ID: {res.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dice System */}
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                      Dice System (ระบบลูกเต๋า)
                    </label>
                    <select
                      value={currentMechanics.dice}
                      onChange={(e) => handleUpdateMechanics({ dice: e.target.value as TemplateDice })}
                      className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 cursor-pointer transition-all"
                    >
                      <option value="d20">d20 System (D&D / Standard d20)</option>
                      <option value="2d6">2d6 System (PbtA / City of Mist)</option>
                      <option value="d100">d100 System (Call of Cthulhu)</option>
                      <option value="none">No Dice (บทบาทสมมติล้วน / ไม่ใช้เต๋า)</option>
                    </select>
                  </div>

                  {/* Stat Modifier Formula */}
                  <div>
                    <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                      Stat Modifier (สูตรโบนัสสเตตัส)
                    </label>
                    <select
                      value={currentMechanics.statModifier}
                      onChange={(e) =>
                        handleUpdateMechanics({ statModifier: e.target.value as TemplateStatModifier })
                      }
                      className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 cursor-pointer transition-all"
                    >
                      <option value="dnd">D&D 5e Formula: (Score - 10) / 2</option>
                      <option value="raw">Direct Score: +Score (สำหรับสเกล 1-5 หรือ ±3)</option>
                      <option value="none">No Modifier: +0 (ทอยเพียว / d100 roll under)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Resource Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-red-500" />
                    <h3 className="text-xs font-semibold uppercase text-zinc-300">
                      Resource Bars (หลอดพลัง/เลือด)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddResource}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มหลอดพลัง
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workingTemplate.resources.length === 0 && (
                    <div className="col-span-full p-4 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
                      ไม่มีหลอดพลัง (0 Resource Bars — เหมาะสำหรับแนวเน้นเนื้อเรื่อง ไอเทม หรือแนวสืบสวน)
                    </div>
                  )}
                  {workingTemplate.resources.map((res, idx) => (
                    <div
                      key={res.id}
                      className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          ID: {res.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveResource(idx)}
                          className="text-zinc-500 hover:text-red-400 transition cursor-pointer"
                          title="ลบหลอดพลังนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-400 font-mono">Label</label>
                          <input
                            type="text"
                            value={res.label}
                            onChange={(e) => handleUpdateResource(idx, { label: e.target.value })}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-mono">Def Max</label>
                          <input
                            type="number"
                            min={0}
                            value={res.defaultMax}
                            onChange={(e) =>
                              handleUpdateResource(idx, { defaultMax: Number(e.target.value) || 0 })
                            }
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-mono block mb-1">Color</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {RESOURCE_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateResource(idx, { color: c })}
                              className={`w-5 h-5 rounded-full ${COLOR_MAP[c].bg} transition cursor-pointer ${
                                res.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110' : 'opacity-60 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-semibold uppercase text-zinc-300">
                      Stats / Attributes (ค่าสถานะ)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStat}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มสเตตัส
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workingTemplate.stats.length === 0 && (
                    <div className="col-span-full p-4 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
                      ไม่มีค่าสถานะแยกย่อย (0 Stats)
                    </div>
                  )}
                  {workingTemplate.stats.map((stat, idx) => (
                    <div
                      key={stat.id}
                      className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          ID: {stat.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStat(idx)}
                          className="text-zinc-500 hover:text-red-400 transition cursor-pointer"
                          title="ลบค่าสถานะนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-400 font-mono">Label</label>
                          <input
                            type="text"
                            value={stat.label}
                            onChange={(e) => handleUpdateStat(idx, { label: e.target.value })}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-mono">Default</label>
                          <input
                            type="number"
                            value={stat.default}
                            onChange={(e) =>
                              handleUpdateStat(idx, { default: Number(e.target.value) || 0 })
                            }
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                        <div>
                          <label className="font-mono">Min (ว่าง = ไม่มีจำกัด)</label>
                          <input
                            type="number"
                            value={stat.min ?? ''}
                            placeholder="None"
                            onChange={(e) =>
                              handleUpdateStat(idx, {
                                min: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white text-center font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-mono">Max (ว่าง = ไม่มีจำกัด)</label>
                          <input
                            type="number"
                            value={stat.max ?? ''}
                            placeholder="None"
                            onChange={(e) =>
                              handleUpdateStat(idx, {
                                max: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Text Fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-semibold uppercase text-zinc-300">
                      Text & Bio Fields (ช่องข้อความ / ข้อมูลภูมิหลัง)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTextField}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มช่องข้อความ
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workingTemplate.textFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          ID: {field.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTextField(idx)}
                          className="text-zinc-500 hover:text-red-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-400 font-mono">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateTextField(idx, { label: e.target.value })}
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 font-mono">Rows</label>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={field.rows}
                            onChange={(e) =>
                              handleUpdateTextField(idx, {
                                rows: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
                              })
                            }
                            className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white text-center font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 font-mono">Placeholder</label>
                        <input
                          type="text"
                          value={field.placeholder}
                          onChange={(e) =>
                            handleUpdateTextField(idx, { placeholder: e.target.value })
                          }
                          className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-zinc-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment Slots */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-semibold uppercase text-zinc-300">
                      Equipment Slots (ช่องสวมใส่)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEquipmentSlot}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มช่องสวมใส่
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {workingTemplate.equipmentSlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2"
                    >
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) =>
                          handleUpdateEquipmentSlot(idx, { label: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEquipmentSlot(idx)}
                        className="text-zinc-500 hover:text-red-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-zinc-300">
                  Status Conditions (สถานะผิดปกติ)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {workingTemplate.conditions.map((cond, idx) => (
                    <span
                      key={cond}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-200"
                    >
                      {cond}
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(idx)}
                        className="text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCondition()
                      }
                    }}
                    placeholder="พิมพ์สถานะใหม่แล้วกด Enter หรือกดเพิ่ม..."
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    + เพิ่ม
                  </button>
                </div>
              </div>

              {/* Sections Toggles */}
              <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex flex-wrap gap-6 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workingTemplate.sections.skills}
                    onChange={(e) =>
                      setWorkingTemplate({
                        ...workingTemplate,
                        sections: { ...workingTemplate.sections, skills: e.target.checked },
                      })
                    }
                    className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                  />
                  <span className="text-zinc-200">เปิดใช้งานหมวดสกิล (Skills Section)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workingTemplate.sections.inventory}
                    onChange={(e) =>
                      setWorkingTemplate({
                        ...workingTemplate,
                        sections: { ...workingTemplate.sections, inventory: e.target.checked },
                      })
                    }
                    className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                  />
                  <span className="text-zinc-200">เปิดใช้งานกระเป๋าสัมภาระ (Inventory Section)</span>
                </label>
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 leading-relaxed">
                คัดลอกรหัส Share Key นี้เพื่อส่งให้เพื่อนหรือบันทึกเก็บไว้และใช้ Import
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  rows={6}
                  value={isExporting ? 'กำลังสร้างรหัส Share Key...' : exportKey}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 font-mono text-[11px] text-amber-300 outline-none select-all break-all"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-zinc-500 font-mono">
                  {exportKey ? `${exportKey.length} ตัวอักษร` : ''}
                </span>

                <button
                  type="button"
                  onClick={handleCopyKey}
                  disabled={!exportKey || isExporting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'คัดลอกรหัสแล้ว!' : 'คัดลอก Template Key'}
                </button>
              </div>
            </div>
          )}

          {tab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                วางรหัส Template Key (ขึ้นต้นด้วย <code className="text-amber-400">CST1.</code>) หรือข้อความ JSON ที่ได้รับมาด้านล่าง
              </div>

              <div>
                <textarea
                  rows={4}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="วางรหัส CST1-... หรือ JSON ที่นี่"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 font-mono text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              {importError && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {previewTemplate && (
                <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{previewTemplate.name}</h4>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      By {previewTemplate.author || 'Unknown'}
                    </span>
                  </div>
                  {previewTemplate.description && (
                    <p className="text-xs text-zinc-400">{previewTemplate.description}</p>
                  )}
                  <div className="flex gap-4 text-[11px] text-zinc-400 font-mono pt-1">
                    <span>{previewTemplate.stats.length} Stats</span>
                    <span>•</span>
                    <span>{previewTemplate.resources.length} Bars</span>
                    <span>•</span>
                    <span>{previewTemplate.textFields.length} Text Fields</span>
                    <span>•</span>
                    <span>{previewTemplate.equipmentSlots.length} Slots</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {!previewTemplate ? (
                  <button
                    type="button"
                    onClick={handleParseImport}
                    disabled={!importInput.trim()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    ตรวจสอบรหัส (Preview)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-5 py-2 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                  >
                    นำมาใช้กับตัวละครนี้ (Apply)
                  </button>
                )}
              </div>
            </div>
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

