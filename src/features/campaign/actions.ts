'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'

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
  const { supabase, user } = await requireAuthenticatedUser()

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

// Owner-only: updates campaign fields and syncs its lorebook.
// Entries with an `id` are updated, entries without one are inserted,
// and existing entries missing from the payload are deleted.
export async function updateCampaign(campaignId: string, payload: CampaignPayload) {
  const { supabase, user } = await requireAuthenticatedUser()

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, creator_id')
    .eq('id', campaignId)
    .single()

  if (!existing) throw new Error('Campaign not found')
  if (existing.creator_id !== user.id) {
    throw new Error('Only the campaign creator can edit this campaign')
  }

  if (!payload.title?.trim()) throw new Error('Campaign title is required')
  if (!payload.world_setting?.trim()) throw new Error('World setting is required')
  if (!payload.core_description?.trim()) throw new Error('Core narrative description is required')

  const customCategory = payload.category === 'Custom' ? payload.custom_category?.trim() ?? '' : null
  if (payload.category === 'Custom' && !customCategory) {
    throw new Error('Custom category name is required when Genre is Custom')
  }

  // Ownership is verified above, so the service role client may be used if RLS lacks an UPDATE policy.
  const db = createAdminClient() || supabase

  const { data: updated, error: updateErr } = await db
    .from('campaigns')
    .update({
      title: payload.title.trim(),
      category: payload.category,
      custom_category: customCategory,
      world_setting: payload.world_setting.trim(),
      core_description: payload.core_description.trim(),
      rule_mechanics: payload.rule_mechanics?.trim() || '',
    })
    .eq('id', existing.id)
    .select('id')
  if (updateErr) throw new Error(updateErr.message)
  if (!updated || updated.length === 0) {
    throw new Error('Campaign could not be updated. Check the UPDATE policy on "campaigns" in Supabase.')
  }

  // --- Sync lorebook entries ---
  const entries = Array.isArray(payload.loreEntries) ? payload.loreEntries : []

  const { data: currentEntries, error: loreFetchErr } = await db
    .from('lorebook_entries')
    .select('id')
    .eq('campaign_id', existing.id)
  if (loreFetchErr) throw new Error(loreFetchErr.message)

  const currentIds = new Set((currentEntries ?? []).map((e: { id: string }) => String(e.id)))
  const keptIds = new Set(entries.filter((e) => e.id && currentIds.has(String(e.id))).map((e) => String(e.id)))
  const toDelete = [...currentIds].filter((id) => !keptIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await db
      .from('lorebook_entries')
      .delete()
      .eq('campaign_id', existing.id)
      .in('id', toDelete)
    if (error) throw new Error(`Failed to remove lorebook entries: ${error.message}`)
  }

  const toRow = (entry: LoreEntryInput) => ({
    title: entry.title.trim(),
    trigger_keys: Array.isArray(entry.trigger_keys) ? entry.trigger_keys : [],
    content: entry.content.trim(),
    category: entry.category,
    activation_mode: entry.activation_mode,
  })

  for (const entry of entries) {
    if (!entry.id || !keptIds.has(String(entry.id))) continue
    const { error } = await db
      .from('lorebook_entries')
      .update(toRow(entry))
      .eq('id', entry.id)
      .eq('campaign_id', existing.id)
    if (error) throw new Error(`Failed to update lorebook entry "${entry.title}": ${error.message}`)
  }

  const toInsert = entries
    .filter((e) => !e.id || !keptIds.has(String(e.id)))
    .map((e) => ({ ...toRow(e), campaign_id: existing.id }))
  if (toInsert.length > 0) {
    const { error } = await db.from('lorebook_entries').insert(toInsert)
    if (error) throw new Error(`Failed to save lorebook entries: ${error.message}`)
  }

  revalidatePath('/hub')
  revalidatePath(`/campaigns/${existing.id}`)
  return { success: true, campaignId: existing.id }
}
