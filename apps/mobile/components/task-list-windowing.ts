/**
 * One home for the FlatList windowing numbers every task list is tuned with.
 *
 * These are #766 perf tuning, not defaults: they were arrived at on low-end
 * Android hardware and had been copy-pasted verbatim into nine list sites, so
 * re-tuning meant finding and editing all nine. Spread this instead, and
 * override individual props where a list genuinely differs (the project reorder
 * list renders a wider window because dragging scrolls past the visible rows;
 * the main task list clips subviews once it is long enough to pay for it).
 *
 * Changing a number here changes scroll behaviour on device — verify against
 * `docs/performance-budgets.md`, not a unit test: react-test-renderer has no
 * layout engine and will happily agree with any value.
 */
export const TASK_LIST_WINDOWING_PROPS = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 12,
  windowSize: 5,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: false,
} as const;
