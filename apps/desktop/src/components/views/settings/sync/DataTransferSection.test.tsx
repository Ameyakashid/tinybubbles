import { act, fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expandSettingsSection } from '../settings-search';
import { DataTransferSection } from './DataTransferSection';

const baseProps = {
    t: {
        dataTransfer: 'Data Transfer',
        dataTransferDesc: 'Import and export data.',
        exportBackup: 'Export Backup',
        exportBackupDesc: 'Save backup.',
        restoreBackup: 'Restore Backup',
        restoreBackupDesc: 'Restore backup.',
        mergeBackup: 'Merge Backup',
        mergeBackupDesc: 'Merge a backup.',
        importTodoist: 'Import from Todoist',
        importTodoistDesc: 'Import Todoist exports.',
        importTickTick: 'Import from TickTick',
        importTickTickDesc: 'Import TickTick exports.',
        importDgt: 'Import from DGT GTD',
        importDgtDesc: 'Import DGT GTD exports.',
        importOmniFocus: 'Import from OmniFocus',
        importOmniFocusDesc: 'Import OmniFocus exports.',
        importMindwtrCsv: 'Import from Mindwtr CSV',
        importMindwtrCsvDesc: 'Import a Mindwtr CSV file.',
        syncing: 'Working...',
    },
    transferAction: null,
    onExportBackup: vi.fn(),
    onRestoreBackup: vi.fn(),
    onMergeBackup: vi.fn(),
    onImportTodoist: vi.fn(),
    onImportTickTick: vi.fn(),
    onImportDgt: vi.fn(),
    onImportOmniFocus: vi.fn(),
    onImportMindwtrCsv: vi.fn(),
    onAddGettingStartedContent: vi.fn(),
} as unknown as ComponentProps<typeof DataTransferSection>;

// The rows are folded away until the header is clicked, which is also the
// click `expandSettingsSection` makes when search jumps to a row inside.
function expandRows(getByRole: ReturnType<typeof render>['getByRole']) {
    fireEvent.click(getByRole('button', { name: /data transfer/i }));
}

describe('DataTransferSection', () => {
    it('links to the import guide in the docs site', () => {
        const { getByRole } = render(<DataTransferSection {...baseProps} />);

        expect(getByRole('link', { name: /Import guide/ })).toHaveAttribute(
            'href',
            'https://docs.mindwtr.app/import/'
        );
    });

    it('keeps the transfer rows folded behind the header until it is expanded', () => {
        const { getByRole, queryByRole } = render(<DataTransferSection {...baseProps} />);

        const header = getByRole('button', { name: /data transfer/i });
        expect(header).toHaveAttribute('aria-expanded', 'false');
        expect(queryByRole('button', { name: /export backup/i })).toBeNull();
        expect(queryByRole('button', { name: /import from todoist/i })).toBeNull();

        fireEvent.click(header);

        expect(header).toHaveAttribute('aria-expanded', 'true');
        expect(getByRole('button', { name: /export backup/i })).toBeTruthy();
        expect(getByRole('button', { name: /import from todoist/i })).toBeTruthy();
    });

    it('unfolds when settings search reveals a row inside it', () => {
        const { getByRole } = render(<DataTransferSection {...baseProps} />);

        let expanded = false;
        act(() => {
            // The core roster gives every row in here section 'dataTransfer'.
            expanded = expandSettingsSection('dataTransfer');
        });

        expect(expanded).toBe(true);
        expect(getByRole('button', { name: /import from omnifocus/i })).toBeTruthy();
    });

    it('calls the TickTick import action', () => {
        const onImportTickTick = vi.fn();
        const { getByRole } = render(
            <DataTransferSection
                {...baseProps}
                onImportTickTick={onImportTickTick}
            />
        );
        expandRows(getByRole);

        fireEvent.click(getByRole('button', { name: /import from ticktick/i }));

        expect(onImportTickTick).toHaveBeenCalledTimes(1);
    });

    it('offers merging a backup beside restoring one', () => {
        const onMergeBackup = vi.fn();
        const onRestoreBackup = vi.fn();
        const { getByRole } = render(
            <DataTransferSection
                {...baseProps}
                onMergeBackup={onMergeBackup}
                onRestoreBackup={onRestoreBackup}
            />
        );
        expandRows(getByRole);

        fireEvent.click(getByRole('button', { name: /merge backup/i }));

        expect(onMergeBackup).toHaveBeenCalledTimes(1);
        expect(onRestoreBackup).not.toHaveBeenCalled();
    });

    it('exposes a recovery action for Getting Started content', () => {
        const onAddGettingStartedContent = vi.fn();
        const { getByRole } = render(
            <DataTransferSection
                {...baseProps}
                onAddGettingStartedContent={onAddGettingStartedContent}
            />
        );
        expandRows(getByRole);

        fireEvent.click(getByRole('button', { name: /add getting started content/i }));

        expect(onAddGettingStartedContent).toHaveBeenCalledTimes(1);
    });
});
