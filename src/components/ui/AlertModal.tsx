'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Loader2, AlertTriangle, Info, X } from 'lucide-react'
import { playSystemSound } from '@/lib/sound'

export type AlertStatus = 'loading' | 'success' | 'error' | 'warning' | 'info'

export type AlertModalProps = {
  isOpen: boolean
  onClose?: () => void
  onConfirm?: () => void
  isConfirm?: boolean
  status?: AlertStatus
  title?: string
  message: React.ReactNode
  badge?: string
  buttonText?: string
  confirmText?: string
  cancelText?: string
  playSound?: boolean
}

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
  playSound = true,
}: AlertModalProps) {
  useEffect(() => {
    if (isOpen && playSound) {
      if (status === 'error' || status === 'warning') {
        playSystemSound('error')
      }
    }
  }, [isOpen, status, playSound])

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

  if (!isOpen) return null

  const defaultTitles: Record<AlertStatus, string> = {
    loading: 'กำลังดำเนินการ...',
    success: 'ดำเนินการสำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    warning: isConfirm ? 'ยืนยันการทำรายการ' : 'แจ้งเตือน',
    info: 'ข้อความแจ้งเตือน',
  }

  const displayTitle = title ?? defaultTitles[status]
  const displayButtonText = buttonText ?? (status === 'error' ? 'ปิดหน้าต่าง' : 'ตกลง')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={status !== 'loading' ? onClose : undefined}
    >
      <div
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative text-center flex flex-col items-center animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {status !== 'loading' && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {status === 'loading' && (
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        )}

        {status === 'success' && (
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        )}

        {status === 'error' && (
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
        )}

        {status === 'warning' && (
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
        )}

        {status === 'info' && (
          <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
            <Info className="w-7 h-7" />
          </div>
        )}

        <h3 className="text-lg font-bold text-white">{displayTitle}</h3>

        {badge && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 font-mono text-xs font-semibold text-amber-400">
            <span>{badge}</span>
          </div>
        )}

        <div className="mt-3 text-xs text-zinc-400 leading-relaxed max-w-xs break-words">
          {message}
        </div>

        {status !== 'loading' && (
          <div className="mt-5 w-full flex items-center gap-2">
            {isConfirm ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                >
                  {cancelText ?? 'ยกเลิก'}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition cursor-pointer ${
                    status === 'error' || status === 'warning'
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {confirmText ?? 'ยืนยัน'}
                </button>
              </>
            ) : (
              onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    status === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  {displayButtonText}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export type AlertOptions = {
  title?: string
  message: React.ReactNode
  status?: AlertStatus
  badge?: string
  buttonText?: string
  playSound?: boolean
  onClose?: () => void
}

export type ConfirmOptions = {
  title?: string
  message: React.ReactNode
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

const AlertContext = createContext<AlertContextType | null>(null)

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    isConfirm: boolean
    status: AlertStatus
    title?: string
    message: React.ReactNode
    badge?: string
    buttonText?: string
    confirmText?: string
    cancelText?: string
    playSound?: boolean
    onCloseCallback?: () => void
    onConfirmCallback?: () => void
  }>({
    isOpen: false,
    isConfirm: false,
    status: 'error',
    message: '',
  })

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
    if (typeof options === 'string') {
      setModalState({
        isOpen: true,
        isConfirm: false,
        status: 'error',
        message: options,
        title: undefined,
        badge: undefined,
        buttonText: undefined,
        confirmText: undefined,
        cancelText: undefined,
        playSound: true,
        onCloseCallback: undefined,
        onConfirmCallback: undefined,
      })
    } else {
      setModalState({
        isOpen: true,
        isConfirm: false,
        status: options.status ?? 'error',
        title: options.title,
        message: options.message,
        badge: options.badge,
        buttonText: options.buttonText,
        confirmText: undefined,
        cancelText: undefined,
        playSound: options.playSound ?? true,
        onCloseCallback: options.onClose,
        onConfirmCallback: undefined,
      })
    }
  }, [])

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
        buttonText: undefined,
        confirmText: opts.confirmText ?? 'ยืนยัน',
        cancelText: opts.cancelText ?? 'ยกเลิก',
        playSound: opts.playSound ?? true,
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
