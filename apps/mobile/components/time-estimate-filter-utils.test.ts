import { describe, expect, it } from 'vitest';

import { formatTimeEstimateChipLabel } from './time-estimate-filter-utils';

describe('time-estimate-filter-utils', () => {
    it('formats short chip labels', () => {
        expect(formatTimeEstimateChipLabel('5min')).toBe('5m');
        expect(formatTimeEstimateChipLabel('30min')).toBe('30m');
        expect(formatTimeEstimateChipLabel('1hr')).toBe('1h');
        expect(formatTimeEstimateChipLabel('4hr+')).toBe('4h+');
    });
});
