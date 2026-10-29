'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { extractCharacterSkillCost, getHpTailwindClass } from '../domain'
import { CLASSIC_TEMPLATE_ID, readCharacterTemplate } from '../template'
import type { CharacterRecord } from './CharacterSheetSections'

type CharacterRosterProps = {
  characters: CharacterRecord[]
  selectedId: CharacterRecord['id'] | undefined
  deletingId: string | null
  canDelete: (char: CharacterRecord) => boolean
  onCreate: () => void
  onSelect: (char: CharacterRecord) => void
  onDelete: (char: CharacterRecord) => void
}

// Left column of the Codex: "create new" button plus one card per saved sheet
export default function CharacterRoster({
  characters,
  selectedId,
  deletingId,
  canDelete,
  onCreate,
  onSelect,
  onDelete,
}: CharacterRosterProps) {
  const { t } = useLanguage()

  return (
    <div className="md:col-span-1 space-y-4">
      <button
        onClick={onCreate}
        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition cursor-pointer shadow-sm"
      >
        {t('character.createNew')}
      </button>

      <div className="space-y-3">
        {characters.map((char) => (
          <CharacterRosterCard
            key={char.id}
            char={char}
            isSelected={selectedId === char.id}
            isDeleting={deletingId === String(char.id)}
            isDeleteDisabled={deletingId !== null}
            canDelete={Boolean(char.id) && canDelete(char)}
            onSelect={() => onSelect(char)}
            onDelete={() => onDelete(char)}
          />
        ))}
        {characters.length === 0 && (
          <p className="text-zinc-500 text-xs italic">No characters saved yet.</p>
        )}
      </div>
    </div>
  )
}

function CharacterRosterCard({
  char,
  isSelected,
  isDeleting,
  isDeleteDisabled,
  canDelete,
  onSelect,
  onDelete,
}: {
  char: CharacterRecord
  isSelected: boolean
  isDeleting: boolean
  isDeleteDisabled: boolean
  canDelete: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { t } = useLanguage()
  const { currentSkillCost, maxSkillCost } = extractCharacterSkillCost(char)
  const tpl = readCharacterTemplate(char)
  const hpLabel = tpl.resources.find((r) => r.id === 'hp')?.label || 'HP'
  const spLabel = tpl.resources.find((r) => r.id === 'skill_cost')?.label || 'Skill Cost'
  const hpColors = getHpTailwindClass(char.current_hp, char.max_hp)

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition ${
        isSelected
          ? 'border-amber-500 bg-zinc-900 shadow-md'
          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-white truncate">{char.name}</h3>
            {tpl.id !== CLASSIC_TEMPLATE_ID && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800/80 text-amber-400 font-mono">
                {tpl.name} (โดย: {tpl.author || 'D&D Playground'})
              </span>
            )}
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 inline-block mt-1">
            {char.class_archetype || t('character.noClass')}
          </span>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              // Keep the card's own click (select) from firing
              e.stopPropagation()
              onDelete()
            }}
            disabled={isDeleteDisabled}
            title="Delete character sheet"
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-2 truncate">
        <span className={hpColors.text}>
          {hpLabel}: {char.current_hp}/{char.max_hp}
        </span>{' '}
        | {spLabel}: {currentSkillCost}/{maxSkillCost} | Status: {char.status_condition}
      </p>
    </div>
  )
}
