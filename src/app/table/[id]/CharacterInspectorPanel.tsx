'use client'

import Link from 'next/link'
import { ArrowLeft, Edit3, Heart, RotateCcw, Save, Shield } from 'lucide-react'
import {
  CHARACTER_CONDITIONS,
  EMPTY_EQUIPMENT,
  EQUIPMENT_LABELS,
} from '@/app/characters/equipment'
import type { Character, CharacterCombatFormState } from './types'

type CharacterInspectorPanelProps = {
  activeChar: Character | null | undefined
  userCharacters: Character[]
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
  return (
    <aside className="w-80 border-r border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaign Hub
        </Link>
        <div className="border-b border-zinc-800 pb-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500">
              Character Inspector
            </span>
            {activeChar && !isSwitchingChar && (
              <div className="flex gap-2">
                <button
                  onClick={onToggleEdit}
                  className="text-[10px] text-zinc-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> {isEditingChar ? 'Close' : 'Edit'}
                </button>
                <button
                  onClick={onStartSwitch}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Switch
                </button>
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            {activeChar ? activeChar.name : 'No Character Bound'}
          </h2>
          <p className="text-xs text-zinc-400">
            {activeChar?.class_archetype || 'Select a sheet below to participate'}
          </p>
        </div>

        {!activeChar || isSwitchingChar ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs text-zinc-400 font-medium">
                Select a character for this session:
              </label>
              {isSwitchingChar && (
                <button
                  onClick={onCancelSwitch}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            {userCharacters.map((char) => (
              <button
                key={char.id}
                onClick={() => onSelectCharacter(char.id)}
                className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-500 text-xs transition cursor-pointer"
              >
                <p className="font-semibold text-white">{char.name}</p>
                <p className="text-zinc-500">
                  {char.class_archetype} | HP: {char.current_hp}/{char.max_hp}
                </p>
              </button>
            ))}
            {userCharacters.length === 0 && (
              <p className="text-xs text-zinc-500 italic">
                No character sheets found. Create one in the Character Codex.
              </p>
            )}
          </div>
        ) : isEditingChar ? (
          /* Inline Character Editor */
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Current HP</label>
                <input
                  type="number"
                  max={charForm.max_hp}
                  value={charForm.current_hp}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    onChangeCharForm({
                      ...charForm,
                      current_hp: Number.isNaN(val) ? 0 : Math.min(charForm.max_hp, val),
                    })
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Max HP</label>
                <input
                  type="number"
                  min={1}
                  value={charForm.max_hp}
                  onChange={(e) => {
                    const newMax = Number(e.target.value)
                    const clampedMax = Number.isNaN(newMax) ? 1 : newMax
                    onChangeCharForm({
                      ...charForm,
                      max_hp: clampedMax,
                      current_hp: Math.min(clampedMax, charForm.current_hp),
                    })
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Armor Class</label>
                <input
                  type="number"
                  value={charForm.armor_class}
                  onChange={(e) =>
                    onChangeCharForm({ ...charForm, armor_class: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Condition</label>
                <select
                  value={charForm.status_condition}
                  onChange={(e) =>
                    onChangeCharForm({ ...charForm, status_condition: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-xs text-white"
                >
                  {CHARACTER_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stats Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 uppercase font-mono block">
                  Ability Scores
                </label>
                <span className="text-[9px] text-zinc-500 font-mono">Allows negative</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.keys(charForm.stats || {}).map((stat) => (
                  <div
                    key={stat}
                    className="bg-zinc-950 border border-zinc-800 rounded p-1 text-center"
                  >
                    <span className="text-[9px] text-zinc-500 uppercase block">{stat}</span>
                    <input
                      type="number"
                      value={charForm.stats[stat] ?? 10}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '' || raw === '-') {
                          onChangeCharForm({
                            ...charForm,
                            stats: { ...charForm.stats, [stat]: raw },
                          })
                          return
                        }
                        const val = Number(raw)
                        if (!Number.isNaN(val)) {
                          onChangeCharForm({
                            ...charForm,
                            stats: { ...charForm.stats, [stat]: val },
                          })
                        }
                      }}
                      className="w-full bg-transparent text-center font-bold text-xs text-white outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory Editor */}
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-mono">Inventory</label>
              <textarea
                rows={3}
                value={charForm.inventory}
                onChange={(e) => onChangeCharForm({ ...charForm, inventory: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white mt-1"
              />
            </div>

            {/* Equipment Slots Editor */}
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">
                Equipment Slots
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {EQUIPMENT_LABELS.map((label, idx) => (
                  <div key={label}>
                    <span className="text-[9px] text-zinc-500 uppercase block">{label}</span>
                    <input
                      type="text"
                      placeholder={`${label}...`}
                      value={(charForm.equipment ?? EMPTY_EQUIPMENT)[idx] || ''}
                      onChange={(e) => {
                        const next = [...(charForm.equipment ?? EMPTY_EQUIPMENT)]
                        next[idx] = e.target.value
                        onChangeCharForm({ ...charForm, equipment: next })
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-1 text-[11px] text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onSaveCharEdits}
                disabled={isSavingChar}
                className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {isSavingChar ? 'Saving...' : 'Save Sheet'}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Combat Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">
                    Hit Points
                  </span>
                  <span className="font-bold text-sm text-white">
                    {activeChar.current_hp} / {activeChar.max_hp}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">
                    Armor Class
                  </span>
                  <span className="font-bold text-sm text-white">{activeChar.armor_class}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-center">
              <span className="text-zinc-400">Condition:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  activeChar.status_condition === 'Normal'
                    ? 'bg-zinc-800 text-zinc-300'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {activeChar.status_condition || 'Normal'}
              </span>
            </div>

            {/* Attributes */}
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(activeChar.stats || {}).map(([key, val]) => (
                <div key={key} className="bg-zinc-950 border border-zinc-800/80 rounded p-2 text-center">
                  <span className="text-[9px] text-zinc-500 block uppercase font-mono">{key}</span>
                  <span className="font-bold text-white text-xs">{String(val)}</span>
                </div>
              ))}
            </div>

            {/* Inventory */}
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400">Inventory</span>
              <div className="mt-1 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 min-h-15 whitespace-pre-line text-[11px]">
                {activeChar.inventory || 'Empty'}
              </div>
            </div>

            {/* Equipment Slots */}
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400">Equipment</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {EQUIPMENT_LABELS.map((label, idx) => {
                  const item = (activeChar.equipment ?? EMPTY_EQUIPMENT)[idx]
                  return (
                    <div
                      key={label}
                      className="p-1.5 bg-zinc-950 border border-zinc-800 rounded text-[11px]"
                    >
                      <span className="text-[9px] text-zinc-500 uppercase block">{label}</span>
                      <span className="text-zinc-300">{item || '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] font-mono text-zinc-600 border-t border-zinc-800 pt-3 flex justify-between">
        <span>CODE: {tableCode}</span>
        <span>{isHeadTable ? 'HEAD TABLE' : 'PLAYER'}</span>
      </div>
    </aside>
  )
}
