import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BoardLoader from '@/features/board/components/BoardLoader'
import { narrateBoardTurn } from '@/features/board/actions'

export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-500 p-8 text-sm">Loading board...</div>
      }
    >
      <BoardContent />
    </Suspense>
  )
}

// Reads cookies (runtime data), so it must render inside <Suspense>.
async function BoardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // The player's own sheets become hero tokens on the board
  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Any public campaign can supply the world and lorebook for the AI Dungeon Master
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title, category')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  return (
    <BoardLoader
      userId={user.id}
      characters={characters || []}
      campaigns={campaigns || []}
      narrateAction={narrateBoardTurn}
    />
  )
}
