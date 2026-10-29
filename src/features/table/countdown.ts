/** How long the "all players ready" countdown runs before the turn goes to the Dungeon Master. */
export const COUNTDOWN_MS = 5000

/** The part of a table row that says where the turn is. */
export type TablePhase = { turn_phase: string; countdown_end: string | null }
