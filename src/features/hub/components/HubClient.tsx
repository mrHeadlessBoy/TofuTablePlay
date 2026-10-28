'use client'

import { useState, useMemo, useRef, useEffect, type FormEvent } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { launchTable, joinTableByCode, deleteTable, deleteCampaign, leaveTable } from '../actions'
import { Play, LogIn, Compass, Trash2, Loader2, LogOut, Dices, Info, Pencil, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Link2, Check, User, Sliders } from 'lucide-react'
import Link from 'next/link'

import { playSystemSound } from '@/lib/sound'
import { AlertModal, useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type PublicCampaign = {
  id: string | number
  category: string
  title: string
  core_description: string
  creator_id?: string | null
  creator_name?: string
  template_name?: string
  template_author?: string
}

type ActiveTable = {
  id: string | number
  table_code: string
  current_turn: number | string
  turn_phase: string
  head_table_id?: string | null
  campaigns?: { title?: string } | null
}

type HubClientProps = {
  publicCampaigns: PublicCampaign[]
  activeTables: ActiveTable[]
  currentUserId: string | null
}

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

function ActiveTableCard({
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
            <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse" />
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

function CampaignCard({
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
  const creatorDisplay = camp.creator_name || (isOwner ? (language === 'en' ? 'You' : 'คุณ (You)') : t('common.creator'))

  return (
    <div className="surface-panel surface-panel-hover rounded-2xl p-6 flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/60 text-zinc-300 font-medium">
            {camp.category}
          </span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
            <User className="w-3 h-3 text-amber-500/90 shrink-0" />
            <span className="truncate max-w-36">{t('hub.createdBy')}: <strong className="text-zinc-200 font-medium">{creatorDisplay}</strong></span>
          </span>
        </div>

        <h3 className="text-lg font-bold text-zinc-100 mt-3 tracking-tight">{camp.title}</h3>
        <p className="text-xs text-zinc-400 mt-2 min-h-20 line-clamp-3 leading-relaxed">{camp.core_description}</p>

        {camp.template_name && (
          <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-1 text-[11px]">
            <span className="text-zinc-500 flex items-center gap-1 shrink-0">
              <Sliders className="w-3 h-3 text-amber-500/90 shrink-0" /> {t('hub.sheetFormat')}:
            </span>
            <span className="text-amber-400/90 font-mono truncate text-right" title={`${camp.template_name} (${t('hub.byAuthor')} ${camp.template_author || 'D&D Playground'})`}>
              {camp.template_name} <span className="text-zinc-500 text-[10px]">({t('hub.byAuthor')} {camp.template_author || 'D&D Playground'})</span>
            </span>
          </div>
        )}
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
        {currentUserId && camp.creator_id === currentUserId && (
          <Link
            href={`/campaigns/${camp.id}/edit`}
            className="py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-amber-600/40 rounded-xl text-xs font-medium text-amber-300 transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5 text-amber-400/90" />
            <span>{t('common.edit')}</span>
          </Link>
        )}

        {/* Delete Campaign Button - Only shown if user IS the owner */}
        {currentUserId && camp.creator_id === currentUserId && (
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

const CAMPAIGNS_PER_PAGE = 6

export default function HubClient({ publicCampaigns, activeTables, currentUserId }: HubClientProps) {
  const router = useRouter()
  const { showAlert, showConfirm } = useAlert()
  const { t, language } = useLanguage()
  const [tableCode, setTableCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinModal, setJoinModal] = useState<{
    open: boolean
    status: 'loading' | 'success' | 'error'
    message?: string
    code?: string
  }>({ open: false, status: 'loading' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isExtended, setIsExtended] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const touchStartX = useRef<number | null>(null)

  // Ensure join modal is closed when returning to the hub via browser back/forward buttons
  useEffect(() => {
    const handleReset = () => {
      setJoinModal({ open: false, status: 'loading' })
      setJoining(false)
    }
    window.addEventListener('popstate', handleReset)
    window.addEventListener('pageshow', handleReset)
    return () => {
      window.removeEventListener('popstate', handleReset)
      window.removeEventListener('pageshow', handleReset)
    }
  }, [])

  const totalPages = Math.max(1, Math.ceil(publicCampaigns.length / CAMPAIGNS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, Math.max(0, totalPages - 1))

  const campaignPages = useMemo(() => {
    const pages: PublicCampaign[][] = []
    for (let i = 0; i < publicCampaigns.length; i += CAMPAIGNS_PER_PAGE) {
      pages.push(publicCampaigns.slice(i, i + CAMPAIGNS_PER_PAGE))
    }
    return pages
  }, [publicCampaigns])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diffX = touchStartX.current - e.changedTouches[0].clientX
    if (diffX > 50 && safeCurrentPage < totalPages - 1) {
      setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
    } else if (diffX < -50 && safeCurrentPage > 0) {
      setCurrentPage((p) => Math.max(0, p - 1))
    }
    touchStartX.current = null
  }

  const handleDeleteTable = async (tbl: ActiveTable) => {
    const name = tbl.campaigns?.title ?? tbl.table_code
    const confirmed = await showConfirm({
      title: language === 'en' ? 'Confirm Delete Table' : 'ยืนยันการลบโต๊ะเล่น',
      message:
        language === 'en'
          ? `Are you sure you want to permanently delete table "${name}" (${tbl.table_code})? All turns and party members will be removed.`
          : `คุณแน่ใจหรือไม่ว่าต้องการลบโต๊ะ "${name}" (${tbl.table_code})? เทิร์นการเล่นและสมาชิกทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้`,
      confirmText: language === 'en' ? 'Delete Table' : 'ลบโต๊ะ',
      cancelText: language === 'en' ? 'Cancel' : 'ยกเลิก',
    })
    if (!confirmed) return
    setDeletingId(`table:${tbl.id}`)
    try {
      await deleteTable(String(tbl.id))
      router.refresh()
    } catch (err: unknown) {
      showAlert({
        title: language === 'en' ? 'Failed to delete table' : 'ไม่สามารถลบโต๊ะได้',
        status: 'error',
        message: err instanceof Error ? err.message : 'Error deleting table',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleLeaveTable = async (tbl: ActiveTable) => {
    const name = tbl.campaigns?.title ?? tbl.table_code
    const confirmed = await showConfirm({
      title: language === 'en' ? 'Confirm Leave Table' : 'ยืนยันการออกจากโต๊ะ',
      message:
        language === 'en'
          ? `Are you sure you want to leave table "${name}" (${tbl.table_code})?`
          : `คุณต้องการออกจากโต๊ะ "${name}" (${tbl.table_code}) ใช่หรือไม่?`,
      confirmText: language === 'en' ? 'Leave Table' : 'ออกจากโต๊ะ',
      cancelText: language === 'en' ? 'Cancel' : 'ยกเลิก',
    })
    if (!confirmed) return
    setDeletingId(`leave:${tbl.id}`)
    try {
      await leaveTable(String(tbl.id))
      router.refresh()
    } catch (err: unknown) {
      showAlert({
        title: language === 'en' ? 'Failed to leave table' : 'ไม่สามารถออกจากโต๊ะได้',
        status: 'error',
        message: err instanceof Error ? err.message : 'Error leaving table',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCampaign = async (camp: PublicCampaign) => {
    const title = camp.title || 'Untitled Campaign'
    const confirmed = await showConfirm({
      title: language === 'en' ? 'Confirm Delete Campaign' : 'ยืนยันการลบแคมเปญ',
      message:
        language === 'en'
          ? `Are you sure you want to delete campaign "${title}"? All lorebook entries and tables created from this world will be permanently erased.`
          : `คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญ "${title}"? ลอว์บุ๊กและโต๊ะทั้งหมดที่สร้างจากแคมเปญนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้`,
      confirmText: language === 'en' ? 'Delete Campaign' : 'ลบแคมเปญ',
      cancelText: language === 'en' ? 'Cancel' : 'ยกเลิก',
    })
    if (!confirmed) return
    setDeletingId(`campaign:${camp.id}`)
    try {
      await deleteCampaign(String(camp.id))
      router.refresh()
    } catch (err: unknown) {
      showAlert({
        title: language === 'en' ? 'Failed to delete campaign' : 'ไม่สามารถลบแคมเปญได้',
        status: 'error',
        message: err instanceof Error ? err.message : 'Error deleting campaign',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const rawInput = tableCode.trim()
    if (!rawInput) {
      showAlert({
        title: language === 'en' ? 'Table Code Required' : 'กรุณากรอกรหัสโต๊ะ',
        status: 'warning',
        badge: 'Table Code Required',
        message:
          language === 'en'
            ? 'Please enter a 6-character table code or paste an invite link.'
            : 'กรุณากรอก Table Code 6 หลัก หรือวาง Invite Link ก่อนกดเข้าร่วมโต๊ะ',
      })
      return
    }

    const displayBadge =
      rawInput.match(/\/table\/([^/?#\s]+)/i)?.[1]?.toUpperCase() ||
      (rawInput.length <= 12 ? rawInput.toUpperCase() : 'INVITE LINK')

    setJoining(true)
    setJoinModal({
      open: true,
      status: 'loading',
      code: displayBadge,
      message:
        language === 'en'
          ? 'Verifying table code and preparing your seat...'
          : 'กำลังตรวจสอบรหัสโต๊ะและจัดเตรียมที่นั่งสำหรับคุณ...',
    })

    try {
      const res = await joinTableByCode(rawInput)
      if (res.success && res.tableId) {
        setJoinModal({
          open: true,
          status: 'success',
          code: res.tableCode || displayBadge,
          message:
            language === 'en'
              ? 'Joined table successfully! Transporting you into the chamber...'
              : 'เข้าร่วมโต๊ะสำเร็จ! กำลังพาท่านเดินทางเข้าสู่ห้องเล่น...',
        })
        const targetTableId = res.tableId
        router.push(`/table/${targetTableId}`)
        setTimeout(() => {
          setJoinModal({ open: false, status: 'loading' })
          setJoining(false)
          setTableCode('')
        }, 1200)
      } else {
        playSystemSound('error')
        setJoinModal({
          open: true,
          status: 'error',
          code: displayBadge,
          message:
            res.error ||
            (language === 'en'
              ? 'Table not found. Please verify the Table Code or Invite Link.'
              : 'ไม่พบโต๊ะดังกล่าว กรุณาตรวจสอบ Table Code หรือ Invite Link อีกครั้ง'),
        })
      }
    } catch (err: unknown) {
      playSystemSound('error')
      setJoinModal({
        open: true,
        status: 'error',
        code: displayBadge,
        message: err instanceof Error ? err.message : (language === 'en' ? 'Connection failed' : 'เกิดข้อผิดพลาดในการเชื่อมต่อเข้าโต๊ะ'),
      })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Quick Join Bar */}
      <div className="surface-panel rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('hub.quickJoin')}</h2>
          <p className="text-xs text-zinc-400 mt-1">
            {t('hub.subtitle')}
          </p>
        </div>
        <form onSubmit={handleJoin} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder={t('hub.enterCodePlaceholder')}
            value={tableCode}
            onChange={(e) => {
              const val = e.target.value
              setTableCode(val.includes('/') || val.includes(':') ? val : val.toUpperCase())
            }}
            className="bg-black/40 border border-zinc-800/80 px-3.5 py-2.5 rounded-xl text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:bg-black/60 outline-none w-full sm:w-64 transition-all"
          />
          <button
            type="submit"
            disabled={joining}
            className="bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-100 flex items-center gap-2 cursor-pointer shrink-0 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 shadow-sm"
          >
            {joining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                <span>{t('hub.joining')}</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{t('hub.joinTableBtn')}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Active Tables */}
      {activeTables.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block animate-pulse" />
            <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">{t('hub.activeTables')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {activeTables.map((tbl) => (
              <ActiveTableCard
                key={tbl.id}
                tbl={tbl}
                currentUserId={currentUserId}
                deletingId={deletingId}
                onDelete={handleDeleteTable}
                onLeave={handleLeaveTable}
              />
            ))}
          </div>
        </div>
      )}

      {/* Public Campaigns */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/40 pb-3">
          <button
            type="button"
            onClick={() => setIsExtended((prev) => !prev)}
            aria-expanded={isExtended}
            aria-controls="explore-campaigns-section"
            className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-zinc-100 hover:text-amber-400 transition-colors cursor-pointer select-none group text-left"
          >
            <Compass className="w-5 h-5 text-amber-500/90 group-hover:rotate-12 transition-transform" />
            <span>{t('hub.publicCampaigns')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/50 text-zinc-400 group-hover:text-zinc-200 font-normal">
              {publicCampaigns.length}
            </span>
            <span className="text-xs text-zinc-400 group-hover:text-amber-400 flex items-center gap-1 ml-1 font-normal">
              {isExtended ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'en' ? 'Collapse' : 'ย่อ'}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'en' ? 'Expand' : 'ขยาย'}</span>
                </>
              )}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {isExtended && totalPages > 1 && (
              <div className="flex items-center gap-1.5 text-xs bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safeCurrentPage === 0}
                  aria-label="Previous campaigns"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-zinc-300 font-mono text-[11px] select-none">
                  {t('hub.page')} {safeCurrentPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safeCurrentPage >= totalPages - 1}
                  aria-label="Next campaigns"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsExtended((prev) => !prev)}
              aria-expanded={isExtended}
              aria-controls="explore-campaigns-section"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/70 rounded-xl transition-all cursor-pointer"
            >
              {isExtended ? (
                <>
                  <span>{language === 'en' ? 'Collapse' : 'ย่อ'}</span>
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                </>
              ) : (
                <>
                  <span>{language === 'en' ? 'Expand' : 'ขยาย'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </>
              )}
            </button>
          </div>
        </div>

        {isExtended ? (
          <div id="explore-campaigns-section" className="space-y-4">
            {publicCampaigns.length === 0 ? (
              <div className="surface-panel rounded-2xl p-8 text-center text-zinc-500 text-sm">
                {language === 'en' ? 'No public campaigns available yet.' : 'ยังไม่มีแคมเปญสาธารณะในขณะนี้'}
              </div>
            ) : (
              <>
                <div
                  className="relative overflow-hidden"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-300 ease-out items-start"
                    style={{ transform: `translateX(-${safeCurrentPage * 100}%)` }}
                  >
                    {campaignPages.map((pageCamps, pageIndex) => (
                      <div
                        key={pageIndex}
                        className="w-full shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      >
                        {pageCamps.map((camp) => (
                          <CampaignCard
                            key={camp.id}
                            camp={camp}
                            currentUserId={currentUserId}
                            deletingId={deletingId}
                            onDelete={handleDeleteCampaign}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 px-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={safeCurrentPage === 0}
                      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> {language === 'en' ? 'Previous' : 'ย้อนกลับ'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentPage(idx)}
                          aria-label={`Go to slide ${idx + 1}`}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            idx === safeCurrentPage
                              ? 'w-6 bg-amber-500/90'
                              : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safeCurrentPage >= totalPages - 1}
                      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {language === 'en' ? 'Next' : 'ถัดไป'} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div
            onClick={() => setIsExtended(true)}
            className="surface-panel rounded-2xl p-4 text-center text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>
              {language === 'en'
                ? `Explore Campaigns is collapsed (${publicCampaigns.length} campaigns available). Click to expand.`
                : `มุมมองแคมเปญถูกย่อไว้ (มีแคมเปญทั้งหมด ${publicCampaigns.length} รายการ) คลิกเพื่อขยาย`}
            </span>
          </div>
        )}
      </div>

      {/* Battle Board entry: floats in the bottom-right corner of the hub */}
      <Link
        href="/board"
        className="group fixed bottom-6 right-6 z-20 flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3 shadow-xl backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700/80 hover:bg-zinc-900/80"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-600/90 text-zinc-100 transition-colors group-hover:bg-amber-600">
          <Dices className="w-5 h-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-zinc-100">Battle Board</span>
          <span className="block text-[11px] text-zinc-400 font-mono">3D grid tabletop · solo prototype</span>
        </span>
      </Link>

      {/* Join Table Status Modal */}
      <AlertModal
        isOpen={joinModal.open}
        onClose={() => setJoinModal((prev) => ({ ...prev, open: false }))}
        status={joinModal.status}
        title={
          joinModal.status === 'loading'
            ? (language === 'en' ? 'Connecting to Table...' : 'กำลังเข้าสู่โต๊ะ...')
            : joinModal.status === 'success'
            ? (language === 'en' ? 'Joined Successfully!' : 'เข้าร่วมสำเร็จ!')
            : (language === 'en' ? 'Cannot Join Table' : 'ไม่สามารถเข้าห้องได้')
        }
        badge={joinModal.code ? `CODE: ${joinModal.code}` : undefined}
        message={joinModal.message}
        playSound={false}
      />
    </div>
  )
}
