import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LanguageProvider } from '@/contexts/language-context';
import { KidNav } from '../KidNav';

const renderNav = (activeRoom: Parameters<typeof KidNav>[0]['activeRoom'] = 'today') => render(
    <LanguageProvider>
        <KidNav activeRoom={activeRoom} onChangeRoom={vi.fn()} />
    </LanguageProvider>,
);

describe('KidNav', () => {
    it('keeps every bottom-nav item on the 88px floor', () => {
        renderNav();

        const items = screen.getAllByRole('button');
        expect(items).toHaveLength(5);

        for (const item of items) {
            expect(item).toHaveClass('min-h-22');
        }
    });

    it('grows the nav height to fit the 88px items', () => {
        renderNav();

        expect(screen.getByRole('navigation', { name: 'Kid rooms' })).toHaveClass('h-28');
    });
});
