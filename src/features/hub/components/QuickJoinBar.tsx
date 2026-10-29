'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogIn } from 'lucide-react'
import { joinTableByCode } from '../actions'
import { playSystemSound } from '@/lib/sound'
import { AlertModal, useAlert } from '@/components/ui/AlertModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type JoinModalState = {
  open: boolean
  status: 'loading' | 'success' | 'error'
  message?: string
  code?: string
}

const CLOSED_JOIN_MODAL: JoinModalState = { open: false, status: 'loading' }

// Short label for the modal badge: the code from an invite link, the typed code, or "INVITE LINK"
function getJoinDisplayBadge(rawInput: string): string {
  return (
    rawInput.match(/\/table\/([^/?#\s]+)/i)?.[1]?.toUpperCase() ||
    (rawInput.length <= 12 ? rawInput.toUpperCase() : 'INVITE LINK')
  )
}

// Quick Join Bar: join an active table by 6-character code or invite link, with a status modal
export default function QuickJoinBar() {
  const router = useRouter()
  const { showAlert } = useAlert()
  const { t, language } = useLanguage()
  const [tableCode, setTableCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinModal, setJoinModal] = useState<JoinModalState>(CLOSED_JOIN_MODAL)

  // Ensure join modal is closed when returning to the hub via browser back/forward buttons
  useEffect(() => {
    const handleReset = () => {
      setJoinModal(CLOSED_JOIN_MODAL)
      setJoining(false)
    }
    window.addEventListener('popstate', handleReset)
    window.addEventListener('pageshow', handleReset)
    return () => {
      window.removeEventListener('popstate', handleReset)
      window.removeEventListener('pageshow', handleReset)
    }
  }, [])

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

    const displayBadge = getJoinDisplayBadge(rawInput)

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
        router.push(`/table/${res.tableId}`)
        setTimeout(() => {
          setJoinModal(CLOSED_JOIN_MODAL)
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
        message:
          err instanceof Error
            ? err.message
            : language === 'en'
              ? 'Connection failed'
              : 'เกิดข้อผิดพลาดในการเชื่อมต่อเข้าโต๊ะ',
      })
    } finally {
      setJoining(false)
    }
  }

  const modalTitle =
    joinModal.status === 'loading'
      ? language === 'en'
        ? 'Connecting to Table...'
        : 'กำลังเข้าสู่โต๊ะ...'
      : joinModal.status === 'success'
        ? language === 'en'
          ? 'Joined Successfully!'
          : 'เข้าร่วมสำเร็จ!'
        : language === 'en'
          ? 'Cannot Join Table'
          : 'ไม่สามารถเข้าห้องได้'

  return (
    <>
      <div className="surface-panel rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 tracking-tight">{t('hub.quickJoin')}</h2>
          <p className="text-xs text-zinc-400 mt-1">{t('hub.quickJoinSubtitle')}</p>
        </div>
        <form onSubmit={handleJoin} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder={t('hub.enterCodePlaceholder')}
            value={tableCode}
            onChange={(e) => {
              // Codes are upper-cased as typed; invite links are kept as pasted
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

      {/* Join Table Status Modal */}
      <AlertModal
        isOpen={joinModal.open}
        onClose={() => setJoinModal((prev) => ({ ...prev, open: false }))}
        status={joinModal.status}
        title={modalTitle}
        badge={joinModal.code ? `CODE: ${joinModal.code}` : undefined}
        message={joinModal.message}
        playSound={false}
      />
    </>
  )
}
