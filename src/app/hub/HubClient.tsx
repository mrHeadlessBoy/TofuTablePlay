'use client'

import { useState } from 'react'
import { launchTable, joinTableByCode } from './actions'
import { Play, LogIn, Compass } from 'lucide-react'
import Link from 'next/link'

export default function HubClient({ publicCampaigns, activeTables }: { publicCampaigns: any[], activeTables: any[] }) {
  const [tableCode, setTableCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tableCode.trim()) return
    setJoining(true)
    try {
      await joinTableByCode(tableCode)
    } catch (err: any) {
      alert(err.message)
      setJoining(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Quick Join Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Have a Table Code?</h2>
          <p className="text-xs text-zinc-400">Enter the 6-character code provided by your Head Table.</p>
        </div>
        <form onSubmit={handleJoin} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            maxLength={8}
            placeholder="e.g. 7K4X9B"
            value={tableCode}
            onChange={(e) => setTableCode(e.target.value.toUpperCase())}
            className="bg-zinc-950 border border-zinc-700 px-3 py-2 rounded-lg text-sm tracking-wider uppercase font-mono text-white focus:border-amber-500 outline-none"
          />
          <button
            type="submit"
            disabled={joining}
            className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
          >
            <LogIn className="w-4 h-4" /> Join
          </button>
        </form>
      </div>

      {/* Active Tables */}
      {activeTables.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Active Tables</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeTables.map((tbl: any) => (
              <div key={tbl.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500">CODE: {tbl.table_code}</span>
                  <h3 className="text-base font-semibold text-white mt-1">{tbl.campaigns?.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">Turn: {tbl.current_turn} | Phase: {tbl.turn_phase}</p>
                </div>
                <Link
                  href={`/table/${tbl.id}`}
                  className="mt-4 inline-flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-white transition"
                >
                  <Play className="w-3.5 h-3.5" /> Re-enter Table
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Campaigns */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Compass className="w-5 h-5 text-amber-500" /> Explore Campaigns
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publicCampaigns.map((camp) => (
            <div key={camp.id} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{camp.category}</span>
                <h3 className="text-lg font-bold text-white mt-2">{camp.title}</h3>
                <p className="text-xs text-zinc-400 mt-2 line-clamp-3">{camp.core_description}</p>
              </div>
              <form action={launchTable.bind(null, camp.id)} className="mt-5">
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-600/90 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Launch as Head Table
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}