import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CharacterEditor from '@/features/character/components/CharacterEditor'
import CharacterCodexHeader from '@/features/character/components/CharacterCodexHeader'

// Reads cookies (runtime data), so it must render inside <Suspense>.
async function CharacterList() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  return <CharacterEditor characters={characters || []} currentUserId={user?.id ?? null} />
}

export default function CharactersPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <CharacterCodexHeader />
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading characters...</p>}>
          <CharacterList />
        </Suspense>
      </div>
    </div>
  )
}
