import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookOpen, Lock, Play, Sliders, Plus } from 'lucide-react'
import { extractCampaignTemplate, stripCampaignTemplateFromRules } from '@/features/character/template'
import { launchTable } from '@/features/hub/actions'

type LoreEntry = {
  id: string
  title: string
  content: string
  category: string
  activation_mode: string
  trigger_keys: string[] | null
}

export default function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Suspense
          fallback={
            <p className="text-sm text-zinc-500">Loading campaign...</p>
          }
        >
          <CampaignDetails params={params} />
        </Suspense>
      </div>
    </div>
  );
}

// Reads params + cookies (runtime data), so it must render inside <Suspense>.
async function CampaignDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const isOwner = !!user && campaign.creator_id === user.id;
  if (!campaign.is_public && !isOwner) notFound();

    let loreQuery = supabase
    .from('lorebook_entries')
    .select('id, title, content, category, activation_mode, trigger_keys')
    .eq('campaign_id', campaign.id)
  // Secret entries are spoilers: only the owner may see them.
  if (!isOwner) loreQuery = loreQuery.neq('activation_mode', 'Secret / DM-Only')
  const { data: lore } = await loreQuery
  const loreEntries = (lore ?? []) as LoreEntry[]

  const categoryLabel =
    campaign.category === "Custom" && campaign.custom_category
      ? campaign.custom_category
      : campaign.category;



  const campaignTemplate = extractCampaignTemplate(campaign);
  const cleanRuleMechanics = stripCampaignTemplateFromRules(campaign.rule_mechanics);

  return (
    <>
      <div className="flex justify-between items-start gap-4 border-b border-zinc-800 pb-4">
        <div>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
            {categoryLabel}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-2">
            {campaign.title}
          </h1>
        </div>
        <Link
          href="/hub"
          className="text-xs text-amber-500 hover:text-amber-400 underline shrink-0"
        >
          &larr; Back to Hub
        </Link>
      </div>
      {/* Required Character Sheet Template Card */}
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-white">Required Character Sheet Template</h2>
          </div>
          <span className="text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
            Mandatory Table Format
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          All adventurers joining this campaign table must play using this character sheet format:
        </p>
        <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-white">{campaignTemplate.name}</div>
            <p className="text-xs text-zinc-400 mt-0.5">{campaignTemplate.description}</p>
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
            ยังไม่มีตัวละครสำหรับแคมเปญนี้ใช่หรือไม่?
          </span>
          <Link
            href={`/characters?campaignId=${encodeURIComponent(String(campaign.id))}&templateId=${encodeURIComponent(campaignTemplate.id)}&returnTo=${encodeURIComponent(`/campaigns/${campaign.id}`)}`}
            className="px-3.5 py-1.5 bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" /> สร้างตัวละครตามเทมเพลตนี้ (Create Character)
          </Link>
        </div>
      </section>

      <form action={launchTable.bind(null, String(campaign.id))}>
                <button 
            type="submit"
            className="w-full py-2.5 bg-amber-600/90 hover:bg-amber-600 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4" /> Launch as Head Table
          </button>

      </form>

      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">
          Campaign Foundation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 uppercase font-medium">
              Campaign Title
            </label>

            <div className="w-full mt-1 border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none">
              {campaign.title}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 uppercase font-medium">
              Genre / Category
            </label>
            <div className="w-full mt-1 border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none">
              {campaign.category}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium">
            Core Narrative Brief
          </label>
            <div className="w-full mt-1 border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none">
              {campaign.core_description}
            </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium">
            World Setting & Environment Lore
          </label>
            <div className="w-full mt-1 border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none">
              {campaign.world_setting}
            </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 uppercase font-medium">
            Rule Mechanics & Custom Systems
          </label>
            <div className="w-full mt-1 border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-amber-500 outline-none">
              {cleanRuleMechanics || 'Standard tabletop RPG rules apply.'}
            </div>
        </div>
      </section>
      <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-white">Lorebook</h2>
          <span className="text-xs text-zinc-500">({loreEntries.length})</span>
        </div>

        {loreEntries.length === 0 ? (
          <p className="text-xs text-zinc-500">No public lore entries.</p>
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

