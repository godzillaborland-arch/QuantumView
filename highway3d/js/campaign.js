import { TIERED_VRITTIS } from './data.js';

// One chapter per question tier. Each chapter: a few road gates from its tier, then a boss of 3 gates (win 2 of 3).
// stages[n] is the drive stage after n correct road gates (1 manual, 2 lane assist, 3 FSD).
export const BOSS_GATES = 3, BOSS_WINS = 2;

export const FREE_CHAPTERS = [
  {
    tier: 1, theme: 'city', title: 'The Restless City', place: 'Guindy, 1978',
    blurb: 'Quantum, the skeptical rationalist, drives through a city that never stops pinging. Learn why the restless mind is the first obstacle, and why minutes on a timer are not the measure.',
    hazards: 'Notifications arrive in pairs and billboards shout from both sides of the road.',
    goal: 4, stages: [1,1,1,2,2], speed: 9, maxSpeed: 14, calm0: 0, calmGain: 0.06,
    vrittis: TIERED_VRITTIS[1], mix: { drifter:0, puddle:0, mirage:0 },
    boss: { name: 'THE WIND', line: 'Arjuna said the mind is harder to control than the wind. Steer through it.' }
  },
  {
    tier: 2, theme: 'monsoon', title: 'Mud on the Lens', place: 'Monsoon highway',
    blurb: 'Rain, puddles and the stories we tell ourselves. Satya is the clean sensor, and every self-deception is mud on the lens.',
    hazards: 'Worries drift between lanes. Puddles of self-deception splash the sensors.',
    goal: 4, stages: [2,2,2,3], speed: 10.5, maxSpeed: 16, calm0: 0.3, calmGain: 0.07,
    vrittis: TIERED_VRITTIS[2], mix: { drifter:0.35, puddle:0.3, mirage:0 },
    puddles: ['WHITE LIE', 'EXCUSE', "IT'S FINE", 'JUST ONCE'],
    boss: { name: 'SELF-DECEPTION', line: 'We lie to others occasionally and to ourselves constantly. Wipe the lens clean.' }
  },
  {
    tier: 3, theme: 'desert', title: 'Neti Neti', place: 'The road to Sacramento',
    blurb: 'Debugging by exclusion. The subtlest vṛttis appear late, and the autopilot cannot see doubt coming. Not this, not this, until the road is clear.',
    hazards: 'Mirages of doubt appear without warning, and FSD cannot see them until they are close. Take the wheel when it matters.',
    goal: 4, stages: [2,2,3], speed: 12, maxSpeed: 18, calm0: 0.6, calmGain: 0.06,
    vrittis: TIERED_VRITTIS[3], mix: { drifter:0.25, puddle:0, mirage:0.45 },
    boss: { name: 'SPIRITUAL PRIDE', line: 'The last vṛtti is the pride of having come this far. Not this. Not this.' }
  }
];

// The campaign being played. The Reader's Edition swaps in its own chapters; importers see the live binding.
export let CHAPTERS = FREE_CHAPTERS, EDITION = 'free';
export function useChapters(list=FREE_CHAPTERS, edition='free'){ CHAPTERS = list; EDITION = edition; }

export function starsFor(misses){ return misses===0 ? 3 : misses<=1 ? 2 : 1; }
