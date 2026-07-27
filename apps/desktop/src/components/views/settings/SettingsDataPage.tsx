import { AttachmentsCleanupSection } from './sync/AttachmentsCleanupSection';
import { DataTransferSection } from './sync/DataTransferSection';
import { DiagnosticsSection } from './sync/DiagnosticsSection';
import type { SettingsDataPageProps } from './sync/types';

export function SettingsDataPage(props: SettingsDataPageProps) {
    return (
        <div className="space-y-8">
            <DataTransferSection {...props} />
            <AttachmentsCleanupSection {...props} />
            {props.isTauri && <DiagnosticsSection {...props} />}
        </div>
    );
}
