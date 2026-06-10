/** Drift-correction rate (s⁻¹): how fast the shown value glides to a fresh anchor. */
const RESYNC_RATE = 2;

/** Relative gap beyond which a new anchor is a regime change (gobble/reset), not drift. */
const SNAP_RATIO = 0.5;

/**
 * Advance the displayed stream value one frame toward the anchor trajectory.
 * Glides when behind, holds when ahead (never runs against the stream), and
 * snaps only on regime changes so poll re-anchors never visibly jump.
 */
export function chaseStreamValue(
  display: number,
  target: number,
  perSecond: number,
  dtSeconds: number,
): number {
  const diff = target - display;
  const scale = Math.max(Math.abs(target), Math.abs(display));
  if (Math.abs(diff) > scale * SNAP_RATIO) return target;
  const movingWithStream = perSecond >= 0 ? diff > 0 : diff < 0;
  if (!movingWithStream) return display;
  return display + diff * (1 - Math.exp(-dtSeconds * RESYNC_RATE));
}
