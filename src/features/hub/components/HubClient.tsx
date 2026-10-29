'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dices } from 'lucide-react'
import { deleteCampaign, deleteTable, leaveTable } from '../actions'
import { useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { ActiveTable, PublicCampaign } from '../types'
import { ActiveTableCard, CampaignCard, SpinningTriangleIcon } from './HubCards'
import QuickJoinBar from './QuickJoinBar'
import CampaignCarousel from './CampaignCarousel'

type HubClientProps = {
  publicCampaigns: PublicCampaign[]
  activeTables: ActiveTable[]
  currentUserId: string | null
}

type DestructiveActionOptions = {
  busyId: string
  confirmTitle: string
  confirmMessage: string
  confirmText: string
  errorTitle: string
  fallbackError: string
  run: () => Promise<unknown>
}

export default function HubClient({ publicCampaigns, activeTables, currentUserId }: HubClientProps) {
  const router = useRouter()
  const { showAlert, showConfirm } = useAlert()
  const { t, language } = useLanguage()
  // Which card action is running, e.g. "table:<id>", "leave:<id>" or "campaign:<id>"
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const isEn = language === 'en'

  // Confirm, run the server action, refresh the hub, and report failures in an alert
  const runDestructiveAction = async ({
    busyId,
    confirmTitle,
    confirmMessage,
    confirmText,
    errorTitle,
    fallbackError,
    run,
  }: DestructiveActionOptions) => {
    const confirmed = await showConfirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmText,
      cancelText: isEn ? 'Cancel' : 'ยกเลิก',
    })
    if (!confirmed) return
    setDeletingId(busyId)
    try {
      await run()
      router.refresh()
    } catch (err: unknown) {
      showAlert({
        title: errorTitle,
        status: 'error',
        message: err instanceof Error ? err.message : fallbackError,
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteTable = (tbl: ActiveTable) => {
    const name = tbl.campaigns?.title ?? tbl.table_code
    return runDestructiveAction({
      busyId: `table:${tbl.id}`,
      confirmTitle: isEn ? 'Confirm Delete Table' : 'ยืนยันการลบโต๊ะเล่น',
      confirmMessage: isEn
        ? `Are you sure you want to permanently delete table "${name}" (${tbl.table_code})? All turns and party members will be removed.`
        : `คุณแน่ใจหรือไม่ว่าต้องการลบโต๊ะ "${name}" (${tbl.table_code})? เทิร์นการเล่นและสมาชิกทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้`,
      confirmText: isEn ? 'Delete Table' : 'ลบโต๊ะ',
      errorTitle: isEn ? 'Failed to delete table' : 'ไม่สามารถลบโต๊ะได้',
      fallbackError: 'Error deleting table',
      run: () => deleteTable(String(tbl.id)),
    })
  }

  const handleLeaveTable = (tbl: ActiveTable) => {
    const name = tbl.campaigns?.title ?? tbl.table_code
    return runDestructiveAction({
      busyId: `leave:${tbl.id}`,
      confirmTitle: isEn ? 'Confirm Leave Table' : 'ยืนยันการออกจากโต๊ะ',
      confirmMessage: isEn
        ? `Are you sure you want to leave table "${name}" (${tbl.table_code})?`
        : `คุณต้องการออกจากโต๊ะ "${name}" (${tbl.table_code}) ใช่หรือไม่?`,
      confirmText: isEn ? 'Leave Table' : 'ออกจากโต๊ะ',
      errorTitle: isEn ? 'Failed to leave table' : 'ไม่สามารถออกจากโต๊ะได้',
      fallbackError: 'Error leaving table',
      run: () => leaveTable(String(tbl.id)),
    })
  }

  const handleDeleteCampaign = (camp: PublicCampaign) => {
    const title = camp.title || 'Untitled Campaign'
    return runDestructiveAction({
      busyId: `campaign:${camp.id}`,
      confirmTitle: isEn ? 'Confirm Delete Campaign' : 'ยืนยันการลบแคมเปญ',
      confirmMessage: isEn
        ? `Are you sure you want to delete campaign "${title}"? All lorebook entries and tables created from this world will be permanently erased.`
        : `คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญ "${title}"? ลอว์บุ๊กและโต๊ะทั้งหมดที่สร้างจากแคมเปญนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้`,
      confirmText: isEn ? 'Delete Campaign' : 'ลบแคมเปญ',
      errorTitle: isEn ? 'Failed to delete campaign' : 'ไม่สามารถลบแคมเปญได้',
      fallbackError: 'Error deleting campaign',
      run: () => deleteCampaign(String(camp.id)),
    })
  }

  return (
    <div className="space-y-10">
      <QuickJoinBar />

      {/* Active Tables */}
      {activeTables.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SpinningTriangleIcon />
            <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
              {t('hub.activeTables')}
            </h2>
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
      <CampaignCarousel
        campaigns={publicCampaigns}
        renderCard={(camp) => (
          <CampaignCard
            key={camp.id}
            camp={camp}
            currentUserId={currentUserId}
            deletingId={deletingId}
            onDelete={handleDeleteCampaign}
          />
        )}
      />

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
    </div>
  )
}
