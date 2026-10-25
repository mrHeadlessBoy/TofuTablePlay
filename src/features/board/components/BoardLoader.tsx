'use client'

import dynamic from 'next/dynamic'
import type { CampaignOption, CodexCharacter } from '../lib/session'
import type { NarrateAction } from '../lib/types'

// The board draws with WebGL and restores its state from localStorage,
// so it only makes sense in the browser: skip server rendering for it.
const BoardPlayground = dynamic(() => import('./BoardPlayground'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-zinc-950 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
      Setting up the board...
    </div>
  ),
})

type BoardLoaderProps = {
  userId: string
  characters: CodexCharacter[]
  campaigns: CampaignOption[]
  narrateAction: NarrateAction
}

export default function BoardLoader(props: BoardLoaderProps) {
  return <BoardPlayground {...props} />
}
