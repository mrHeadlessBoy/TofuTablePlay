'use client'

import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  EMPTY_EQUIPMENT,
  type CharacterInventoryItem,
  type CharacterSkill,
} from '@/features/character/domain'
import {
  COLUMN_EQUIPMENT_SLOT_INDEX,
  COLUMN_RESOURCE_IDS,
  clampStatValue,
  isColumnStatId,
  type CharacterTemplate,
  type SheetCustomValues,
  type TemplateResource,
} from '@/features/character/template'
import type { CharacterCombatFormState } from '../types'

const INPUT_CLASS =
  'w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white focus:border-amber-400 outline-none'
const ROW_INPUT_CLASS =
  'w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded p-1 text-[11px] text-white'
const FIELD_LABEL_CLASS = 'text-[10px] text-zinc-400 uppercase font-mono'

function toNumberOr(raw: string, fallback: number): number {
  const val = Number(raw)
  return Number.isNaN(val) ? fallback : val
}

type CharacterCombatEditorProps = {
  template: CharacterTemplate
  charForm: CharacterCombatFormState
  formCustom: SheetCustomValues
  formInventoryItems: CharacterInventoryItem[]
  onChange: (next: CharacterCombatFormState) => void
}

// Inline combat editor inside the SAO window: resources, condition, stats, inventory, gear and skills
export default function CharacterCombatEditor({
  template,
  charForm,
  formCustom,
  formInventoryItems,
  onChange,
}: CharacterCombatEditorProps) {
  const hpResourceDef = template.resources.find((r) => r.id === 'hp')
  const spResourceDef = template.resources.find((r) => r.id === 'skill_cost')
  const customResourceDefs = template.resources.filter(
    (r) => !(COLUMN_RESOURCE_IDS as readonly string[]).includes(r.id),
  )

  return (
    <div className="space-y-4 text-xs">
      {(hpResourceDef || template.resources.length === 0) && (
        <HpEditor
          label={hpResourceDef?.label || 'HP'}
          charForm={charForm}
          onChange={onChange}
        />
      )}

      {spResourceDef && (
        <SkillCostEditor
          label={spResourceDef.label || 'Skill Cost'}
          charForm={charForm}
          onChange={onChange}
        />
      )}

      {/* Custom Template Resource Bars Editor (Stress, Luck, etc.) */}
      {customResourceDefs.map((res) => (
        <CustomResourceEditor
          key={res.id}
          resource={res}
          charForm={charForm}
          formCustom={formCustom}
          onChange={onChange}
        />
      ))}

      <ConditionSelect template={template} charForm={charForm} onChange={onChange} />

      {template.stats.length > 0 && (
        <StatsEditor
          template={template}
          charForm={charForm}
          formCustom={formCustom}
          onChange={onChange}
        />
      )}

      {template.sections.inventory && (
        <InventoryEditor
          items={formInventoryItems}
          onItemsChange={(inventory) => onChange({ ...charForm, inventory })}
        />
      )}

      {template.equipmentSlots.length > 0 && (
        <EquipmentEditor
          template={template}
          charForm={charForm}
          formCustom={formCustom}
          onChange={onChange}
        />
      )}

      {template.sections.skills && (
        <SkillsEditor
          skills={charForm.skills || []}
          onSkillsChange={(skills) => onChange({ ...charForm, skills })}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resource editors                                                    */
/* ------------------------------------------------------------------ */

type FormSectionProps = {
  charForm: CharacterCombatFormState
  onChange: (next: CharacterCombatFormState) => void
}

function NumberField({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onValueChange: (raw: string) => void
}) {
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  )
}

function HpEditor({ label, charForm, onChange }: FormSectionProps & { label: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label={`Current ${label}`}
        max={charForm.max_hp}
        value={charForm.current_hp}
        onValueChange={(raw) =>
          onChange({
            ...charForm,
            current_hp: Math.min(charForm.max_hp, toNumberOr(raw, 0)),
          })
        }
      />
      <NumberField
        label={`Max ${label}`}
        min={1}
        value={charForm.max_hp}
        onValueChange={(raw) => {
          const clampedMax = toNumberOr(raw, 1)
          onChange({
            ...charForm,
            max_hp: clampedMax,
            current_hp: Math.min(clampedMax, charForm.current_hp),
          })
        }}
      />
    </div>
  )
}

// Skill cost is mirrored into armor_class, which is where older sheets stored it
function SkillCostEditor({
  label,
  charForm,
  onChange,
}: FormSectionProps & { label: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label={`Current ${label}`}
        min={0}
        max={charForm.max_skill_cost}
        value={charForm.current_skill_cost}
        onValueChange={(raw) => {
          const clamped = Math.max(
            0,
            Math.min(charForm.max_skill_cost, toNumberOr(raw, 0)),
          )
          onChange({
            ...charForm,
            current_skill_cost: clamped,
            armor_class: clamped,
          })
        }}
      />
      <NumberField
        label={`Max ${label}`}
        min={0}
        value={charForm.max_skill_cost}
        onValueChange={(raw) => {
          const clampedMax = Math.max(0, toNumberOr(raw, 0))
          const nextCur = Math.min(clampedMax, charForm.current_skill_cost)
          onChange({
            ...charForm,
            max_skill_cost: clampedMax,
            current_skill_cost: nextCur,
            armor_class: nextCur,
          })
        }}
      />
    </div>
  )
}

function CustomResourceEditor({
  resource,
  charForm,
  formCustom,
  onChange,
}: FormSectionProps & { resource: TemplateResource; formCustom: SheetCustomValues }) {
  const existing = formCustom.resources[resource.id] || {
    current: resource.defaultMax,
    max: resource.defaultMax,
  }

  const setResource = (current: number, max: number) => {
    onChange({
      ...charForm,
      sheet_custom: {
        ...formCustom,
        resources: {
          ...formCustom.resources,
          [resource.id]: { current, max },
        },
      },
    })
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label={`Current ${resource.label}`}
        min={0}
        max={existing.max}
        value={existing.current}
        onValueChange={(raw) =>
          setResource(
            Math.max(0, Math.min(existing.max, toNumberOr(raw, 0))),
            existing.max,
          )
        }
      />
      <NumberField
        label={`Max ${resource.label}`}
        min={0}
        value={existing.max}
        onValueChange={(raw) => {
          const nextMax = Math.max(0, toNumberOr(raw, 0))
          setResource(Math.min(nextMax, existing.current), nextMax)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Condition, stats & equipment                                        */
/* ------------------------------------------------------------------ */

function ConditionSelect({
  template,
  charForm,
  onChange,
}: FormSectionProps & { template: CharacterTemplate }) {
  const { t } = useLanguage()
  const current = charForm.status_condition
  // Keep a condition that the template no longer lists so the select does not silently change it
  const isUnlisted = !!current && !template.conditions.includes(current)

  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>{t('character.statusCondition')}</label>
      <select
        value={current}
        onChange={(e) => onChange({ ...charForm, status_condition: e.target.value })}
        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-white mt-0.5 focus:border-amber-400 outline-none"
      >
        {template.conditions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {isUnlisted && <option value={current}>{current}</option>}
      </select>
    </div>
  )
}

function StatsEditor({
  template,
  charForm,
  formCustom,
  onChange,
}: FormSectionProps & { template: CharacterTemplate; formCustom: SheetCustomValues }) {
  const { t } = useLanguage()

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`${FIELD_LABEL_CLASS} block`}>
          {t('character.statsAndAttributes')}
        </label>
        <span className="text-[9px] text-zinc-500 font-mono">Allows negative</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {template.stats.map((stat) => {
          const isCol = isColumnStatId(stat.id)
          const currentVal = isCol
            ? (charForm.stats[stat.id] ?? stat.default)
            : (formCustom.stats[stat.id] ?? charForm.stats[stat.id] ?? stat.default)

          const handleChange = (raw: string) => {
            // Let the player clear the box or start typing a negative number
            if (raw === '' || raw === '-') {
              onChange({ ...charForm, stats: { ...charForm.stats, [stat.id]: raw } })
              return
            }
            const val = Number(raw)
            if (Number.isNaN(val)) return
            const clamped = clampStatValue(stat, val)
            onChange({
              ...charForm,
              stats: { ...charForm.stats, [stat.id]: clamped },
              sheet_custom: isCol
                ? formCustom
                : { ...formCustom, stats: { ...formCustom.stats, [stat.id]: clamped } },
            })
          }

          return (
            <div
              key={stat.id}
              className="bg-zinc-900 border border-zinc-800 rounded p-1 text-center"
            >
              <span
                className="text-[9px] text-zinc-500 uppercase block truncate"
                title={stat.label}
              >
                {stat.label}
              </span>
              <input
                type="number"
                min={stat.min ?? undefined}
                max={stat.max ?? undefined}
                value={currentVal}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full bg-transparent text-center font-bold text-xs text-white outline-none"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EquipmentEditor({
  template,
  charForm,
  formCustom,
  onChange,
}: FormSectionProps & { template: CharacterTemplate; formCustom: SheetCustomValues }) {
  const { t } = useLanguage()
  const equipment = charForm.equipment ?? EMPTY_EQUIPMENT

  const setSlot = (slotId: string, colIdx: number | undefined, value: string) => {
    if (colIdx !== undefined) {
      const next = [...equipment]
      next[colIdx] = value
      onChange({ ...charForm, equipment: next })
      return
    }
    onChange({
      ...charForm,
      sheet_custom: {
        ...formCustom,
        equipment: { ...formCustom.equipment, [slotId]: value },
      },
    })
  }

  return (
    <div>
      <label className={`${FIELD_LABEL_CLASS} block mb-1`}>
        {t('character.equipmentSlots')}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {template.equipmentSlots.map((slot) => {
          const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
          const val =
            colIdx !== undefined
              ? equipment[colIdx] || ''
              : formCustom.equipment[slot.id] || ''
          return (
            <div key={slot.id}>
              <span className="text-[9px] text-zinc-500 uppercase block truncate">
                {slot.label}
              </span>
              <input
                type="text"
                placeholder={`${slot.label}...`}
                value={val}
                onChange={(e) => setSlot(slot.id, colIdx, e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-[11px] text-white focus:border-amber-400 outline-none"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Inventory & skills (editable lists)                                 */
/* ------------------------------------------------------------------ */

function InventoryEditor({
  items,
  onItemsChange,
}: {
  items: CharacterInventoryItem[]
  onItemsChange: (next: CharacterInventoryItem[]) => void
}) {
  const { t } = useLanguage()

  const updateItem = (idx: number, patch: Partial<CharacterInventoryItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onItemsChange(next)
  }

  return (
    <div className="space-y-2">
      <ListHeader title="Inventory" count={`${items.length} item(s)`} />
      <div className="space-y-2">
        {items.map((item, idx) => (
          <RowCard
            key={idx}
            title={`Item #${idx + 1}`}
            removeTitle="Remove item"
            onRemove={() => onItemsChange(items.filter((_, i) => i !== idx))}
          >
            <div className="grid grid-cols-3 gap-1.5">
              <div className="col-span-2">
                <RowFieldLabel>Item Name :</RowFieldLabel>
                <input
                  type="text"
                  placeholder="Item name..."
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  className={ROW_INPUT_CLASS}
                />
              </div>
              <div>
                <RowFieldLabel>Qty :</RowFieldLabel>
                <input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    updateItem(idx, { quantity: Number.isNaN(val) ? 1 : Math.max(1, val) })
                  }}
                  className={`${ROW_INPUT_CLASS} text-center`}
                />
              </div>
            </div>
            <div>
              <RowFieldLabel>Description :</RowFieldLabel>
              <input
                type="text"
                placeholder="Effect / description (optional)..."
                value={item.description || ''}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                className={ROW_INPUT_CLASS}
              />
            </div>
          </RowCard>
        ))}
        {items.length === 0 && (
          <div className="p-3 bg-zinc-900/50 border border-dashed border-zinc-800 rounded text-center text-zinc-500 text-[11px]">
            No items in inventory
          </div>
        )}
      </div>
      <AddRowButton
        onClick={() => onItemsChange([...items, { name: '', quantity: 1, description: '' }])}
      >
        {t('character.addItem')}
      </AddRowButton>
    </div>
  )
}

function SkillsEditor({
  skills,
  onSkillsChange,
}: {
  skills: CharacterSkill[]
  onSkillsChange: (next: CharacterSkill[]) => void
}) {
  const { t } = useLanguage()

  const updateSkill = (idx: number, patch: Partial<CharacterSkill>) => {
    const next = [...skills]
    next[idx] = { ...next[idx], ...patch }
    onSkillsChange(next)
  }

  return (
    <div className="space-y-2">
      <ListHeader title="Skill" count={`${skills.length} slot(s)`} />
      <div className="space-y-2">
        {skills.map((skill, idx) => (
          <RowCard
            key={idx}
            title={`Skill #${idx + 1}`}
            removeTitle="Remove skill"
            onRemove={() => onSkillsChange(skills.filter((_, i) => i !== idx))}
          >
            <div>
              <RowFieldLabel>Skill Name :</RowFieldLabel>
              <input
                type="text"
                placeholder="Skill name..."
                value={skill.name}
                onChange={(e) => updateSkill(idx, { name: e.target.value })}
                className={ROW_INPUT_CLASS}
              />
            </div>
            <div>
              <RowFieldLabel>Skill Cost :</RowFieldLabel>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={skill.cost ?? 0}
                onChange={(e) =>
                  updateSkill(idx, { cost: Math.max(0, toNumberOr(e.target.value, 0)) })
                }
                className={ROW_INPUT_CLASS}
              />
            </div>
            <div>
              <RowFieldLabel>Description :</RowFieldLabel>
              <input
                type="text"
                placeholder="Description..."
                value={skill.description}
                onChange={(e) => updateSkill(idx, { description: e.target.value })}
                className={ROW_INPUT_CLASS}
              />
            </div>
          </RowCard>
        ))}
      </div>
      <AddRowButton
        onClick={() => onSkillsChange([...skills, { name: '', cost: 0, description: '' }])}
      >
        {t('character.addSkill')}
      </AddRowButton>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function ListHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-center justify-between">
      <label className={`${FIELD_LABEL_CLASS} block`}>{title}</label>
      <span className="text-[9px] text-zinc-500 font-mono">{count}</span>
    </div>
  )
}

function RowCard({
  title,
  removeTitle,
  onRemove,
  children,
}: {
  title: string
  removeTitle: string
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-amber-500 font-mono uppercase">{title}</span>
        <button
          type="button"
          onClick={onRemove}
          title={removeTitle}
          className="text-zinc-500 hover:text-red-400 p-0.5 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {children}
    </div>
  )
}

function RowFieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[9px] text-zinc-400 uppercase font-mono block">{children}</span>
  )
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
    >
      <Plus className="w-3 h-3" /> {children}
    </button>
  )
}
