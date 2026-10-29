'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type AlertStatus = 'loading' | 'success' | 'error' | 'warning' | 'info'

export type AlertModalAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'accent'
}

type ModalWidth = 'sm' | 'md' | 'lg'

export type AlertModalProps = {
  isOpen: boolean
  onClose?: () => void
  onConfirm?: () => void
  isConfirm?: boolean
  status?: AlertStatus
  title?: string
  message: ReactNode
  badge?: string
  buttonText?: string
  confirmText?: string
  cancelText?: string
  playSound?: boolean
  maxWidth?: ModalWidth
  action?: AlertModalAction
}

// Round icon above the title, one per status
const STATUS_ICON: Record<AlertStatus, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  loading: { Icon: Loader2, tone: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
  success: { Icon: CheckCircle2, tone: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  error: { Icon: AlertCircle, tone: 'bg-red-500/10 border-red-500/20 text-red-400' },
  warning: { Icon: AlertTriangle, tone: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  info: { Icon: Info, tone: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
}

const WIDTH_CLASS: Record<ModalWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

const NEUTRAL_BUTTON_CLASS = 'bg-zinc-800 hover:bg-zinc-700'

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  isConfirm = false,
  status = 'error',
  title,
  message,
  badge,
  buttonText,
  confirmText,
  cancelText,
  maxWidth,
  action,
}: AlertModalProps) {
  useEffect(() => {
    if (!isOpen || status === 'loading') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, status, onClose])

  const { language } = useLanguage()

  if (!isOpen) return null

  const isEn = language === 'en'
  const defaultTitles: Record<AlertStatus, string> = {
    loading: isEn ? 'Processing...' : 'กำลังดำเนินการ...',
    success: isEn ? 'Successful' : 'ดำเนินการสำเร็จ',
    error: isEn ? 'Error' : 'เกิดข้อผิดพลาด',
    warning: isConfirm
      ? isEn
        ? 'Confirm Action'
        : 'ยืนยันการทำรายการ'
      : isEn
        ? 'Warning'
        : 'แจ้งเตือน',
    info: isEn ? 'Notice' : 'ข้อความแจ้งเตือน',
  }
  const defaultButtonText =
    status === 'error' ? (isEn ? 'Close' : 'ปิดหน้าต่าง') : isEn ? 'OK' : 'ตกลง'
  const isLoading = status === 'loading'
  const { Icon, tone } = STATUS_ICON[status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={!isLoading ? onClose : undefined}
    >
      <div
        className={`w-full ${WIDTH_CLASS[maxWidth ?? 'md']} bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative flex flex-col items-center animate-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {!isLoading && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className={`w-14 h-14 rounded-full border flex items-center justify-center mb-4 ${tone}`}>
          <Icon className={`w-7 h-7 ${isLoading ? 'animate-spin' : ''}`} />
        </div>

        <h3 className="text-lg font-bold text-white text-center">{title ?? defaultTitles[status]}</h3>

        {badge && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono text-xs font-semibold text-amber-400">
            <span>{badge}</span>
          </div>
        )}

        <div
          className={`mt-3 text-xs leading-relaxed w-full wrap-break-words ${
            typeof message === 'string' ? 'text-zinc-400 text-center' : 'text-zinc-300 text-left'
          }`}
        >
          {message}
        </div>

        {!isLoading && (
          <div className="mt-5 w-full flex items-center gap-2">
            <AlertModalFooter
              status={status}
              isConfirm={isConfirm}
              action={action}
              onClose={onClose}
              onConfirm={onConfirm}
              buttonText={buttonText ?? defaultButtonText}
              confirmText={confirmText ?? (isEn ? 'Confirm' : 'ยืนยัน')}
              cancelText={cancelText ?? (isEn ? 'Cancel' : 'ยกเลิก')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Buttons under the message: confirm/cancel, an extra action plus close, or a single close button
function AlertModalFooter({
  status,
  isConfirm,
  action,
  onClose,
  onConfirm,
  buttonText,
  confirmText,
  cancelText,
}: {
  status: AlertStatus
  isConfirm: boolean
  action?: AlertModalAction
  onClose?: () => void
  onConfirm?: () => void
  buttonText: string
  confirmText: string
  cancelText: string
}) {
  if (isConfirm) {
    const isDangerous = status === 'error' || status === 'warning'
    return (
      <>
        <button
          type="button"
          onClick={onClose}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold ${NEUTRAL_BUTTON_CLASS} text-zinc-300 transition cursor-pointer`}
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition cursor-pointer ${
            isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'
          }`}
        >
          {confirmText}
        </button>
      </>
    )
  }

  if (action) {
    const actionClass =
      action.variant === 'secondary'
        ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
        : action.variant === 'accent'
          ? 'bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-md'
          : 'bg-amber-600 hover:bg-amber-500 text-white'
    return (
      <div className="w-full flex flex-col sm:flex-row items-center gap-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:flex-1 py-2.5 rounded-xl text-xs font-semibold ${NEUTRAL_BUTTON_CLASS} text-zinc-300 transition cursor-pointer order-2 sm:order-1`}
          >
            {buttonText}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            action.onClick()
            if (onClose) onClose()
          }}
          className={`w-full sm:flex-1 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer order-1 sm:order-2 ${actionClass}`}
        >
          {action.label}
        </button>
      </div>
    )
  }

  if (!onClose) return null

  return (
    <button
      type="button"
      onClick={onClose}
      className={`w-full py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
        status === 'success'
          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
          : `${NEUTRAL_BUTTON_CLASS} text-white`
      }`}
    >
      {buttonText}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Global provider (useAlert)                                          */
/* ------------------------------------------------------------------ */

export type AlertOptions = {
  title?: string
  message: ReactNode
  status?: AlertStatus
  badge?: string
  buttonText?: string
  playSound?: boolean
  maxWidth?: ModalWidth
  action?: AlertModalAction
  onClose?: () => void
}

export type ConfirmOptions = {
  title?: string
  message: ReactNode
  status?: AlertStatus
  badge?: string
  confirmText?: string
  cancelText?: string
  playSound?: boolean
}

type AlertContextType = {
  showAlert: (options: AlertOptions | string) => void
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>
  closeAlert: () => void
}

type ModalState = {
  isOpen: boolean
  isConfirm: boolean
  status: AlertStatus
  title?: string
  message: ReactNode
  badge?: string
  buttonText?: string
  confirmText?: string
  cancelText?: string
  playSound?: boolean
  maxWidth?: ModalWidth
  action?: AlertModalAction
  onCloseCallback?: () => void
  onConfirmCallback?: () => void
}

const CLOSED_MODAL_STATE: ModalState = {
  isOpen: false,
  isConfirm: false,
  status: 'error',
  message: '',
}

// A plain string is shown as a small error alert
function alertStateFrom(options: AlertOptions | string): ModalState {
  if (typeof options === 'string') {
    return {
      isOpen: true,
      isConfirm: false,
      status: 'error',
      message: options,
      playSound: true,
      maxWidth: 'sm',
    }
  }
  return {
    isOpen: true,
    isConfirm: false,
    status: options.status ?? 'error',
    title: options.title,
    message: options.message,
    badge: options.badge,
    buttonText: options.buttonText,
    playSound: options.playSound ?? true,
    maxWidth: options.maxWidth ?? (typeof options.message === 'string' ? 'sm' : 'md'),
    action: options.action,
    onCloseCallback: options.onClose,
  }
}

const AlertContext = createContext<AlertContextType | null>(null)

export function AlertProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>(CLOSED_MODAL_STATE)

  const closeAlert = useCallback(() => {
    setModalState((prev) => {
      if (prev.onCloseCallback) {
        prev.onCloseCallback()
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setModalState((prev) => {
      if (prev.onConfirmCallback) {
        prev.onConfirmCallback()
      }
      return { ...prev, isOpen: false }
    })
  }, [])

  const showAlert = useCallback((options: AlertOptions | string) => {
    setModalState(alertStateFrom(options))
  }, [])

  // Resolves true on confirm, false on cancel / close
  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options
      setModalState({
        isOpen: true,
        isConfirm: true,
        status: opts.status ?? 'warning',
        title: opts.title ?? 'ยืนยันการทำรายการ',
        message: opts.message,
        badge: opts.badge,
        confirmText: opts.confirmText ?? 'ยืนยัน',
        cancelText: opts.cancelText ?? 'ยกเลิก',
        playSound: opts.playSound ?? true,
        maxWidth: 'sm',
        onConfirmCallback: () => resolve(true),
        onCloseCallback: () => resolve(false),
      })
    })
  }, [])

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
      {children}
      <AlertModal
        isOpen={modalState.isOpen}
        onClose={closeAlert}
        onConfirm={handleConfirm}
        isConfirm={modalState.isConfirm}
        status={modalState.status}
        title={modalState.title}
        message={modalState.message}
        badge={modalState.badge}
        buttonText={modalState.buttonText}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        playSound={modalState.playSound}
        maxWidth={modalState.maxWidth}
        action={modalState.action}
      />
    </AlertContext.Provider>
  )
}

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}
