import { useMemo } from 'react';
import { safeFormatDate, tFallback, useTaskStore } from '@tinybubbles/core';
import type { Task } from '@tinybubbles/core';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '../ErrorBoundary';
import { useLanguage } from '../../contexts/language-context';
import {
    buildFamilyDashboardBuckets,
    DONE_LOOKBACK_DAYS,
    UPCOMING_WINDOW_DAYS,
} from '../../lib/family-dashboard-buckets';
import { StoreTaskItem } from './list/StoreTaskItem';

/**
 * The parent flavour's home view: what the child's device has synced up,
 * arranged the way a parent asks about it — what slipped, what's on for
 * today, what's coming, and what got finished (family-dashboard-buckets.ts).
 *
 * Structure only. It reads the same store every other view reads (the child's
 * data IS this instance's data — one sync token, one namespace) and reuses
 * StoreTaskItem so rows behave exactly as they do elsewhere. Visual design is
 * the design pass's to own.
 */

type SectionTone = 'attention' | 'normal' | 'done';

function DashboardSection({
    title,
    tone,
    tasks,
    emptyText,
    readOnly,
}: {
    title: string;
    tone: SectionTone;
    tasks: Task[];
    emptyText: string;
    readOnly?: boolean;
}) {
    return (
        <section aria-label={title} className="space-y-1.5">
            <h3
                className={
                    tone === 'attention' && tasks.length > 0
                        ? 'text-sm font-semibold uppercase tracking-wide text-destructive'
                        : 'text-sm font-semibold uppercase tracking-wide text-muted-foreground'
                }
            >
                {title} <span className="font-normal">({tasks.length})</span>
            </h3>
            {tasks.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">{emptyText}</p>
            ) : (
                <div className="divide-y divide-border/30">
                    {tasks.map((task) => (
                        <StoreTaskItem
                            key={task.id}
                            taskId={task.id}
                            readOnly={readOnly}
                            showQuickDone={!readOnly}
                            showProjectBadgeInActions={false}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

export function FamilyDashboardView({ onOpenSyncSettings }: { onOpenSyncSettings?: () => void }) {
    const { t } = useLanguage();
    // Single-value selectors only (array refs and primitives) — no fresh
    // objects per call. The bucket memo keys on the ARRAY IDENTITIES, not on
    // lastDataChangeAt: sync-applied remote data deliberately does not bump
    // the change token (it must not retrigger sync), but it does swap the
    // arrays — and a kid's completion arriving by sync is exactly what this
    // dashboard exists to show.
    const tasks = useTaskStore((state) => state.tasks);
    const projects = useTaskStore((state) => state.projects);
    const lastSyncAt = useTaskStore((state) => state.settings?.lastSyncAt);
    const lastSyncStatus = useTaskStore((state) => state.settings?.lastSyncStatus);
    const lastSyncError = useTaskStore((state) => state.settings?.lastSyncError);

    const buckets = useMemo(() => {
        const projectMap = new Map(projects.map((project) => [project.id, project]));
        return buildFamilyDashboardBuckets(tasks, projectMap, new Date());
    }, [tasks, projects]);

    const syncLine = lastSyncStatus === 'error'
        ? `${tFallback(t, 'familyDashboard.syncProblem', 'Sync problem')}: ${lastSyncError ?? ''}`
        : lastSyncAt
            ? `${tFallback(t, 'familyDashboard.lastSync', 'Last sync')}: ${safeFormatDate(lastSyncAt, 'Pp', lastSyncAt)}`
            : tFallback(
                t,
                'familyDashboard.notConnected',
                'Not syncing yet — connect this app to your family server in Settings → Sync, using the same server and token as your child’s device.',
            );

    const glance: Array<{ key: string; icon: typeof AlertTriangle; label: string; value: number; attention?: boolean }> = [
        {
            key: 'overdue',
            icon: AlertTriangle,
            label: tFallback(t, 'familyDashboard.overdue', 'Overdue'),
            value: buckets.overdue.length,
            attention: buckets.overdue.length > 0,
        },
        {
            key: 'today',
            icon: CalendarClock,
            label: tFallback(t, 'familyDashboard.dueToday', 'Due today'),
            value: buckets.dueToday.length,
        },
        {
            key: 'doneToday',
            icon: CheckCircle2,
            label: tFallback(t, 'familyDashboard.doneToday', 'Done today'),
            value: buckets.doneTodayCount,
        },
    ];

    return (
        <ErrorBoundary>
            <div className="flex flex-col gap-6">
                <header className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">
                        {tFallback(t, 'familyDashboard.title', 'Family')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {tFallback(
                            t,
                            'familyDashboard.subtitle',
                            'Everything here is live from your child’s device. Add or change a task anywhere in this app and it appears there on the next sync.',
                        )}
                    </p>
                    <p
                        className={
                            lastSyncStatus === 'error'
                                ? 'flex items-center gap-1.5 text-sm text-destructive'
                                : 'flex items-center gap-1.5 text-sm text-muted-foreground'
                        }
                        role={lastSyncStatus === 'error' ? 'alert' : undefined}
                    >
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{syncLine}</span>
                        {/* The parent flavour suppresses the stock first-run
                            dialog (its "Start fresh" would seed sample data
                            into the child's namespace), so this link IS the
                            parent's onboarding: not connected or broken →
                            straight to Settings → Sync. */}
                        {onOpenSyncSettings && (lastSyncStatus === 'error' || !lastSyncAt) && (
                            <button
                                type="button"
                                onClick={onOpenSyncSettings}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                                {lastSyncStatus === 'error'
                                    ? tFallback(t, 'familyDashboard.fixSync', 'Check sync settings')
                                    : tFallback(t, 'familyDashboard.connectNow', 'Connect now')}
                            </button>
                        )}
                    </p>
                </header>

                <div className="flex flex-wrap gap-3" aria-label={tFallback(t, 'familyDashboard.glance', 'At a glance')}>
                    {glance.map(({ key, icon: Icon, label, value, attention }) => (
                        <div
                            key={key}
                            className={
                                attention
                                    ? 'flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2'
                                    : 'flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2'
                            }
                        >
                            <Icon
                                className={attention ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-muted-foreground'}
                                aria-hidden="true"
                            />
                            <span className="text-lg font-semibold tabular-nums">{value}</span>
                            <span className="text-sm text-muted-foreground">{label}</span>
                        </div>
                    ))}
                </div>

                <DashboardSection
                    title={tFallback(t, 'familyDashboard.sectionOverdue', 'Needs attention')}
                    tone="attention"
                    tasks={buckets.overdue}
                    emptyText={tFallback(t, 'familyDashboard.emptyOverdue', 'Nothing overdue.')}
                />
                <DashboardSection
                    title={tFallback(t, 'familyDashboard.sectionToday', 'Due today')}
                    tone="normal"
                    tasks={buckets.dueToday}
                    emptyText={tFallback(t, 'familyDashboard.emptyToday', 'Nothing due today.')}
                />
                <DashboardSection
                    title={tFallback(t, 'familyDashboard.sectionUpcoming', `Coming up (next ${UPCOMING_WINDOW_DAYS} days)`)}
                    tone="normal"
                    tasks={buckets.upcoming}
                    emptyText={tFallback(t, 'familyDashboard.emptyUpcoming', 'Nothing scheduled.')}
                />
                <DashboardSection
                    title={tFallback(t, 'familyDashboard.sectionDone', `Finished (last ${DONE_LOOKBACK_DAYS} days)`)}
                    tone="done"
                    tasks={buckets.doneRecently}
                    emptyText={tFallback(t, 'familyDashboard.emptyDone', 'Nothing finished yet.')}
                    readOnly
                />
            </div>
        </ErrorBoundary>
    );
}
