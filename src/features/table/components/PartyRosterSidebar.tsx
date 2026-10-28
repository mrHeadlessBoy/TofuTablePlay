'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, Users, UserX } from 'lucide-react'
import { extractCharacterSkillCost, getHpTailwindClass } from '@/features/character/domain'
import {
  readCharacterTemplate,
  readCustomValues,
  type ResourceColor,
} from '@/features/character/template'
import { buildPlayerColorMap, getPlayerNameColor, type LorebookEntry, type Member } from '../types'
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
  const { t, language } = useLanguage()
  const [isPartyOpen, setIsPartyOpen] = useState(true)
  const [isLorebookOpen, setIsLorebookOpen] = useState(true)

  const playerColorMap = useMemo(
    () =>
      buildPlayerColorMap(
        members
          .map((m) => m.characters?.name)
          .filter((name): name is string => Boolean(name && name.trim()))
      ),
    [members]
  )

  const readyCount = members.filter((m) => m.is_ready).length

  return (
    <aside
      aria-label="Party Roster & Campaign Lorebook HUD"
      className="fixed top-3.5 right-4 z-30 w-72 sm:w-80 pointer-events-none flex flex-col gap-2.5 max-h-[calc(100vh-6rem)]"
    >
      {/* 1. FLOATING PARTY ROSTER HUD BLOCK */}
      <div className="pointer-events-auto rounded-xl border border-white/15 bg-transparent p-3 flex flex-col gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {/* Header Toggle */}
        <button
          type="button"
          onClick={() => setIsPartyOpen((prev) => !prev)}
          className="flex items-center justify-between text-left cursor-pointer group w-full select-none"
          title={isPartyOpen ? (language === 'en' ? 'Click to collapse Party Roster' : 'คลิกเพื่อพับเก็บ Party Roster') : (language === 'en' ? 'Click to expand Party Roster' : 'คลิกเพื่อเปิดดู Party Roster')}
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase drop-shadow-sm">
              {t('table.partyRoster')}
            </h3>
            <span className="text-[10px] font-mono text-zinc-400">
              ({readyCount}/{members.length})
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-300 transition-transform duration-200 ${
              isPartyOpen ? '' : '-rotate-90'
            }`}
          />
        </button>

        {/* Member List */}
        {isPartyOpen && (
          <div className="space-y-1.5 overflow-y-auto max-h-[38vh] pr-1">
            {memberLoadError && (
              <p className="text-xs text-red-400 font-mono" role="alert">
                {memberLoadError}
              </p>
            )}

            {members.map((m) => {
              const char = m.characters
              const charName = char?.name || 'Spectator/Unbound'
              const nameColorClass = char?.name
                ? getPlayerNameColor(char.name, playerColorMap)
                : 'text-white'
              const skillCost = char ? extractCharacterSkillCost(char) : null
              const charTemplate = char ? readCharacterTemplate(char) : null
              const charCustom = char ? readCustomValues(char) : null

              return (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg border border-white/10 bg-transparent flex flex-col gap-1.5 text-xs transition hover:border-amber-400/40 select-text"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold block truncate drop-shadow-sm ${nameColorClass}`}>
                          {charName}
                        </span>
                        {m.user_id === headTableId && (
                          <span className="text-[9px] font-mono text-amber-400 border border-amber-500/70 px-1 rounded bg-transparent">
                            {t('sao.host')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5 text-[10px] text-zinc-400 drop-shadow-sm">
                        <span className="text-zinc-300">{char?.class_archetype || t('character.noClass')}</span>
                        {char &&
                          charTemplate &&
                          charTemplate.resources.map((res) => {
                            if (res.id === 'hp') {
                              const curHp = char.current_hp ?? 0
                              const maxHp = char.max_hp ?? res.defaultMax
                              const shortLabel =
                                /^hit\s*points/i.test(res.label)
                                  ? 'HP'
                                  : res.label.split(/[（(]/)[0].trim() || 'HP'
                              return (
                                <span
                                  key={res.id}
                                  className={`font-mono font-semibold ${
                                    getHpTailwindClass(curHp, maxHp || 1).text
                                  }`}
                                >
                                  {shortLabel}: {curHp}/{maxHp}
                                </span>
                              )
                            }
                            if (res.id === 'skill_cost' && skillCost) {
                              const shortLabel =
                                /^skill\s*cost$/i.test(res.label)
                                  ? 'SP'
                                  : res.label.split(/[（(]/)[0].trim() || 'SP'
                              return (
                                <span key={res.id} className="text-cyan-400 font-mono font-semibold">
                                  {shortLabel}: {skillCost.currentSkillCost}/{skillCost.maxSkillCost}
                                </span>
                              )
                            }
                            const customVal = charCustom?.resources[res.id] ?? {
                              current: res.defaultMax,
                              max: res.defaultMax,
                            }
                            const shortLabel = res.label.split(/[（(]/)[0].trim() || res.label
                            const colorCls =
                              ROSTER_RESOURCE_TEXT_COLOR[res.color] || 'text-zinc-300'
                            return (
                              <span key={res.id} className={`font-mono font-semibold ${colorCls}`}>
                                {shortLabel}: {customVal.current}/{customVal.max}
                              </span>
                            )
                          })}
                        {char?.status_condition && char.status_condition !== 'Normal' && (
                          <span className="text-amber-400 font-mono">
                            [{char.status_condition}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border bg-transparent ${
                          m.is_ready
                            ? 'border-emerald-500/80 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                            : 'border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {m.is_ready ? (language === 'en' ? 'READY' : 'พร้อม') : (language === 'en' ? 'DRAFTING' : 'กำลังคิด')}
                      </span>
                      {isHeadTable && m.user_id !== userId && (
                        <button
                          type="button"
                          onClick={() => onKickMember(m.user_id, charName)}
                          title={language === 'en' ? 'Kick Player (Host)' : 'นำผู้เล่นออกจากโต๊ะ (โฮสต์)'}
                          className="text-zinc-500 hover:text-red-400 transition cursor-pointer p-0.5"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Real-time declared action shown when player is READY */}
                  {m.is_ready && (
                    <div className="border-l-2 border-emerald-500/80 pl-2 py-0.5 text-[11px] text-zinc-300 bg-transparent">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium mb-0.5">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>{language === 'en' ? 'Declared Action:' : 'การกระทำที่ส่ง:'}</span>
                      </div>
                      {m.action_text ? (
                        <p className="italic text-zinc-200 whitespace-pre-wrap wrap-break-words leading-relaxed drop-shadow-sm">
                          &ldquo;{m.action_text}&rdquo;
                        </p>
                      ) : (
                        <p className="italic text-zinc-500 text-[10px]">{language === 'en' ? '(Ready without action)' : '(พร้อมโดยไม่มีการกระทำ)'}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. FLOATING CAMPAIGN LOREBOOK HUD BLOCK */}
      <div className="pointer-events-auto rounded-xl border border-white/15 bg-transparent p-3 flex flex-col gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {/* Header Toggle */}
        <button
          type="button"
          onClick={() => setIsLorebookOpen((prev) => !prev)}
          className="flex items-center justify-between text-left cursor-pointer group w-full select-none"
          title={isLorebookOpen ? (language === 'en' ? 'Click to collapse Campaign Lorebook' : 'คลิกเพื่อพับเก็บ Campaign Lorebook') : (language === 'en' ? 'Click to expand Campaign Lorebook' : 'คลิกเพื่อเปิดดู Campaign Lorebook')}
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase drop-shadow-sm">
              {t('table.lorebook')}
            </h3>
            <span className="text-[10px] font-mono text-zinc-400">
              ({lorebook.length})
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-300 transition-transform duration-200 ${
              isLorebookOpen ? '' : '-rotate-90'
            }`}
          />
        </button>

        {/* Lorebook Entries */}
        {isLorebookOpen && (
          <div className="space-y-1.5 overflow-y-auto max-h-[30vh] pr-1">
            {lorebook.map((entry) => (
              <div
                key={entry.id}
                className="p-2 rounded-lg border border-white/10 bg-transparent text-xs transition hover:border-amber-400/40 select-text"
              >
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
            ))}
            {lorebook.length === 0 && (
              <p className="text-zinc-500 text-xs italic">{t('campaign.noLorebook')}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
