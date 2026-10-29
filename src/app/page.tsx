'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Scroll, Users, Play, BookOpen, Crown, ChevronRight, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

type LocalizedText = { th: string; en: string }

// The 3 core pillars shown under the hero
const FEATURE_PILLARS: { icon: LucideIcon; title: LocalizedText; body: LocalizedText }[] = [
  {
    icon: Users,
    title: { th: 'ดราฟต์พร้อมกัน (Gartic Phone Loop)', en: 'Synchronized Action Draft' },
    body: {
      th: 'ทุกคนพิมพ์แอ็กชันส่วนตัวแบบซ่อน แล้วเปิดเผยพร้อมกัน ป้องกันการแก้ทางแบบ Meta-gaming และสร้างความสนุกไม่คาดฝัน',
      en: 'Secret drafting phases with simultaneous reveals prevent meta-gaming and ensure spontaneous tactical moments.',
    },
  },
  {
    icon: BookOpen,
    title: { th: 'คลังตำนานชาญฉลาด (Dynamic Lorebooks)', en: 'Dynamic Lorebooks' },
    body: {
      th: 'แทรกข้อมูลโลกและเงื่อนไขลับเข้ามาเฉพาะเมื่อคำสำคัญตรงกับบทสนทนา ประหยัด Token และคงความแม่นยำของ Lore',
      en: 'Inject world knowledge only when narrative hooks trigger, preserving context tokens while deepening lore accuracy.',
    },
  },
  {
    icon: Crown,
    title: { th: 'หัวหน้าโต๊ะปรับแต่งได้ (Host Authority)', en: 'Host Narrative Override' },
    body: {
      th: 'Head Table สามารถปรับแต่งข้อความบรรยายของ AI ได้แบบเรียลไทม์ พร้อมระบบสลับภาษา (TH/EN) ได้อิสระ',
      en: 'Head Table hosts can fine-tune narration in real time to steer plot twists and maintain campaign integrity.',
    },
  },
]

export default function LandingPage() {
  const { language } = useLanguage()
  const isThai = language === 'th'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-amber-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/40 bg-zinc-950/70 backdrop-blur-xl sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-85" title="TofuTablePlay">
            <Image
              src="/assets/pictures/logo_tofutableplay.png"
              alt="TofuTablePlay"
              width={120}
              height={120}
              className="h-12 sm:h-16 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageToggle />
            <Link
              href="/login"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors duration-200 px-2 py-1"
            >
              {isThai ? 'เข้าสู่ระบบ' : 'Sign In'}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-10 sm:pt-14 pb-24 text-center space-y-8 sm:space-y-10 flex-1 flex flex-col justify-center items-center">

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

        {/* Feature Grid (3 Core Pillars) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full pt-4">
          {FEATURE_PILLARS.map((pillar) => (
            <FeatureCard
              key={pillar.title.en}
              icon={pillar.icon}
              title={isThai ? pillar.title.th : pillar.title.en}
              body={isThai ? pillar.body.th : pillar.body.en}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/40 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          <p>TofuTablePlay &copy; 2026 &mdash; Pure text tabletop RPG engine.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="surface-panel surface-panel-hover rounded-xl p-5 space-y-2.5">
      <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
        <Icon className="w-4 h-4 text-amber-400/90" />
      </div>
      <h3 className="font-semibold text-zinc-100 text-sm">{title}</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">{body}</p>
    </div>
  )
}
