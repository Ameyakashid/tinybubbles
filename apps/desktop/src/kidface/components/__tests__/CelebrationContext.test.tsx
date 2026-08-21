import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CelebrationProvider, useCelebration } from '../CelebrationContext';

function CelebrationButton() {
    const celebrate = useCelebration();
    return (
        <button type="button" onClick={() => celebrate()}>
            Celebrate
        </button>
    );
}

describe('CelebrationProvider', () => {
    it('does not leak timers when the provider unmounts during a burst', () => {
        vi.useFakeTimers();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const { unmount } = render(
            <CelebrationProvider>
                <CelebrationButton />
            </CelebrationProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Celebrate' }));

        unmount();

        act(() => {
            vi.runAllTimers();
        });

        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
        vi.useRealTimers();
    });
});
