'use client'

import type { ReactNode } from 'react'
import { Heart, Package, Sparkles, Zap } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  EMPTY_EQUIPMENT,
  extractCharacterInventory,
  extractCharacterSkills,
  getHpTailwindClass,
} from '@/features/character/domain'
import {
  COLUMN_EQUIPMENT_SLOT_INDEX,
  isColumnStatId,
  isColumnTextFieldId,
  type CharacterTemplate,
  type ResourceColor,
  type SheetCustomValues,
  type TemplateResource,
} from '@/features/character/template'
import { abilityModifier, formatModifier } from '@/components/dice/dice'
import { SaoDualSemicircleDial } from './SaoDualSemicircleDial'
import type { Character } from '../types'

const CUSTOM_RESOURCE_BAR_COLOR: Record<
  ResourceColor,
  { text: string; bg: string }
> = {
  red: { text: 'text-red-400', bg: 'bg-red-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-400' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-400' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-400' },
  zinc: { text: 'text-zinc-400', bg: 'bg-zinc-400' },
}

const SECTION_TITLE_CLASS =
  'text-[10px] uppercase font-mono tracking-wider text-amber-400/90'

function toPercent(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)))
}

type CharacterSheetViewProps = {
  activeChar: Character
  template: CharacterTemplate
  custom: SheetCustomValues
  currentSkillCost: number
  maxSkillCost: number
}

// Read-only SAO character sheet: dial crest, resource gauges, stats, gear, skills, inventory and profile
export default function CharacterSheetView({
  activeChar,
  template,
  custom,
  currentSkillCost,
  maxSkillCost,
}: CharacterSheetViewProps) {
  return (
    <div className="space-y-4">
      {/* 1. Top 2-Part Semicircle Crest inside Window */}
      <div className="flex flex-col items-center rounded bg-zinc-900/60 border border-white/10 p-3">
        <div className="w-52 h-52">
          <SaoDualSemicircleDial
            activeChar={activeChar}
            currentSkillCost={currentSkillCost}
            maxSkillCost={maxSkillCost}
            isOpen={true}
            variant="crest"
          />
        </div>

        {/* SAO Linear Resource Gauge Bars right beneath the dial (ordered by template.resources) */}
        {template.resources.length > 0 && (
          <ResourceGaugeGrid
            activeChar={activeChar}
            template={template}
            custom={custom}
            currentSkillCost={currentSkillCost}
            maxSkillCost={maxSkillCost}
          />
        )}
      </div>

      {/* 2. Full Details Section (ภายใต้ครึ่งวงกลม = ข้อมูลเต็ม) */}
      <div className="space-y-2.5">
        <StatusConditionRow condition={activeChar.status_condition} />
        {template.stats.length > 0 && (
          <StatGrid activeChar={activeChar} template={template} custom={custom} />
        )}
      </div>

      {template.equipmentSlots.length > 0 && (
        <EquipmentGrid activeChar={activeChar} template={template} custom={custom} />
      )}
      {template.sections.skills && <SkillList activeChar={activeChar} />}
      {template.sections.inventory && <InventoryList activeChar={activeChar} />}
      <ProfileFields activeChar={activeChar} template={template} custom={custom} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resource gauges                                                     */
/* ------------------------------------------------------------------ */

function ResourceGaugeGrid({
  activeChar,
  template,
  custom,
  currentSkillCost,
  maxSkillCost,
}: CharacterSheetViewProps) {
  const curHp = activeChar.current_hp ?? 0
  const maxHp = Math.max(1, activeChar.max_hp ?? 1)
  const hpColors = getHpTailwindClass(curHp, maxHp)
  const hpLabel = template.resources.find((r) => r.id === 'hp')?.label || 'HP'
  const spLabel = getSkillCostLabel(template)

  return (
    <div
      className={`w-full grid ${
        template.resources.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      } gap-3 mt-2 pt-2.5 border-t border-white/10`}
    >
      {template.resources.map((res) => {
        if (res.id === 'hp') {
          return (
            <ResourceGauge
              key={res.id}
              label={
                <>
                  <Heart className={`w-3 h-3 shrink-0 ${hpColors.text}`} />{' '}
                  {hpLabel}
                </>
              }
              labelClassName="flex items-center gap-1 text-zinc-300 truncate"
              valueText={
                <>
                  {activeChar.current_hp} / {activeChar.max_hp}
                </>
              }
              valueClassName="text-white"
              percent={toPercent(curHp, maxHp)}
              barClassName={hpColors.bg}
            />
          )
        }

        if (res.id === 'skill_cost') {
          return (
            <ResourceGauge
              key={res.id}
              label={
                <>
                  <Zap className="w-3 h-3 text-sky-400 shrink-0" /> {spLabel}
                </>
              }
              labelClassName="flex items-center gap-1 text-zinc-300 truncate"
              valueText={`${currentSkillCost} / ${maxSkillCost}`}
              valueClassName="text-sky-300"
              percent={toPercent(currentSkillCost, maxSkillCost)}
              barClassName="bg-sky-400"
            />
          )
        }

        return <CustomResourceGauge key={res.id} resource={res} custom={custom} />
      })}
    </div>
  )
}

function CustomResourceGauge({
  resource,
  custom,
}: {
  resource: TemplateResource
  custom: SheetCustomValues
}) {
  const val = custom.resources[resource.id] || {
    current: resource.defaultMax,
    max: resource.defaultMax,
  }
  const colorTheme =
    CUSTOM_RESOURCE_BAR_COLOR[resource.color] || CUSTOM_RESOURCE_BAR_COLOR.zinc

  return (
    <ResourceGauge
      label={resource.label}
      labelClassName={`truncate font-semibold ${colorTheme.text}`}
      valueText={`${val.current} / ${val.max}`}
      valueClassName="text-white"
      percent={toPercent(val.current, val.max)}
      barClassName={colorTheme.bg}
    />
  )
}

function ResourceGauge({
  label,
  labelClassName,
  valueText,
  valueClassName,
  percent,
  barClassName,
}: {
  label: ReactNode
  labelClassName: string
  valueText: ReactNode
  valueClassName: string
  percent: number
  barClassName: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
        <span className={labelClassName}>{label}</span>
        <span className={`${valueClassName} font-bold shrink-0`}>{valueText}</span>
      </div>
      <div className="h-2 w-full bg-zinc-950 border border-white/15 rounded-xs overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// The built-in "Skill Cost" resource is shown as "SKILL PT" on the sheet
function getSkillCostLabel(template: CharacterTemplate): string {
  const spResourceDef = template.resources.find((r) => r.id === 'skill_cost')
  return spResourceDef?.id === 'skill_cost' &&
    spResourceDef.label === 'Skill Cost'
    ? 'SKILL PT'
    : spResourceDef?.label || 'SKILL PT'
}

/* ------------------------------------------------------------------ */
/* Condition & stats                                                   */
/* ------------------------------------------------------------------ */

function StatusConditionRow({ condition }: { condition: string | null | undefined }) {
  const { t } = useLanguage()
  const isNormal = condition === 'Normal' || !condition

  return (
    <div className="p-2.5 bg-zinc-900/70 border border-white/10 rounded flex justify-between items-center">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />{' '}
        {t('character.statusCondition')}
      </span>
      <span
        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
          isNormal
            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
            : 'bg-amber-950 text-amber-300 border border-amber-700'
        }`}
      >
        {condition || 'Normal'}
      </span>
    </div>
  )
}

type SheetSectionProps = {
  activeChar: Character
  template: CharacterTemplate
  custom: SheetCustomValues
}

function StatGrid({ activeChar, template, custom }: SheetSectionProps) {
  const modStyle = template.mechanics.statModifier

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
      {template.stats.map((stat) => {
        const raw = isColumnStatId(stat.id)
          ? (activeChar.stats?.[stat.id] ?? stat.default)
          : (custom.stats[stat.id] ?? activeChar.stats?.[stat.id] ?? stat.default)
        const numericRaw =
          typeof raw === 'number' || typeof raw === 'string' ? raw : stat.default
        const mod = abilityModifier(numericRaw, modStyle)
        return (
          <div
            key={stat.id}
            className="bg-zinc-900/70 border border-white/10 rounded p-1.5 text-center"
          >
            <span
              className="text-[9px] text-zinc-400 block uppercase font-mono truncate"
              title={stat.label}
            >
              {stat.label}
            </span>
            <span className="font-bold text-white text-xs font-mono block">
              {String(raw)}
            </span>
            <span className="text-[9px] font-mono text-amber-400 block">
              {modStyle === 'none' ? '—' : formatModifier(mod)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Equipment, skills, inventory & profile                              */
/* ------------------------------------------------------------------ */

function EquipmentGrid({ activeChar, template, custom }: SheetSectionProps) {
  const { t } = useLanguage()

  return (
    <div>
      <span className={`${SECTION_TITLE_CLASS} block mb-1.5`}>
        {t('character.equipmentSlots')}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {template.equipmentSlots.map((slot) => {
          const colIdx = COLUMN_EQUIPMENT_SLOT_INDEX[slot.id]
          const item =
            colIdx !== undefined
              ? (activeChar.equipment ?? EMPTY_EQUIPMENT)[colIdx]
              : custom.equipment[slot.id]
          return (
            <div
              key={slot.id}
              className="p-2 bg-zinc-900/70 border border-white/10 rounded text-[11px]"
            >
              <span className="text-[9px] text-zinc-500 uppercase font-mono block">
                {slot.label}
              </span>
              <span className="text-zinc-200 wrap-break-words">{item || '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SkillList({ activeChar }: { activeChar: Character }) {
  const skills = extractCharacterSkills(activeChar)

  return (
    <div>
      <span className={`${SECTION_TITLE_CLASS} flex items-center gap-1 mb-1.5`}>
        <Sparkles className="w-3 h-3" /> Skills ({skills.length})
      </span>
      {skills.length > 0 ? (
        <div className="space-y-1.5">
          {skills.map((skill, idx) => (
            <EntryCard
              key={idx}
              title={skill.name || 'Unnamed Skill'}
              badge={`Cost: ${skill.cost ?? 0}`}
              badgeClassName="bg-sky-950/80 border-sky-800/70 text-sky-300"
              description={skill.description}
            />
          ))}
        </div>
      ) : (
        <EmptyNote>No skills registered</EmptyNote>
      )}
    </div>
  )
}

function InventoryList({ activeChar }: { activeChar: Character }) {
  const inventory = extractCharacterInventory(activeChar)

  return (
    <div>
      <span className={`${SECTION_TITLE_CLASS} flex items-center gap-1.5 mb-1.5`}>
        <Package className="w-3 h-3" /> Inventory ({inventory.length})
      </span>
      {inventory.length > 0 ? (
        <div className="space-y-1.5">
          {inventory.map((item, idx) => (
            <EntryCard
              key={idx}
              title={item.name || 'Unnamed Item'}
              badge={`x${item.quantity}`}
              badgeClassName="bg-amber-950/80 border-amber-800/70 text-amber-300"
              description={item.description}
            />
          ))}
        </div>
      ) : (
        <EmptyNote>Inventory is empty</EmptyNote>
      )}
    </div>
  )
}

function EntryCard({
  title,
  badge,
  badgeClassName,
  description,
}: {
  title: string
  badge: string
  badgeClassName: string
  description?: string
}) {
  return (
    <div className="p-2.5 bg-zinc-900/70 border border-white/10 rounded text-[11px] space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-amber-300 font-bold">{title}</span>
        <span
          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono shrink-0 ${badgeClassName}`}
        >
          {badge}
        </span>
      </div>
      {description && (
        <p className="text-zinc-300 whitespace-pre-line leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="p-2.5 bg-zinc-900/50 border border-white/10 rounded text-zinc-500 italic text-[11px]">
      {children}
    </div>
  )
}

// Character Traits & Lore (Dynamic Template Text Fields) — only fields with content are shown
function ProfileFields({ activeChar, template, custom }: SheetSectionProps) {
  const charMap = activeChar as unknown as Record<string, unknown>
  const populatedTextFields = template.textFields
    .map((field) => {
      const value = isColumnTextFieldId(field.id)
        ? String(charMap[field.id] || '').trim()
        : String(custom.fields[field.id] || '').trim()
      return { field, value }
    })
    .filter((entry) => entry.value.length > 0)

  if (populatedTextFields.length === 0) return null

  return (
    <div className="space-y-2 pt-1 border-t border-white/10">
      <span className={`${SECTION_TITLE_CLASS} block`}>Character Profile</span>
      {populatedTextFields.map(({ field, value }) => {
        const labelColor =
          field.id === 'strengths'
            ? 'text-emerald-400'
            : field.id === 'weaknesses'
              ? 'text-red-400'
              : 'text-zinc-400'
        return (
          <div
            key={field.id}
            className="p-2 bg-zinc-900/60 border border-white/10 rounded text-[11px]"
          >
            <span className={`text-[9px] uppercase font-mono block ${labelColor}`}>
              {field.label}
            </span>
            <p className="text-zinc-300 whitespace-pre-line">{value}</p>
          </div>
        )
      })}
    </div>
  )
}
