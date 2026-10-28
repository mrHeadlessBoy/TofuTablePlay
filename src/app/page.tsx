'use client'

import Link from 'next/link'
import { Sparkles, Shield, Scroll, Users, Play, BookOpen, Crown, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

export default function LandingPage() {
  const { language } = useLanguage()
  const isThai = language === 'th'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-amber-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/40 bg-zinc-950/70 backdrop-blur-xl sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-500/90" />
            </div>
            <span className="font-semibold tracking-tight text-base text-zinc-100">
              TofuTablePlay
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageToggle />
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors duration-200 px-2 py-1"
            >
              {isThai ? 'เข้าสู่ระบบ' : 'Sign In'}
            </Link>
            <Link
              href="/hub"
              className="text-xs font-medium bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 px-3.5 py-1.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isThai ? 'เข้าสู่ฮับ' : 'Enter Hub'}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center space-y-12 flex-1 flex flex-col justify-center items-center">
        {/* Subtle Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 text-zinc-300 text-xs font-mono transition-opacity hover:opacity-90">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/90" />
          <span>{isThai ? 'ระบบเทเบิลท็อปสวมบทบาทขับเคลื่อนด้วย AI' : 'AI-Orchestrated Tabletop Engine'}</span>
        </div>

        {/* Hero Headline & Subtitle */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-100 leading-[1.15]">
            {isThai ? (
              <>
                สวมบทบาทเทเบิลท็อปพร้อมเพรียง <br className="hidden sm:inline" />
                ดำเนินเรื่องโดย AI Dungeon Master
              </>
            ) : (
              <>
                Synchronized tabletop roleplay, <br className="hidden sm:inline" />
                governed by an intelligent DM.
              </>
            )}
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {isThai
              ? 'ดราฟต์แอ็กชันลับพร้อมกัน ปลดล็อกคลังตำนาน Lorebook อัตโนมัติตามบทสนทนา และให้ AI DM ถักทอเรื่องราวเป็นพงศาวดารแบบไร้รอยต่อ'
              : 'Draft hidden actions in synchronized turns, trigger contextual lorebooks on the fly, and let the AI Dungeon Master weave your party destiny into a living chronicle.'}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full sm:w-auto justify-center">
          <Link
            href="/hub"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
          >
            <Scroll className="w-4 h-4 text-amber-200" />
            <span>{isThai ? 'เข้าสู่แคมเปญข้อความ (Text Campaign)' : 'Enter Text Campaign'}</span>
            <ChevronRight className="w-4 h-4 text-amber-200/80" />
          </Link>

          <button
            disabled
            title="Grid-Box Walking Mode coming in future releases"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 font-medium text-sm cursor-not-allowed"
          >
            <Play className="w-4 h-4 opacity-50" />
            <span>{isThai ? 'โหมดเดินช่อง (Grid Mode)' : 'Live Campaign (Grid Mode)'}</span>
            <span className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.5 rounded font-mono">Soon</span>
          </button>
        </div>

        {/* Live Story Preview Mockup (Atmospheric Layered Opacity) */}
        <div className="w-full max-w-3xl surface-panel surface-panel-hover rounded-2xl p-5 sm:p-6 text-left space-y-4 shadow-xl">
          {/* Mock Window Top Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse" />
              <span className="font-mono text-zinc-400">{isThai ? 'โต๊ะเล่น: #TFP-808' : 'Table: #TFP-808'}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-amber-400/90">
                {isThai ? 'เทิร์น #12 — คลี่คลายเรื่องราว' : 'Turn #12 — Narration'}
              </span>
            </div>
          </div>

          {/* DM Chronicle Passage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-400/90 font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI DUNGEON MASTER</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic">
              {isThai
                ? '“หมอกควันสีครามค่อยๆ สลายตัว เผยให้เห็นบานประตูศิลาโบราณสลักอักขระเรืองแสงอ่อนๆ Aria ก้าวเท้าอย่างเงียบกริบเพื่อสังเกตการณ์กลไกกับดัก ขณะที่ Bran ชูคทาสร้างม่านคุ้มภัยให้กลุ่ม...”'
                : '“The azure mist dissolves slowly, revealing an ancient runic archway etched into the bedrock. Aria slips soundlessly across the mossy flagstones to inspect the mechanism, while Bran raises his stave to cast a protective perimeter...”'}
            </p>
          </div>

          {/* Party Member Status Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-800/40 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/50 flex justify-between items-center">
              <div>
                <p className="font-medium text-zinc-200">Aria</p>
                <p className="text-[10px] text-zinc-500 font-mono">Rogue / Scout</p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
                HP 24/24
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/50 flex justify-between items-center">
              <div>
                <p className="font-medium text-zinc-200">Bran</p>
                <p className="text-[10px] text-zinc-500 font-mono">Cleric of Light</p>
              </div>
              <span className="text-[11px] font-mono text-cyan-400/90 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/40">
                SP 14/16
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-800/50 flex justify-between items-center">
              <div>
                <p className="font-medium text-zinc-200">Chloe</p>
                <p className="text-[10px] text-zinc-500 font-mono">Investigator</p>
              </div>
              <span className="text-[11px] font-mono text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/40">
                {isThai ? 'เบาะแส: 3' : 'Clues: 3'}
              </span>
            </div>
          </div>
        </div>

        {/* Feature Grid (3 Core Pillars) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full pt-4">
          <div className="surface-panel surface-panel-hover rounded-xl p-5 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-400/90" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              {isThai ? 'ดราฟต์พร้อมกัน (Gartic Phone Loop)' : 'Synchronized Action Draft'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isThai
                ? 'ทุกคนพิมพ์แอ็กชันส่วนตัวแบบซ่อน แล้วเปิดเผยพร้อมกัน ป้องกันการแก้ทางแบบ Meta-gaming และสร้างความสนุกไม่คาดฝัน'
                : 'Secret drafting phases with simultaneous reveals prevent meta-gaming and ensure spontaneous tactical moments.'}
            </p>
          </div>

          <div className="surface-panel surface-panel-hover rounded-xl p-5 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-400/90" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              {isThai ? 'คลังตำนานชาญฉลาด (Dynamic Lorebooks)' : 'Dynamic Lorebooks'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isThai
                ? 'แทรกข้อมูลโลกและเงื่อนไขลับเข้ามาเฉพาะเมื่อคำสำคัญตรงกับบทสนทนา ประหยัด Token และคงความแม่นยำของ Lore'
                : 'Inject world knowledge only when narrative hooks trigger, preserving context tokens while deepening lore accuracy.'}
            </p>
          </div>

          <div className="surface-panel surface-panel-hover rounded-xl p-5 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-400/90" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              {isThai ? 'หัวหน้าโต๊ะปรับแต่งได้ (Host Authority)' : 'Host Narrative Override'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isThai
                ? 'Head Table สามารถปรับแต่งข้อความบรรยายของ AI ได้แบบเรียลไทม์ พร้อมระบบสลับภาษา (TH/EN) ได้อิสระ'
                : 'Head Table hosts can fine-tune narration in real time to steer plot twists and maintain campaign integrity.'}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/40 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>TofuTablePlay &copy; 2026 &mdash; Pure text tabletop RPG engine.</p>
          <div className="flex items-center gap-4 text-zinc-400">
            <Link href="/hub" className="hover:text-zinc-200 transition-colors">
              {isThai ? 'ศูนย์กลางแคมเปญ' : 'Campaign Hub'}
            </Link>
            <Link href="/login" className="hover:text-zinc-200 transition-colors">
              {isThai ? 'บัญชีผู้เล่น' : 'Player Account'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
