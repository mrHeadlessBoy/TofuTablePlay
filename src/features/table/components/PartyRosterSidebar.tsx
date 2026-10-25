'use client'

import { useMemo } from 'react'
import { BookOpen, Check, Users, UserX } from 'lucide-react'
import { extractCharacterSkillCost } from '@/features/character/domain'
import { buildPlayerColorMap, getPlayerNameColor, type LorebookEntry, type Member } from '../types'

type PartyRosterSidebarProps = {
  members: Member[]
  memberLoadError: string | null
  headTableId: string | undefined
  userId: string
  isHeadTable: boolean
  lorebook: LorebookEntry[]
  onKickMember: (targetUserId: string, targetName: string) => void
}

export default function PartyRosterSidebar({
  members,
  memberLoadError,
  headTableId,
  userId,
  isHeadTable,
  lorebook,
  onKickMember,
}: PartyRosterSidebarProps) {
  const playerColorMap = useMemo(
    () =>
      buildPlayerColorMap(
        members
          .map((m) => m.characters?.name)
          .filter((name): name is string => Boolean(name && name.trim()))
      ),
    [members]
  )

  return (
    <aside className="w-80 border-l border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        {/* Party Roster with Host Kick */}
        <div>
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Users className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-white">Party Roster</h3>
          </div>
          <div className="mt-3 space-y-2">
            {memberLoadError && (
              <p className="text-xs text-red-400" role="alert">
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
              return (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col gap-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold block ${nameColorClass}`}>{charName}</span>
                        {m.user_id === headTableId && (
                          <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-800 px-1 rounded">
                            HOST
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5 text-[10px] text-zinc-500">
                        <span>{char?.class_archetype || 'No class'}</span>
                        {char?.current_hp !== undefined && (
                          <span className="text-red-400 font-mono">
                            HP: {char.current_hp}/{char.max_hp}
                          </span>
                        )}
                        {skillCost && (
                          <span className="text-cyan-400 font-mono">
                            Skill Cost: {skillCost.currentSkillCost}/{skillCost.maxSkillCost}
                          </span>
                        )}
                        {char?.status_condition && char.status_condition !== 'Normal' && (
                          <span className="text-amber-400 font-mono">
                            [{char.status_condition}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          m.is_ready
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {m.is_ready ? 'READY' : 'DRAFTING'}
                      </span>
                      {isHeadTable && m.user_id !== userId && (
                        <button
                          onClick={() => onKickMember(m.user_id, charName)}
                          title="Kick Player (Host)"
                          className="text-zinc-600 hover:text-red-400 transition cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Real-time declared action shown when player is READY */}
                  {m.is_ready && (
                    <div className="p-2 rounded bg-zinc-900/90 border border-emerald-900/40 text-[11px] text-zinc-300">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium mb-1">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>Declared Action:</span>
                      </div>
                      {m.action_text ? (
                        <p className="italic text-zinc-300 whitespace-pre-wrap wrap-break-words leading-relaxed">
                          &ldquo;{m.action_text}&rdquo;
                        </p>
                      ) : (
                        <p className="italic text-zinc-500 text-[10px]">(Ready without action)</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick-Lookup Lorebook */}
        <div>
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-white">Campaign Lorebook</h3>
          </div>
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
            {lorebook.map((entry) => (
              <div
                key={entry.id}
                className="p-2 rounded bg-zinc-950 border border-zinc-800 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">{entry.title}</span>
                  <span className="text-[9px] text-amber-400 font-mono">{entry.category}</span>
                </div>
                <p className="text-zinc-400 text-[11px] mt-1 line-clamp-2">{entry.content}</p>
              </div>
            ))}
            {lorebook.length === 0 && (
              <p className="text-zinc-500 text-xs italic">No entries in the lorebook.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
