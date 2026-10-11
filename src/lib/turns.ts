/**
 * The first row in `turns` is the opening narration, written when a table is launched.
 * Nobody has played yet at that point, so it is not a turn. The row after it is the party's
 * "Turn 1": to get the number players see, subtract this from a row's turn_number.
 */
export const OPENING_TURN_NUMBER = 1