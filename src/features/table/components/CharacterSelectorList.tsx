'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Plus, Sliders, Sparkles, User } from 'lucide-react'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { extractCharacterSkillCost } from '@/features/character/domain'
import {
  readCharacterTemplate,
  type CharacterTemplate,
} from '@/features/character/template'
import type { Character } from '../types'

const CREATE_CHARACTER_LINK_CLASS =
  'inline-flex items-center justify-center gap-1.5 w-full py-2 bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer'

// Character Codex link that opens a blank sheet in the table's template and comes back here afterwards
function buildCreateCharacterHref(tableCode: string, templateId: string): string {
  return `/characters?tableCode=${encodeURIComponent(tableCode)}&templateId=${encodeURIComponent(templateId)}&returnTo=${encodeURIComponent(`/table/${tableCode}`)}`
}

type CharacterSelectorListProps = {
  userCharacters: Character[]
  campaignTemplate: CharacterTemplate
  tableCode: string
  isSwitchingChar: boolean
  onCancelSwitch: () => void
  onSelectCharacter: (charId: string) => void
}

// Character picker shown in the SAO window when no sheet is bound yet or the player is switching sheets
export default function CharacterSelectorList({
  userCharacters,
  campaignTemplate,
  tableCode,
  isSwitchingChar,
  onCancelSwitch,
  onSelectCharacter,
}: CharacterSelectorListProps) {
  const { showAlert } = useAlert()
  const router = useRouter()
  const { t, language } = useLanguage()
  const createHref = buildCreateCharacterHref(tableCode, campaignTemplate.id)
  const hasCompatibleCharacter = userCharacters.some(
    (c) => readCharacterTemplate(c).id === campaignTemplate.id,
  )

  const showMismatchAlert = (char: Character, charTemplate: CharacterTemplate) => {
    showAlert({
      title:
        language === 'en'
          ? 'Sheet Format Mismatches Campaign Requirements'
          : 'รูปแบบชีทไม่ตรงกับข้อกำหนดของแคมเปญ',
      status: 'warning',
      badge: 'Sheet Mismatch',
      maxWidth: 'md',
      buttonText: language === 'en' ? 'Pick Another Character' : 'เลือกตัวละครอื่น',
      action: {
        label:
          language === 'en'
            ? 'Create New Character For This Campaign'
            : 'สร้างตัวละครใหม่สำหรับแคมเปญนี้',
        variant: 'accent',
        onClick: () => {
          router.push(createHref)
        },
      },
      message: (
        <MismatchAlertMessage
          char={char}
          charTemplate={charTemplate}
          campaignTemplate={campaignTemplate}
        />
      ),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('sao.selectCharBelow')}</span>
        </label>
        {isSwitchingChar && (
          <button
            type="button"
            onClick={onCancelSwitch}
            className="text-[10px] font-mono uppercase text-zinc-400 hover:text-white cursor-pointer"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>

      <CampaignRequirementBanner template={campaignTemplate} />

      {/* 1-Click Create Character for Campaign */}
      <Link
        href={createHref}
        className="w-full py-2.5 px-3 bg-linear-to-r from-amber-600/90 to-amber-500/90 hover:from-amber-600 hover:to-amber-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> {t('sao.createCharButton')}
      </Link>

      {/* Character List with Compatibility Checking */}
      <div className="space-y-2 pt-1">
        {userCharacters.map((char) => (
          <CharacterOption
            key={char.id}
            char={char}
            campaignTemplate={campaignTemplate}
            onSelect={onSelectCharacter}
            onMismatch={showMismatchAlert}
          />
        ))}
      </div>

      {userCharacters.length > 0 && !hasCompatibleCharacter && (
        <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs space-y-2 text-amber-200">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {language === 'en'
                ? 'No character matches this campaign yet'
                : 'ยังไม่มีตัวละครที่ตรงตามเงื่อนไขของแคมเปญนี้'}
            </span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            แคมเปญนี้กำหนดให้ใช้รูปแบบชีท{' '}
            <strong className="text-white font-medium">&ldquo;{campaignTemplate.name}&rdquo;</strong>{' '}
            คุณสามารถกดปุ่มด้านล่างเพื่อสร้างตัวละครที่ตรงตามเงื่อนไขได้ทันที
          </p>
          <Link href={createHref} className={CREATE_CHARACTER_LINK_CLASS}>
            <Plus className="w-3.5 h-3.5" /> {t('sao.createCharButton')}
          </Link>
        </div>
      )}

      {userCharacters.length === 0 && (
        <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-center space-y-2.5">
          <p className="text-xs text-zinc-400">
            {language === 'en'
              ? 'No character sheets found in your codex'
              : 'ยังไม่พบแผ่นตัวละครในคลังของคุณ'}
          </p>
          <Link href={createHref} className={CREATE_CHARACTER_LINK_CLASS}>
            <Plus className="w-3.5 h-3.5" /> {t('sao.createCharButton')}
          </Link>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Campaign requirement & character options                            */
/* ------------------------------------------------------------------ */

function CampaignRequirementBanner({ template }: { template: CharacterTemplate }) {
  const { t, language } = useLanguage()
  const chipClass = 'bg-zinc-900/90 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded'

  return (
    <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-amber-300 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          {language === 'en' ? 'Required:' : 'ข้อกำหนด:'} {template.name} (
          {language === 'en' ? 'Sheet Creator' : 'ผู้สร้างชีท'}:{' '}
          {template.author || 'Campaign Creator'})
        </span>
        <span className="text-[10px] font-medium bg-amber-900/70 text-amber-200 px-2 py-0.5 rounded border border-amber-700/60">
          {t('sao.enforced')}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 leading-snug">{template.description}</p>
      <div className="flex flex-wrap gap-1 text-[10px] pt-0.5">
        {template.resources.length > 0 ? (
          template.resources.map((r) => (
            <span
              key={r.id}
              className="bg-zinc-900/90 border border-zinc-700/60 text-zinc-300 px-1.5 py-0.5 rounded"
            >
              {r.label}
            </span>
          ))
        ) : (
          <span className="bg-amber-950/80 border border-amber-800 text-amber-300 px-1.5 py-0.5 rounded font-medium">
            {t('sao.inventoryCluesOnly')}
          </span>
        )}
        <span className={chipClass}>{template.stats.length} Stats</span>
        <span className={chipClass}>{template.equipmentSlots.length} Gear Slots</span>
      </div>
    </div>
  )
}

function CharacterOption({
  char,
  campaignTemplate,
  onSelect,
  onMismatch,
}: {
  char: Character
  campaignTemplate: CharacterTemplate
  onSelect: (charId: string) => void
  onMismatch: (char: Character, charTemplate: CharacterTemplate) => void
}) {
  const { t } = useLanguage()
  const charTemplate = readCharacterTemplate(char)
  const isCompatible = charTemplate.id === campaignTemplate.id
  const cost = extractCharacterSkillCost(char)

  return (
    <button
      type="button"
      onClick={() => {
        if (!isCompatible) {
          onMismatch(char, charTemplate)
          return
        }
        onSelect(char.id)
      }}
      className={`w-full text-left p-3 rounded-lg border text-xs transition cursor-pointer ${
        isCompatible
          ? 'bg-zinc-900/80 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/20 ring-1 ring-emerald-500/20'
          : 'bg-zinc-950/60 border-zinc-800/80 opacity-60 hover:opacity-90 hover:border-red-500/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-bold text-white flex items-center gap-1.5">
          {char.name}
          {isCompatible ? (
            <span className="text-[10px] font-normal bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Check className="w-3 h-3" /> {t('sao.compatible')}
            </span>
          ) : (
            <span className="text-[10px] font-normal bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.5 rounded">
              {charTemplate.name} ({charTemplate.author || 'D&D Playground'})
            </span>
          )}
        </p>
        {!isCompatible && (
          <span className="text-[10px] text-red-400 flex items-center gap-1 font-mono">
            <AlertCircle className="w-3 h-3" /> {t('sao.mismatched')}
          </span>
        )}
      </div>
      <p className="text-zinc-400 font-mono text-[11px] mt-1">
        {char.class_archetype || 'Adventurer'}
        {charTemplate.resources.length > 0
          ? ` · HP ${char.current_hp ?? 0}/${char.max_hp ?? 0} · SP ${cost.currentSkillCost}/${cost.maxSkillCost}`
          : ' · 0 Resources (Item/Clue only)'}
      </p>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Mismatch alert body                                                 */
/* ------------------------------------------------------------------ */

const TEMPLATE_SUMMARY_TONES = {
  character: {
    wrapper: 'border-b border-zinc-800/80 pb-2.5',
    heading: 'text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold',
    name: 'text-amber-400 font-bold text-sm block mt-0.5',
    author: 'text-xs text-zinc-400 font-normal',
    chip: 'text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700',
  },
  required: {
    wrapper: 'pt-0.5',
    heading:
      'text-[10px] text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1',
    name: 'text-emerald-300 font-bold text-sm block mt-0.5',
    author: 'text-xs text-emerald-400/80 font-normal',
    chip: 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80',
  },
} as const

function TemplateSummary({
  heading,
  template,
  authorFallback,
  tone,
}: {
  heading: ReactNode
  template: CharacterTemplate
  authorFallback: string
  tone: keyof typeof TEMPLATE_SUMMARY_TONES
}) {
  const styles = TEMPLATE_SUMMARY_TONES[tone]

  return (
    <div className={styles.wrapper}>
      <span className={styles.heading}>{heading}</span>
      <span className={styles.name}>
        {template.name}{' '}
        <span className={styles.author}>
          (ผู้สร้าง: {template.author || authorFallback})
        </span>
      </span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className={styles.chip}>
          {template.resources.length > 0
            ? `${template.resources.length} หลอดพลัง (${template.resources.map((r) => r.label).join(', ')})`
            : '0 หลอดพลัง (เน้นไอเทม & เบาะแส)'}
        </span>
        <span className={styles.chip}>{template.stats.length} สเตตัส</span>
        <span className={styles.chip}>{template.equipmentSlots.length} ช่องอุปกรณ์</span>
      </div>
    </div>
  )
}

function MismatchAlertMessage({
  char,
  charTemplate,
  campaignTemplate,
}: {
  char: Character
  charTemplate: CharacterTemplate
  campaignTemplate: CharacterTemplate
}) {
  return (
    <div className="space-y-3 text-xs">
      <p className="text-zinc-300 leading-relaxed">
        ไม่สามารถนำตัวละคร{' '}
        <strong className="text-white font-semibold">&ldquo;{char.name}&rdquo;</strong>{' '}
        เข้าร่วมเล่นได้ เนื่องจากแคมเปญนี้กำหนดโครงสร้างแผ่นตัวละครเฉพาะ
      </p>

      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 space-y-3 text-left">
        <TemplateSummary
          tone="character"
          heading={`รูปแบบของตัวละครนี้ (${char.name})`}
          template={charTemplate}
          authorFallback="D&D Playground"
        />
        <TemplateSummary
          tone="required"
          heading={
            <>
              <Check className="w-3 h-3" /> แคมเปญนี้กำหนดให้ใช้ (Required Format)
            </>
          }
          template={campaignTemplate}
          authorFallback="Campaign Creator"
        />
      </div>

      <div className="p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg text-amber-200/90 text-[11px] leading-relaxed flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>คำแนะนำ:</strong> คุณสามารถกดปุ่ม{' '}
          <span className="text-amber-300 underline font-semibold">
            &ldquo;สร้างตัวละครใหม่สำหรับแคมเปญนี้&rdquo;
          </span>{' '}
          ด้านล่าง เพื่อเข้าสู่หน้าสร้างตัวละครด้วยเทมเพลตที่ตรงกับแคมเปญได้ทันที
        </span>
      </div>
    </div>
  )
}
