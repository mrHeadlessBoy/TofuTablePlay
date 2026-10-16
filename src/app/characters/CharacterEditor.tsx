'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCharacter, deleteCharacter, CharacterFormData } from './actions'
import {
  ABILITY_SCORE_KEYS,
  EMPTY_EQUIPMENT,
  EQUIPMENT_LABELS,
  clampHpValues,
  sanitizeAbilityScores,
  type AbilityScoreKey,
} from './equipment'
import { playSystemSound } from '@/lib/sound'
import { Trash2, Loader2 } from 'lucide-react'

const defaultStats: Record<AbilityScoreKey, number> = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }

type CharacterRecord = CharacterFormData & { id?: string | number; user_id?: string | null }

export default function CharacterEditor({
  characters,
  currentUserId,
}: {
  characters: CharacterRecord[]
  currentUserId?: string | null
}) {
  const router = useRouter()
  const [selectedChar, setSelectedChar] = useState<CharacterRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isOwner = (char: CharacterRecord) => {
    if (!currentUserId || !char.user_id) return true
    return char.user_id === currentUserId
  }

  const handleDelete = async (char: CharacterRecord) => {
    if (!char.id) return
    const charName = char.name?.trim() || 'this character'
    if (!confirm(`Delete character "${charName}"? This sheet will be permanently removed. This cannot be undone.`)) {
      return
    }

    setDeletingId(String(char.id))
    try {
      await deleteCharacter(String(char.id))
      if (selectedChar?.id === char.id) {
        setSelectedChar(null)
      }
      router.refresh()
    } catch (err: unknown) {
      playSystemSound('error')
      const message = err instanceof Error ? err.message : 'Failed to delete character.'
      alert(message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleNew = () => {
    setSelectedChar({
      name: '',
      class_archetype: '',
      current_hp: 100,
      max_hp: 100,
      armor_class: 14,
      stats: { ...defaultStats },
      appearance: '',
      backstory: '',
      strengths: '',
      weaknesses: '',
      inventory: '',
      status_condition: 'Normal',
      equipment: [...EMPTY_EQUIPMENT],
    })
  }

  const handleStatChange = (stat: AbilityScoreKey, rawValue: string) => {
    if (!selectedChar) return
    if (rawValue === '' || rawValue === '-') {
      setSelectedChar({
        ...selectedChar,
        stats: { ...selectedChar.stats, [stat]: rawValue as unknown as number },
      })
      return
    }
    const num = Number(rawValue)
    if (!Number.isNaN(num)) {
      setSelectedChar({
        ...selectedChar,
        stats: { ...selectedChar.stats, [stat]: num },
      })
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChar) return
    setIsSaving(true)
    try {
      const { currentHp, maxHp } = clampHpValues(selectedChar.current_hp, selectedChar.max_hp)
      const sanitizedStats = sanitizeAbilityScores(selectedChar.stats, 0)
      await saveCharacter({
        ...selectedChar,
        current_hp: currentHp,
        max_hp: maxHp,
        stats: sanitizedStats,
      })
      setSelectedChar(null)
      router.refresh()
    } catch (err: unknown) {
      playSystemSound('error')
      const message = err instanceof Error ? err.message : 'Failed to save character.'
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Character Cards Roster */}
      <div className="md:col-span-1 space-y-4">
        <button
          onClick={handleNew}
          className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition cursor-pointer"
        >
          + Create New Character
        </button>

        <div className="space-y-3">
          {characters.map((char) => (
            <div
              key={char.id}
              onClick={() => setSelectedChar(char)}
              className={`p-4 rounded-lg border cursor-pointer transition ${
                selectedChar?.id === char.id
                  ? 'border-amber-500 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white truncate">{char.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 inline-block mt-1">
                    {char.class_archetype}
                  </span>
                </div>
                {char.id && isOwner(char) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(char)
                    }}
                    disabled={deletingId !== null}
                    title="Delete character sheet"
                    className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {deletingId === String(char.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                HP: {char.current_hp}/{char.max_hp} | AC: {char.armor_class} | Status: {char.status_condition}
              </p>
            </div>
          ))}
          {characters.length === 0 && (
            <p className="text-zinc-500 text-xs italic">No characters saved yet.</p>
          )}
        </div>
      </div>

      {/* Editor Form */}
      <div className="md:col-span-2">
        {selectedChar ? (
          <form onSubmit={onSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase">Character Name</label>
                <input
                  type="text"
                  required
                  value={selectedChar.name}
                  onChange={(e) => setSelectedChar({ ...selectedChar, name: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">Class / Archetype</label>
                <input
                  type="text"
                  required
                  value={selectedChar.class_archetype}
                  onChange={(e) => setSelectedChar({ ...selectedChar, class_archetype: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Combat Vitals */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase">Current HP</label>
                <input
                  type="number"
                  max={selectedChar.max_hp}
                  value={selectedChar.current_hp}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setSelectedChar({
                      ...selectedChar,
                      current_hp: Number.isNaN(val) ? 0 : Math.min(selectedChar.max_hp, val),
                    })
                  }}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">Max HP</label>
                <input
                  type="number"
                  min={1}
                  value={selectedChar.max_hp}
                  onChange={(e) => {
                    const newMax = Number(e.target.value)
                    const clampedMax = Number.isNaN(newMax) ? 1 : newMax
                    setSelectedChar({
                      ...selectedChar,
                      max_hp: clampedMax,
                      current_hp: Math.min(clampedMax, selectedChar.current_hp),
                    })
                  }}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">Armor Class (AC)</label>
                <input
                  type="number"
                  value={selectedChar.armor_class}
                  onChange={(e) => setSelectedChar({ ...selectedChar, armor_class: Number(e.target.value) })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Attributes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-zinc-400 uppercase block">Attributes (Stats)</label>
                <span className="text-[11px] text-zinc-500 font-mono">Allows negative</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {ABILITY_SCORE_KEYS.map((stat) => (
                  <div key={stat} className="bg-zinc-950 border border-zinc-800 rounded p-2 text-center">
                    <span className="text-[10px] text-zinc-500 font-bold block">{stat}</span>
                    <input
                      type="number"
                      value={selectedChar.stats[stat]}
                      onChange={(e) => handleStatChange(stat, e.target.value)}
                      className="w-full text-center bg-transparent text-sm font-semibold text-amber-400 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Descriptive Profile */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase">Strengths & Proficiencies</label>
                <textarea
                  rows={2}
                  value={selectedChar.strengths || ''}
                  onChange={(e) => setSelectedChar({ ...selectedChar, strengths: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">Weaknesses & Flaws</label>
                <textarea
                  rows={2}
                  value={selectedChar.weaknesses || ''}
                  onChange={(e) => setSelectedChar({ ...selectedChar, weaknesses: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase">Appearance & Visual Traits</label>
              <textarea
                rows={2}
                placeholder="Physical build, clothing, notable scars or aura..."
                value={selectedChar.appearance || ''}
                onChange={(e) => setSelectedChar({ ...selectedChar, appearance: e.target.value })}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase">Inventory (Item Log)</label>
                <textarea
                  rows={3}
                  value={selectedChar.inventory || ''}
                  onChange={(e) => setSelectedChar({ ...selectedChar, inventory: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase">Backstory & Bio</label>
                <textarea
                  rows={3}
                  value={selectedChar.backstory || ''}
                  onChange={(e) => setSelectedChar({ ...selectedChar, backstory: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Equipment Slots */}
            <div>
              <label className="text-xs text-zinc-400 uppercase block mb-2">Equipment Slots</label>
              <div className="grid grid-cols-2 gap-3">
                {EQUIPMENT_LABELS.map((label, idx) => (
                  <div key={label}>
                    <label className="text-[10px] text-zinc-500 font-mono uppercase">{label}</label>
                    <input
                      type="text"
                      placeholder={`${label} slot...`}
                      value={(selectedChar.equipment ?? EMPTY_EQUIPMENT)[idx] || ''}
                      onChange={(e) => {
                        const next = [...(selectedChar.equipment ?? EMPTY_EQUIPMENT)] as CharacterFormData['equipment']
                        next[idx] = e.target.value
                        setSelectedChar({ ...selectedChar, equipment: next })
                      }}
                      className="w-full mt-0.5 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
              {selectedChar.id && isOwner(selectedChar) ? (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedChar)}
                  disabled={deletingId !== null || isSaving}
                  className="px-3 py-2 text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-300 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deletingId === String(selectedChar.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete Character
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChar(null)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || deletingId !== null}
                  className="px-5 py-2 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Character Sheet'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="h-full border border-dashed border-zinc-800 rounded-xl flex items-center justify-center p-12 text-zinc-500 text-sm">
            Select a character to view or edit, or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}
