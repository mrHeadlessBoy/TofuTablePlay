'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { signOut } from '@/features/hub/actions';
import { LogOut } from 'lucide-react';

export function HubHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('hub.title')}</h1>
        <p className="text-zinc-400 text-sm mt-0.5">{t('hub.subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2.5 items-center">
        <LanguageToggle />
        <Link
          href="/characters"
          className="text-xs text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition"
        >
          {t('nav.characterSheets')}
        </Link>
        <Link
          href="/campaigns/new"
          className="text-xs text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg font-medium transition"
        >
          {t('nav.newCampaign')}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs text-zinc-400 hover:text-red-400 bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900/50 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer font-medium"
            title={t('nav.signOut')}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.signOut')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default HubHeader;
