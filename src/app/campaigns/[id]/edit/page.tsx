import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CampaignForm from '@/features/campaign/components/CampaignForm'
import {
  extractCampaignTemplate,
  stripCampaignTemplateFromRules,
} from '@/features/character/template'
import type { LoreEntryInput } from '@/features/campaign/actions'

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-zinc-950 text-zinc-500 p-8 text-sm">Loading campaign...</div>}
    >
      <EditCampaignContent params={params} />
    </Suspense>
  )
}

// Reads params + cookies (runtime data), so it must render inside <Suspense>.
async function EditCampaignContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) notFound()
  // Only the owner may edit; everyone else is sent to the read-only details page.
  if (campaign.creator_id !== user.id) redirect(`/campaigns/${id}`)

  const { data: lore } = await supabase
    .from('lorebook_entries')
    .select('id, title, content, category, activation_mode, trigger_keys')
    .eq('campaign_id', campaign.id)

  const loreEntries: LoreEntryInput[] = (lore ?? []).map((e) => ({
    id: String(e.id),
    title: e.title ?? '',
    content: e.content ?? '',
    category: e.category,
    activation_mode: e.activation_mode,
    trigger_keys: Array.isArray(e.trigger_keys) ? e.trigger_keys : [],
  }))

  return (
    <CampaignForm
      mode="edit"
      campaignId={String(campaign.id)}
      initial={{
        title: campaign.title ?? '',
        category: campaign.category ?? 'Fantasy',
        custom_category: campaign.custom_category ?? '',
        world_setting: campaign.world_setting ?? '',
        core_description: campaign.core_description ?? '',
        rule_mechanics: stripCampaignTemplateFromRules(campaign.rule_mechanics),
        sheet_template: extractCampaignTemplate(campaign),
        loreEntries,
      }}
    />
  )
}
