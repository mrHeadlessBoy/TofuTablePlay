'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

export function CharacterCodexHeader() {
  const { t, language } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {t('character.codexTitle')}
        </h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          {language === 'en'
            ? 'Manage and author your reusable tabletop character sheets.'
            : 'จัดการและสร้างแผ่นตัวละครสำหรับใช้ในการเล่นแคมเปญของคุณ'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
        <LanguageToggle />
        <Link href="/hub" className="text-xs text-amber-500 hover:text-amber-400 underline">
          {t('common.backToHub')}
        </Link>
      </div>
    </div>
  );
}

export default CharacterCodexHeader;
