'use client'

export const SOUND_PATHS = {
  roll_under_10: '/assets/sound/roll_under_10.wav',
  roll_more_than_10_under_15: '/assets/sound/roll_more_than_10_under_15.wav',
  roll_more_than_15: '/assets/sound/roll_more_than_15.wav',
  player_enter_table: '/assets/sound/player_enter_table.wav',
  ai_reply: '/assets/sound/Ai_reply.wav',
  error: '/assets/sound/error.wav',
} as const

export type SoundKey = keyof typeof SOUND_PATHS

let pendingAutoplayKey: SoundKey | null = null
let unlockListenerAttached = false

function attachAutoplayUnlock() {
  if (unlockListenerAttached || typeof window === 'undefined') return
  unlockListenerAttached = true

  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    unlockListenerAttached = false

    if (pendingAutoplayKey) {
      const keyToPlay = pendingAutoplayKey
      pendingAutoplayKey = null
      playSound(keyToPlay)
    }
  }

  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

/**
 * Plays a notification sound by key.
 * Gracefully handles browser autoplay restrictions if triggered on initial page load.
 */
export function playSound(key: SoundKey): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return

  try {
    const src = SOUND_PATHS[key]
    const audio = new Audio(src)
    audio.preload = 'auto'

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((err: unknown) => {
        // If blocked by browser autoplay policy (e.g. player_enter_table on page refresh),
        // play it on the first user interaction.
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          pendingAutoplayKey = key
          attachAutoplayUnlock()
        }
      })
    }
  } catch (err) {
    console.error('Failed to play sound:', err)
  }
}

/**
 * Plays the appropriate dice roll notification sound based on the roll total:
 * - Under 10 (< 10): roll_under_10.wav
 * - 10 to under 15 (10..14): roll_more_than_10_under_15.wav
 * - 15 and above (>= 15): roll_more_than_15.wav
 */
export function playDiceRollSound(total: number): void {
  if (total < 10) {
    playSound('roll_under_10')
  } else if (total < 15) {
    playSound('roll_more_than_10_under_15')
  } else {
    playSound('roll_more_than_15')
  }
}

/**
 * Plays a system notification sound:
 * - 'player_enter_table': player_enter_table.wav
 * - 'ai_reply': Ai_reply.wav
 * - 'error': error.wav
 */
export function playSystemSound(type: 'player_enter_table' | 'ai_reply' | 'error'): void {
  playSound(type)
}
