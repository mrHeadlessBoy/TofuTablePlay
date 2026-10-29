'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, Info, Link2, Loader2, LogOut, Pencil, Play, Trash2, User } from 'lucide-react'
import { launchTable } from '../actions'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { ActiveTable, PublicCampaign } from '../types'

// Small rotating amber triangle used as the "live table" marker
export function SpinningTriangleIcon() {
  return (
    <span
      className="inline-flex items-center justify-center text-amber-500/90 animate-[spin_6s_linear_infinite] select-none"
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-current">
        <path d="M6 1.5L11 10.5H1L6 1.5Z" />
      </svg>
    </span>
  )
}

// Submit button for the launch form; shows the AI DM writing state while the server action runs
function LaunchButton() {
  const { pending } = useFormStatus()
  const { t } = useLanguage()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 rounded-xl text-xs font-semibold text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-wait shadow-sm"
    >
      {pending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
          <span>{t('hub.dmWritingOpening')}</span>
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" />
          <span>{t('hub.launchAsHead')}</span>
        </>
      )}
    </button>
  )
}

export function ActiveTableCard({
  tbl,
  currentUserId,
  deletingId,
  onDelete,
  onLeave,
}: {
  tbl: ActiveTable
  currentUserId: string | null
  deletingId: string | null
  onDelete: (tbl: ActiveTable) => void
  onLeave: (tbl: ActiveTable) => void
}) {
  const { t } = useLanguage()
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/table/${tbl.table_code}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // Fallback if clipboard API fails
    }
  }

  return (
    <div className="surface-panel surface-panel-hover rounded-2xl p-5 flex flex-col justify-between shadow-lg">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SpinningTriangleIcon />
            <span className="text-[11px] uppercase font-mono tracking-wider text-amber-400/90 font-medium">
              {t('hub.tableCode')}: {tbl.table_code}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            title={t('hub.inviteLink')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/70 text-[10px] font-mono text-zinc-300 hover:text-amber-400 transition cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">{t('hub.copiedLink')}</span>
              </>
            ) : (
              <>
                <Link2 className="w-3 h-3" />
                <span>{t('hub.inviteLink')}</span>
              </>
            )}
          </button>
        </div>

        <h3 className="text-base font-semibold text-zinc-100 tracking-tight">{tbl.campaigns?.title}</h3>
        <p className="text-xs text-zinc-400 font-mono">
          {t('hub.turn')}: {tbl.current_turn} | {t('hub.phase')}: {tbl.turn_phase}
        </p>
      </div>

      <div className="space-y-2 pt-4">
        <Link
          href={`/table/${tbl.id}`}
          className="inline-flex items-center justify-center gap-2 w-full py-2 bg-zinc-800/70 hover:bg-zinc-700/80 border border-zinc-700/60 rounded-xl text-xs font-medium text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Play className="w-3.5 h-3.5 text-amber-400/90" />
          <span>{t('hub.reEnterTable')}</span>
        </Link>

        {currentUserId && tbl.head_table_id === currentUserId ? (
          <button
            type="button"
            onClick={() => onDelete(tbl)}
            disabled={deletingId !== null}
            className="inline-flex items-center justify-center gap-2 w-full py-2 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 rounded-xl text-xs font-medium text-red-300 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            {deletingId === `table:${tbl.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{t('hub.deleteTable')}</span>
          </button>
        ) : currentUserId ? (
          <button
            type="button"
            onClick={() => onLeave(tbl)}
            disabled={deletingId !== null}
            className="inline-flex items-center justify-center gap-2 w-full py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/70 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
          >
            {deletingId === `leave:${tbl.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>{t('hub.leaveTable')}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CampaignCard({
  camp,
  currentUserId,
  deletingId,
  onDelete,
}: {
  camp: PublicCampaign
  currentUserId: string | null
  deletingId: string | null
  onDelete: (camp: PublicCampaign) => void
}) {
  const { t, language } = useLanguage()
  const isOwner = !!currentUserId && camp.creator_id === currentUserId
  const creatorDisplay =
    camp.creator_name || (isOwner ? (language === 'en' ? 'You' : 'คุณ (You)') : t('common.creator'))

  return (
    <div className="surface-panel surface-panel-hover rounded-2xl p-6 flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/60 text-zinc-300 font-medium">
            {camp.category}
          </span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
            <User className="w-3 h-3 text-amber-500/90 shrink-0" />
            <span className="truncate max-w-36">
              {t('hub.createdBy')}: <strong className="text-zinc-200 font-medium">{creatorDisplay}</strong>
            </span>
          </span>
        </div>

        <h3 className="text-lg font-bold text-zinc-100 mt-3 tracking-tight">{camp.title}</h3>
        <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">{camp.core_description}</p>
      </div>

      <div className="space-y-2 pt-5">
        <form action={launchTable.bind(null, String(camp.id), language)}>
          <LaunchButton />
        </form>

        {/* Details Button - Only shown if user is NOT the owner */}
        {camp.creator_id !== currentUserId && (
          <Link
            href={`/campaigns/${camp.id}`}
            className="py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/70 rounded-xl text-xs font-medium text-zinc-300 hover:text-white transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t('common.details')}</span>
          </Link>
        )}

        {/* Edit Button - Only shown if user IS the owner */}
        {isOwner && (
          <Link
            href={`/campaigns/${camp.id}/edit`}
            className="py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-amber-600/40 rounded-xl text-xs font-medium text-amber-300 transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5 text-amber-400/90" />
            <span>{t('common.edit')}</span>
          </Link>
        )}

        {/* Delete Campaign Button - Only shown if user IS the owner */}
        {isOwner && (
          <button
            type="button"
            onClick={() => onDelete(camp)}
            disabled={deletingId !== null}
            className="w-full py-2 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 rounded-xl text-xs font-medium text-red-300 transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {deletingId === `campaign:${camp.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{t('hub.deleteCampaign')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
