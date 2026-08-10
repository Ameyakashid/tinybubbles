import { AttachmentsCleanupSection } from './sync/AttachmentsCleanupSection';
import { BackupSection, ImportSection } from './sync/DataTransferSections';
import { DiagnosticsSection } from './sync/DiagnosticsSection';
import type { SettingsDataPageProps } from './sync/types';

export function SettingsDataPage(props: SettingsDataPageProps) {
    return (
        <div className="space-y-8">
            <BackupSection {...props} />
            <ImportSection {...props} />
            <AttachmentsCleanupSection {...props} />
            {props.isTauri && <DiagnosticsSection {...props} />}
        </div>
    );
}
