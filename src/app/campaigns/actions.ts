'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface LoreEntryInput {
  id?: string
  title: string
  trigger_keys: string[]
  content: string
  category: 'Faction' | 'Location' | 'NPC' | 'Item/Artifact' | 'History/Event' | 'Custom'
  activation_mode: 'Always Active' | 'Keyword Triggered' | 'Secret / DM-Only'
}

interface CampaignPayload {
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

  // Validation
  if (!payload.title || !payload.title.trim()) {
    throw new Error('Campaign title is required')
  }
  if (!payload.world_setting || !payload.world_setting.trim()) {
    throw new Error('World setting is required')
  }
  if (!payload.core_description || !payload.core_description.trim()) {
    throw new Error('Core narrative description is required')
  }

  const customCategory = payload.category === 'Custom' ? payload.custom_category?.trim() ?? '' : null

  if (payload.category === 'Custom' && (!customCategory || !customCategory.trim())) {
    throw new Error('Custom category name is required when Genre is Custom')
  }

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      creator_id: user.id,
      title: payload.title.trim(),
      category: payload.category,
      custom_category: customCategory,
      world_setting: payload.world_setting.trim(),
      core_description: payload.core_description.trim(),
      rule_mechanics: payload.rule_mechanics?.trim() || '',
      is_public: true,
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message || 'Failed to create campaign')
  }

  // Insert lorebook entries if present
  if (Array.isArray(payload.loreEntries) && payload.loreEntries.length > 0) {
    const entriesToInsert = payload.loreEntries.map((entry) => ({
      campaign_id: campaign.id,
      title: entry.title.trim(),
      trigger_keys: Array.isArray(entry.trigger_keys) ? entry.trigger_keys : [],
      content: entry.content.trim(),
      category: entry.category,
      activation_mode: entry.activation_mode,
    }))

    const { error: loreError } = await supabase
      .from('lorebook_entries')
      .insert(entriesToInsert)

    if (loreError) {
      // Rollback newly created campaign to prevent orphaned broken data
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      throw new Error(`Failed to save lorebook entries: ${loreError.message}`)
    }
  }

  revalidatePath('/hub')
  return { success: true, campaignId: campaign.id }
}