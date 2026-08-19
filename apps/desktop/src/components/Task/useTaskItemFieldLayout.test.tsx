import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createTaskDraft, type Task, type TaskDraft } from '@tinybubbles/core';

import { DEFAULT_TASK_EDITOR_ORDER } from './task-item-helpers';
import { useTaskItemFieldLayout } from './useTaskItemFieldLayout';

const baseTask: Task = {
    id: 'task-1',
    title: 'Task',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
};

type LayoutParams = Parameters<typeof useTaskItemFieldLayout>[0];

const buildParams = (
    overrides: Partial<Omit<LayoutParams, 'draft'>> & { draft?: Partial<TaskDraft> } = {},
): LayoutParams => {
    const task = overrides.task ?? {
        ...baseTask,
        dueDate: '2026-03-20',
        checklist: [{ id: 'item-1', title: 'Checklist item', isCompleted: false }],
    };
    return {
        settings: overrides.settings ?? {},
        task,
        draft: {
            ...createTaskDraft(task),
            status: 'next',
            priority: 'high',
            contexts: '@home',
            description: 'Reference notes',
            dueDate: '2026-03-20',
            recurrence: 'daily',
            reviewAt: '2026-03-21T09:00',
            startTime: '2026-03-19T09:00',
            tags: '#notes',
            location: 'Office',
            timeEstimate: '30min',
            ...overrides.draft,
        },
        prioritiesEnabled: overrides.prioritiesEnabled ?? true,
        timeEstimatesEnabled: overrides.timeEstimatesEnabled ?? true,
        visibleEditAttachmentsLength: overrides.visibleEditAttachmentsLength ?? 1,
    };
};

describe('useTaskItemFieldLayout', () => {
    it('keeps the default editor shallow while leaving optional metadata hidden until used', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            draft: {
                priority: '',
                energyLevel: '',
                assignedTo: '',
                location: '',
                timeEstimate: '',
            },
        })));

        // The four optional defaults stay shallow, while fixed status remains
        // reachable without requiring a trip to Settings.
        expect(result.current.basicFields).toEqual(expect.arrayContaining(['contexts', 'dueDate']));
        expect(result.current.basicFields).toContain('status');
        expect(result.current.organizationFields).not.toContain('priority');
        expect(result.current.organizationFields).not.toContain('energyLevel');
        expect(result.current.organizationFields).not.toContain('assignedTo');
        expect(result.current.organizationFields).not.toContain('timeEstimate');
        expect(result.current.detailsFields).not.toContain('location');
        expect(result.current.sectionOpenDefaults.details).toBe(false);
    });

    it('hides status when the task editor layout disables it even for non-inbox tasks', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        hidden: ['status'],
                    },
                },
            },
            draft: { status: 'next' },
        })));

        expect(result.current.basicFields).not.toContain('status');
    });

    it('hides every configured field when hidden fields have no task content', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        hidden: [...DEFAULT_TASK_EDITOR_ORDER],
                    },
                },
            },
            task: baseTask,
            draft: {
                status: 'next',
                projectId: '',
                sectionId: '',
                areaId: '',
                priority: '',
                energyLevel: '',
                assignedTo: '',
                contexts: '',
                description: '',
                dueDate: '',
                recurrence: '',
                reviewAt: '',
                startTime: '',
                tags: '',
                location: '',
                timeEstimate: '',
            },
            visibleEditAttachmentsLength: 0,
        })));

        expect(result.current.showProjectField).toBe(false);
        expect(result.current.showAreaField).toBe(false);
        expect(result.current.showSectionField).toBe(false);
        expect(result.current.basicFields).toEqual([]);
        expect(result.current.schedulingFields).toEqual([]);
        expect(result.current.organizationFields).toEqual([]);
        expect(result.current.detailsFields).toEqual([]);
    });

    it('hides action-only fields while a task is being edited as reference', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            draft: { status: 'reference' },
        })));

        // Reference-only action fields stay hidden, but status remains available
        // so the task can be moved out of Reference.
        expect(result.current.basicFields).toContain('status');
        expect(result.current.basicFields).not.toContain('dueDate');
        expect(result.current.schedulingFields).toEqual([]);
        expect(result.current.basicFields).toContain('contexts');
        expect(result.current.organizationFields).toContain('tags');
        expect(result.current.organizationFields).not.toContain('priority');
        expect(result.current.organizationFields).not.toContain('timeEstimate');
        // description and checklist live in the open basic area in the kid
        // shell; checklist is reference-hidden like the other action fields.
        expect(result.current.basicFields).toContain('description');
        expect(result.current.basicFields).not.toContain('checklist');
        expect(result.current.detailsFields).toContain('attachments');
        expect(result.current.detailsFields).not.toContain('description');
    });

    it('uses the draft status rather than the persisted task status for field visibility', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            task: {
                ...baseTask,
                status: 'reference',
                checklist: [{ id: 'item-1', title: 'Checklist item', isCompleted: false }],
            },
            draft: { status: 'next' },
        })));

        expect(result.current.basicFields).toContain('dueDate');
        expect(result.current.schedulingFields).toHaveLength(3);
        expect(result.current.schedulingFields).toEqual(expect.arrayContaining(['startTime', 'recurrence', 'reviewAt']));
        expect(result.current.basicFields).toContain('contexts');
        expect(result.current.organizationFields).toContain('priority');
        expect(result.current.organizationFields).toContain('timeEstimate');
        expect(result.current.basicFields).toContain('checklist');
    });

    it('groups the scheduling dates together above the recurrence editor', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams()));

        expect(result.current.schedulingFields).toEqual(['startTime', 'reviewAt', 'recurrence']);
    });

    it('splits basic fields around the organizer row following the configured order', () => {
        // 'status'/'project'/'area' are hidden by the reduced default visible set
        // unless a saved layout un-hides them (DESIGN.md: "Saved user layouts
        // still win"), so this exercises a saved layout — a custom order plus an
        // explicit empty hidden list — to keep testing the ordering behavior the
        // title describes.
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        order: ['contexts', 'dueDate', 'area', 'project', 'section', 'status'],
                        hidden: [],
                    },
                },
            },
        })));

        expect(result.current.basicFieldsBeforeOrganizers).toEqual(['contexts', 'dueDate']);
        expect(result.current.organizerFields).toEqual(['area', 'project']);
        // Fields absent from the saved order append in default order after it
        // — description and checklist are basic-area fields in the kid shell.
        expect(result.current.basicFieldsAfterOrganizers).toEqual(['status', 'description', 'checklist']);
    });

    it('keeps status reachable by default but trailing the child fields', () => {
        // With zero saved customization, status remains fixed in the editor while
        // the empty-by-default project and area fields stay hidden. The kid
        // shell leads with what a child touches — notes, checklist, due date —
        // and status recedes to the end of the open area.
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams()));

        expect(result.current.basicFields).toContain('status');
        expect(result.current.organizerFields).toEqual([]);
        expect(result.current.basicFieldsBeforeOrganizers).toEqual(['description', 'checklist', 'dueDate', 'contexts', 'status']);
        expect(result.current.basicFieldsAfterOrganizers).toEqual([]);

        // Settings can still re-enable every field (DESIGN.md); once nothing is
        // hidden, the organizer row anchors after the child's fields and
        // status renders below it.
        const { result: revealed } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: { gtd: { taskEditor: { hidden: [] } } },
        })));

        expect(revealed.current.basicFieldsBeforeOrganizers).toEqual(['description', 'checklist', 'dueDate']);
        expect(revealed.current.organizerFields).toEqual(['project', 'area']);
        expect(revealed.current.basicFieldsAfterOrganizers).toEqual(['contexts', 'status']);
        expect(revealed.current.basicFields).toEqual([
            ...revealed.current.basicFieldsBeforeOrganizers,
            ...revealed.current.basicFieldsAfterOrganizers,
        ]);
    });

    it('places every basic field before an empty organizer row', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        hidden: ['project', 'area', 'section'],
                    },
                },
            },
            draft: { projectId: '', sectionId: '', areaId: '' },
            task: baseTask,
        })));

        expect(result.current.organizerFields).toEqual([]);
        expect(result.current.basicFieldsAfterOrganizers).toEqual([]);
        expect(result.current.basicFieldsBeforeOrganizers).toEqual(result.current.basicFields);
    });

    it('reveals the empty assignedTo field while editing a task as waiting (#1021)', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            draft: { status: 'waiting', assignedTo: '' },
        })));

        expect(result.current.organizationFields).toContain('assignedTo');
    });

    it('keeps assignedTo hidden by default for non-waiting statuses when empty', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            draft: { status: 'next', assignedTo: '' },
        })));

        expect(result.current.organizationFields).not.toContain('assignedTo');
    });

    it('keeps assignedTo hidden while waiting when the saved layout explicitly hides it', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        hidden: ['assignedTo'],
                    },
                },
            },
            draft: { status: 'waiting', assignedTo: '' },
        })));

        expect(result.current.organizationFields).not.toContain('assignedTo');
    });

    it('keeps showing assignedTo while waiting once it already has a value', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            draft: { status: 'waiting', assignedTo: 'Sam' },
        })));

        expect(result.current.organizationFields).toContain('assignedTo');
    });

    it('moves due date into scheduling when configured and preserves section open defaults', () => {
        const { result } = renderHook(() => useTaskItemFieldLayout(buildParams({
            settings: {
                gtd: {
                    taskEditor: {
                        sections: {
                            dueDate: 'scheduling',
                        },
                        sectionOpen: {
                            scheduling: true,
                            details: false,
                        },
                    },
                },
            },
        })));

        expect(result.current.basicFields).not.toContain('dueDate');
        expect(result.current.schedulingFields).toContain('dueDate');
        expect(result.current.sectionOpenDefaults).toEqual({
            basic: true,
            scheduling: true,
            organization: false,
            details: false,
        });
    });
});
