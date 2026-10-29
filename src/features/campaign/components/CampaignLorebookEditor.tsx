'use client'

import { useState } from 'react'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { LoreEntryInput } from '../actions'
import { useAlert } from '@/components/ui/AlertModal'

const LORE_CATEGORIES = ['Faction', 'Location', 'NPC', 'Item/Artifact', 'History/Event', 'Custom'] as const
const ACTIVATION_MODES = ['Always Active', 'Keyword Triggered', 'Secret / DM-Only'] as const

type LoreCategory = (typeof LORE_CATEGORIES)[number]
type ActivationMode = (typeof ACTIVATION_MODES)[number]

const EMPTY_ENTRY: LoreEntryInput = {
  title: '',
  trigger_keys: [],
  content: '',
  category: 'Faction',
  activation_mode: 'Keyword Triggered',
}

const DRAFT_INPUT_CLASS = 'w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white'

// "paladin, dawn , solar" -> ['paladin', 'dawn', 'solar']
function splitTriggerKeys(input: string): string[] {
  return input
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

function mergeTriggerKeys(existing: string[], added: string[]): string[] {
  return Array.from(new Set([...existing, ...added]))
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

// Attached lore entries plus the draft entry being written in the editor
export function useLorebookDraft(initialEntries: LoreEntryInput[] = []) {
  const { showConfirm } = useAlert()
  const [entries, setEntries] = useState<LoreEntryInput[]>(initialEntries)
  const [triggerInput, setTriggerInput] = useState('')
  const [draft, setDraft] = useState<LoreEntryInput>(EMPTY_ENTRY)

  const hasTitle = Boolean(draft.title.trim())
  const hasContent = Boolean(draft.content.trim())

  // The draft with any keywords still sitting in the keyword input folded in
  const draftWithPendingKeys = (): LoreEntryInput => ({
    ...draft,
    trigger_keys: mergeTriggerKeys(draft.trigger_keys, splitTriggerKeys(triggerInput)),
  })

  const addTriggerKeys = () => {
    if (!triggerInput.trim()) return
    const keys = splitTriggerKeys(triggerInput)
    setDraft((prev) => ({ ...prev, trigger_keys: mergeTriggerKeys(prev.trigger_keys, keys) }))
    setTriggerInput('')
  }

  const removeTriggerKey = (key: string) => {
    setDraft((prev) => ({ ...prev, trigger_keys: prev.trigger_keys.filter((k) => k !== key) }))
  }

  const attachDraft = () => {
    if (!hasTitle || !hasContent) return
    setEntries([...entries, draftWithPendingKeys()])
    setDraft(EMPTY_ENTRY)
    setTriggerInput('')
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  // Moves an attached entry back into the draft editor (keeping its id so it is updated, not duplicated)
  const editEntry = async (index: number) => {
    if (hasTitle || hasContent) {
      const confirmed = await showConfirm('Discard the lore entry currently in the draft editor?')
      if (!confirmed) return
    }
    setDraft(entries[index])
    setTriggerInput('')
    setEntries(entries.filter((_, i) => i !== index))
  }

  return {
    entries,
    draft,
    setDraft,
    triggerInput,
    setTriggerInput,
    addTriggerKeys,
    removeTriggerKey,
    attachDraft,
    removeEntry,
    editEntry,
    // Only one of title/content filled in: cannot be saved as-is
    isDraftIncomplete: hasTitle !== hasContent,
    // Entries to save: a complete draft the user forgot to attach is included
    entriesForSubmit: (): LoreEntryInput[] =>
      hasTitle && hasContent ? [...entries, draftWithPendingKeys()] : [...entries],
  }
}

export type LorebookDraft = ReturnType<typeof useLorebookDraft>

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

// Section 3: Lorebook Registry
export function LorebookRegistrySection({ lorebook }: { lorebook: LorebookDraft }) {
  return (
    <div className="surface-panel rounded-2xl p-6 space-y-6 shadow-lg">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-white">Dynamic Lorebook Registry</h2>
      </div>
      <p className="text-xs text-zinc-400">
        Entries are dynamically injected into the AI context window when keyword triggers match player
        input actions or recent turns.
      </p>

      {lorebook.entries.length > 0 && (
        <div className="space-y-3">
          {lorebook.entries.map((entry, idx) => (
            <LoreEntryRow
              key={idx}
              entry={entry}
              onEdit={() => lorebook.editEntry(idx)}
              onRemove={() => lorebook.removeEntry(idx)}
            />
          ))}
        </div>
      )}

      <LoreEntryDraftEditor lorebook={lorebook} />
    </div>
  )
}

function LoreEntryRow({
  entry,
  onEdit,
  onRemove,
}: {
  entry: LoreEntryInput
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-start">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">{entry.title}</span>
          <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{entry.category}</span>
          <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800">
            {entry.activation_mode}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">{entry.content}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {entry.trigger_keys.map((k) => (
            <span
              key={k}
              className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded"
            >
              #{k}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          title="Edit entry"
          className="text-zinc-500 hover:text-amber-400 p-1 cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove entry"
          className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Add New Lore Entry Draft
function LoreEntryDraftEditor({ lorebook }: { lorebook: LorebookDraft }) {
  const { draft, setDraft, triggerInput, setTriggerInput } = lorebook
  const usesKeywords =
    draft.activation_mode === 'Keyword Triggered' || draft.activation_mode === 'Secret / DM-Only'

  return (
    <div className="border border-dashed border-zinc-800 rounded-lg p-4 space-y-4 bg-zinc-950/40">
      <span className="text-xs font-semibold uppercase text-zinc-400">Add Lore Entry</span>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <input
            type="text"
            placeholder="Entry Title (e.g. Order of the Sun)"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              // Enter would submit the whole campaign form
              if (e.key === 'Enter') e.preventDefault()
            }}
            className={DRAFT_INPUT_CLASS}
          />
        </div>
        <div>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as LoreCategory })}
            className={DRAFT_INPUT_CLASS}
          >
            {LORE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={draft.activation_mode}
            onChange={(e) => setDraft({ ...draft, activation_mode: e.target.value as ActivationMode })}
            className={DRAFT_INPUT_CLASS}
          >
            {ACTIVATION_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <textarea
          rows={2}
          placeholder="Lore details, behavioral traits, or hidden secrets..."
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          className={DRAFT_INPUT_CLASS}
        />
      </div>

      {/* Keyword Trigger Chips */}
      {usesKeywords && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={
                draft.activation_mode === 'Secret / DM-Only'
                  ? 'Optional keywords (leave blank to always send to AI DM)'
                  : 'Add comma-separated keywords (e.g. paladin, dawn, solar)'
              }
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  lorebook.addTriggerKeys()
                }
              }}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={lorebook.addTriggerKeys}
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs rounded text-zinc-200 cursor-pointer"
            >
              Add Keys
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {draft.trigger_keys.map((k) => (
              <span
                key={k}
                onClick={() => lorebook.removeTriggerKey(k)}
                className="inline-flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-red-950 hover:text-red-300 text-zinc-300 px-2 py-0.5 rounded cursor-pointer"
              >
                {k} &times;
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={lorebook.attachDraft}
        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium rounded flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Attach Entry to Lorebook
      </button>
    </div>
  )
}
