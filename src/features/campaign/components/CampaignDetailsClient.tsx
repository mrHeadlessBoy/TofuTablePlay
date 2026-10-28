'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Lock, Play, Sliders, Plus, User } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {categoryLabel}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700/60 text-zinc-300 flex items-center gap-1.5 font-mono">
              <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                {t('hub.createdBy')}: <strong className="text-zinc-200 font-semibold">{creatorDisplayName}</strong>
              </span>
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-2">
            {campaign.title}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <LanguageToggle />
          <Link
            href="/hub"
            className="text-xs text-amber-500 hover:text-amber-400 underline shrink-0"
          >
            {t('common.backToHub')}
          </Link>
        </div>
      </div>

      {/* Required Character Sheet Template Card */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-white">
              {t('campaign.requiredSheetTemplate')}
            </h2>
          </div>
          <span className="text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
            {t('campaign.mandatoryFormat')}
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          {t('campaign.requiredSheetDesc')}
        </p>
        <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-white">{campaignTemplate.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/60 text-amber-300 font-mono">
                {t('common.sheetAuthor')}: {campaignTemplate.author || 'Campaign Creator'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{campaignTemplate.description}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] shrink-0">
            {campaignTemplate.resources.length > 0 ? (
              campaignTemplate.resources.map((r) => (
                <span key={r.id} className="bg-zinc-900 border border-zinc-700/60 text-zinc-300 px-2 py-0.5 rounded">
                  {r.label}
                </span>
              ))
            ) : (
              <span className="bg-amber-950/60 border border-amber-800/80 text-amber-300 px-2 py-0.5 rounded font-medium">
                0 Resource Bars (Item & Clues Only)
              </span>
            )}
            <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {campaignTemplate.stats.length} Stats
            </span>
            <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {campaignTemplate.equipmentSlots.length} Gear Slots
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-800/80">
          <span className="text-[11px] text-zinc-400">
            {t('campaign.noCharYetNotice')}
          </span>
          <Link
            href={`/characters?campaignId=${encodeURIComponent(String(campaign.id))}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}`}
            className="px-3.5 py-1.5 bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" /> {t('campaign.createCharForCampaign')}
          </Link>
        </div>
      </section>

      <form action={launchTable.bind(null, String(campaign.id), language)}>
        <button
          type="submit"
          className="w-full py-2.5 bg-amber-600/90 hover:bg-amber-600 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Play className="w-4 h-4" /> {t('hub.launchAsHead')}
        </button>
      </form>

      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">
          {t('campaign.foundation')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-400 uppercase font-medium">
              {t('campaign.campaignTitle')}
            </label>
            <div className="w-full mt-1 border border-zinc-800 bg-zinc-950/60 rounded-lg p-2 text-sm text-white">
              {campaign.title}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 uppercase font-medium">
              {t('campaign.genre')}
            </label>
            <div className="w-full mt-1 border border-zinc-800 bg-zinc-950/60 rounded-lg p-2 text-sm text-white">
              {campaign.category}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 uppercase font-medium">
              {t('common.creator')}
            </label>
            <div className="w-full mt-1 border border-zinc-800 bg-zinc-950/60 rounded-lg p-2 text-sm text-amber-400 flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{creatorDisplayName}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium">
            {t('campaign.coreBrief')}
          </label>
          <div className="w-full mt-1 border border-zinc-800 bg-zinc-950/60 rounded-lg p-2.5 text-sm text-white whitespace-pre-wrap">
            {campaign.core_description}
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium">
            {t('campaign.worldSetting')}
          </label>
          <div className="w-full mt-1 border border-zinc-800 bg-zinc-950/60 rounded-lg p-2.5 text-sm text-white whitespace-pre-wrap">
            {campaign.world_setting}
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium block mb-2">
            {t('campaign.ruleMechanics')} ({parsedRules.length})
          </label>
          {parsedRules.length > 0 ? (
            <div className="space-y-2">
              {parsedRules.map((rule, idx) => (
                <div key={rule.id || idx} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{rule.title}</span>
                    {rule.category && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        {rule.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{rule.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full border border-zinc-800/80 rounded-lg p-2.5 text-xs text-zinc-400 bg-zinc-950/60">
              {t('campaign.standardRulesApply')}
            </div>
          )}
        </div>
      </section>

      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-white">{t('campaign.lorebook')}</h2>
          <span className="text-xs text-zinc-500">({loreEntries.length})</span>
        </div>

        {loreEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">{t('campaign.noLorebook')}</p>
        ) : (
          <div className="space-y-3">
            {loreEntries.map((entry) => (
              <div key={entry.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-white">{entry.title}</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{entry.category}</span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800 inline-flex items-center gap-1">
                    {entry.activation_mode === 'Secret / DM-Only' && <Lock className="w-2.5 h-2.5" />}
                    {entry.activation_mode}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{entry.content}</p>
                {(entry.trigger_keys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(entry.trigger_keys ?? []).map((k) => (
                      <span key={k} className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
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
