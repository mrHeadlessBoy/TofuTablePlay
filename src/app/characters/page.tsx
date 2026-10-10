import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CharacterEditor from './CharacterEditor'
import Link from 'next/link'

// Reads cookies (runtime data), so it must render inside <Suspense>.
async function CharacterList() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  return <CharacterEditor characters={characters || []} />
}

export default function CharactersPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Character Codex</h1>
            <p className="text-zinc-400 text-sm">Manage and author your reusable tabletop character sheets.</p>
          </div>
          <Link href="/hub" className="text-xs text-amber-500 hover:text-amber-400 underline">
            &larr; Back to Campaign Hub
          </Link>
        </div>

        <Suspense fallback={<p className="text-sm text-zinc-500">Loading characters...</p>}>
          <CharacterList />
        </Suspense>
      </div>
    </div>
  )
}