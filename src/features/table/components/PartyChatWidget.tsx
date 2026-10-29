'use client'

import { useState, useRef, useEffect, useCallback, memo, type FormEvent, type RefObject } from 'react'
import {
  MessageSquare,
  Send,
  Minimize2,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Trash2,
  ArrowDown,
  X,
} from 'lucide-react'
import type { ChatMode, PartyChatMessage } from '../types'

const MAX_MESSAGE_LENGTH = 400

// Lightweight Web Audio API ping so chat notifications require zero external audio asset requests
let sharedAudioCtx: AudioContext | null = null
export function playChatPingSound() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass()
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume()
    }
    const osc = sharedAudioCtx.createOscillator()
    const gain = sharedAudioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, sharedAudioCtx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, sharedAudioCtx.currentTime + 0.08) // A5

    gain.gain.setValueAtTime(0.06, sharedAudioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + 0.14)

    osc.connect(gain)
    gain.connect(sharedAudioCtx.destination)
    osc.start()
    osc.stop(sharedAudioCtx.currentTime + 0.15)
  } catch {
    // Ignore audio context errors if blocked by browser
  }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

type ChatMessageItemProps = {
  msg: PartyChatMessage
  isOwn: boolean
}

const ChatMessageItem = memo(function ChatMessageItem({ msg, isOwn }: ChatMessageItemProps) {
  const isIC = msg.mode === 'ic'

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-1.5 mb-1 px-0.5">
        {isIC ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400">
            <Sparkles className="w-2.5 h-2.5" />
            {msg.senderName}
            {msg.characterClass && (
              <span className="text-[9px] font-normal text-amber-500/80">
                ({msg.characterClass})
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-400">
            <span className="px-1 py-0.2 rounded bg-cyan-950/90 border border-cyan-800/70 text-[9px] font-mono uppercase">
              OOC
            </span>
            <span className="text-zinc-300">{msg.senderName}</span>
          </span>
        )}

        {msg.isHost && (
          <span className="text-[8px] font-mono uppercase px-1 rounded bg-amber-950 text-amber-400 border border-amber-800/80">
            HOST
          </span>
        )}

        <span className="text-[9px] text-zinc-600 font-mono">{formatTime(msg.timestamp)}</span>
      </div>

      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed wrap-break-words shadow-sm ${
          isIC
            ? isOwn
              ? 'bg-amber-950/50 border border-amber-600/40 text-amber-100 italic'
              : 'bg-zinc-900/90 border-l-2 border-y border-r border-l-amber-500 border-zinc-800 text-amber-50/95 italic'
            : isOwn
              ? 'bg-cyan-950/40 border border-cyan-700/40 text-zinc-100'
              : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200'
        }`}
      >
        {isIC ? `“${msg.text}”` : msg.text}
      </div>
    </div>
  )
})

type PartyChatWidgetProps = {
  messages: PartyChatMessage[]
  userId: string
  activeCharacterName?: string | null
  // Not shown in the widget at the moment; IC messages carry the class from TablePlayground
  activeCharacterClass?: string | null
  isHeadTable: boolean
  partySize: number
  onSendMessage: (payload: { mode: ChatMode; text: string }) => void
  onClearMessages: () => void
}

export default function PartyChatWidget({
  messages,
  userId,
  activeCharacterName,
  isHeadTable,
  partySize,
  onSendMessage,
  onClearMessages,
}: PartyChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<ChatMode>(activeCharacterName ? 'ic' : 'ooc')
  const [draft, setDraft] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [previewMsg, setPreviewMsg] = useState<PartyChatMessage | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastSeenMessageIdRef = useRef<string | null>(
    messages.length > 0 ? messages[messages.length - 1].id : null,
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    setIsAtBottom(true)
  }, [])

  // Handle incoming messages: sound, unread badge, preview bubble, and smart scroll
  useEffect(() => {
    if (messages.length === 0) {
      lastSeenMessageIdRef.current = null
      return
    }

    const latest = messages[messages.length - 1]
    if (latest.id === lastSeenMessageIdRef.current) return
    lastSeenMessageIdRef.current = latest.id

    const isFromOther = latest.userId !== userId

    if (!isOpen) {
      if (isFromOther) {
        requestAnimationFrame(() => {
          setUnreadCount((c) => c + 1)
          setPreviewMsg(latest)
        })
        if (soundEnabled) playChatPingSound()
      }
      return
    }

    // Widget is open
    if (isFromOther && soundEnabled) {
      playChatPingSound()
    }

    if (!isFromOther || isAtBottom) {
      requestAnimationFrame(() => scrollToBottom('smooth'))
    }
  }, [messages, isOpen, userId, soundEnabled, isAtBottom, scrollToBottom])

  const handleOpen = () => {
    setIsOpen(true)
    setUnreadCount(0)
    setPreviewMsg(null)
    requestAnimationFrame(() => {
      scrollToBottom('instant')
      inputRef.current?.focus()
    })
  }

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(distanceFromBottom < 48)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseChatInput(draft, mode)
    if (!parsed) return
    onSendMessage(parsed)
    setDraft('')
  }

  if (!isOpen) {
    return (
      <CollapsedChatLauncher
        previewMsg={previewMsg}
        unreadCount={unreadCount}
        onOpen={handleOpen}
        onDismissPreview={() => setPreviewMsg(null)}
      />
    )
  }

  return (
    <section
      aria-label="Party Chat"
      className="fixed bottom-4 right-4 z-40 flex w-80 sm:w-96 h-112 max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl backdrop-blur-xl overflow-hidden"
    >
      <ChatHeader
        partySize={partySize}
        soundEnabled={soundEnabled}
        canClear={messages.length > 0}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        onClear={onClearMessages}
        onMinimize={() => setIsOpen(false)}
      />

      <ChatModeSwitcher
        mode={mode}
        speakerLabel={getSpeakerLabel(mode, activeCharacterName, isHeadTable)}
        onModeChange={setMode}
      />

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-3 space-y-2.5"
      >
        {messages.length === 0 ? (
          <ChatEmptyState />
        ) : (
          messages.map((msg) => (
            <ChatMessageItem key={msg.id} msg={msg} isOwn={msg.userId === userId} />
          ))
        )}
      </div>

      {/* Jump to bottom pill when scrolled up */}
      {!isAtBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-700/80 text-amber-400 px-3 py-1 text-[10px] font-medium shadow-lg cursor-pointer"
        >
          <ArrowDown className="w-3 h-3" />
          <span>ข้อความล่าสุด</span>
        </button>
      )}

      <ChatComposer
        inputRef={inputRef}
        mode={mode}
        draft={draft}
        activeCharacterName={activeCharacterName}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

// Quick shortcut prefixes: "/e text", "((text))" or "/ooc text" force OOC, "/ic text" forces IC
function parseChatInput(draft: string, mode: ChatMode): { mode: ChatMode; text: string } | null {
  const raw = draft.trim()
  if (!raw) return null

  let finalMode: ChatMode = mode
  let finalText = raw

  if (raw.startsWith('/e')) {
    finalMode = 'ooc'
    finalText = raw.slice(2).trim()
  } else if (raw.startsWith('((') && raw.endsWith('))') && raw.length > 4) {
    finalMode = 'ooc'
    finalText = raw.slice(2, -2).trim()
  } else if (raw.toLowerCase().startsWith('/ooc ')) {
    finalMode = 'ooc'
    finalText = raw.slice(5).trim()
  } else if (raw.toLowerCase().startsWith('/ic ')) {
    finalMode = 'ic'
    finalText = raw.slice(4).trim()
  }

  if (!finalText) return null
  return { mode: finalMode, text: finalText.slice(0, MAX_MESSAGE_LENGTH) }
}

// Who the next message will be sent as, shown next to the IC/OOC switch
function getSpeakerLabel(
  mode: ChatMode,
  activeCharacterName: string | null | undefined,
  isHeadTable: boolean,
): string {
  if (mode === 'ic') {
    return activeCharacterName || (isHeadTable ? 'Host (Narrator)' : 'Adventurer')
  }
  if (activeCharacterName) return `${activeCharacterName} [OOC]`
  return isHeadTable ? 'Host [OOC]' : 'Player [OOC]'
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

// Collapsed state: floating trigger button plus a preview bubble for the latest message from others
function CollapsedChatLauncher({
  previewMsg,
  unreadCount,
  onOpen,
  onDismissPreview,
}: {
  previewMsg: PartyChatMessage | null
  unreadCount: number
  onOpen: () => void
  onDismissPreview: () => void
}) {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {/* Floating preview bubble when collapsed and a new message arrives */}
      {previewMsg && (
        <div className="max-w-xs rounded-xl bg-zinc-900/95 border border-zinc-700/80 px-3.5 py-2.5 shadow-2xl backdrop-blur-md text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span
              className={`font-semibold text-[11px] flex items-center gap-1 ${
                previewMsg.mode === 'ic' ? 'text-amber-400' : 'text-cyan-400'
              }`}
            >
              {previewMsg.mode === 'ic' ? (
                <Sparkles className="w-3 h-3" />
              ) : (
                <span className="px-1 rounded bg-cyan-950 text-[9px] font-mono">OOC</span>
              )}
              {previewMsg.senderName}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDismissPreview()
              }}
              aria-label="Dismiss preview"
              className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="text-left text-zinc-200 line-clamp-2 hover:text-white cursor-pointer"
          >
            {previewMsg.mode === 'ic' ? `“${previewMsg.text}”` : previewMsg.text}
          </button>
        </div>
      )}

      {/* Collapsed Floating Trigger Button */}
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex items-center gap-2.5 rounded-full bg-zinc-950/80 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 px-4 py-2.5 text-xs font-medium text-zinc-200 shadow-xl backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      >
        <div className="relative">
          <MessageSquare className="w-4 h-4 text-amber-400 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black shadow">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span>Party Chat</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Realtime Connected" />
      </button>
    </div>
  )
}

const HEADER_ICON_BUTTON_CLASS = 'p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition cursor-pointer'

function ChatHeader({
  partySize,
  soundEnabled,
  canClear,
  onToggleSound,
  onClear,
  onMinimize,
}: {
  partySize: number
  soundEnabled: boolean
  canClear: boolean
  onToggleSound: () => void
  onClear: () => void
  onMinimize: () => void
}) {
  const soundLabel = soundEnabled ? 'Mute chat sound' : 'Unmute chat sound'

  return (
    <div className="flex items-center justify-between border-b border-zinc-800/90 bg-zinc-900/80 px-3.5 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="truncate">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold text-white">Party Chat</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {partySize}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleSound}
          title={soundLabel}
          aria-label={soundLabel}
          className={`${HEADER_ICON_BUTTON_CLASS} hover:text-zinc-200`}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-zinc-600" />
          )}
        </button>

        {canClear && (
          <button
            type="button"
            onClick={onClear}
            title="Clear local chat history"
            aria-label="Clear local chat history"
            className={`${HEADER_ICON_BUTTON_CLASS} hover:text-red-400`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onMinimize}
          title="Minimize chat"
          aria-label="Minimize chat"
          className={`${HEADER_ICON_BUTTON_CLASS} hover:text-white`}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// Mode Switcher Bar: IC vs OOC
function ChatModeSwitcher({
  mode,
  speakerLabel,
  onModeChange,
}: {
  mode: ChatMode
  speakerLabel: string
  onModeChange: (mode: ChatMode) => void
}) {
  const tabClass = (isActive: boolean, activeClass: string) =>
    `flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition cursor-pointer ${
      isActive ? `${activeClass} text-white shadow-sm` : 'text-zinc-400 hover:text-zinc-200'
    }`

  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/70 bg-zinc-900/40 px-3 py-1.5 text-[11px]">
      <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
        <button
          type="button"
          onClick={() => onModeChange('ic')}
          className={tabClass(mode === 'ic', 'bg-amber-600')}
        >
          <Sparkles className="w-3 h-3" />
          <span>IC (สวมบทบาท)</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('ooc')}
          className={tabClass(mode === 'ooc', 'bg-cyan-600')}
        >
          <User className="w-3 h-3" />
          <span>OOC (นอกบท)</span>
        </button>
      </div>

      <span className="truncate text-[10px] text-zinc-400 font-mono" title={speakerLabel}>
        {speakerLabel}
      </span>
    </div>
  )
}

function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center px-4 text-zinc-500 space-y-2">
      <MessageSquare className="w-6 h-6 text-zinc-700" />
      <p className="text-xs text-zinc-400 font-medium">ยังไม่มีข้อความในห้องแชต</p>
      <p className="text-[11px] text-zinc-600 leading-relaxed">
        เลือกโหมด <span className="text-amber-400">IC</span> เพื่อพูดคุยสวมบทบาทตัวละคร หรือ{' '}
        <span className="text-cyan-400">OOC</span> (หรือพิมพ์ขึ้นต้นด้วย{' '}
        <code className="text-zinc-400">/e</code>) เพื่อวางแผนกับปาร์ตี้แบบสดๆ
      </p>
    </div>
  )
}

function ChatComposer({
  inputRef,
  mode,
  draft,
  activeCharacterName,
  onDraftChange,
  onSubmit,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  mode: ChatMode
  draft: string
  activeCharacterName?: string | null
  onDraftChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}) {
  const isIC = mode === 'ic'

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-zinc-800/90 bg-zinc-900/70 p-2.5 flex items-center gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={
          isIC
            ? `พูดในฐานะ ${activeCharacterName || 'ตัวละคร'}... (พิมพ์ // เพื่อ OOC)`
            : 'พิมพ์ข้อความคุยกับปาร์ตี้ (OOC)...'
        }
        className={`flex-1 rounded-xl bg-black/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 border focus:outline-none transition-all ${
          isIC ? 'border-amber-500/30 focus:border-amber-500' : 'border-cyan-500/30 focus:border-cyan-500'
        }`}
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        aria-label="Send message"
        className={`p-2 rounded-xl text-zinc-100 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 cursor-pointer ${
          isIC ? 'bg-amber-600 hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500'
        }`}
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  )
}
