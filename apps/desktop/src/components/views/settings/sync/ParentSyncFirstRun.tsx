import { Users } from 'lucide-react';
import type { SyncBackend } from '@tinybubbles/core';
import { cn } from '../../../../lib/utils';
import { isParentFlavour } from '../../../../config/flavour';
import type { SettingsSyncLabels } from './types';

type ParentSyncFirstRunProps = {
    syncBackend: SyncBackend;
    t: SettingsSyncLabels;
};

/**
 * Parent flavour: the first-run treatment for Settings → Sync.
 *
 * The stock first-run dialog is suppressed for parents (it would seed sample
 * data into the child's namespace), so the Family dashboard links here instead.
 * While sync is still off, paint a calm explainer at the top of the page that
 * frames the backend choice: this app reads from the same namespace as the
 * child's device.
 *
 * Paint only. No state, no sync logic, no token handling. The card disappears
 * naturally once the parent selects a backend.
 */
export function ParentSyncFirstRun({ syncBackend, t }: ParentSyncFirstRunProps) {
    if (!isParentFlavour || syncBackend !== 'off') return null;

    return (
        <section
            className={cn(
                'rounded-2xl border bg-primary/[0.05] p-5',
                'border-primary/15',
            )}
            aria-labelledby="parent-sync-first-run-title"
        >
            <div className="flex items-start gap-3.5">
                <span
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        'bg-primary/10 text-primary',
                    )}
                    aria-hidden="true"
                >
                    <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 space-y-2">
                    <h3
                        id="parent-sync-first-run-title"
                        className="text-sm font-semibold text-foreground"
                    >
                        {t.parentSyncFirstRunTitle}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {t.parentSyncFirstRunBody}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {t.syncDescription}
                    </p>
                </div>
            </div>
        </section>
    );
}
