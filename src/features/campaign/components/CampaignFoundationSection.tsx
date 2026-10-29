'use client'

import { Plus, Sparkles, Trash2 } from 'lucide-react'
import type { CampaignRuleMechanic } from '@/features/campaign/rules'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const CATEGORIES = [
  'Fantasy',
  'Sci-Fi',
  'Horror',
  'Comedy',
  'Romance',
  'Slice of Life / Cozy',
  'Post-Apocalyptic',
  'Drama',
  'Custom',
]

const FIELD_LABEL_CLASS = 'text-xs text-zinc-400 uppercase font-medium'
const FIELD_INPUT_CLASS =
  'w-full mt-1.5 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none transition-all'
const RULE_INPUT_CLASS =
  'w-full mt-1 bg-black/40 border border-zinc-800/80 rounded-xl p-2 text-xs text-zinc-100 focus:border-zinc-600 outline-none'
const RULE_LABEL_CLASS = 'text-[10px] text-zinc-400 font-mono uppercase block'

export type CampaignFoundationValues = {
  title: string
  category: string
  customCategory: string
  coreDescription: string
  worldSetting: string
}

type CampaignFoundationSectionProps = {
  values: CampaignFoundationValues
  onChange: (patch: Partial<CampaignFoundationValues>) => void
  rules: CampaignRuleMechanic[]
  onRulesChange: (rules: CampaignRuleMechanic[]) => void
}

// Section 1: Campaign Overview (title, genre, brief, world setting and rule mechanics)
export default function CampaignFoundationSection({
  values,
  onChange,
  rules,
  onRulesChange,
}: CampaignFoundationSectionProps) {
  const { t } = useLanguage()

  return (
    <div className="surface-panel rounded-2xl p-6 space-y-5 shadow-lg">
      <h2 className="text-lg font-semibold text-white">{t('campaign.foundation')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL_CLASS}>{t('campaign.campaignTitle')}</label>
          <input
            type="text"
            required
            placeholder={t('campaign.campaignTitlePlaceholder')}
            value={values.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        <div>
          <label className={FIELD_LABEL_CLASS}>{t('campaign.genre')}</label>
          <select
            value={values.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className={FIELD_INPUT_CLASS}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {values.category === 'Custom' && (
        <div>
          <label className={FIELD_LABEL_CLASS}>{t('campaign.genreCustom')}</label>
          <input
            type="text"
            required
            value={values.customCategory}
            onChange={(e) => onChange({ customCategory: e.target.value })}
            className={FIELD_INPUT_CLASS}
          />
        </div>
      )}

      <div>
        <label className={FIELD_LABEL_CLASS}>{t('campaign.coreBrief')}</label>
        <textarea
          required
          rows={3}
          placeholder={t('campaign.coreBriefPlaceholder')}
          value={values.coreDescription}
          onChange={(e) => onChange({ coreDescription: e.target.value })}
          className={FIELD_INPUT_CLASS}
        />
      </div>

      <div>
        <label className={FIELD_LABEL_CLASS}>{t('campaign.worldSetting')}</label>
        <textarea
          required
          rows={3}
          placeholder={t('campaign.worldSettingPlaceholder')}
          value={values.worldSetting}
          onChange={(e) => onChange({ worldSetting: e.target.value })}
          className={FIELD_INPUT_CLASS}
        />
      </div>

      <RuleMechanicsEditor rules={rules} onRulesChange={onRulesChange} />
    </div>
  )
}

// Rule Mechanics & Custom Systems (Structured like Skills & Inventory)
function RuleMechanicsEditor({
  rules,
  onRulesChange,
}: {
  rules: CampaignRuleMechanic[]
  onRulesChange: (rules: CampaignRuleMechanic[]) => void
}) {
  const { t } = useLanguage()

  const updateRule = (index: number, field: keyof CampaignRuleMechanic, value: string) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], [field]: value }
    onRulesChange(updated)
  }

  const addRule = () => {
    onRulesChange([...rules, { id: `rule-${Date.now()}`, title: '', category: '', description: '' }])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-400 uppercase flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {t('campaign.ruleMechanics')}
        </label>
        <span className="text-[11px] text-zinc-500 font-mono">{rules.length} rule(s)</span>
      </div>

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div
            key={rule.id || idx}
            className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-amber-500 font-mono uppercase">Rule #{idx + 1}</span>
              <button
                type="button"
                onClick={() => onRulesChange(rules.filter((_, i) => i !== idx))}
                title="Remove rule"
                className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className={RULE_LABEL_CLASS}>{t('campaign.ruleTitle')} :</label>
                <input
                  type="text"
                  placeholder="e.g., Sanity Meter, Perma-death..."
                  value={rule.title}
                  onChange={(e) => updateRule(idx, 'title', e.target.value)}
                  className={RULE_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-1">
                <label className={RULE_LABEL_CLASS}>{t('campaign.ruleCategory')} :</label>
                <input
                  type="text"
                  placeholder="e.g., Survival, Combat..."
                  value={rule.category || ''}
                  onChange={(e) => updateRule(idx, 'category', e.target.value)}
                  className={RULE_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <label className={RULE_LABEL_CLASS}>{t('campaign.ruleDescription')} :</label>
                <input
                  type="text"
                  placeholder="Describe how this rule works..."
                  value={rule.description}
                  onChange={(e) => updateRule(idx, 'description', e.target.value)}
                  className={RULE_INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <p className="text-xs text-zinc-500 italic">
            {t('campaign.noRulesNote')}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-dashed border-zinc-700 hover:border-amber-500/60 text-amber-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> {t('campaign.addRule')}
      </button>
    </div>
  )
}
