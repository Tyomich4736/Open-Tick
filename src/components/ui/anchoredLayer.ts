/**
 * Portaled UI that belongs to an open AnchoredPopover (e.g. TimeSelect list).
 * Clicks / focus inside these layers must not close the parent popover.
 */
export const ANCHORED_LAYER_ATTR = 'data-anchored-layer'

export function isInsideAnchoredLayer(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`[${ANCHORED_LAYER_ATTR}]`))
}
