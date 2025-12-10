// Association type to color mapping (from web app CSS)
export const ASSOCIATION_COLORS = {
  character: '#4ade80', // green
  place: '#60a5fa',     // blue
  event: '#f87171',     // red
  item: '#fbbf24',      // yellow/amber
} as const;

export type AssociationType = keyof typeof ASSOCIATION_COLORS;

export function getAssociationColor(type: string): string {
  return ASSOCIATION_COLORS[type as AssociationType] || '#ffffff';
}
