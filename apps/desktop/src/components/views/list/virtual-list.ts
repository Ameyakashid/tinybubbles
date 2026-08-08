/**
 * Shared sizing for the desktop task lists, all of which virtualize with
 * `@tanstack/react-virtual`. The library owns the row model; only the numbers
 * every list agrees on live here.
 */
export const LIST_VIRTUALIZATION_THRESHOLD = 25;
export const LIST_VIRTUAL_ROW_ESTIMATE = 120;
export const LIST_VIRTUAL_HEADER_ESTIMATE = 42;
/** Roughly 600px of rows kept mounted past the viewport in either direction. */
export const LIST_VIRTUAL_OVERSCAN_ROWS = Math.max(2, Math.ceil(600 / LIST_VIRTUAL_ROW_ESTIMATE));
