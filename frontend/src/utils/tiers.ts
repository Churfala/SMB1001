import type { TierInfo } from '../types';

export type { TierInfo };

export const TIERS: TierInfo[] = [
  { tier: 1, name: 'Bronze',   color: '#92400e', bg: '#fef3c7', maxControls: 7  },
  { tier: 2, name: 'Silver',   color: '#374151', bg: '#f3f4f6', maxControls: 17 },
  { tier: 3, name: 'Gold',     color: '#854d0e', bg: '#fef08a', maxControls: 27 },
  { tier: 4, name: 'Platinum', color: '#1e3a5f', bg: '#dbeafe', maxControls: 32 },
  { tier: 5, name: 'Diamond',  color: '#5b21b6', bg: '#ede9fe', maxControls: 39 },
];

export function tierInfo(tier: number, tiers: TierInfo[] = TIERS): TierInfo {
  return tiers.find((t) => t.tier === tier) ?? tiers[0];
}
