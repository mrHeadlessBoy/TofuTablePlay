'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Lock, Play, Sliders, Plus, User, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { launchTable } from '@/features/hub/actions';
import type { CharacterTemplate } from '@/features/character/template';
import type { CampaignRuleMechanic } from '@/features/campaign/rules';

type LoreEntry = {
  id: string;
  title: string;
  content: string;
  category: string;
  activation_mode: string;
  trigger_keys: string[] | null;
};

interface CampaignDetailsClientProps {
  campaign: {
    id: string | number;
    title: string;
    category: string;
    custom_category?: string | null;
    core_description: string;
    world_setting: string;
    creator_id?: string | null;
  };
  creatorDisplayName: string;
  campaignTemplate: CharacterTemplate;
  parsedRules: CampaignRuleMechanic[];
  loreEntries: LoreEntry[];
}

export default function CampaignDetailsClient({
  campaign,
  creatorDisplayName,
  campaignTemplate,
  parsedRules,
  loreEntries,
}: CampaignDetailsClientProps) {
  const { t, language } = useLanguage();

  const categoryLabel =
    campaign.category === 'Custom' && campaign.custom_category
      ? campaign.custom_category
      : campaign.category;

  return (
    <>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/40 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/60 text-zinc-300 font-medium">
              {categoryLabel}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900/60 border border-zinc-800/70 text-zinc-400 flex items-center gap-1.5 font-mono">
              <User className="w-3.5 h-3.5 text-amber-500/90 shrink-0" />
              <span>
                {t('hub.createdBy')}: <strong className="text-zinc-200 font-semibold">{creatorDisplayName}</strong>
              </span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 mt-2">
            {campaign.title}
          </h1>
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

      {/* Required Character Sheet Template Card */}
      <section className="surface-panel rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500/90" />
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
              {t('campaign.requiredSheetTemplate')}
            </h2>
          </div>
          <span className="text-[11px] font-medium bg-amber-500/10 text-amber-400/90 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            {t('campaign.mandatoryFormat')}
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t('campaign.requiredSheetDesc')}
        </p>

        <div className="p-4 bg-black/40 border border-zinc-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-zinc-100">{campaignTemplate.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-400 font-mono">
                {t('common.sheetAuthor')}: {campaignTemplate.author || 'Campaign Creator'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{campaignTemplate.description}</p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px] shrink-0 font-mono">
            {campaignTemplate.resources.length > 0 ? (
              campaignTemplate.resources.map((r) => (
                <span key={r.id} className="bg-zinc-900 border border-zinc-700/60 text-zinc-300 px-2 py-0.5 rounded-lg">
                  {r.label}
                </span>
              ))
            ) : (
              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400/90 px-2 py-0.5 rounded-lg font-medium">
                0 Resources (Item & Clues Only)
              </span>
            )}
            <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg">
              {campaignTemplate.stats.length} Stats
            </span>
            <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg">
              {campaignTemplate.equipmentSlots.length} Gear Slots
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-800/40">
          <span className="text-[11px] text-zinc-400">
            {t('campaign.noCharYetNotice')}
          </span>
          <Link
            href={`/characters?campaignId=${encodeURIComponent(String(campaign.id))}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}`}
            className="px-3.5 py-1.5 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('campaign.createCharForCampaign')}</span>
          </Link>
        </div>
      </section>

      {/* Launch Table Form */}
      <form action={launchTable.bind(null, String(campaign.id), language)}>
        <button
          type="submit"
          className="w-full py-3 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 rounded-xl text-sm font-semibold text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Play className="w-4 h-4" />
          <span>{t('hub.launchAsHead')}</span>
        </button>
      </form>

      {/* Campaign Foundation Section */}
      <section className="surface-panel rounded-2xl p-6 space-y-5 shadow-lg">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
          {t('campaign.foundation')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">
              {t('campaign.campaignTitle')}
            </label>
            <div className="w-full border border-zinc-800/80 bg-black/40 rounded-xl p-2.5 text-sm text-zinc-100">
              {campaign.title}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">
              {t('campaign.genre')}
            </label>
            <div className="w-full border border-zinc-800/80 bg-black/40 rounded-xl p-2.5 text-sm text-zinc-100">
              {campaign.category}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">
              {t('common.creator')}
            </label>
            <div className="w-full border border-zinc-800/80 bg-black/40 rounded-xl p-2.5 text-sm text-amber-400/90 flex items-center gap-1.5 font-medium font-mono">
              <User className="w-3.5 h-3.5 text-amber-500/90 shrink-0" />
              <span>{creatorDisplayName}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">
            {t('campaign.coreBrief')}
          </label>
          <div className="w-full border border-zinc-800/80 bg-black/40 rounded-xl p-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {campaign.core_description}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">
            {t('campaign.worldSetting')}
          </label>
          <div className="w-full border border-zinc-800/80 bg-black/40 rounded-xl p-3 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {campaign.world_setting}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium block">
            {t('campaign.ruleMechanics')} ({parsedRules.length})
          </label>
          {parsedRules.length > 0 ? (
            <div className="space-y-2">
              {parsedRules.map((rule, idx) => (
                <div key={rule.id || idx} className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-100">{rule.title}</span>
                    {rule.category && (
                      <span className="text-[10px] bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-md font-mono">
                        {rule.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full border border-zinc-800/70 rounded-xl p-3 text-xs text-zinc-400 bg-black/30">
              {t('campaign.standardRulesApply')}
            </div>
          )}
        </div>
      </section>

      {/* Lorebook Registry */}
      <section className="surface-panel rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500/90" />
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">{t('campaign.lorebook')}</h2>
          <span className="text-xs text-zinc-500 font-mono">({loreEntries.length})</span>
        </div>

        {loreEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">{t('campaign.noLorebook')}</p>
        ) : (
          <div className="space-y-3">
            {loreEntries.map((entry) => (
              <div key={entry.id} className="p-3.5 bg-black/30 border border-zinc-800/70 rounded-xl space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-100">{entry.title}</span>
                  <span className="text-[10px] bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-md font-mono">{entry.category}</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400/90 px-2 py-0.5 rounded-md border border-amber-500/20 inline-flex items-center gap-1 font-mono">
                    {entry.activation_mode === 'Secret / DM-Only' && <Lock className="w-2.5 h-2.5" />}
                    <span>{entry.activation_mode}</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                {(entry.trigger_keys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(entry.trigger_keys ?? []).map((k) => (
                      <span key={k} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-md font-mono">
                        #{k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
