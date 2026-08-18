import { useMemo } from 'react';
import { isToday, isYesterday } from 'date-fns';
import {
    getTaskCompletionInstant,
    safeFormatDate,
    tFallback,
    useProjectById,
    useTaskStore,
} from '@tinybubbles/core';
import type { Task } from '@tinybubbles/core';
import { AlertTriangle, CalendarClock, Check, CheckCircle2 } from 'lucide-react';
import { ErrorBoundary } from '../ErrorBoundary';
import { cn } from '../../lib/utils';
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
 * It reads the same store every other view reads (the child's data IS this
 * instance's data — one sync token, one namespace). The three live sections
 * reuse StoreTaskItem so rows behave exactly as they do elsewhere; the
 * Finished feed uses its own quiet row — a parent reads it as reassurance
 * ("my child did this, at this time"), not as work to manage.
 */

type SectionTone = 'attention' | 'normal' | 'done';

function GlanceTile({
    icon: Icon,
    label,
    value,
    tone,
}: {
    icon: typeof AlertTriangle;
    label: string;
    value: number;
    tone: 'attention' | 'calm' | 'kelp';
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-3.5 rounded-2xl border px-4 py-3.5',
                tone === 'attention'
                    ? 'border-warning/50 bg-warning/[0.06]'
                    : 'border-border/70 bg-card',
            )}
        >
            <span
                className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    tone === 'attention' && 'bg-warning/15 text-warning',
                    tone === 'calm' && 'bg-primary/10 text-primary',
                    tone === 'kelp' && 'bg-success/15 text-success',
                )}
                aria-hidden="true"
            >
                <Icon className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
                <span
                    className={cn(
                        'text-2xl font-semibold tabular-nums',
                        tone === 'attention' ? 'text-warning' : 'text-foreground',
                    )}
                >
                    {value}
                </span>
                <span className="truncate text-xs text-muted-foreground">{label}</span>
            </span>
        </div>
    );
}

/**
 * A Finished-feed row: a settled kelp bubble, the title (readable, not struck
 * through — done here means accomplished, not cancelled), and the completion
 * time the parent actually came for. Static by design.
 */
function FamilyCompletedRow({ task }: { task: Task }) {
    const { t } = useLanguage();
    const project = useProjectById(task.projectId);
    const instant = getTaskCompletionInstant(task);

    const when = instant
        ? isToday(instant)
            ? `${tFallback(t, 'familyDashboard.today', 'Today')}, ${safeFormatDate(instant, 'p', '')}`
            : isYesterday(instant)
                ? `${tFallback(t, 'familyDashboard.yesterday', 'Yesterday')}, ${safeFormatDate(instant, 'p', '')}`
                : safeFormatDate(instant, 'PP', task.completedAt ?? '')
        : '';

    return (
        <div className="flex items-center gap-3 px-2 py-2">
            <span
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                aria-hidden="true"
            >
                <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                {task.title}
            </span>
            {project && (
                <span className="hidden max-w-40 shrink-0 truncate text-xs text-muted-foreground/80 sm:block">
                    {project.title}
                </span>
            )}
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {when}
            </span>
        </div>
    );
}

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
    const needsAttention = tone === 'attention' && tasks.length > 0;
    return (
        <section
            aria-label={title}
            className={cn(
                'overflow-hidden rounded-2xl border',
                needsAttention
                    ? 'border-warning/40 bg-warning/[0.03]'
                    : 'border-border/70 bg-card/60',
            )}
        >
            <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
                <h3
                    className={cn(
                        'text-xs font-semibold uppercase tracking-[0.14em]',
                        needsAttention ? 'text-warning' : 'text-muted-foreground',
                    )}
                >
                    {title}
                </h3>
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        needsAttention
                            ? 'bg-warning/15 text-warning'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {tasks.length}
                </span>
            </header>
            {tasks.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">{emptyText}</p>
            ) : (
                <div className="divide-y divide-border/40 border-t border-border/40 px-2 py-1">
                    {tasks.map((task) => (
                        tone === 'done' ? (
                            <FamilyCompletedRow key={task.id} task={task} />
                        ) : (
                            <StoreTaskItem
                                key={task.id}
                                taskId={task.id}
                                readOnly={readOnly}
                                showQuickDone={!readOnly}
                                showProjectBadgeInActions={false}
                            />
                        )
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

    const isSyncError = lastSyncStatus === 'error';
    const syncLine = isSyncError
        ? `${tFallback(t, 'familyDashboard.syncProblem', 'Sync problem')}: ${lastSyncError ?? ''}`
        : lastSyncAt
            ? `${tFallback(t, 'familyDashboard.lastSync', 'Last sync')}: ${safeFormatDate(lastSyncAt, 'Pp', lastSyncAt)}`
            : tFallback(
                t,
                'familyDashboard.notConnected',
                'Not syncing yet — connect this app to your family server in Settings → Sync, using the same server and token as your child’s device.',
            );

    const glance: Array<{
        key: string;
        icon: typeof AlertTriangle;
        label: string;
        value: number;
        tone: 'attention' | 'calm' | 'kelp';
    }> = [
        {
            key: 'overdue',
            icon: AlertTriangle,
            label: tFallback(t, 'familyDashboard.overdue', 'Overdue'),
            value: buckets.overdue.length,
            // Lantern amber, lit only when there is something to act on.
            tone: buckets.overdue.length > 0 ? 'attention' : 'calm',
        },
        {
            key: 'today',
            icon: CalendarClock,
            label: tFallback(t, 'familyDashboard.dueToday', 'Due today'),
            value: buckets.dueToday.length,
            tone: 'calm',
        },
        {
            key: 'doneToday',
            icon: CheckCircle2,
            label: tFallback(t, 'familyDashboard.doneToday', 'Done today'),
            value: buckets.doneTodayCount,
            tone: 'kelp',
        },
    ];

    return (
        <ErrorBoundary>
            <div className="family-dashboard mx-auto flex w-full max-w-3xl flex-col gap-6">
                <header className="space-y-2.5">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {tFallback(t, 'familyDashboard.title', 'Family')}
                    </h2>
                    <p className="max-w-prose text-sm text-muted-foreground">
                        {tFallback(
                            t,
                            'familyDashboard.subtitle',
                            'Everything here is live from your child’s device. Add or change a task anywhere in this app and it appears there on the next sync.',
                        )}
                    </p>
                    {/* The parent flavour suppresses the stock first-run
                        dialog (its "Start fresh" would seed sample data into
                        the child's namespace), so the CTA on this strip IS the
                        parent's onboarding: not connected or broken → straight
                        to Settings → Sync. */}
                    <div
                        className={cn(
                            'flex w-fit max-w-full flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-2xl border py-1.5 pl-3.5 pr-1.5 text-[13px] sm:rounded-full',
                            isSyncError
                                ? 'border-destructive/40 bg-destructive/5 text-destructive'
                                : 'border-border/70 bg-card text-muted-foreground',
                        )}
                        role={isSyncError ? 'alert' : undefined}
                    >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5 basis-72">
                            <span
                                className={cn(
                                    'h-2 w-2 shrink-0 rounded-full',
                                    isSyncError ? 'bg-destructive' : lastSyncAt ? 'bg-success' : 'bg-warning',
                                )}
                                aria-hidden="true"
                            />
                            <span className="min-w-0">{syncLine}</span>
                        </span>
                        {onOpenSyncSettings && (isSyncError || !lastSyncAt) && (
                            <button
                                type="button"
                                onClick={onOpenSyncSettings}
                                className="ml-1 shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isSyncError
                                    ? tFallback(t, 'familyDashboard.fixSync', 'Check sync settings')
                                    : tFallback(t, 'familyDashboard.connectNow', 'Connect now')}
                            </button>
                        )}
                    </div>
                </header>

                <div
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                    aria-label={tFallback(t, 'familyDashboard.glance', 'At a glance')}
                >
                    {glance.map(({ key, icon, label, value, tone }) => (
                        <GlanceTile key={key} icon={icon} label={label} value={value} tone={tone} />
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
