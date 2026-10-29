'use client'

import type { ReactNode } from 'react'
import { Heart, Loader2, Package, Plus, Sliders, Sparkles, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { CharacterFormData } from '../actions'
import {
  EMPTY_EQUIPMENT,
  type CharacterInventoryItem,
  type CharacterSkill,
} from '../domain'
import {
  BUILTIN_TEMPLATES,
  COLUMN_EQUIPMENT_SLOT_INDEX,
  isBuiltinTemplateId,
  isColumnStatId,
  isColumnTextFieldId,
  type CharacterTemplate,
  type ResourceColor,
  type SheetCustomValues,
  type TemplateResource,
} from '../template'

// A sheet being edited in the Codex (saved sheets carry their id and owner)
export type CharacterRecord = CharacterFormData & {
  id?: string | number
  user_id?: string | null
}

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

const FIELD_INPUT_CLASS =
  'w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all'
const SMALL_INPUT_CLASS =
  'w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none'
const SECTION_LABEL_CLASS = 'text-xs text-zinc-400 uppercase'
const ROW_LABEL_CLASS = 'text-[10px] text-zinc-400 font-mono uppercase block'

/* ------------------------------------------------------------------ */
/* Header & identity                                                   */
/* ------------------------------------------------------------------ */

// Title plus the template selector / customizer controls
export function SheetFormHeader({
  isNew,
  template,
  onSwitchTemplate,
  onOpenCustomizer,
}: {
  isNew: boolean
  template: CharacterTemplate
  onSwitchTemplate: (templateId: string) => void
  onOpenCustomizer: () => void
}) {
  const { t, language } = useLanguage()
  const isBuiltin = isBuiltinTemplateId(template.id)

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-zinc-800/40 pb-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {isNew ? t('character.newTitle') : t('character.editTitle')}
        </h2>
        <span className="text-[11px] text-zinc-400 font-mono">
          {template.name} • {t('common.sheetAuthor')}: {template.author || 'D&D Playground'}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-black/40 border border-zinc-800/80 rounded-xl px-3 py-1.5 text-xs">
          <span className="text-[10px] uppercase font-mono text-zinc-500">
            {t('character.template')}:
          </span>
          <select
            value={template.id}
            onChange={(e) => onSwitchTemplate(e.target.value)}
            className="bg-transparent text-amber-400 font-medium outline-none cursor-pointer text-xs"
          >
            {BUILTIN_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id} className="bg-zinc-900 text-white">
                {tpl.name}
              </option>
            ))}
            {!isBuiltin && (
              <option
                value={template.id}
                className="bg-zinc-900 text-amber-300 font-semibold"
              >
                ★ {template.name} (Custom)
              </option>
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenCustomizer}
          title="ปรับแต่งโครงสร้างชีต หรือแชร์/นำเข้า Template Key"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-900/60 hover:bg-zinc-800/80 hover:text-white text-zinc-200 border border-zinc-800/80 rounded-xl transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-sm"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {isBuiltin
              ? t('character.templateCustomizer')
              : language === 'en'
                ? 'Edit Structure / Key'
                : 'แก้ไขโครงสร้าง / Key'}
          </span>
        </button>
      </div>
    </div>
  )
}

export function IdentityFields({
  name,
  archetype,
  onNameChange,
  onArchetypeChange,
}: {
  name: string
  archetype: string
  onNameChange: (value: string) => void
  onArchetypeChange: (value: string) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={SECTION_LABEL_CLASS}>{t('character.name')}</label>
        <input
          type="text"
          required
          placeholder="e.g. Roland of Gilead"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={FIELD_INPUT_CLASS}
        />
      </div>
      <div>
        <label className={SECTION_LABEL_CLASS}>{t('character.archetype')}</label>
        <input
          type="text"
          required
          placeholder="e.g. Gunslinger, Paladin, Student..."
          value={archetype}
          onChange={(e) => onArchetypeChange(e.target.value)}
          className={FIELD_INPUT_CLASS}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resource bars                                                       */
/* ------------------------------------------------------------------ */

// Dynamic Resource Bars (HP, Skill Cost, Stress, Sanity, Energy...)
export function ResourceBarsSection({
  template,
  character,
  customValues,
  onCharacterChange,
  onCustomResourceChange,
}: {
  template: CharacterTemplate
  character: CharacterRecord
  customValues: SheetCustomValues
  onCharacterChange: (patch: Partial<CharacterRecord>) => void
  onCustomResourceChange: (resId: string, key: 'current' | 'max', val: number) => void
}) {
  return (
    <div className="space-y-3">
      <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5`}>
        <Heart className="w-3.5 h-3.5 text-red-500" /> Resource Bars (หลอดพลัง/เลือด)
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {template.resources.map((res) => {
          if (res.id === 'hp') {
            return (
              <ResourceCard
                key={res.id}
                resource={res}
                current={character.current_hp}
                max={character.max_hp}
                maxMin={1}
                onCurrentChange={(raw) => {
                  const nextVal = Number(raw)
                  const clamped = Number.isNaN(nextVal)
                    ? 0
                    : Math.max(0, Math.min(character.max_hp, nextVal))
                  onCharacterChange({ current_hp: clamped })
                }}
                onMaxChange={(raw) => {
                  const nextMax = Math.max(1, Number(raw) || 1)
                  const nextCur = Math.min(nextMax, character.current_hp)
                  onCharacterChange({ max_hp: nextMax, current_hp: nextCur })
                }}
              />
            )
          }

          if (res.id === 'skill_cost') {
            // Skill cost is mirrored into armor_class, which is where older sheets stored it
            const currentCost = character.current_skill_cost ?? character.armor_class ?? 10
            const maxCost = character.max_skill_cost ?? character.armor_class ?? 10
            return (
              <ResourceCard
                key={res.id}
                resource={res}
                current={currentCost}
                max={maxCost}
                maxMin={0}
                onCurrentChange={(raw) => {
                  const num = Number(raw)
                  const clamped = Number.isNaN(num) ? 0 : Math.max(0, Math.min(maxCost, num))
                  onCharacterChange({ current_skill_cost: clamped, armor_class: clamped })
                }}
                onMaxChange={(raw) => {
                  const nextMax = Math.max(0, Number(raw) || 0)
                  const nextCur = Math.min(nextMax, currentCost)
                  onCharacterChange({
                    max_skill_cost: nextMax,
                    current_skill_cost: nextCur,
                    armor_class: nextCur,
                  })
                }}
              />
            )
          }

          // Custom Resource (Stress, Sanity, Luck, Mana...)
          const customRes = customValues.resources[res.id] || {
            current: res.defaultMax,
            max: res.defaultMax,
          }
          return (
            <ResourceCard
              key={res.id}
              resource={res}
              current={customRes.current}
              max={customRes.max}
              maxMin={0}
              onCurrentChange={(raw) =>
                onCustomResourceChange(res.id, 'current', Number(raw) || 0)
              }
              onMaxChange={(raw) => onCustomResourceChange(res.id, 'max', Number(raw) || 0)}
            />
          )
        })}
      </div>
    </div>
  )
}

function ResourceCard({
  resource,
  current,
  max,
  maxMin,
  onCurrentChange,
  onMaxChange,
}: {
  resource: TemplateResource
  current: number
  max: number
  maxMin: number
  onCurrentChange: (raw: string) => void
  onMaxChange: (raw: string) => void
}) {
  const colorBorder = RESOURCE_COLOR_BORDER[resource.color] || 'border-zinc-700'
  const colorText = RESOURCE_COLOR_TEXT[resource.color] || 'text-zinc-400'

  return (
    <div className={`p-3.5 bg-black/30 border rounded-xl space-y-2 ${colorBorder}`}>
      <div className="flex justify-between items-center text-xs">
        <span className={`font-semibold ${colorText}`}>{resource.label}</span>
        <span className="text-[11px] font-mono text-zinc-400">
          {current} / {max}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-[10px] text-zinc-500 font-mono">Current</label>
          <input
            type="number"
            min={0}
            max={max}
            value={current}
            onChange={(e) => onCurrentChange(e.target.value)}
            className={SMALL_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono">Max</label>
          <input
            type="number"
            min={maxMin}
            value={max}
            onChange={(e) => onMaxChange(e.target.value)}
            className={SMALL_INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Condition, stats, text fields & equipment                           */
/* ------------------------------------------------------------------ */

// Status Condition (populated dynamically from template.conditions)
export function ConditionField({
  template,
  value,
  onChange,
}: {
  template: CharacterTemplate
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useLanguage()
  // Keep a condition that the template does not list so the select does not silently change it
  const isUnlisted = !template.conditions.includes(value || '') && !!value

  return (
    <div>
      <label className={SECTION_LABEL_CLASS}>{t('character.statusCondition')}</label>
      <select
        value={value || template.conditions[0] || 'Normal'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all cursor-pointer"
      >
        {template.conditions.map((cond) => (
          <option key={cond} value={cond}>
            {cond}
          </option>
        ))}
        {isUnlisted && <option value={value}>{value} (Custom)</option>}
      </select>
    </div>
  )
}

export function StatsSection({
  template,
  character,
  customValues,
  onStatChange,
}: {
  template: CharacterTemplate
  character: CharacterRecord
  customValues: SheetCustomValues
  onStatChange: (statId: string, rawValue: string) => void
}) {
  const { t } = useLanguage()
  const charStats = character.stats as Record<string, unknown>

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className={SECTION_LABEL_CLASS}>
          {t('character.statsAndAttributes')} ({template.stats.length})
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {template.stats.map((stat) => {
          const rawVal = isColumnStatId(stat.id)
            ? (charStats?.[stat.id] ?? stat.default)
            : (customValues.stats[stat.id] ?? stat.default)
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
                onChange={(e) => onStatChange(stat.id, e.target.value)}
                className="w-full bg-transparent text-center font-bold text-sm text-white outline-none mt-1"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Dynamic Text Fields (Strengths, Weaknesses, Appearance, Backstory, Crush, etc.)
export function TextFieldsSection({
  template,
  character,
  customValues,
  onFieldChange,
}: {
  template: CharacterTemplate
  character: CharacterRecord
  customValues: SheetCustomValues
  onFieldChange: (fieldId: string, value: string) => void
}) {
  const charMap = character as unknown as Record<string, unknown>

  return (
    <div className="space-y-4">
      {template.textFields.map((field) => {
        const val = isColumnTextFieldId(field.id)
          ? (charMap[field.id] as string) || ''
          : customValues.fields[field.id] || ''

        return (
          <div key={field.id}>
            <label className={SECTION_LABEL_CLASS}>{field.label}</label>
            <textarea
              rows={field.rows || 2}
              placeholder={field.placeholder}
              value={val}
              onChange={(e) => onFieldChange(field.id, e.target.value)}
              className={FIELD_INPUT_CLASS}
            />
          </div>
        )
      })}
    </div>
  )
}

export function EquipmentSection({
  template,
  equipment,
  customValues,
  onSlotChange,
}: {
  template: CharacterTemplate
  equipment: string[] | undefined
  customValues: SheetCustomValues
  onSlotChange: (slotId: string, value: string) => void
}) {
  const { t } = useLanguage()

  return (
    <div>
      <label className={`${SECTION_LABEL_CLASS} block mb-2`}>
        {t('character.equipmentSlots')} ({template.equipmentSlots.length})
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {template.equipmentSlots.map((slot) => {
          const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
          const val =
            colIdx !== undefined
              ? (equipment ?? EMPTY_EQUIPMENT)[colIdx] || ''
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
                onChange={(e) => onSlotChange(slot.id, e.target.value)}
                className="w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-xs text-zinc-100 focus:border-zinc-600 outline-none"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Skills & inventory (editable lists)                                 */
/* ------------------------------------------------------------------ */

export function SkillsSection({
  skills,
  onAdd,
  onChange,
  onRemove,
}: {
  skills: CharacterSkill[]
  onAdd: () => void
  onChange: (index: number, field: 'name' | 'cost' | 'description', value: string | number) => void
  onRemove: (index: number) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="space-y-3">
      <ListSectionHeader
        icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
        title={t('character.skills')}
        count={`${skills.length} slot(s)`}
      />

      <div className="space-y-3">
        {skills.map((skill, idx) => (
          <ListRowCard
            key={idx}
            title={`Skill #${idx + 1}`}
            removeTitle="Remove skill"
            onRemove={() => onRemove(idx)}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <label className={ROW_LABEL_CLASS}>Skill Name :</label>
                <input
                  type="text"
                  placeholder="e.g., Fireball, Shadow Step..."
                  value={skill.name}
                  onChange={(e) => onChange(idx, 'name', e.target.value)}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-1">
                <label className={ROW_LABEL_CLASS}>Skill Cost :</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={skill.cost ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    onChange(idx, 'cost', Number.isNaN(val) ? 0 : Math.max(0, val))
                  }}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <label className={ROW_LABEL_CLASS}>Description :</label>
                <input
                  type="text"
                  placeholder="Describe what this skill does..."
                  value={skill.description}
                  onChange={(e) => onChange(idx, 'description', e.target.value)}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
            </div>
          </ListRowCard>
        ))}

        {skills.length === 0 && (
          <p className="text-xs text-zinc-500 italic">
            No skills added yet. Click &quot;Add Skill&quot; below to add a skill slot.
          </p>
        )}
      </div>

      <AddListItemButton onClick={onAdd}>{t('character.addSkill')}</AddListItemButton>
    </div>
  )
}

export function InventorySection({
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  items: CharacterInventoryItem[]
  onAdd: () => void
  onChange: (
    index: number,
    field: 'name' | 'quantity' | 'description',
    value: string | number,
  ) => void
  onRemove: (index: number) => void
}) {
  const { t } = useLanguage()

  return (
    <div className="space-y-3">
      <ListSectionHeader
        icon={<Package className="w-3.5 h-3.5 text-amber-400" />}
        title={t('character.inventory')}
        count={`${items.length} item(s)`}
      />

      <div className="space-y-3">
        {items.map((item, idx) => (
          <ListRowCard
            key={idx}
            title={`Item #${idx + 1}`}
            removeTitle="Remove item"
            onRemove={() => onRemove(idx)}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className={ROW_LABEL_CLASS}>Item Name :</label>
                <input
                  type="text"
                  placeholder="e.g., Health Potion, Rope..."
                  value={item.name}
                  onChange={(e) => onChange(idx, 'name', e.target.value)}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-1">
                <label className={ROW_LABEL_CLASS}>Quantity :</label>
                <input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={item.quantity ?? 1}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    onChange(idx, 'quantity', Number.isNaN(val) ? 1 : Math.max(1, Math.round(val)))
                  }}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <label className={ROW_LABEL_CLASS}>Description :</label>
                <input
                  type="text"
                  placeholder="e.g., Restores 20 HP, 50ft length..."
                  value={item.description || ''}
                  onChange={(e) => onChange(idx, 'description', e.target.value)}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
            </div>
          </ListRowCard>
        ))}

        {items.length === 0 && (
          <p className="text-xs text-zinc-500 italic">
            No items in inventory yet. Click &quot;Add Item&quot; below to add an item.
          </p>
        )}
      </div>

      <AddListItemButton onClick={onAdd}>{t('character.addItem')}</AddListItemButton>
    </div>
  )
}

function ListSectionHeader({
  icon,
  title,
  count,
}: {
  icon: ReactNode
  title: string
  count: string
}) {
  return (
    <div className="flex items-center justify-between">
      <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5`}>
        {icon} {title}
      </label>
      <span className="text-[11px] text-zinc-500 font-mono">{count}</span>
    </div>
  )
}

function ListRowCard({
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
    <div className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-amber-500 font-mono uppercase">{title}</span>
        <button
          type="button"
          onClick={onRemove}
          title={removeTitle}
          className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

function AddListItemButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" /> {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Footer actions                                                      */
/* ------------------------------------------------------------------ */

export function SheetFormActions({
  canDelete,
  isDeletingThis,
  isDeletingAny,
  isSaving,
  onDelete,
  onCancel,
}: {
  canDelete: boolean
  isDeletingThis: boolean
  isDeletingAny: boolean
  isSaving: boolean
  onDelete: () => void
  onCancel: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletingAny || isSaving}
          className="px-3 py-2 text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isDeletingThis ? (
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
          onClick={onCancel}
          className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSaving || isDeletingAny}
          className="px-5 py-2.5 text-xs bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 rounded-xl font-semibold cursor-pointer disabled:opacity-50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
        >
          {isSaving ? t('character.savingChar') : t('character.saveChar')}
        </button>
      </div>
    </div>
  )
}
