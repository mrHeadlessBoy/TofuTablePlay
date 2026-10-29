'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Edit3, Link2, RotateCcw, Save, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LanguageToggle from '@/components/ui/LanguageToggle'
import {
  extractCharacterInventory,
  extractCharacterSkillCost,
  type CharacterInventoryItem,
} from '@/features/character/domain'
import {
  CLASSIC_TEMPLATE,
  readCharacterTemplate,
  readCustomValues,
  type CharacterTemplate,
} from '@/features/character/template'
import SaoCharacterOrb, {
  DEFAULT_ORB_SCALE_PERCENT,
  MAX_ORB_SCALE_PERCENT,
  MIN_ORB_SCALE_PERCENT,
  ORB_SCALE_STEP_PERCENT,
  SAO_ORB_SCALE_STORAGE_KEY,
  computeEffectiveOrbPx,
  playSaoChime,
} from './SaoCharacterOrb'
import CharacterSelectorList from './CharacterSelectorList'
import CharacterCombatEditor from './CharacterCombatEditor'
import CharacterSheetView from './CharacterSheetView'
import type { Character, CharacterCombatFormState } from '../types'

type CharacterInspectorPanelProps = {
  activeChar: Character | null | undefined
  userCharacters: Character[]
  campaignTemplate?: CharacterTemplate
  isEditingChar: boolean
  isSavingChar: boolean
  isSwitchingChar: boolean
  charForm: CharacterCombatFormState
  tableCode: string
  isHeadTable: boolean
  onToggleEdit: () => void
  onStartSwitch: () => void
  onCancelSwitch: () => void
  onSelectCharacter: (charId: string) => void
  onChangeCharForm: (next: CharacterCombatFormState) => void
  onSaveCharEdits: () => void
  onCancelEdit: () => void
}

export default function CharacterInspectorPanel({
  activeChar,
  userCharacters,
  campaignTemplate = CLASSIC_TEMPLATE,
  isEditingChar,
  isSavingChar,
  isSwitchingChar,
  charForm,
  tableCode,
  isHeadTable,
  onToggleEdit,
  onStartSwitch,
  onCancelSwitch,
  onSelectCharacter,
  onChangeCharForm,
  onSaveCharEdits,
  onCancelEdit,
}: CharacterInspectorPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scalePercent, setScalePercent] = usePersistedOrbScale()
  const viewport = useViewportSize()

  const activeTemplate = readCharacterTemplate(activeChar)
  const activeCustom = readCustomValues(activeChar)
  const formCustom = charForm.sheet_custom ?? activeCustom
  const formInventoryItems: CharacterInventoryItem[] = Array.isArray(charForm.inventory)
    ? charForm.inventory
    : extractCharacterInventory({ inventory: charForm.inventory })
  const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(activeChar)

  const orbSizePx = computeEffectiveOrbPx(scalePercent, viewport.width, viewport.height)

  // Sync dynamic left clearance CSS variable so NarrativeFeedPanel's bottom input never overlaps the orb
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sao-orb-clearance', `${orbSizePx + 32}px`)
    return () => {
      root.style.removeProperty('--sao-orb-clearance')
    }
  }, [orbSizePx])

  // Allow closing the SAO window with Escape when not actively editing inputs
  useEffect(() => {
    if (!isOpen || isEditingChar) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        playSaoChime(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isEditingChar])

  const handleToggleWindow = () => {
    const next = !isOpen
    setIsOpen(next)
    playSaoChime(next)
  }

  const isSelecting = !activeChar || isSwitchingChar

  return (
    <>
      {/* TOP-LEFT COMPACT NAVIGATION BAR (Always accessible when character panel is collapsed) */}
      <TableNavBar tableCode={tableCode} />

      {/* EXTRACTED RESPONSIVE FLOATING SAO CIRCULAR ORB WITH [ − | 100% | + ] SIZE CONTROLS */}
      <SaoCharacterOrb
        activeChar={activeChar}
        currentSkillCost={currentSkillCost}
        maxSkillCost={maxSkillCost}
        isOpen={isOpen}
        orbSizePx={orbSizePx}
        scalePercent={scalePercent}
        onToggle={handleToggleWindow}
        onDecreaseScale={() =>
          setScalePercent((prev) =>
            Math.max(MIN_ORB_SCALE_PERCENT, prev - ORB_SCALE_STEP_PERCENT),
          )
        }
        onIncreaseScale={() =>
          setScalePercent((prev) =>
            Math.min(MAX_ORB_SCALE_PERCENT, prev + ORB_SCALE_STEP_PERCENT),
          )
        }
        onResetScale={() => setScalePercent(DEFAULT_ORB_SCALE_PERCENT)}
      />

      {/* EXPANDED SAO FLOATING CHARACTER WINDOW (2-Part Semicircle Crest on Top + Full Character Sheet Underneath) */}
      {isOpen && (
        <aside
          aria-label="Character Inspector Window"
          style={getWindowStyle(orbSizePx, viewport)}
          className="fixed z-40 w-[calc(100vw-1.5rem)] sm:w-104 flex flex-col rounded-2xl bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-left-3 duration-200"
        >
          {/* SAO Top Glowing Accent Line */}
          <div className="h-0.5 w-full bg-amber-600/60 shrink-0" />

          <InspectorWindowHeader
            activeChar={activeChar}
            activeTemplate={activeTemplate}
            isHeadTable={isHeadTable}
            isEditingChar={isEditingChar}
            isSwitchingChar={isSwitchingChar}
            onToggleEdit={onToggleEdit}
            onStartSwitch={onStartSwitch}
            onClose={handleToggleWindow}
          />

          {/* Scrollable Window Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {isSelecting ? (
              <CharacterSelectorList
                userCharacters={userCharacters}
                campaignTemplate={campaignTemplate}
                tableCode={tableCode}
                isSwitchingChar={isSwitchingChar}
                onCancelSwitch={onCancelSwitch}
                onSelectCharacter={onSelectCharacter}
              />
            ) : isEditingChar ? (
              <CharacterCombatEditor
                template={activeTemplate}
                charForm={charForm}
                formCustom={formCustom}
                formInventoryItems={formInventoryItems}
                onChange={onChangeCharForm}
              />
            ) : (
              <CharacterSheetView
                activeChar={activeChar}
                template={activeTemplate}
                custom={activeCustom}
                currentSkillCost={currentSkillCost}
                maxSkillCost={maxSkillCost}
              />
            )}
          </div>

          {/* SAO Window Footer */}
          {isEditingChar && (
            <EditorFooter
              isSaving={isSavingChar}
              onSave={onSaveCharEdits}
              onCancel={onCancelEdit}
            />
          )}
        </aside>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Hooks & layout helpers                                              */
/* ------------------------------------------------------------------ */

// Orb size preference, restored from and saved to localStorage
function usePersistedOrbScale() {
  const state = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_ORB_SCALE_PERCENT
    try {
      const saved = Number(window.localStorage.getItem(SAO_ORB_SCALE_STORAGE_KEY))
      if (
        Number.isFinite(saved) &&
        saved >= MIN_ORB_SCALE_PERCENT &&
        saved <= MAX_ORB_SCALE_PERCENT
      ) {
        return Math.round(saved)
      }
    } catch {
      // Ignore storage access errors
    }
    return DEFAULT_ORB_SCALE_PERCENT
  })
  const scalePercent = state[0]

  useEffect(() => {
    try {
      window.localStorage.setItem(SAO_ORB_SCALE_STORAGE_KEY, String(scalePercent))
    } catch {
      // Ignore storage errors
    }
  }, [scalePercent])

  return state
}

type ViewportSize = { width: number; height: number }

// Track viewport changes for responsive orb & window placement
function useViewportSize(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }))

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return viewport
}

// Dynamic placement for the expanded SAO window based on current orb size & viewport
function getWindowStyle(orbSizePx: number, viewport: ViewportSize) {
  if (viewport.width >= 1024) {
    const desktopLeftPx = Math.min(orbSizePx + 36, Math.max(16, viewport.width - 432))
    return {
      left: `${desktopLeftPx}px`,
      bottom: '16px',
      maxHeight: 'calc(100vh - 3.5rem)',
    }
  }

  const mobileBottomPx = Math.min(
    orbSizePx + 48,
    Math.max(80, Math.round(viewport.height * 0.42)),
  )
  return {
    left: '12px',
    bottom: `${mobileBottomPx}px`,
    maxHeight: `calc(100vh - ${mobileBottomPx + 56}px)`,
  }
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function TableNavBar({ tableCode }: { tableCode: string }) {
  const { t } = useLanguage()
  const [copiedInvite, setCopiedInvite] = useState(false)

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/table/${tableCode}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedInvite(true)
      setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      // Fallback ignored
    }
  }

  return (
    <div className="fixed top-3.5 left-4 z-30 flex items-center gap-2 rounded-full bg-zinc-950/80 border border-zinc-800/70 px-3.5 py-1.5 shadow-xl backdrop-blur-xl">
      <Link
        href="/hub"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-amber-400 transition pr-2 border-r border-zinc-800"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">{t('nav.hub')}</span>
      </Link>
      <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
        {t('table.tableCode')}: <strong className="text-amber-400">{tableCode}</strong>
      </span>
      <button
        type="button"
        onClick={handleCopyInviteLink}
        title={t('table.copyLink')}
        className="inline-flex items-center gap-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-mono text-zinc-300 hover:text-amber-300 transition cursor-pointer"
      >
        {copiedInvite ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">{t('table.inviteLinkCopied')}</span>
          </>
        ) : (
          <>
            <Link2 className="w-3 h-3 text-amber-500" />
            <span>{t('table.copyLink')}</span>
          </>
        )}
      </button>
      <div className="pl-1 border-l border-zinc-800">
        <LanguageToggle />
      </div>
    </div>
  )
}

function InspectorWindowHeader({
  activeChar,
  activeTemplate,
  isHeadTable,
  isEditingChar,
  isSwitchingChar,
  onToggleEdit,
  onStartSwitch,
  onClose,
}: {
  activeChar: Character | null | undefined
  activeTemplate: CharacterTemplate
  isHeadTable: boolean
  isEditingChar: boolean
  isSwitchingChar: boolean
  onToggleEdit: () => void
  onStartSwitch: () => void
  onClose: () => void
}) {
  const { t, language } = useLanguage()
  const sheetCreatorLabel = language === 'en' ? 'Sheet Creator' : 'ผู้สร้างชีท'

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800/40 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1 h-6 bg-amber-500/80 rounded-full shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-amber-400">
              {t('sao.playerStatus')}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-white/10 text-zinc-300 rounded-xs">
              {isHeadTable ? t('sao.host') : t('sao.party')}
            </span>
          </div>
          <h2 className="text-base font-bold text-white truncate">
            {activeChar ? activeChar.name : t('sao.noCharBound')}
          </h2>
          <p className="text-[11px] text-zinc-400 truncate">
            {activeChar
              ? `${activeChar.class_archetype || 'Adventurer'} • ${activeTemplate.name} (${sheetCreatorLabel}: ${activeTemplate.author || 'D&D Playground'})`
              : t('sao.selectCharBelow')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {activeChar && !isSwitchingChar && (
          <>
            <button
              type="button"
              onClick={onToggleEdit}
              title={isEditingChar ? t('sao.closeEditor') : t('sao.editSheet')}
              className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition flex items-center gap-1 cursor-pointer ${
                isEditingChar
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-white/5 border-white/15 text-zinc-300 hover:border-amber-400/70 hover:text-amber-300'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>{isEditingChar ? t('sao.closeEditor') : t('common.edit')}</span>
            </button>
            <button
              type="button"
              onClick={onStartSwitch}
              title={t('sao.switchSheet')}
              className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 border border-white/15 text-zinc-300 hover:border-white/40 hover:text-white transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('sao.switchSheet')}</span>
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close window"
          className="p-1.5 rounded bg-white/5 hover:bg-red-500/20 border border-white/15 hover:border-red-400/60 text-zinc-400 hover:text-red-300 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function EditorFooter({
  isSaving,
  onSave,
  onCancel,
}: {
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="border-t border-white/15 bg-zinc-900/90 px-4 py-2.5">
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />{' '}
          {isSaving ? t('character.savingChar') : t('character.saveChar')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
