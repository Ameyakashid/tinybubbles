import { SyncConfigurationSection } from './sync/SyncConfigurationSection';
import { SyncStatusSection } from './sync/SyncStatusSection';
import { ParentSyncFirstRun } from './sync/ParentSyncFirstRun';
import type { SettingsSyncPageProps } from './sync/types';

// Layout only — this component is the `page-chunk:sync` lazy boundary. URL
// validity and `isSyncTargetValid` live in `useSyncSettings`, next to the state
// they validate.
export function SettingsSyncPage(props: SettingsSyncPageProps) {
    return (
        <div className="space-y-8">
            <ParentSyncFirstRun syncBackend={props.syncBackend} t={props.t} />
            <SyncConfigurationSection {...props} />
            <SyncStatusSection {...props} />
        </div>
    );
}
