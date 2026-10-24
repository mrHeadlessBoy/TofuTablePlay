'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign, updateCampaign, LoreEntryInput } from './actions'
import { Trash2, Plus, BookOpen, Sparkles, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useAlert } from '@/components/ui/AlertModal'

const CATEGORIES = [
  'Fantasy', 'Sci-Fi', 'Horror', 'Comedy', 'Romance',
  'Slice of Life / Cozy', 'Post-Apocalyptic', 'Drama', 'Custom'
]

const LORE_CATEGORIES = ['Faction', 'Location', 'NPC', 'Item/Artifact', 'History/Event', 'Custom'] as const
const ACTIVATION_MODES = ['Always Active', 'Keyword Triggered', 'Secret / DM-Only'] as const

type LoreCategory = (typeof LORE_CATEGORIES)[number]
type ActivationMode = (typeof ACTIVATION_MODES)[number]

export type CampaignFormInitial = {
  title: string
  category: string
  custom_category: string
  world_setting: string
  core_description: string
  rule_mechanics: string
  loreEntries: LoreEntryInput[]
}

type CampaignFormProps =
  | { mode: 'create'; campaignId?: undefined; initial?: undefined }
  | { mode: 'edit'; campaignId: string; initial: CampaignFormInitial }

const EMPTY_ENTRY: LoreEntryInput = {
  title: '',
  trigger_keys: [],
  content: '',
  category: 'Faction',
  activation_mode: 'Keyword Triggered',
}

export default function CampaignForm({ mode, campaignId, initial }: CampaignFormProps) {
  const router = useRouter()
  const { showAlert, showConfirm } = useAlert()
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState(initial?.category || 'Fantasy')
  const [customCategory, setCustomCategory] = useState(initial?.custom_category ?? '')
  const [worldSetting, setWorldSetting] = useState(initial?.world_setting ?? '')
  const [coreDescription, setCoreDescription] = useState(initial?.core_description ?? '')
  const [ruleMechanics, setRuleMechanics] = useState(initial?.rule_mechanics ?? '')

  // Lorebook state
  const [loreEntries, setLoreEntries] = useState<LoreEntryInput[]>(initial?.loreEntries ?? [])
  const [triggerInput, setTriggerInput] = useState('')
  const [newEntry, setNewEntry] = useState<LoreEntryInput>(EMPTY_ENTRY)

  const addTriggerKey = () => {
    if (!triggerInput.trim()) return
    const keys = triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
    setNewEntry((prev) => ({
      ...prev,
      trigger_keys: Array.from(new Set([...prev.trigger_keys, ...keys])),
    }))
    setTriggerInput('')
  }

  const removeTriggerKey = (key: string) => {
    setNewEntry((prev) => ({
      ...prev,
      trigger_keys: prev.trigger_keys.filter((k) => k !== key),
    }))
  }

  const handleAddLoreEntry = () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) return
    // Also capture any uncommitted trigger keys currently in triggerInput
    const pendingKeys = triggerInput.trim()
      ? triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
      : []
    const finalTriggerKeys = Array.from(new Set([...newEntry.trigger_keys, ...pendingKeys]))

    setLoreEntries([...loreEntries, { ...newEntry, trigger_keys: finalTriggerKeys }])
    setNewEntry(EMPTY_ENTRY)
    setTriggerInput('')
  }

  const handleRemoveLoreEntry = (index: number) => {
    setLoreEntries(loreEntries.filter((_, i) => i !== index))
  }

  // Moves an attached entry back into the draft editor (keeping its id so it is updated, not duplicated)
  const handleEditLoreEntry = async (index: number) => {
    if (newEntry.title.trim() || newEntry.content.trim()) {
      const confirmed = await showConfirm('Discard the lore entry currently in the draft editor?')
      if (!confirmed) return
    }
    setNewEntry(loreEntries[index])
    setTriggerInput('')
    setLoreEntries(loreEntries.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // If user filled in a lore draft but forgot to click "Attach Entry to Lorebook", include it
      const finalEntries = [...loreEntries]
      if (newEntry.title.trim() && newEntry.content.trim()) {
        const pendingKeys = triggerInput.trim()
          ? triggerInput.split(',').map((k) => k.trim()).filter(Boolean)
          : []
        finalEntries.push({
          ...newEntry,
          trigger_keys: Array.from(new Set([...newEntry.trigger_keys, ...pendingKeys])),
        })
      }

      const payload = {
        title,
        category,
        custom_category: customCategory,
        world_setting: worldSetting,
        core_description: coreDescription,
        rule_mechanics: ruleMechanics,
        loreEntries: finalEntries,
      }

      const res = isEdit
        ? await updateCampaign(campaignId, payload)
        : await createCampaign(payload)

      if (res?.success) {
        router.push(isEdit ? `/campaigns/${campaignId}` : '/hub')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : `Something went wrong while ${isEdit ? 'saving' : 'creating'} the campaign.`
      showAlert(message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-amber-500" /> {isEdit ? 'Edit Campaign' : 'Campaign & Lorebook Studio'}
            </h1>
            <p className="text-zinc-400 text-sm">Author your campaign universe and configure context triggers for the AI DM.</p>
          </div>
          <Link
            href="/hub"
            className="text-xs text-amber-500 hover:text-amber-400 underline"
          >
            &larr; Back to Hub
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Campaign Overview */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Campaign Foundation</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="The Citadel of Ash"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">Genre / Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {category === 'Custom' && (
              <div>
                <label className="text-xs text-zinc-400 uppercase font-medium">Custom Category Name</label>
                <input
                  type="text"
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-400 uppercase font-medium">Core Narrative Brief</label>
              <textarea
                required
                rows={3}
                placeholder="Brief summary of the overarching journey and party objectives..."
                value={coreDescription}
                onChange={(e) => setCoreDescription(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase font-medium">World Setting & Environment Lore</label>
              <textarea
                required
                rows={3}
                placeholder="Geographic layout, political tensions, environmental tone..."
                value={worldSetting}
                onChange={(e) => setWorldSetting(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 uppercase font-medium">Rule Mechanics & Custom Systems</label>
              <textarea
                rows={2}
                placeholder="e.g. Sanity meters, scarcity-based inventory, non-standard magic rules..."
                value={ruleMechanics}
                onChange={(e) => setRuleMechanics(e.target.value)}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Section 2: Lorebook Registry */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-white">Dynamic Lorebook Registry</h2>
            </div>
            <p className="text-xs text-zinc-400">
              Entries are dynamically injected into the AI context window when keyword triggers match player input actions or recent turns.
            </p>

            {/* List Existing Entries */}
            {loreEntries.length > 0 && (
              <div className="space-y-3">
                {loreEntries.map((entry, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-start">
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
                          <span key={k} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditLoreEntry(idx)}
                        title="Edit entry"
                        className="text-zinc-500 hover:text-amber-400 p-1 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLoreEntry(idx)}
                        title="Remove entry"
                        className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Lore Entry Draft */}
            <div className="border border-dashed border-zinc-800 rounded-lg p-4 space-y-4 bg-zinc-950/40">
              <span className="text-xs font-semibold uppercase text-zinc-400">Add Lore Entry</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    placeholder="Entry Title (e.g. Order of the Sun)"
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <select
                    value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value as LoreCategory })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  >
                    {LORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <select
                    value={newEntry.activation_mode}
                    onChange={(e) => setNewEntry({ ...newEntry, activation_mode: e.target.value as ActivationMode })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                  >
                    {ACTIVATION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  placeholder="Lore details, behavioral traits, or hidden secrets..."
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white"
                />
              </div>

              {/* Keyword Trigger Chips */}
              {(newEntry.activation_mode === 'Keyword Triggered' ||
                newEntry.activation_mode === 'Secret / DM-Only') && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={
                        newEntry.activation_mode === 'Secret / DM-Only'
                          ? 'Optional keywords (leave blank to always send to AI DM)'
                          : 'Add comma-separated keywords (e.g. paladin, dawn, solar)'
                      }
                      value={triggerInput}
                      onChange={(e) => setTriggerInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTriggerKey(); } }}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={addTriggerKey}
                      className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs rounded text-zinc-200 cursor-pointer"
                    >
                      Add Keys
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {newEntry.trigger_keys.map((k) => (
                      <span
                        key={k}
                        onClick={() => removeTriggerKey(k)}
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
                onClick={handleAddLoreEntry}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium rounded flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Attach Entry to Lorebook
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-sm transition disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? (isEdit ? 'Saving Changes...' : 'Creating Campaign...')
              : (isEdit ? 'Save Changes' : 'Publish Campaign')}
          </button>
        </form>
      </div>
    </div>
  )
}