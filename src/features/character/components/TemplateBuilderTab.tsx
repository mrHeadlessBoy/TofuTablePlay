'use client'

import { useState, type ReactNode } from 'react'
import { FileText, Heart, Package, Plus, RotateCcw, Sliders, Sparkles, Trash2, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  DEFAULT_MECHANICS,
  RESOURCE_COLORS,
  isBuiltinTemplateId,
  makeFieldId,
  type CharacterTemplate,
  type ResourceColor,
  type TemplateDice,
  type TemplateEquipmentSlot,
  type TemplateMechanics,
  type TemplateMode,
  type TemplateResource,
  type TemplateStat,
  type TemplateStatModifier,
  type TemplateTextField,
} from '../template'

const COLOR_SWATCH: Record<ResourceColor, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  zinc: 'bg-zinc-500',
}

const META_INPUT_CLASS =
  'w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none transition-all'
const META_LABEL_CLASS = 'text-[11px] font-mono uppercase text-zinc-400'
const SELECT_CLASS =
  'w-full bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 outline-none focus:border-zinc-600 cursor-pointer transition-all'
const CARD_INPUT_CLASS =
  'w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-white'
const CARD_NUMBER_INPUT_CLASS = `${CARD_INPUT_CLASS} text-center font-mono`
const CARD_LABEL_CLASS = 'text-[10px] text-zinc-400 font-mono'

// Replace one entry of a list immutably
function updateAt<T>(list: T[], index: number, updates: Partial<T>): T[] {
  const next = [...list]
  next[index] = { ...next[index], ...updates }
  return next
}

type TemplateBuilderTabProps = {
  template: CharacterTemplate
  onChange: (next: CharacterTemplate) => void
}

// Visual template builder: meta, AI DM mechanics, resources, stats, text fields, gear slots, conditions, sections
export default function TemplateBuilderTab({ template, onChange }: TemplateBuilderTabProps) {
  const { language } = useLanguage()

  const handleClearToBlank = () => {
    onChange({
      ...template,
      resources: [],
      stats: [],
      equipmentSlots: [],
      conditions: ['Normal'],
      textFields: [],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-zinc-400">
          กำหนดโครงสร้างสเตตัส หลอดพลัง และช่องสวมใส่ตามที่คุณต้องการ
        </span>
        <button
          type="button"
          onClick={handleClearToBlank}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition cursor-pointer border border-zinc-700/80 shadow-sm"
          title="Clear all fields to a blank canvas"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>
            {language === 'en' ? 'Start from Blank Sheet' : 'ล้างเป็นชีทว่าง (Start from Blank)'}
          </span>
        </button>
      </div>

      {isBuiltinTemplateId(template.id) && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              คุณกำลังปรับแต่งจากเทมเพลตเริ่มต้น: <strong>{template.name}</strong>{' '}
              (เมื่อบันทึก ระบบจะแปลงเป็นชีท Custom ให้อัตโนมัติ)
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-700/60 shrink-0 font-medium">
            Fork to Custom
          </span>
        </div>
      )}

      <MetaFields template={template} onChange={onChange} />
      <MechanicsPanel template={template} onChange={onChange} />
      <ResourcesSection template={template} onChange={onChange} />
      <StatsSection template={template} onChange={onChange} />
      <TextFieldsSection template={template} onChange={onChange} />
      <EquipmentSlotsSection template={template} onChange={onChange} />
      <ConditionsSection template={template} onChange={onChange} />
      <SectionToggles template={template} onChange={onChange} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Meta & mechanics                                                    */
/* ------------------------------------------------------------------ */

function MetaFields({ template, onChange }: TemplateBuilderTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-xl border border-zinc-800/70">
      <div>
        <label className={META_LABEL_CLASS}>Template Name</label>
        <input
          type="text"
          value={template.name}
          onChange={(e) => onChange({ ...template, name: e.target.value })}
          placeholder="e.g., Romance / Slice of Life"
          className={META_INPUT_CLASS}
        />
      </div>
      <div>
        <label className={META_LABEL_CLASS}>Author</label>
        <input
          type="text"
          value={template.author}
          onChange={(e) => onChange({ ...template, author: e.target.value })}
          placeholder="Author name"
          className={META_INPUT_CLASS}
        />
      </div>
      <div className="md:col-span-2">
        <label className={META_LABEL_CLASS}>Description</label>
        <input
          type="text"
          value={template.description}
          onChange={(e) => onChange({ ...template, description: e.target.value })}
          placeholder="Brief description of this template's theme and rules..."
          className={META_INPUT_CLASS}
        />
      </div>
    </div>
  )
}

// Rules & Mechanics (AI DM Profile)
function MechanicsPanel({ template, onChange }: TemplateBuilderTabProps) {
  const mechanics = template.mechanics ?? DEFAULT_MECHANICS

  const updateMechanics = (updates: Partial<TemplateMechanics>) => {
    onChange({ ...template, mechanics: { ...mechanics, ...updates } })
  }

  return (
    <div className="space-y-3 p-4 bg-black/30 border border-zinc-800/70 rounded-xl">
      <div className="flex items-center gap-1.5">
        <Sliders className="w-4 h-4 text-amber-500" />
        <h3 className="text-xs font-semibold uppercase text-zinc-300">
          Rules & Mechanics / กติกาและกลไก (AI DM Profile)
        </h3>
      </div>
      <p className="text-[11px] text-zinc-400">
        กำหนดรูปแบบการตัดสินและกลไกของ AI ให้เข้ากับแนวของแคมเปญ (เช่น ต่อสู้, โรแมนติก,
        เนื้อเรื่อง/สืบสวน หรือสยองขวัญ)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <MechanicsSelect
          label="Gameplay Mode (โหมดการเล่น)"
          value={mechanics.mode}
          onChange={(value) => updateMechanics({ mode: value as TemplateMode })}
        >
          <option value="combat">Combat RPG (ต่อสู้ / แอ็กชันแฟนตาซี)</option>
          <option value="narrative">Narrative / Mystery (เน้นเนื้อเรื่อง / สืบสวน / ไอเทม)</option>
          <option value="social">Social / Romance (โรแมนติก / บทสนทนา / ความรู้สึก)</option>
          <option value="horror">Horror / Survival (สยองขวัญ / สติสัมปชัญญะ / เอาชีวิตรอด)</option>
        </MechanicsSelect>

        <MechanicsSelect
          label="Vitality Resource (หลอดพลังชีวิตหลัก)"
          value={mechanics.vitalityResourceId ?? ''}
          onChange={(value) => updateMechanics({ vitalityResourceId: value ? value : null })}
        >
          <option value="">ไม่มีหลอดเลือด (No Damage System)</option>
          {template.resources.map((res) => (
            <option key={res.id} value={res.id}>
              {res.label || res.id} (ID: {res.id})
            </option>
          ))}
        </MechanicsSelect>

        <MechanicsSelect
          label="Dice System (ระบบลูกเต๋า)"
          value={mechanics.dice}
          onChange={(value) => updateMechanics({ dice: value as TemplateDice })}
        >
          <option value="d20">d20 System (D&D / Standard d20)</option>
          <option value="2d6">2d6 System (PbtA / City of Mist)</option>
          <option value="d100">d100 System (Call of Cthulhu)</option>
          <option value="none">No Dice (บทบาทสมมติล้วน / ไม่ใช้เต๋า)</option>
        </MechanicsSelect>

        <MechanicsSelect
          label="Stat Modifier (สูตรโบนัสสเตตัส)"
          value={mechanics.statModifier}
          onChange={(value) => updateMechanics({ statModifier: value as TemplateStatModifier })}
        >
          <option value="dnd">D&D 5e Formula: (Score - 10) / 2</option>
          <option value="raw">Direct Score: +Score (สำหรับสเกล 1-5 หรือ ±3)</option>
          <option value="none">No Modifier: +0 (ทอยเพียว / d100 roll under)</option>
        </MechanicsSelect>
      </div>
    </div>
  )
}

function MechanicsSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div>
      <label className={`${META_LABEL_CLASS} block mb-1`}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {children}
      </select>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resources, stats & text fields                                      */
/* ------------------------------------------------------------------ */

function ResourcesSection({ template, onChange }: TemplateBuilderTabProps) {
  const handleAdd = () => {
    const newRes: TemplateResource = {
      id: makeFieldId('Resource', template.resources.map((r) => r.id)),
      label: 'Energy',
      defaultMax: 20,
      color: 'amber',
    }
    onChange({ ...template, resources: [...template.resources, newRes] })
  }

  const handleUpdate = (index: number, updates: Partial<TemplateResource>) => {
    onChange({ ...template, resources: updateAt(template.resources, index, updates) })
  }

  // Removing the vitality bar moves the AI DM's vitality to HP (or the first remaining bar)
  const handleRemove = (index: number) => {
    const removed = template.resources[index]
    const nextResources = template.resources.filter((_, i) => i !== index)
    const currentVitality = template.mechanics?.vitalityResourceId
    const nextVitalityId =
      currentVitality === removed?.id
        ? (nextResources.find((r) => r.id === 'hp')?.id ?? nextResources[0]?.id ?? null)
        : (currentVitality ?? null)

    onChange({
      ...template,
      resources: nextResources,
      mechanics: {
        ...(template.mechanics ?? DEFAULT_MECHANICS),
        vitalityResourceId: nextVitalityId,
      },
    })
  }

  return (
    <BuilderSection
      icon={<Heart className="w-4 h-4 text-red-500" />}
      title="Resource Bars (หลอดพลัง/เลือด)"
      addLabel="เพิ่มหลอดพลัง"
      onAdd={handleAdd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {template.resources.length === 0 && (
          <EmptyBuilderNote>
            ไม่มีหลอดพลัง (0 Resource Bars — เหมาะสำหรับแนวเน้นเนื้อเรื่อง ไอเทม หรือแนวสืบสวน)
          </EmptyBuilderNote>
        )}
        {template.resources.map((res, idx) => (
          <BuilderCard key={res.id} id={res.id} removeTitle="ลบหลอดพลังนี้" onRemove={() => handleRemove(idx)}>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={CARD_LABEL_CLASS}>Label</label>
                <input
                  type="text"
                  value={res.label}
                  onChange={(e) => handleUpdate(idx, { label: e.target.value })}
                  className={CARD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className={CARD_LABEL_CLASS}>Def Max</label>
                <input
                  type="number"
                  min={0}
                  value={res.defaultMax}
                  onChange={(e) => handleUpdate(idx, { defaultMax: Number(e.target.value) || 0 })}
                  className={CARD_NUMBER_INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className={`${CARD_LABEL_CLASS} block mb-1`}>Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {RESOURCE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleUpdate(idx, { color: c })}
                    className={`w-5 h-5 rounded-full ${COLOR_SWATCH[c]} transition cursor-pointer ${
                      res.color === c
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </BuilderCard>
        ))}
      </div>
    </BuilderSection>
  )
}

function StatsSection({ template, onChange }: TemplateBuilderTabProps) {
  const handleAdd = () => {
    const newStat: TemplateStat = {
      id: makeFieldId('New Stat', template.stats.map((s) => s.id)),
      label: 'New Stat',
      min: null,
      max: null,
      default: 10,
    }
    onChange({ ...template, stats: [...template.stats, newStat] })
  }

  const handleUpdate = (index: number, updates: Partial<TemplateStat>) => {
    onChange({ ...template, stats: updateAt(template.stats, index, updates) })
  }

  const handleRemove = (index: number) => {
    onChange({ ...template, stats: template.stats.filter((_, i) => i !== index) })
  }

  // Empty input means "no limit"
  const parseLimit = (raw: string) => (raw === '' ? null : Number(raw))

  return (
    <BuilderSection
      icon={<Sparkles className="w-4 h-4 text-amber-500" />}
      title="Stats / Attributes (ค่าสถานะ)"
      addLabel="เพิ่มสเตตัส"
      onAdd={handleAdd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {template.stats.length === 0 && (
          <EmptyBuilderNote>ไม่มีค่าสถานะแยกย่อย (0 Stats)</EmptyBuilderNote>
        )}
        {template.stats.map((stat, idx) => (
          <BuilderCard key={stat.id} id={stat.id} removeTitle="ลบค่าสถานะนี้" onRemove={() => handleRemove(idx)}>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={CARD_LABEL_CLASS}>Label</label>
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => handleUpdate(idx, { label: e.target.value })}
                  className={CARD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className={CARD_LABEL_CLASS}>Default</label>
                <input
                  type="number"
                  value={stat.default}
                  onChange={(e) => handleUpdate(idx, { default: Number(e.target.value) || 0 })}
                  className={CARD_NUMBER_INPUT_CLASS}
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
                  onChange={(e) => handleUpdate(idx, { min: parseLimit(e.target.value) })}
                  className={CARD_NUMBER_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="font-mono">Max (ว่าง = ไม่มีจำกัด)</label>
                <input
                  type="number"
                  value={stat.max ?? ''}
                  placeholder="None"
                  onChange={(e) => handleUpdate(idx, { max: parseLimit(e.target.value) })}
                  className={CARD_NUMBER_INPUT_CLASS}
                />
              </div>
            </div>
          </BuilderCard>
        ))}
      </div>
    </BuilderSection>
  )
}

function TextFieldsSection({ template, onChange }: TemplateBuilderTabProps) {
  const handleAdd = () => {
    const newField: TemplateTextField = {
      id: makeFieldId('Custom Field', template.textFields.map((f) => f.id)),
      label: 'New Field',
      placeholder: 'Enter details...',
      rows: 2,
    }
    onChange({ ...template, textFields: [...template.textFields, newField] })
  }

  const handleUpdate = (index: number, updates: Partial<TemplateTextField>) => {
    onChange({ ...template, textFields: updateAt(template.textFields, index, updates) })
  }

  const handleRemove = (index: number) => {
    onChange({ ...template, textFields: template.textFields.filter((_, i) => i !== index) })
  }

  return (
    <BuilderSection
      icon={<FileText className="w-4 h-4 text-cyan-500" />}
      title="Text & Bio Fields (ช่องข้อความ / ข้อมูลภูมิหลัง)"
      addLabel="เพิ่มช่องข้อความ"
      onAdd={handleAdd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {template.textFields.map((field, idx) => (
          <BuilderCard key={field.id} id={field.id} onRemove={() => handleRemove(idx)}>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={CARD_LABEL_CLASS}>Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => handleUpdate(idx, { label: e.target.value })}
                  className={CARD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className={CARD_LABEL_CLASS}>Rows</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={field.rows}
                  onChange={(e) =>
                    handleUpdate(idx, {
                      rows: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
                    })
                  }
                  className={CARD_NUMBER_INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className={CARD_LABEL_CLASS}>Placeholder</label>
              <input
                type="text"
                value={field.placeholder}
                onChange={(e) => handleUpdate(idx, { placeholder: e.target.value })}
                className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-md p-1.5 text-xs text-zinc-300"
              />
            </div>
          </BuilderCard>
        ))}
      </div>
    </BuilderSection>
  )
}

/* ------------------------------------------------------------------ */
/* Equipment slots, conditions & section toggles                       */
/* ------------------------------------------------------------------ */

function EquipmentSlotsSection({ template, onChange }: TemplateBuilderTabProps) {
  const handleAdd = () => {
    const newSlot: TemplateEquipmentSlot = {
      id: makeFieldId('Slot', template.equipmentSlots.map((s) => s.id)),
      label: 'Accessory',
    }
    onChange({ ...template, equipmentSlots: [...template.equipmentSlots, newSlot] })
  }

  const handleUpdate = (index: number, updates: Partial<TemplateEquipmentSlot>) => {
    onChange({ ...template, equipmentSlots: updateAt(template.equipmentSlots, index, updates) })
  }

  const handleRemove = (index: number) => {
    onChange({
      ...template,
      equipmentSlots: template.equipmentSlots.filter((_, i) => i !== index),
    })
  }

  return (
    <BuilderSection
      icon={<Package className="w-4 h-4 text-emerald-500" />}
      title="Equipment Slots (ช่องสวมใส่)"
      addLabel="เพิ่มช่องสวมใส่"
      onAdd={handleAdd}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {template.equipmentSlots.map((slot, idx) => (
          <div
            key={slot.id}
            className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2"
          >
            <input
              type="text"
              value={slot.label}
              onChange={(e) => handleUpdate(idx, { label: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-1 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-zinc-500 hover:text-red-400 transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </BuilderSection>
  )
}

function ConditionsSection({ template, onChange }: TemplateBuilderTabProps) {
  const [newCondition, setNewCondition] = useState('')

  const handleAdd = () => {
    const trimmed = newCondition.trim()
    if (!trimmed || template.conditions.includes(trimmed)) return
    onChange({ ...template, conditions: [...template.conditions, trimmed] })
    setNewCondition('')
  }

  const handleRemove = (index: number) => {
    onChange({ ...template, conditions: template.conditions.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase text-zinc-300">
        Status Conditions (สถานะผิดปกติ)
      </h3>
      <div className="flex flex-wrap gap-2">
        {template.conditions.map((cond, idx) => (
          <span
            key={cond}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-200"
          >
            {cond}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
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
              handleAdd()
            }
          }}
          placeholder="พิมพ์สถานะใหม่แล้วกด Enter หรือกดเพิ่ม..."
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium cursor-pointer"
        >
          + เพิ่ม
        </button>
      </div>
    </div>
  )
}

function SectionToggles({ template, onChange }: TemplateBuilderTabProps) {
  const setSection = (key: keyof CharacterTemplate['sections'], checked: boolean) => {
    onChange({ ...template, sections: { ...template.sections, [key]: checked } })
  }

  return (
    <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 flex flex-wrap gap-6 text-xs">
      <SectionToggle
        checked={template.sections.skills}
        onChange={(checked) => setSection('skills', checked)}
        label="เปิดใช้งานหมวดสกิล (Skills Section)"
      />
      <SectionToggle
        checked={template.sections.inventory}
        onChange={(checked) => setSection('inventory', checked)}
        label="เปิดใช้งานกระเป๋าสัมภาระ (Inventory Section)"
      />
    </div>
  )
}

function SectionToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-700 text-amber-500 focus:ring-0"
      />
      <span className="text-zinc-200">{label}</span>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function BuilderSection({
  icon,
  title,
  addLabel,
  onAdd,
  children,
}: {
  icon: ReactNode
  title: string
  addLabel: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <h3 className="text-xs font-semibold uppercase text-zinc-300">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>
      {children}
    </div>
  )
}

function BuilderCard({
  id,
  removeTitle,
  onRemove,
  children,
}: {
  id: string
  removeTitle?: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-zinc-500 uppercase">ID: {id}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-500 hover:text-red-400 transition cursor-pointer"
          title={removeTitle}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

function EmptyBuilderNote({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full p-4 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
      {children}
    </div>
  )
}
