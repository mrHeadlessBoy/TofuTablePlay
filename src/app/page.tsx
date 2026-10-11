import Link from 'next/link'
import { Sparkles, Shield, Scroll, Users, Play } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight text-lg text-white">D&D Playground</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-400 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/hub"
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition"
            >
              Enter Hub
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8 flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" /> AI-Orchestrated Tabletop Engine
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Synchronized tabletop roleplay, <br className="hidden sm:inline" />
          governed by an intelligent DM.
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
          Draft hidden actions in synchronized turns, trigger custom lorebooks on the fly, 
          and let the AI Dungeon Master weave your party destiny into a living chronicle.
        </p>

        {/* Primary CTAs specified in Project Overview */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 w-full sm:w-auto">
          <Link
            href="/hub"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition shadow-lg shadow-amber-600/20"
          >
            <Scroll className="w-4 h-4" /> Text Campaign
          </Link>

          <button
            disabled
            title="Grid-Box Walking Mode coming in future releases"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 font-semibold text-sm cursor-not-allowed cursor-pointer"
          >
            <Play className="w-4 h-4" /> Live Campaign (Grid Mode)
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">Soon</span>
          </button>
        </div>

        {/* Quick Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left w-full">
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-white text-sm">Gartic Phone Loop</h3>
            <p className="text-xs text-zinc-400 leading-normal">
              Secret drafting phases with simultaneous reveals prevent meta-gaming and ensure spontaneous chaos.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2">
            <Scroll className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-white text-sm">Dynamic Lorebooks</h3>
            <p className="text-xs text-zinc-400 leading-normal">
              Inject world knowledge only when keywords or narrative hooks match, saving context tokens.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-white text-sm">Host Intervention</h3>
            <p className="text-xs text-zinc-400 leading-normal">
              Head Table hosts can fine-tune narrative text in real time to maintain campaign consistency.
            </p>
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        D&D Playground &copy; 2026 &mdash; Pure text tabletop RPG engine.
      </footer>
    </div>
  )
}