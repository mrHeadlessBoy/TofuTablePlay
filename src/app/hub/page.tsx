import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import HubClient from './HubClient'

export default async function CampaignHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Public campaigns
  const { data: publicCampaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Campaign Hub</h1>
            <p className="text-zinc-400 text-sm">Join an existing room, launch a session, or build your worlds.</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/characters" className="text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
              Character Sheets
            </Link>
            <Link href="/campaigns/new" className="text-xs text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg font-medium">
              + New Campaign
            </Link>
          </div>
        </div>

        <HubClient publicCampaigns={publicCampaigns || []} activeTables={activeTables} />
      </div>
    </div>
  )
}