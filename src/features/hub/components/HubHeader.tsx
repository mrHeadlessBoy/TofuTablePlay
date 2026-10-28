'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { signOut } from '@/features/hub/actions';
import Image from 'next/image';
import { LogOut, Plus, Users } from 'lucide-react';

export function HubHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800/40 pb-5">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center" title="TofuTablePlay">
            <Image
              src="/assets/pictures/logo.png"
              alt="TofuTablePlay"
              width={130}
              height={44}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            {t('hub.title')}
          </h1>
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm pl-0.5 leading-relaxed">
          {t('hub.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <LanguageToggle />

        <Link
          href="/characters"
          className="text-xs text-zinc-300 hover:text-white bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/70 hover:border-zinc-700/80 px-3.5 py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 font-medium shadow-sm"
        >
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span>{t('nav.characterSheets')}</span>
        </Link>

        <Link
          href="/campaigns/new"
          className="text-xs text-zinc-100 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 px-3.5 py-2 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-amber-200" />
          <span>{t('nav.newCampaign')}</span>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="text-xs text-zinc-400 hover:text-red-300 bg-zinc-900/60 hover:bg-red-950/40 border border-zinc-800/70 hover:border-red-900/60 px-3 py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5 cursor-pointer font-medium"
            title={t('nav.signOut')}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('nav.signOut')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default HubHeader;
