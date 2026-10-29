'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser, type DbClient } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import { packCampaignTemplateIntoRules, type CharacterTemplate } from '@/features/character/template'

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
  sheet_template?: CharacterTemplate | null
  loreEntries: LoreEntryInput[]
}

// Server-side checks shared by create and update. Returns the custom genre name (null unless "Custom").
function validateCampaignPayload(payload: CampaignPayload): string | null {
  if (!payload.title?.trim() || payload.title.trim().length < 2) {
    throw new Error('ชื่อแคมเปญต้องมีความยาวอย่างน้อย 2 ตัวอักษร (Campaign title must be at least 2 characters)')
  }
  if (payload.title.trim().length > 100) {
    throw new Error('ชื่อแคมเปญต้องมีความยาวไม่เกิน 100 ตัวอักษร (Campaign title cannot exceed 100 characters)')
  }
  if (!payload.world_setting?.trim()) {
    throw new Error('กรุณากรอกข้อมูล World Setting / เซ็ตติ้งโลก (World setting is required)')
  }
  if (!payload.core_description?.trim()) {
    throw new Error('กรุณากรอกคำอธิบายเนื้อเรื่องหลัก (Core narrative description is required)')
  }

  const customCategory = payload.category === 'Custom' ? payload.custom_category?.trim() ?? '' : null
  if (payload.category === 'Custom' && !customCategory) {
    throw new Error('กรุณาระบุชื่อหมวดหมู่ที่กำหนดเองเมื่อเลือกประเภท Custom (Custom category name is required)')
  }

  if (!payload.sheet_template || !payload.sheet_template.id) {
    throw new Error('กรุณาเลือกรูปแบบแผ่นตัวละครสำหรับแคมเปญนี้ (Character Sheet Template is required)')
  }

  return customCategory
}

// The campaigns columns both create and update write (the sheet template rides inside rule_mechanics)
function buildCampaignColumns(payload: CampaignPayload, customCategory: string | null) {
  return {
    title: payload.title.trim(),
    category: payload.category,
    custom_category: customCategory,
    world_setting: payload.world_setting.trim(),
    core_description: payload.core_description.trim(),
    rule_mechanics: packCampaignTemplateIntoRules(payload.rule_mechanics, payload.sheet_template),
  }
}

function toLoreRow(entry: LoreEntryInput) {
  return {
    title: entry.title.trim(),
    trigger_keys: Array.isArray(entry.trigger_keys) ? entry.trigger_keys : [],
    content: entry.content.trim(),
    category: entry.category,
    activation_mode: entry.activation_mode,
  }
}

export async function createCampaign(payload: CampaignPayload) {
  const { supabase, user } = await requireAuthenticatedUser()
  const customCategory = validateCampaignPayload(payload)

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      creator_id: user.id,
      ...buildCampaignColumns(payload, customCategory),
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
      ...toLoreRow(entry),
    }))

    const { error: loreError } = await supabase.from('lorebook_entries').insert(entriesToInsert)

    if (loreError) {
      // Rollback newly created campaign to prevent orphaned broken data
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      throw new Error(`Failed to save lorebook entries: ${loreError.message}`)
    }
  }

  revalidatePath('/hub')
  return { success: true, campaignId: campaign.id }
}

// Entries with an `id` are updated, entries without one are inserted,
// and existing entries missing from the payload are deleted.
async function syncLorebookEntries(db: DbClient, campaignId: string, entries: LoreEntryInput[]) {
  const { data: currentEntries, error: loreFetchErr } = await db
    .from('lorebook_entries')
    .select('id')
    .eq('campaign_id', campaignId)
  if (loreFetchErr) throw new Error(loreFetchErr.message)

  const currentIds = new Set((currentEntries ?? []).map((e: { id: string }) => String(e.id)))
  const keptIds = new Set(
    entries.filter((e) => e.id && currentIds.has(String(e.id))).map((e) => String(e.id)),
  )
  const toDelete = [...currentIds].filter((id) => !keptIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await db
      .from('lorebook_entries')
      .delete()
      .eq('campaign_id', campaignId)
      .in('id', toDelete)
    if (error) throw new Error(`Failed to remove lorebook entries: ${error.message}`)
  }

  for (const entry of entries) {
    if (!entry.id || !keptIds.has(String(entry.id))) continue
    const { error } = await db
      .from('lorebook_entries')
      .update(toLoreRow(entry))
      .eq('id', entry.id)
      .eq('campaign_id', campaignId)
    if (error) throw new Error(`Failed to update lorebook entry "${entry.title}": ${error.message}`)
  }

  const toInsert = entries
    .filter((e) => !e.id || !keptIds.has(String(e.id)))
    .map((e) => ({ ...toLoreRow(e), campaign_id: campaignId }))
  if (toInsert.length > 0) {
    const { error } = await db.from('lorebook_entries').insert(toInsert)
    if (error) throw new Error(`Failed to save lorebook entries: ${error.message}`)
  }
}

// Owner-only: updates campaign fields and syncs its lorebook.
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

  const customCategory = validateCampaignPayload(payload)

  // Ownership is verified above, so the service role client may be used if RLS lacks an UPDATE policy.
  const db = createAdminClient() || supabase

  const { data: updated, error: updateErr } = await db
    .from('campaigns')
    .update(buildCampaignColumns(payload, customCategory))
    .eq('id', existing.id)
    .select('id')
  if (updateErr) throw new Error(updateErr.message)
  if (!updated || updated.length === 0) {
    throw new Error('Campaign could not be updated. Check the UPDATE policy on "campaigns" in Supabase.')
  }

  await syncLorebookEntries(db, existing.id, Array.isArray(payload.loreEntries) ? payload.loreEntries : [])

  revalidatePath('/hub')
  revalidatePath(`/campaigns/${existing.id}`)
  return { success: true, campaignId: existing.id }
}
