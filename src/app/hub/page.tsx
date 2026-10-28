import { Suspense } from 'react'
import { createClient, resolveMultipleUserDisplayNames } from '@/lib/supabase/server'
import { extractCampaignTemplate } from '@/features/character/template'
import HubClient from '@/features/hub/components/HubClient'
import HubHeader from '@/features/hub/components/HubHeader'

// Reads cookies (runtime data), so it must render inside <Suspense>.
async function HubData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Public campaigns
  const { data: publicCampaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  const creatorIds = (publicCampaigns ?? []).map((c) => c.creator_id)
  const creatorNamesMap = await resolveMultipleUserDisplayNames(creatorIds, user?.id)

  const enrichedPublicCampaigns = (publicCampaigns ?? []).map((camp) => {
    const tpl = extractCampaignTemplate(camp)
    const creatorName = camp.creator_id === user?.id
      ? 'คุณ (You)'
      : (creatorNamesMap.get(camp.creator_id) || (camp.creator_id ? `User (${camp.creator_id.slice(0, 6)})` : 'ผู้สร้างแคมเปญ'))

    return {
      ...camp,
      creator_name: creatorName,
      template_name: tpl.name,
      template_author: tpl.author || 'D&D Playground',
    }
  })

  // 2. Active tables where user is a participant
  const { data: activeMemberships } = await supabase
    .from('table_members')
    .select('table_id, tables(*, campaigns(title, category))')
    .eq('user_id', user?.id)

  const activeTables = (activeMemberships ?? []).flatMap((membership) => {
    const table = Array.isArray(membership.tables) ? membership.tables[0] : membership.tables
    return table ? [table] : []
  })

  return (
    <HubClient
      publicCampaigns={enrichedPublicCampaigns}
      activeTables={activeTables}
      currentUserId={user?.id ?? null}
    />
  )
}

export default function CampaignHubPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <HubHeader />
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading campaigns...</p>}>
          <HubData />
        </Suspense>
      </div>
    </div>
  )
}
