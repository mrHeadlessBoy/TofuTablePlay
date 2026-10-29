'use client'

import { Check, RotateCcw, Sliders, Sparkles } from 'lucide-react'
import { BUILTIN_TEMPLATES, type CharacterTemplate } from '@/features/character/template'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const SELECTED_CARD_CLASS = 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30'
const IDLE_CARD_CLASS = 'bg-black/40 border-zinc-800/80 hover:border-zinc-700/80'

type CampaignTemplatePickerProps = {
  selectedTemplate: CharacterTemplate
  isCustomTemplate: boolean
  onSelectPreset: (preset: CharacterTemplate) => void
  onCustomizePreset: (preset: CharacterTemplate) => void
  onStartCustom: () => void
  onResetToBlank: () => void
}

// Section 2: Character Sheet Template Requirement (built-in presets or a custom sheet)
export default function CampaignTemplatePicker({
  selectedTemplate,
  isCustomTemplate,
  onSelectPreset,
  onCustomizePreset,
  onStartCustom,
  onResetToBlank,
}: CampaignTemplatePickerProps) {
  const { t } = useLanguage()

  return (
    <div className="surface-panel rounded-2xl p-6 space-y-6 shadow-lg">
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
        Every player joining this campaign will play using this character sheet format. Choose a
        built-in genre preset or design your own custom sheet template.
      </p>

      {/* Built-in Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BUILTIN_TEMPLATES.map((preset) => (
          <PresetTemplateCard
            key={preset.id}
            preset={preset}
            isSelected={!isCustomTemplate && selectedTemplate.id === preset.id}
            onSelect={() => onSelectPreset(preset)}
            onCustomize={() => onCustomizePreset(preset)}
          />
        ))}
      </div>

      <CustomTemplateOption
        selectedTemplate={selectedTemplate}
        isCustomTemplate={isCustomTemplate}
        onStartCustom={onStartCustom}
        onResetToBlank={onResetToBlank}
      />
    </div>
  )
}

function PresetTemplateCard({
  preset,
  isSelected,
  onSelect,
  onCustomize,
}: {
  preset: CharacterTemplate
  isSelected: boolean
  onSelect: () => void
  onCustomize: () => void
}) {
  const { t } = useLanguage()
  const chipClass = 'bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded'

  return (
    <div
      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
        isSelected ? SELECTED_CARD_CLASS : IDLE_CARD_CLASS
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-sm text-white flex items-center gap-1.5">
            {preset.name}{' '}
            <span className="text-[10px] text-zinc-500 font-mono font-normal">
              (โดย {preset.author || 'D&D Playground'})
            </span>
          </div>
          {isSelected && <Check className="w-4 h-4 text-amber-400" />}
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{preset.description}</p>
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
          <span className={chipClass}>{preset.stats.length} Stats</span>
          <span className={chipClass}>{preset.equipmentSlots.length} Gear Slots</span>
        </div>

        <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSelect}
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
            onClick={onCustomize}
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
}

// One-line summary of a custom sheet's shape
function describeCustomTemplate(template: CharacterTemplate): string {
  const resources =
    template.resources.length === 0
      ? '0 Resource Bars (Item-Only)'
      : `${template.resources.length} resources`
  return `"${template.name}" (โดย ${template.author || 'Campaign Creator'}) — ${resources}, ${template.stats.length} stats, ${template.equipmentSlots.length} equipment slots, ${template.conditions.length} conditions.`
}

// Custom Campaign Sheet Option
function CustomTemplateOption({
  selectedTemplate,
  isCustomTemplate,
  onStartCustom,
  onResetToBlank,
}: {
  selectedTemplate: CharacterTemplate
  isCustomTemplate: boolean
  onStartCustom: () => void
  onResetToBlank: () => void
}) {
  const { t, language } = useLanguage()

  return (
    <div
      onClick={onStartCustom}
      className={`p-4 rounded-xl border transition cursor-pointer ${
        isCustomTemplate ? SELECTED_CARD_CLASS : IDLE_CARD_CLASS
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
              ? describeCustomTemplate(selectedTemplate)
              : 'ออกแบบโครงสร้างแผ่นตัวละครด้วยตัวเอง เริ่มต้นจากชีทว่างเปล่าโดยไม่มีสเตตัสหรือหลอดพลังงานค้างไว้ (สามารถใส่เฉพาะไอเทม หรือสเตตัสเฉพาะตามใจชอบ)'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCustomTemplate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onResetToBlank()
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
              onStartCustom()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition font-medium cursor-pointer shadow"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>
              {isCustomTemplate ? t('campaign.editInBuilder') : t('campaign.createBlankSheet')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
