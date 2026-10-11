import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, Pencil, Play, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { launchTable } from '@/app/hub/actions'

type LoreEntry = {
  id: string
  title: string
  content: string
  category: string
  activation_mode: string
  trigger_keys: string[] | null
}

export default function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading campaign...</p>}>
          <CampaignDetails params={params} />
        </Suspense>
      </div>
    </div>
  )
}

// Reads params + cookies (runtime data), so it must render inside <Suspense>.
async function CampaignDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) notFound()

  const isOwner = !!user && campaign.creator_id === user.id
  if (!campaign.is_public && !isOwner) notFound()

  let loreQuery = supabase
    .from('lorebook_entries')
    .select('id, title, content, category, activation_mode, trigger_keys')
    .eq('campaign_id', campaign.id)
  // Secret entries are spoilers: only the owner may see them.
  if (!isOwner) loreQuery = loreQuery.neq('activation_mode', 'Secret / DM-Only')
  const { data: lore } = await loreQuery
  const loreEntries = (lore ?? []) as LoreEntry[]

  const categoryLabel = campaign.category === 'Custom' && campaign.custom_category
    ? campaign.custom_category
    : campaign.category

  return (
    <>
      <div className="flex justify-between items-start gap-4 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{categoryLabel}</span>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-2">{campaign.title}</h1>
          {isOwner && <p className="text-xs text-amber-500 mt-1">You created this campaign</p>}
        </div>
        <Link href="/hub" className="text-xs text-amber-500 hover:text-amber-400 underline shrink-0">
          &larr; Back to Hub
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form action={launchTable.bind(null, String(campaign.id))} className="flex-1">
          <button
            type="submit"
            className="w-full py-2.5 bg-amber-600/90 hover:bg-amber-600 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4" /> Launch as Head Table
          </button>
        </form>
        {isOwner && (
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-4 h-4" /> Edit Campaign
          </Link>
        )}
      </div>

      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-5">
        <DetailBlock label="Core Narrative Brief" value={campaign.core_description} />
        <DetailBlock label="World Setting & Environment Lore" value={campaign.world_setting} />
        <DetailBlock label="Rule Mechanics & Custom Systems" value={campaign.rule_mechanics} />
      </section>

      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-white">Lorebook</h2>
          <span className="text-xs text-zinc-500">({loreEntries.length})</span>
        </div>

        {loreEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">No public lore entries.</p>
        ) : (
          <div className="space-y-3">
            {loreEntries.map((entry) => (
              <div key={entry.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-white">{entry.title}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{entry.category}</span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800 inline-flex items-center gap-1">
                    {entry.activation_mode === 'Secret / DM-Only' && <Lock className="w-2.5 h-2.5" />}
                    {entry.activation_mode}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{entry.content}</p>
                {(entry.trigger_keys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(entry.trigger_keys ?? []).map((k) => (
                      <span key={k} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
                        #{k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <h3 className="text-xs text-zinc-400 uppercase font-medium">{label}</h3>
      <p className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap">
        {value?.trim() ? value : <span className="text-zinc-600 italic">Not specified</span>}
      </p>
    </div>
  )
}

