// Shared dice tray. Import from here in any page:
//   import { DiceRoller, rollDice } from '@/components/dice'
// Server code, or a file that only needs the maths, can import '@/components/dice/dice' directly
// so it does not pull in the 3D die.
export { default as DiceRoller, type DiceActor, type DiceRollerProps } from './DiceRoller'
export { default as Die3D, ROLL_ANIMATION_MS } from './Die3D'
export * from './dice'
