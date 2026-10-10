import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TablePlayground from './TablePlayground'

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

// Reads params + cookies (runtime data), so it must render inside <Suspense>.
async function TableContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  // Fetch Members & linked characters
  const { data: members } = await supabase
    .from('table_members')
    .select(`
      *,
      characters (*)
    `)
    .eq('table_id', id)

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

  // Fetch campaign lorebook entries
  const { data: lorebook } = await supabase
    .from('lorebook_entries')
    .select('*')
    .eq('campaign_id', table.campaign_id)

  const currentMember = members?.find((m) => m.user_id === user.id)
  const isHeadTable = table.head_table_id === user.id

  return (
    <TablePlayground
      initialTable={table}
      initialMembers={members || []}
      initialTurns={turns || []}
      lorebook={lorebook || []}
      userCharacters={userCharacters || []}
      currentMember={currentMember}
      userId={user.id}
      isHeadTable={isHeadTable}
    />
  )
}