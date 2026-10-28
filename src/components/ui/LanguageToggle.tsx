'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-zinc-900/90 border border-zinc-800 rounded-lg shadow-xs ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 shrink-0" />
      <button
        type="button"
        onClick={() => setLanguage('th')}
        className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
          language === 'th'
            ? 'bg-amber-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
        title="สลับเป็นภาษาไทย"
      >
        <span>🇹🇭</span>
        <span>TH</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
          language === 'en'
            ? 'bg-amber-600 text-white shadow-xs font-semibold'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
        title="Switch to English"
      >
        <span>🇺🇸</span>
        <span>EN</span>
      </button>
    </div>
  );
}

export default LanguageToggle;
