import { describe, expect, it } from 'vitest';

import { createImportDiagnostic, formatImportDiagnostic } from './import-diagnostics';

describe('import diagnostics', () => {
    it.each([
        ['1 unsupported recurrence rule', 'settings.importDiagnostics.unsupportedRecurrence'],
        ['2 dates could not be mapped', 'settings.importDiagnostics.unmappedDate'],
        ['3 statuses could not be mapped', 'settings.importDiagnostics.unmappedStatus'],
        ['4 duplicate CSV IDs were skipped', 'settings.importDiagnostics.duplicateIdentity'],
        ['5 previously imported tasks were skipped', 'settings.importDiagnostics.skippedExistingRecords'],
        ['6 non-CSV archive entries were skipped', 'settings.importDiagnostics.skippedArchiveEntries'],
        ['7 files could not be parsed', 'settings.importDiagnostics.invalidArchiveEntries'],
        ['8 tasks had no matching parent', 'settings.importDiagnostics.missingParent'],
        ['9 empty rows were skipped', 'settings.importDiagnostics.emptyRecords'],
    ])('formats %s with its code-specific localized meaning', (message, expectedKey) => {
        const diagnostic = createImportDiagnostic(message, 'warning');
        expect(formatImportDiagnostic(diagnostic, (key) => key)).toBe(expectedKey);
    });
});
