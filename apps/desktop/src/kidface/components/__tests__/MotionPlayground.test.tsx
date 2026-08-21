import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CelebrationProvider } from '../CelebrationContext';
import { MotionPlayground } from '../MotionPlayground';

function renderPlayground() {
    return render(
        <CelebrationProvider>
            <MotionPlayground />
        </CelebrationProvider>,
    );
}

describe('MotionPlayground', () => {
    it('does not leak timers when the playground unmounts during the hero celebration', () => {
        vi.useFakeTimers();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const { unmount } = renderPlayground();

        const heroButton = screen.getByRole('checkbox', { name: 'Toggle celebration checkbox' });
        fireEvent.click(heroButton);

        unmount();

        act(() => {
            vi.runAllTimers();
        });

        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
        vi.useRealTimers();
    });

    it('applies the reduced-motion preview class when the toggle is pressed', () => {
        renderPlayground();

        const playground = screen.getByRole('heading', { name: 'Go nuts, safely' }).parentElement?.parentElement;
        expect(playground).not.toHaveClass('motion-reduce');

        fireEvent.click(screen.getByRole('button', { name: 'Toggle reduced motion preview' }));

        expect(playground).toHaveClass('motion-reduce');
    });
});
