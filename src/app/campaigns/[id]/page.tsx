import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, resolveUserDisplayName } from "@/lib/supabase/server";
import { extractCampaignTemplate, stripCampaignTemplateFromRules } from '@/features/character/template';
import { parseRuleMechanics } from '@/features/campaign/rules';
import CampaignDetailsClient from '@/features/campaign/components/CampaignDetailsClient';

type LoreEntry = {
  id: string;
  title: string;
  content: string;
  category: string;
  activation_mode: string;
  trigger_keys: string[] | null;
};

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

  const creatorDisplayName = await resolveUserDisplayName(campaign.creator_id, user?.id);

  let loreQuery = supabase
    .from('lorebook_entries')
    .select('id, title, content, category, activation_mode, trigger_keys')
    .eq('campaign_id', campaign.id);
  // Secret entries are spoilers: only the owner may see them.
  if (!isOwner) loreQuery = loreQuery.neq('activation_mode', 'Secret / DM-Only');
  const { data: lore } = await loreQuery;
  const loreEntries = (lore ?? []) as LoreEntry[];

  const campaignTemplate = extractCampaignTemplate(campaign);
  const cleanRuleMechanics = stripCampaignTemplateFromRules(campaign.rule_mechanics);
  const parsedRules = parseRuleMechanics(cleanRuleMechanics);

  return (
    <CampaignDetailsClient
      campaign={campaign}
      creatorDisplayName={creatorDisplayName}
      campaignTemplate={campaignTemplate}
      parsedRules={parsedRules}
      loreEntries={loreEntries}
    />
  );
}
