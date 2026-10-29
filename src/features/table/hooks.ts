'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { getServerTime } from './actions'
import { COUNTDOWN_MS } from './countdown'
import { playSystemSound } from '@/lib/sound'
import type { Member, TableData, Turn } from './types'

export const COUNTDOWN_SECONDS = Math.ceil(COUNTDOWN_MS / 1000)

// Plays the "enter table" chime on mount and whenever a new player joins,
// and the "AI reply" sound whenever a new turn arrives.
export function useTableNotificationSounds(members: Member[], turns: Turn[]) {
  // Track known turns and members so sound notifications fire only on new arrivals
  const knownTurnIdsRef = useRef<Set<string>>(new Set(turns.map((t) => t.id)))
  const knownMemberIdsRef = useRef<Set<string>>(new Set(members.map((m) => m.user_id)))

  // Play sound when player enters the table playground page
  useEffect(() => {
    playSystemSound('player_enter_table')
  }, [])

  // Play sound when another player enters the table
  useEffect(() => {
    let newPlayerEntered = false
    for (const m of members) {
      if (!knownMemberIdsRef.current.has(m.user_id)) {
        knownMemberIdsRef.current.add(m.user_id)
        newPlayerEntered = true
      }
    }
    if (newPlayerEntered) {
      playSystemSound('player_enter_table')
    }
  }, [members])

  // Play sound when AI replies with a new turn
  useEffect(() => {
    let hasNewTurn = false
    for (const t of turns) {
      if (!knownTurnIdsRef.current.has(t.id)) {
        knownTurnIdsRef.current.add(t.id)
        hasNewTurn = true
      }
    }
    if (hasNewTurn) {
      playSystemSound('ai_reply')
    }
  }, [turns])
}

// Server clock minus this device's clock, in ms. countdown_end is stamped by the server,
// so a device whose clock is a few seconds off would otherwise count down from another number.
export function useServerClockOffset(): RefObject<number> {
  const clockOffsetRef = useRef(0)

  // Ask the server what time it is (best of 3 round trips)
  useEffect(() => {
    let cancelled = false

    const syncClock = async () => {
      let bestRoundTrip = Infinity
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        const sentAt = Date.now()
        try {
          const serverNow = await getServerTime()
          const roundTrip = Date.now() - sentAt
          if (!cancelled && roundTrip < bestRoundTrip) {
            bestRoundTrip = roundTrip
            clockOffsetRef.current = serverNow - (sentAt + roundTrip / 2)
          }
        } catch {
          // Keep the offset we already have
        }
      }
    }

    void syncClock()
    return () => {
      cancelled = true
    }
  }, [])

  return clockOffsetRef
}

// Synchronized countdown timer: seconds left until countdown_end (server clock), or null when not counting down
export function useCountdownSeconds(
  turnPhase: TableData['turn_phase'],
  countdownEndValue: TableData['countdown_end'],
  clockOffsetRef: RefObject<number>,
): number | null {
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (turnPhase !== 'countdown' || !countdownEndValue) {
      const resetId = window.setTimeout(() => {
        setCountdownSeconds(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }

    const countdownEnd = new Date(countdownEndValue)

    if (Number.isNaN(countdownEnd.getTime())) {
      const resetId = window.setTimeout(() => {
        setCountdownSeconds(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }

    const interval = setInterval(() => {
      const serverNow = Date.now() + clockOffsetRef.current
      const remaining = Math.min(
        COUNTDOWN_SECONDS,
        Math.max(0, Math.ceil((countdownEnd.getTime() - serverNow) / 1000)),
      )
      setCountdownSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [turnPhase, countdownEndValue, clockOffsetRef])

  return countdownSeconds
}
