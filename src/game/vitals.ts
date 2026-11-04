import type { Needs } from './types';

export const VITALS = {
  health: {
    label: 'Health',
    icon: 'heart',
    color: '#d98b77',
    advice: 'Apply an herbal bandage for 35 health. A bowl of stew also restores 8.',
  },
  hunger: {
    label: 'Hunger',
    icon: 'food',
    color: '#d8b879',
    advice: 'Eat berries, mushrooms or pine nuts. Forest stew restores 55 hunger.',
  },
  thirst: {
    label: 'Thirst',
    icon: 'water',
    color: '#8ec3bf',
    advice: 'Drink spring water for 35 thirst. Refill your bottles at the spring northeast of camp.',
  },
  warmth: {
    label: 'Warmth',
    icon: 'thermometer',
    color: '#dba373',
    advice: 'Stay near a burning fire or shelter. Hold a lit torch, or drink warm berry tea.',
  },
  stamina: {
    label: 'Stamina',
    icon: 'stamina',
    color: '#b7c783',
    advice: 'Walk instead of sprinting, or stop for a moment. Resting at a shelter restores stamina.',
  },
} as const;
export type Vital = keyof typeof VITALS;
export function meterValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}
export function condition(value: number) {
  return meterValue(value) < 25 ? 'critical' : meterValue(value) < 50 ? 'low' : 'steady';
}
export function urgentVitals(needs: Needs): Vital[] {
  return (Object.keys(VITALS) as Vital[]).filter((key) => condition(needs[key]) !== 'steady');
}
