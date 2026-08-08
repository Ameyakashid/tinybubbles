import { useEffect, useMemo, useRef } from 'react';
import { translateWithFallback, useTaskStore, type PomodoroAutoStartOptions } from '@mindwtr/core';
import { useLanguage } from '../contexts/language-context';
import { sendDesktopPomodoroCompletionAlert } from '../lib/pomodoro-alert';
import { reconcilePomodoroSnapshot, usePomodoroStore } from '../store/pomodoro-store';

/**
 * Runs the pomodoro clock and its completion alert app-wide.
 *
 * Both used to live in PomodoroPanel, which only mounts inside Agenda, so a
 * timer left running while the user worked in another view — or another
 * workspace, which is the whole point of the timer — never ticked to zero and
 * never alerted until Agenda was reopened. Reconciliation is timestamp-based,
 * so the clock still read correctly on return; only the sound, notification and
 * taskbar flash were missed (#528).
 *
 * Covers both phases: the break end alerts the same way the focus end does,
 * once the break is actually running (auto-start breaks, or Start pressed).
 */
export function usePomodoroAlerts(): void {
    const pomodoroEnabled = useTaskStore((state) => state.settings.features?.pomodoro === true);
    const notificationsEnabled = useTaskStore((state) => state.settings.notificationsEnabled !== false);
    const autoStartBreaks = useTaskStore((state) => state.settings.gtd?.pomodoro?.autoStartBreaks === true);
    const autoStartFocus = useTaskStore((state) => state.settings.gtd?.pomodoro?.autoStartFocus === true);
    const isRunning = usePomodoroStore((state) => state.snapshot.timerState.isRunning);
    const lastEvent = usePomodoroStore((state) => state.snapshot.lastEvent);
    const commitSnapshot = usePomodoroStore((state) => state.commitPomodoro);
    const { t } = useLanguage();
    const previousEventRef = useRef(lastEvent);

    const autoStartOptions = useMemo<PomodoroAutoStartOptions>(
        () => ({ autoStartBreaks, autoStartFocus }),
        [autoStartBreaks, autoStartFocus]
    );

    useEffect(() => {
        if (!pomodoroEnabled || !isRunning) return;
        const intervalId = window.setInterval(() => {
            commitSnapshot((prev) => reconcilePomodoroSnapshot(prev, Date.now(), autoStartOptions));
        }, 1000);
        return () => window.clearInterval(intervalId);
    }, [autoStartOptions, commitSnapshot, isRunning, pomodoroEnabled]);

    useEffect(() => {
        const previous = previousEventRef.current;
        previousEventRef.current = lastEvent;
        if (!lastEvent || lastEvent === previous || !notificationsEnabled) return;
        const message = lastEvent === 'focus-finished'
            ? translateWithFallback(t, 'pomodoro.focusComplete', 'Focus session complete. Take a short break.')
            : translateWithFallback(t, 'pomodoro.breakComplete', 'Break complete. Ready for the next focus session.');
        void sendDesktopPomodoroCompletionAlert(
            translateWithFallback(t, 'pomodoro.title', 'Pomodoro Focus'),
            message
        );
    }, [lastEvent, notificationsEnabled, t]);
}
