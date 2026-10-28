'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Users, ArrowLeft } from 'lucide-react';

export function CharacterCodexHeader() {
  const { t, language } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/40 pb-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center">
            <Users className="w-4 h-4 text-amber-500/90" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            {t('character.codexTitle')}
          </h1>
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm pl-0.5 leading-relaxed">
          {language === 'en'
            ? 'Manage and author your reusable tabletop character sheets.'
            : 'จัดการและสร้างแผ่นตัวละครสำหรับใช้ในการเล่นแคมเปญของคุณ'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
        <LanguageToggle />
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('common.backToHub')}</span>
        </Link>
      </div>
    </div>
  );
}

export default CharacterCodexHeader;
