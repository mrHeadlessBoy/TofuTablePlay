'use client'

import { Globe } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Language } from '@/lib/i18n/types'

const LANGUAGE_OPTIONS: { value: Language; flag: string; label: string; title: string }[] = [
  { value: 'th', flag: '🇹🇭', label: 'TH', title: 'สลับเป็นภาษาไทย' },
  { value: 'en', flag: '🇺🇸', label: 'EN', title: 'Switch to English' },
]

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-zinc-900/90 border border-zinc-800 rounded-lg shadow-xs ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 shrink-0" />
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
            language === option.value
              ? 'bg-amber-600 text-white shadow-xs font-semibold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
          title={option.title}
        >
          <span>{option.flag}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export default LanguageToggle
