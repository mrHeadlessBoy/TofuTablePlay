// Equipment slot names and defaults for the character sheet.
// They live here, not in actions.ts, because a 'use server' file may only export async functions:
// anything else it exports reaches the browser as a server-action reference instead of its value.

/** Equipment slots: [head, torso, leg, foot, left hand, right hand] */
export type EquipmentSlots = [string, string, string, string, string, string]

export const EQUIPMENT_LABELS = ['Head', 'Torso', 'Leg', 'Foot', 'Left Hand', 'Right Hand'] as const

export const EMPTY_EQUIPMENT: EquipmentSlots = ['', '', '', '', '', '']
