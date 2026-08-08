import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createPomodoroState, DEFAULT_POMODORO_DURATIONS, sanitizePomodoroSessionHistory, useTaskStore } from '@mindwtr/core';
import { LanguageProvider } from '../contexts/language-context';
import { usePomodoroStore } from '../store/pomodoro-store';
import { usePomodoroAlerts } from './usePomodoroAlerts';

const sendAlert = vi.fn();
vi.mock('../lib/pomodoro-alert', () => ({
    sendDesktopPomodoroCompletionAlert: (...args: unknown[]) => sendAlert(...args),
}));

// Deliberately renders nothing: the point is that the timer alerts from App,
// with no pomodoro UI mounted anywhere (#528).
function Harness() {
    usePomodoroAlerts();
    return null;
}

const startRunningPhase = (phase: 'focus' | 'break', remainingSeconds: number) => {
    usePomodoroStore.setState({
        hasHydrated: true,
        snapshot: {
            durations: DEFAULT_POMODORO_DURATIONS,
            timerState: { ...createPomodoroState(DEFAULT_POMODORO_DURATIONS, phase), remainingSeconds, isRunning: true },
            selectedTaskId: undefined,
            lastEvent: null,
            updatedAtMs: Date.now(),
            sessionHistory: sanitizePomodoroSessionHistory(),
        },
    });
};

describe('usePomodoroAlerts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sendAlert.mockClear();
        window.localStorage.clear();
        useTaskStore.setState({
            tasks: [],
            _allTasks: [],
            settings: { features: { pomodoro: true } },
            error: null,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('alerts when a focus session finishes with no panel mounted', () => {
        startRunningPhase('focus', 2);
        render(<LanguageProvider><Harness /></LanguageProvider>);

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(sendAlert).toHaveBeenCalledTimes(1);
        expect(sendAlert.mock.calls[0][1]).toContain('Focus session complete');
    });

    it('alerts when a break finishes too', () => {
        startRunningPhase('break', 2);
        render(<LanguageProvider><Harness /></LanguageProvider>);

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(sendAlert).toHaveBeenCalledTimes(1);
        expect(sendAlert.mock.calls[0][1]).toContain('Break complete');
    });

    it('stays quiet while notifications are off', () => {
        useTaskStore.setState({ settings: { features: { pomodoro: true }, notificationsEnabled: false } });
        startRunningPhase('focus', 2);
        render(<LanguageProvider><Harness /></LanguageProvider>);

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(sendAlert).not.toHaveBeenCalled();
    });
});
