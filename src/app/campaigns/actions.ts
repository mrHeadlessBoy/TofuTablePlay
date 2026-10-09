'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export interface LoreEntryInput {
  id?: string
  title: string
  trigger_keys: string[]
  content: string
  category: 'Faction' | 'Location' | 'NPC' | 'Item/Artifact' | 'History/Event' | 'Custom'
  activation_mode: 'Always Active' | 'Keyword Triggered' | 'Secret / DM-Only'
}

export interface CampaignPayload {
  title: string
  category: string
  custom_category?: string
  world_setting: string
  core_description: string
  rule_mechanics: string
  loreEntries: LoreEntryInput[]
}

export async function createCampaign(payload: CampaignPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      creator_id: user.id,
      title: payload.title,
      category: payload.category,
      custom_category: payload.category === 'Custom' ? payload.custom_category : null,
      world_setting: payload.world_setting,
      core_description: payload.core_description,
      rule_mechanics: payload.rule_mechanics,
      is_public: true,
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message || 'Failed to create campaign')
  }

  // Insert lorebook entries if present
  if (payload.loreEntries.length > 0) {
    const entriesToInsert = payload.loreEntries.map((entry) => ({
      campaign_id: campaign.id,
      title: entry.title,
      trigger_keys: entry.trigger_keys,
      content: entry.content,
      category: entry.category,
      activation_mode: entry.activation_mode,
    }))

    const { error: loreError } = await supabase
      .from('lorebook_entries')
      .insert(entriesToInsert)

    if (loreError) throw new Error(loreError.message)
  }

  revalidatePath('/hub')
  redirect('/hub')
}