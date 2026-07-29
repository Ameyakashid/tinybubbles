import { describe, expect, it } from 'vitest';
import type { Area, Project, Task } from '@mindwtr/core';

import { buildTaskGroupSections, getTaskGroupByLabel, type TaskGroupItem } from './task-group-sections';

// Returns the key unchanged, so tFallback falls through to the English fallback
// and these assertions pin the strings a user actually sees.
const t = (key: string) => key;

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: id,
  status: 'archived',
  tags: [],
  contexts: [],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
} as Task);

const project = (id: string, title: string, overrides: Partial<Project> = {}): Project => ({
  id,
  title,
  status: 'active',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
} as Project);

const area = (id: string, name: string, order: number): Area => ({
  id,
  name,
  order,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
} as Area);

/** Section titles in order, each with the ids that follow it. */
const layout = (items: TaskGroupItem[]) => {
  const out: Array<{ section: string; count: number; ids: string[] }> = [];
  items.forEach((item) => {
    if (item.type === 'section') {
      out.push({ section: item.title, count: item.count, ids: [] });
    } else {
      out[out.length - 1]?.ids.push(item.task.id);
    }
  });
  return out;
};

describe('buildTaskGroupSections', () => {
  it('groups by project, ordering projects by order then title, unassigned first', () => {
    const items = buildTaskGroupSections({
      groupBy: 'project',
      tasks: [task('a', { projectId: 'p2' }), task('b'), task('c', { projectId: 'p1' })],
      areas: [],
      projectById: new Map([
        ['p1', project('p1', 'Zebra', { order: 0 })],
        ['p2', project('p2', 'Alpha', { order: 1 })],
      ]),
      t,
    });

    expect(layout(items)).toEqual([
      { section: 'No project', count: 1, ids: ['b'] },
      { section: 'Zebra', count: 1, ids: ['c'] },
      { section: 'Alpha', count: 1, ids: ['a'] },
    ]);
  });

  it('files a task whose project is missing under no-project rather than dropping it', () => {
    const items = buildTaskGroupSections({
      groupBy: 'project',
      tasks: [task('orphan', { projectId: 'deleted-project' })],
      areas: [],
      projectById: new Map(),
      t,
    });

    expect(layout(items)).toEqual([
      { section: 'No project', count: 1, ids: ['orphan'] },
    ]);
  });

  it('lists a multi-tag task under each of its tags', () => {
    const items = buildTaskGroupSections({
      groupBy: 'tag',
      tasks: [task('both', { tags: ['beta', 'alpha'] }), task('none')],
      areas: [],
      projectById: new Map(),
      t,
    });

    expect(layout(items)).toEqual([
      { section: 'No tags', count: 1, ids: ['none'] },
      { section: 'alpha', count: 1, ids: ['both'] },
      { section: 'beta', count: 1, ids: ['both'] },
    ]);
  });

  it('groups by area, falling back to the project area and then to General', () => {
    const items = buildTaskGroupSections({
      groupBy: 'area',
      tasks: [
        task('direct', { areaId: 'a1' }),
        task('viaProject', { projectId: 'p1' }),
        task('loose'),
        task('staleArea', { areaId: 'deleted-area' }),
      ],
      areas: [area('a1', 'Work', 0)],
      projectById: new Map([['p1', project('p1', 'Proj', { areaId: 'a1' })]]),
      t,
    });

    // A task pointing at an area that no longer exists lands in General rather
    // than creating a phantom section or vanishing.
    expect(layout(items)).toEqual([
      { section: 'General', count: 2, ids: ['loose', 'staleArea'] },
      { section: 'Work', count: 2, ids: ['direct', 'viaProject'] },
    ]);
  });

  it('buckets by completion date against the supplied clock', () => {
    const now = new Date('2026-05-12T12:00:00.000Z');
    const items = buildTaskGroupSections({
      groupBy: 'completedDate',
      tasks: [
        task('today', { completedAt: '2026-05-12T09:00:00.000Z' }),
        task('old', { completedAt: '2026-01-02T09:00:00.000Z' }),
        task('never'),
      ],
      areas: [],
      projectById: new Map(),
      t,
      now,
    });

    const sections = layout(items);
    expect(sections.map((section) => section.section)).toContain('Today');
    expect(sections.find((section) => section.section === 'Today')?.ids).toEqual(['today']);
    expect(sections.find((section) => section.section === 'Earlier')?.ids).toEqual(['old']);
    expect(sections.find((section) => section.section === 'Not completed')?.ids).toEqual(['never']);
  });

  it('drops empty groups so no header is ever left without rows', () => {
    const items = buildTaskGroupSections({
      groupBy: 'area',
      tasks: [task('only', { areaId: 'a1' })],
      areas: [area('a1', 'Work', 0), area('a2', 'Empty', 1)],
      projectById: new Map(),
      t,
    });

    expect(layout(items).map((section) => section.section)).toEqual(['Work']);
    expect(items.every((item) => item.type !== 'section' || item.count > 0)).toBe(true);
  });

  it('preserves the incoming task order within a group', () => {
    const items = buildTaskGroupSections({
      groupBy: 'area',
      tasks: [task('third'), task('first'), task('second')],
      areas: [],
      projectById: new Map(),
      t,
    });

    expect(layout(items)[0]?.ids).toEqual(['third', 'first', 'second']);
  });
});

describe('getTaskGroupByLabel', () => {
  it('labels every axis the group control offers', () => {
    expect(getTaskGroupByLabel('none', t)).toBe('No grouping');
    expect(getTaskGroupByLabel('area', t)).toBe('Area');
    expect(getTaskGroupByLabel('project', t)).toBe('Project');
    expect(getTaskGroupByLabel('tag', t)).toBe('Tags');
    expect(getTaskGroupByLabel('completedDate', t)).toBe('Completion date');
  });
});
