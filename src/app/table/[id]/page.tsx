import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { UUID_REGEX, type SessionClient } from '@/lib/supabase/auth'
import { notFound, redirect } from 'next/navigation'
import TablePlayground from '@/features/table/components/TablePlayground'
import { getTableMembers } from '@/features/table/actions'

export default function TablePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-500 p-8 text-sm">Loading table...</div>
      }
    >
      <TableContent params={params} />
    </Suspense>
  )
}

async function ensureTableMembership(
  supabase: SessionClient,
  tableId: string,
  userId: string
) {
  const { data: existingSeat } = await supabase
    .from('table_members')
    .select('id')
    .eq('table_id', tableId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingSeat) {
    const { error } = await supabase.from('table_members').upsert(
      {
        table_id: tableId,
        user_id: userId,
      },
      { onConflict: 'table_id,user_id' }
    )
    if (error) {
      throw new Error(`Failed to join table: ${error.message}`)
    }
  }
}

// Reads params + cookies (runtime data), so it must render inside <Suspense>.
async function TableContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=${encodeURIComponent(`/table/${id}`)}`)

  // Allow invite links using either the short table_code (/table/7K4X9B) or the table UUID (/table/<uuid>)
  if (!UUID_REGEX.test(id)) {
    const cleanCode = decodeURIComponent(id).trim().toUpperCase()
    const { data: tableByCode } = await supabase
      .from('tables')
      .select('id')
      .eq('table_code', cleanCode)
      .maybeSingle()

    if (!tableByCode) notFound()

    await ensureTableMembership(supabase, tableByCode.id, user.id)
    redirect(`/table/${tableByCode.id}`)
  }

  // Fetch Table with campaign details
  const { data: table } = await supabase
    .from('tables')
    .select(`
      *,
      campaigns (*)
    `)
    .eq('id', id)
    .single()

  if (!table) notFound()

  // Automatically add or re-enter user into table_members when opening a direct table link
  await ensureTableMembership(supabase, table.id, user.id)

  const members = await getTableMembers(id)

  // Fetch User's Characters
  const { data: userCharacters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)

  // Fetch narrative turns history
  const { data: turns } = await supabase
    .from('turns')
    .select('*')
    .eq('table_id', id)
    .order('turn_number', { ascending: true })

  const currentMember = members.find((m) => m.user_id === user.id)
  const isHeadTable = table.head_table_id === user.id
  const isCampaignOwner = table.campaigns?.creator_id === user.id

  // Fetch campaign lorebook entries (hide Secret / DM-Only entries from regular players)
  let lorebookQuery = supabase
    .from('lorebook_entries')
    .select('*')
    .eq('campaign_id', table.campaign_id)
  if (!isHeadTable && !isCampaignOwner) {
    lorebookQuery = lorebookQuery.neq('activation_mode', 'Secret / DM-Only')
  }
  const { data: lorebook } = await lorebookQuery

  return (
    <TablePlayground
      initialTable={table}
      initialMembers={members}
      initialTurns={turns || []}
      lorebook={lorebook || []}
      userCharacters={userCharacters || []}
      currentMember={currentMember}
      userId={user.id}
      isHeadTable={isHeadTable}
    />
  )
}
