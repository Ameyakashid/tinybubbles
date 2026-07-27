import { SyncConfigurationSection } from './sync/SyncConfigurationSection';
import { SyncStatusSection } from './sync/SyncStatusSection';
import type { SettingsSyncPageProps } from './sync/types';

// Layout only — this component is the `page-chunk:sync` lazy boundary. URL
// validity and `isSyncTargetValid` live in `useSyncSettings`, next to the state
// they validate.
export function SettingsSyncPage(props: SettingsSyncPageProps) {
    return (
        <div className="space-y-8">
            <SyncConfigurationSection {...props} />
            <SyncStatusSection {...props} />
        </div>
    );
}
