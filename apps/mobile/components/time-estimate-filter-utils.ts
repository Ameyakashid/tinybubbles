import { formatTimeEstimateLabel as formatCoreTimeEstimateLabel, type TimeEstimate } from '@mindwtr/core';

export const MOBILE_TIME_ESTIMATE_OPTIONS: TimeEstimate[] = [
    '5min',
    '10min',
    '15min',
    '30min',
    '1hr',
    '2hr',
    '3hr',
    '4hr',
    '4hr+',
];

export const formatTimeEstimateChipLabel = formatCoreTimeEstimateLabel;

/** Time-estimate filter chips: the user's configured presets, or the defaults. */
export const resolveTimeEstimateFilterOptions = (
    presets: TimeEstimate[] | undefined
): TimeEstimate[] => (presets?.length ? presets : MOBILE_TIME_ESTIMATE_OPTIONS);
