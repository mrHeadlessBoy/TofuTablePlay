'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Check, ChevronDown, Users, UserX } from 'lucide-react'
import { extractCharacterSkillCost, getHpTailwindClass } from '@/features/character/domain'
import {
  readCharacterTemplate,
  readCustomValues,
  type ResourceColor,
} from '@/features/character/template'
import {
  buildPlayerColorMap,
  getPlayerNameColor,
  type Character,
  type LorebookEntry,
  type Member,
} from '../types'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const ROSTER_RESOURCE_TEXT_COLOR: Record<ResourceColor, string> = {
  red: 'text-red-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  violet: 'text-violet-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
  zinc: 'text-zinc-300',
}

// Strip a parenthesised suffix such as "Sanity (สติ)" -> "Sanity"
function shortResourceLabel(label: string): string {
  return label.split(/[（(]/)[0].trim()
}

type PartyRosterSidebarProps = {
  members: Member[]
  memberLoadError: string | null
  headTableId: string | undefined
  userId: string
  isHeadTable: boolean
  lorebook: LorebookEntry[]
  onKickMember: (targetUserId: string, targetName: string) => void
}

/**
 * Floating In-Game HUD for Party Roster & Campaign Lorebook.
 * Renders in the top-right corner with a transparent background (no solid panel BG),
 * floating seamlessly over the game screen like an MMORPG/SAO game HUD.
 */
export default function PartyRosterSidebar({
  members,
  memberLoadError,
  headTableId,
  userId,
  isHeadTable,
  lorebook,
  onKickMember,
}: PartyRosterSidebarProps) {
  const { t } = useLanguage()

  const playerColorMap = useMemo(
    () =>
      buildPlayerColorMap(
        members
          .map((m) => m.characters?.name)
          .filter((name): name is string => Boolean(name && name.trim())),
      ),
    [members],
  )

  const readyCount = members.filter((m) => m.is_ready).length

  return (
    <aside
      aria-label="Party Roster & Campaign Lorebook HUD"
      className="fixed top-3.5 right-4 z-30 w-72 sm:w-80 pointer-events-none flex flex-col gap-2.5 max-h-[calc(100vh-6rem)]"
    >
      {/* 1. FLOATING PARTY ROSTER HUD BLOCK */}
      <CollapsibleHudPanel
        icon={<Users className="w-3.5 h-3.5 text-amber-400" />}
        accentClassName="bg-amber-500/80"
        title={t('table.partyRoster')}
        count={`(${readyCount}/${members.length})`}
        panelName="Party Roster"
        bodyClassName="max-h-[38vh]"
      >
        {memberLoadError && (
          <p className="text-xs text-red-400 font-mono" role="alert">
            {memberLoadError}
          </p>
        )}

        {members.map((m) => (
          <PartyMemberCard
            key={m.id}
            member={m}
            nameColorClass={
              m.characters?.name ? getPlayerNameColor(m.characters.name, playerColorMap) : 'text-white'
            }
            isHost={m.user_id === headTableId}
            canKick={isHeadTable && m.user_id !== userId}
            onKick={onKickMember}
          />
        ))}
      </CollapsibleHudPanel>

      {/* 2. FLOATING CAMPAIGN LOREBOOK HUD BLOCK */}
      <CollapsibleHudPanel
        icon={<BookOpen className="w-3.5 h-3.5 text-amber-400" />}
        accentClassName="bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
        title={t('table.lorebook')}
        count={`(${lorebook.length})`}
        panelName="Campaign Lorebook"
        bodyClassName="max-h-[30vh]"
      >
        {lorebook.map((entry) => (
          <LoreEntryCard key={entry.id} entry={entry} />
        ))}
        {lorebook.length === 0 && (
          <p className="text-zinc-500 text-xs italic">{t('campaign.noLorebook')}</p>
        )}
      </CollapsibleHudPanel>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* HUD panel shell                                                     */
/* ------------------------------------------------------------------ */

function CollapsibleHudPanel({
  icon,
  accentClassName,
  title,
  count,
  panelName,
  bodyClassName,
  children,
}: {
  icon: ReactNode
  accentClassName: string
  title: string
  count: string
  panelName: string
  bodyClassName: string
  children: ReactNode
}) {
  const { language } = useLanguage()
  const [isOpen, setIsOpen] = useState(true)
  const toggleHint =
    language === 'en'
      ? `Click to ${isOpen ? 'collapse' : 'expand'} ${panelName}`
      : `คลิกเพื่อ${isOpen ? 'พับเก็บ' : 'เปิดดู'} ${panelName}`

  return (
    <div className="pointer-events-auto rounded-2xl border border-zinc-800/70 bg-zinc-950/80 backdrop-blur-xl p-3.5 flex flex-col gap-2.5 shadow-2xl">
      {/* Header Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between text-left cursor-pointer group w-full select-none"
        title={toggleHint}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1 h-3.5 rounded-full ${accentClassName}`} />
          {icon}
          <h3 className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase drop-shadow-sm">
            {title}
          </h3>
          <span className="text-[10px] font-mono text-zinc-400">{count}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-300 transition-transform duration-200 ${
            isOpen ? '' : '-rotate-90'
          }`}
        />
      </button>

      {isOpen && <div className={`space-y-1.5 overflow-y-auto pr-1 ${bodyClassName}`}>{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Party members                                                       */
/* ------------------------------------------------------------------ */

function PartyMemberCard({
  member,
  nameColorClass,
  isHost,
  canKick,
  onKick,
}: {
  member: Member
  nameColorClass: string
  isHost: boolean
  canKick: boolean
  onKick: (targetUserId: string, targetName: string) => void
}) {
  const { t, language } = useLanguage()
  const char = member.characters
  const charName = char?.name || 'Spectator/Unbound'

  return (
    <div className="p-2.5 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/40 flex flex-col gap-1.5 text-xs transition-all duration-200 select-text">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-bold block truncate drop-shadow-sm ${nameColorClass}`}>
              {charName}
            </span>
            {isHost && (
              <span className="text-[9px] font-mono text-amber-400 border border-amber-500/70 px-1 rounded bg-transparent">
                {t('sao.host')}
              </span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-2 mt-0.5 text-[10px] text-zinc-400 drop-shadow-sm">
            <span className="text-zinc-300">{char?.class_archetype || t('character.noClass')}</span>
            {char && <MemberResourceReadouts char={char} />}
            {char?.status_condition && char.status_condition !== 'Normal' && (
              <span className="text-amber-400 font-mono">[{char.status_condition}]</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border bg-transparent ${
              member.is_ready
                ? 'border-emerald-500/80 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                : 'border-zinc-700 text-zinc-400'
            }`}
          >
            {member.is_ready
              ? language === 'en'
                ? 'READY'
                : 'พร้อม'
              : language === 'en'
                ? 'DRAFTING'
                : 'กำลังคิด'}
          </span>
          {canKick && (
            <button
              type="button"
              onClick={() => onKick(member.user_id, charName)}
              title={language === 'en' ? 'Kick Player (Host)' : 'นำผู้เล่นออกจากโต๊ะ (โฮสต์)'}
              className="text-zinc-500 hover:text-red-400 transition cursor-pointer p-0.5"
            >
              <UserX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time declared action shown when player is READY */}
      {member.is_ready && <DeclaredAction actionText={member.action_text} />}
    </div>
  )
}

// One "LABEL: cur/max" readout per template resource (HP, SP, then custom bars)
function MemberResourceReadouts({ char }: { char: Character }) {
  const template = readCharacterTemplate(char)
  const custom = readCustomValues(char)
  const skillCost = extractCharacterSkillCost(char)

  return (
    <>
      {template.resources.map((res) => {
        if (res.id === 'hp') {
          const curHp = char.current_hp ?? 0
          const maxHp = char.max_hp ?? res.defaultMax
          const label = /^hit\s*points/i.test(res.label) ? 'HP' : shortResourceLabel(res.label) || 'HP'
          return (
            <span
              key={res.id}
              className={`font-mono font-semibold ${getHpTailwindClass(curHp, maxHp || 1).text}`}
            >
              {label}: {curHp}/{maxHp}
            </span>
          )
        }

        if (res.id === 'skill_cost') {
          const label = /^skill\s*cost$/i.test(res.label) ? 'SP' : shortResourceLabel(res.label) || 'SP'
          return (
            <span key={res.id} className="text-cyan-400 font-mono font-semibold">
              {label}: {skillCost.currentSkillCost}/{skillCost.maxSkillCost}
            </span>
          )
        }

        const customVal = custom.resources[res.id] ?? {
          current: res.defaultMax,
          max: res.defaultMax,
        }
        const colorCls = ROSTER_RESOURCE_TEXT_COLOR[res.color] || 'text-zinc-300'
        return (
          <span key={res.id} className={`font-mono font-semibold ${colorCls}`}>
            {shortResourceLabel(res.label) || res.label}: {customVal.current}/{customVal.max}
          </span>
        )
      })}
    </>
  )
}

function DeclaredAction({ actionText }: { actionText: string | null | undefined }) {
  const { language } = useLanguage()

  return (
    <div className="border-l-2 border-emerald-500/80 pl-2 py-0.5 text-[11px] text-zinc-300 bg-transparent">
      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium mb-0.5">
        <Check className="w-3 h-3 shrink-0" />
        <span>{language === 'en' ? 'Declared Action:' : 'การกระทำที่ส่ง:'}</span>
      </div>
      {actionText ? (
        <p className="italic text-zinc-200 whitespace-pre-wrap wrap-break-words leading-relaxed drop-shadow-sm">
          &ldquo;{actionText}&rdquo;
        </p>
      ) : (
        <p className="italic text-zinc-500 text-[10px]">
          {language === 'en' ? '(Ready without action)' : '(พร้อมโดยไม่มีการกระทำ)'}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Lorebook                                                            */
/* ------------------------------------------------------------------ */

function LoreEntryCard({ entry }: { entry: LorebookEntry }) {
  return (
    <div className="p-2 rounded-lg border border-white/10 bg-transparent text-xs transition hover:border-amber-400/40 select-text">
      <div className="flex justify-between items-center gap-2">
        <span className="font-bold text-white truncate drop-shadow-sm">{entry.title}</span>
        {entry.category && (
          <span className="text-[9px] text-amber-400 font-mono border border-amber-500/40 px-1 rounded bg-transparent shrink-0">
            {entry.category}
          </span>
        )}
      </div>
      {entry.content && (
        <p className="text-zinc-300 text-[11px] mt-1 line-clamp-3 leading-relaxed drop-shadow-sm">
          {entry.content}
        </p>
      )}
    </div>
  )
}
