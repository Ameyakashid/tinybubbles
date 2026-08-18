import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import type { Task } from '@tinybubbles/core';

import { TaskQuickActionMenu } from './TaskQuickActionMenu';

const now = '2026-02-01T00:00:00.000Z';

const task: Task = {
    id: 'task-1',
    title: 'Task',
    status: 'next',
    contexts: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
};

const t = (key: string) => ({
    'areas.create': 'Create area',
    'areas.search': 'Search areas',
    'calendar.nextMonth': 'Next month',
    'calendar.prevMonth': 'Previous month',
    'common.cancel': 'Cancel',
    'common.clear': 'Clear',
    'common.delete': 'Delete',
    'common.noMatches': 'No matches',
    'common.save': 'Save',
    'nav.calendar': 'Calendar',
    'projects.duplicate': 'Duplicate',
    'review.markReviewed': 'Mark reviewed',
    'task.convertToReference': 'Convert to Reference',
    'task.createProjectFromTask': 'Create project from task',
    'task.aria.dueTime': 'Due time',
    'task.aria.reviewTime': 'Review time',
    'task.aria.startTime': 'Start time',
    'taskEdit.areaLabel': 'Area',
    'taskEdit.contextsLabel': 'Contexts',
    'taskEdit.dueDateLabel': 'Due Date',
    'taskEdit.moreOptions': 'More options',
    'taskEdit.noAreaOption': 'No Area',
    'taskEdit.reviewDateLabel': 'Review Date',
    'taskEdit.startDateLabel': 'Start Date',
}[key] ?? key);

const createMenuProps = (overrides: Partial<ComponentProps<typeof TaskQuickActionMenu>> = {}): ComponentProps<typeof TaskQuickActionMenu> => ({
    task,
    x: 16,
    y: 16,
    t,
    dateFormatSetting: 'system',
    nativeDateInputLocale: 'en-US',
    contextOptions: [],
    areas: [],
    readOnly: false,
    onClose: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn(),
    onCreateArea: vi.fn(async () => null),
    onUpdateTask: vi.fn(async () => ({ success: true })),
    ...overrides,
});

const renderMenu = (overrides: Partial<ComponentProps<typeof TaskQuickActionMenu>> = {}) => {
    const props = createMenuProps(overrides);
    render(<TaskQuickActionMenu {...props} />);
    return props;
};

const renderClosableMenu = (overrides: Partial<ComponentProps<typeof TaskQuickActionMenu>> = {}) => {
    const props = createMenuProps(overrides);
    function Harness() {
        const [open, setOpen] = useState(true);
        return open ? (
            <TaskQuickActionMenu
                {...props}
                onClose={() => {
                    props.onClose();
                    setOpen(false);
                }}
            />
        ) : null;
    }
    render(<Harness />);
    return props;
};

describe('TaskQuickActionMenu', () => {
    // The simplified shell keeps a single panel-opening entry (Due Date);
    // the start/review/area/contexts entries are hidden. See DESIGN.md.
    it('exposes dialog state on the due date entry without pressed state', () => {
        renderMenu();

        expect(screen.getByRole('menu', { name: /more options/i })).toBeInTheDocument();
        const dueButton = screen.getByRole('menuitem', { name: 'Due Date…' });
        expect(dueButton).toHaveAttribute('aria-haspopup', 'dialog');
        expect(dueButton).toHaveAttribute('aria-expanded', 'false');
        expect(dueButton).not.toHaveAttribute('aria-pressed');
        expect(dueButton).toHaveClass('focus-visible:ring-2');

        fireEvent.click(dueButton);

        expect(dueButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: /due date/i }))
            .toHaveClass('w-[min(30rem,calc(100vw-1rem))]');
    });

    it('uses Escape to close the active panel before closing the menu', () => {
        const props = renderMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: /due date/i })).not.toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when clicking outside an open date panel', () => {
        const props = renderMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));

        fireEvent.mouseDown(document.body);

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on an outside click but does not also activate the control underneath it', () => {
        const outsideClick = vi.fn();
        const outsideButton = document.createElement('button');
        outsideButton.textContent = 'Add task to calendar';
        outsideButton.addEventListener('click', outsideClick);
        document.body.appendChild(outsideButton);

        try {
            const props = renderMenu();

            // A real dismissing gesture fires mousedown, then (on the same
            // target) click — both are part of the same user click.
            fireEvent.mouseDown(outsideButton);
            fireEvent.click(outsideButton);

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(outsideClick).not.toHaveBeenCalled();
        } finally {
            document.body.removeChild(outsideButton);
        }
    });

    it('ignores the initial layout scroll after opening but closes on later scrolls', () => {
        vi.useFakeTimers();
        try {
            const props = renderMenu();

            fireEvent.scroll(window);
            expect(props.onClose).not.toHaveBeenCalled();

            vi.advanceTimersByTime(160);
            fireEvent.scroll(window);

            expect(props.onClose).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('closes the due date mini calendar when clicking elsewhere in the quick panel', () => {
        const props = renderMenu({ task: { ...task, dueDate: '2026-04-12' } });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));

        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        fireEvent.focus(within(panel).getByLabelText('Due Date'));
        fireEvent.click(within(panel).getByRole('button', { name: 'Due Date Calendar' }));
        expect(screen.getByRole('dialog', { name: 'Due Date Calendar' })).toBeInTheDocument();

        fireEvent.pointerDown(within(panel).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'Due Date Calendar' })).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('discards a popover-selected quick date when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const props = renderMenu({ task: { ...task, dueDate: '2026-04-12' } });
        await user.click(screen.getByRole('menuitem', { name: 'Due Date…' }));

        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        await user.click(within(panel).getByRole('button', { name: 'Due Date Calendar' }));
        const calendar = screen.getByRole('dialog', { name: 'Due Date Calendar' });
        await user.click(within(calendar).getByRole('button', { name: 'Tomorrow' }));

        // Picking a suggestion applies to the draft and closes the popover.
        expect(screen.queryByRole('dialog', { name: 'Due Date Calendar' })).not.toBeInTheDocument();

        await user.click(within(panel).getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'Due Date' })).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('saves a popover-selected quick date with one click', async () => {
        const user = userEvent.setup();
        const onUpdateTask = vi.fn(async () => ({ success: true as const }));
        const props = renderMenu({ onUpdateTask });
        await user.click(screen.getByRole('menuitem', { name: 'Due Date…' }));

        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        await user.click(within(panel).getByRole('button', { name: 'Due Date Calendar' }));
        const calendar = screen.getByRole('dialog', { name: 'Due Date Calendar' });
        await user.click(within(calendar).getByRole('button', { name: 'Tomorrow' }));

        await user.click(within(panel).getByRole('button', { name: 'Save' }));

        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const pad = (value: number) => String(value).padStart(2, '0');
        const expected = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

        await waitFor(() => expect(onUpdateTask).toHaveBeenCalledTimes(1));
        expect(onUpdateTask).toHaveBeenCalledWith({ dueDate: expected });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    // Adult actions are hidden in the simplified shell — even when the task
    // carries the data that used to surface them (a due review date, an
    // area-less task). Their capabilities stay reachable through the task
    // editor (Settings -> GTD -> Task Editor Layout) and the Tidy up flow.
    it('hides the adult actions in the simplified shell', () => {
        renderMenu({
            task: { ...task, reviewAt: '2000-01-01T00:00:00.000Z' },
            onRename: vi.fn(),
            onPromoteToProject: vi.fn(),
        });

        for (const name of [
            /start date/i,
            /review date/i,
            'Mark reviewed',
            'Review in 1 week',
            'Area…',
            'Contexts…',
            'Convert to Reference',
        ]) {
            expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
        }

        // The kept child-safe set, in render order.
        const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
        expect(items).toEqual([
            'Rename task',
            'Due Date…',
            'Duplicate',
            'Turn into a list',
            'Delete',
        ]);
    });

    it('saves the panel draft when Enter is pressed in a field', async () => {
        const onUpdateTask = vi.fn(async () => ({ success: true as const }));
        const props = renderMenu({ onUpdateTask });

        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));
        const dialog = screen.getByRole('dialog', { name: 'Due Date' });
        const input = within(dialog).getByLabelText('Due Date');
        fireEvent.change(input, { target: { value: '2026-02-04' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
            expect(onUpdateTask).toHaveBeenCalledWith({ dueDate: '2026-02-04' });
        });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes without saving when Enter is pressed on an unchanged draft', () => {
        const onUpdateTask = vi.fn(async () => ({ success: true as const }));
        const props = renderMenu({ task: { ...task, dueDate: '2026-04-12' }, onUpdateTask });

        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));
        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        fireEvent.keyDown(within(panel).getByLabelText('Due Date'), { key: 'Enter' });

        expect(onUpdateTask).not.toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps a mini-calendar date in the draft until Save', async () => {
        const onUpdateTask = vi.fn(async () => ({ success: true as const }));
        const props = renderMenu({
            task: { ...task, dueDate: '2026-04-12' },
            onUpdateTask,
        });

        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));
        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        fireEvent.focus(within(panel).getByLabelText('Due Date'));
        fireEvent.click(within(panel).getByRole('button', { name: 'Due Date Calendar' }));

        const calendarDay = screen.getByRole('button', { name: /April 19, 2026/i });
        fireEvent.pointerDown(calendarDay);
        fireEvent.click(calendarDay);

        expect(onUpdateTask).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(within(panel).getByLabelText('Due Date')).toHaveValue('04/19/2026');

        fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onUpdateTask).toHaveBeenCalledTimes(1));
        expect(onUpdateTask).toHaveBeenCalledWith({ dueDate: '2026-04-19' });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('uses the configured date format when saving quick action date text', async () => {
        const onUpdateTask = vi.fn(async () => ({ success: true as const }));
        const props = renderMenu({
            task: { ...task, dueDate: '2026-04-12' },
            dateFormatSetting: 'dmy',
            nativeDateInputLocale: 'en-GB-u-fw-mon',
            onUpdateTask,
        });

        fireEvent.click(screen.getByRole('menuitem', { name: 'Due Date…' }));
        const panel = screen.getByRole('dialog', { name: 'Due Date' });
        const input = within(panel).getByLabelText('Due Date') as HTMLInputElement;

        expect(input.value).toBe('12/04/2026');
        fireEvent.change(input, { target: { value: '19/04/2026' } });
        fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(onUpdateTask).toHaveBeenCalledWith({ dueDate: '2026-04-19' });
        });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('focuses the menu container on open, with no item pre-highlighted', () => {
        renderMenu();

        expect(document.activeElement).toBe(screen.getByRole('menu', { name: /more options/i }));
    });

    it('moves between menu items with arrow keys, wrapping at the ends', () => {
        renderMenu();

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Due Date…' }));

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Duplicate' }));

        fireEvent.keyDown(window, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Due Date…' }));

        fireEvent.keyDown(window, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Due Date…' }));
    });

    it('highlights the focused item with a plain focus style, not focus-visible only', () => {
        renderMenu();

        fireEvent.keyDown(window, { key: 'ArrowDown' });
        expect(document.activeElement).toHaveClass('focus:bg-muted');
    });

    it('jumps to the first and last item with Home and End', () => {
        renderMenu();

        fireEvent.keyDown(window, { key: 'End' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));

        fireEvent.keyDown(window, { key: 'Home' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Due Date…' }));
    });

    it('opens the focused submenu panel with ArrowRight and closes it with ArrowLeft', () => {
        renderMenu();

        const dueButton = screen.getByRole('menuitem', { name: 'Due Date…' });
        dueButton.focus();
        fireEvent.keyDown(window, { key: 'ArrowRight' });

        expect(screen.getByRole('dialog', { name: 'Due Date' })).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'ArrowLeft' });

        expect(screen.queryByRole('dialog', { name: 'Due Date' })).not.toBeInTheDocument();
        expect(document.activeElement).toBe(dueButton);
    });

    it('returns focus to the anchoring item when Escape closes a panel', () => {
        renderMenu();

        const dueButton = screen.getByRole('menuitem', { name: 'Due Date…' });
        fireEvent.click(dueButton);
        expect(screen.getByRole('dialog', { name: 'Due Date' })).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.queryByRole('dialog', { name: 'Due Date' })).not.toBeInTheDocument();
        expect(document.activeElement).toBe(dueButton);
    });

    it('skips disabled items when moving focus', () => {
        renderMenu({
            focusAction: {
                isFocused: false,
                canToggle: false,
                label: "Add to today's focus",
                title: 'Clarify first',
                onToggle: vi.fn(),
            },
        });

        fireEvent.keyDown(window, { key: 'Home' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Due Date…' }));
    });

    it('runs the promote-to-project action from the quick menu', () => {
        const onPromoteToProject = vi.fn();
        const props = renderMenu({ onPromoteToProject });

        // The entry wears the shell's plain-language label; the capability is
        // the same promote-to-project action.
        fireEvent.click(screen.getByRole('menuitem', { name: 'Turn into a list' }));

        expect(onPromoteToProject).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('runs the focus action from the quick menu and closes it', () => {
        const onToggle = vi.fn();
        const props = renderMenu({
            focusAction: {
                isFocused: false,
                canToggle: true,
                label: "Add to today's focus",
                title: "Add to today's focus",
                onToggle,
            },
        });

        fireEvent.click(screen.getByRole('menuitem', { name: /add to today's focus/i }));

        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    // Dismissing the menu must not also activate whatever sits underneath. On the
    // calendar that fall-through opened the "add task to calendar" composer as a
    // side effect of closing the menu (#867). Timing is the whole point of this
    // test: `click` only arrives after `mouseup`, a separate user action, so the
    // task queue is allowed to drain in between exactly as a real press does. A
    // version that dispatched mousedown and click back-to-back passed against an
    // implementation that was broken in the browser.
    const withControlUnderneath = async (
        run: (outside: HTMLButtonElement) => Promise<void>,
    ): Promise<ReturnType<typeof vi.fn>> => {
        const underneath = vi.fn();
        const outside = document.createElement('button');
        outside.addEventListener('click', underneath);
        document.body.appendChild(outside);
        try {
            await run(outside);
        } finally {
            outside.remove();
        }
        return underneath;
    };

    it('swallows the click that dismisses it so the control underneath is not activated', async () => {
        const underneath = await withControlUnderneath(async (outside) => {
            const props = renderClosableMenu();

            fireEvent.mouseDown(outside);
            expect(props.onClose).toHaveBeenCalled();

            await new Promise((resolve) => { setTimeout(resolve, 0); });
            fireEvent.click(outside);
        });

        expect(underneath).not.toHaveBeenCalled();
    });

    it('stops swallowing once the press turns into a drag, so a later click still lands', async () => {
        const underneath = await withControlUnderneath(async (outside) => {
            renderClosableMenu();

            fireEvent.mouseDown(outside);
            // No click ever follows a press that became a drag.
            fireEvent.dragStart(outside);

            await new Promise((resolve) => { setTimeout(resolve, 0); });
            fireEvent.click(outside);
        });

        expect(underneath).toHaveBeenCalledTimes(1);
    });

    it('shows disabled focus actions with a reason', () => {
        const onToggle = vi.fn();
        const reason = 'Clarify this task before adding it to Focus.';
        const props = renderMenu({
            focusAction: {
                isFocused: false,
                canToggle: false,
                label: "Add to today's focus",
                title: reason,
                onToggle,
            },
        });

        const focusAction = screen.getByRole('menuitem', { name: /add to today's focus/i });
        expect(focusAction).toBeDisabled();
        expect(focusAction).toHaveAttribute('title', reason);

        fireEvent.click(focusAction);

        expect(onToggle).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
