// Consolidation-law guard: TASK_RECURRENCE_INPUT_FIELD_KEYS (the key set of
// recurrenceObjectSchema, the zod object mindwtr_add_task/mindwtr_update_task's recurrence
// input actually validates against) must still equal the 14-key list
// packages/core/src/task-recurrence-fields.ts now shares with
// apps/cloud/src/server-validation.ts's CLOUD_RECURRENCE_ALLOWED_KEYS (the same list, verbatim
// — see that file). The literal below stays PINNED on purpose (consolidation law: a test
// importing the same shared list on both sides would shrink in lockstep with it); the
// second assertion ties the shared core list to the same pin.
import { describe, expect, test } from 'bun:test';

import { TASK_RECURRENCE_FIELD_KEYS } from '@mindwtr/core';

import { TASK_RECURRENCE_INPUT_FIELD_KEYS } from './input-validation.js';

// Mutation-test evidence: temporarily dropping 'rrule' from
// input-validation.ts's recurrenceObjectSchema while developing this test made the assertion
// below fail as expected; reverted before landing.
const PINNED_RECURRENCE_FIELD_KEYS = [
  'rule', 'seriesId', 'strategy', 'byDay', 'byMonthDay', 'weekStart', 'count', 'until',
  'completedOccurrences', 'anchorDay', 'startAnchorDay', 'dueAnchorDay', 'reviewAnchorDay',
  'rrule',
];

describe('recurrence field-key consolidation (single shared list, two consumers)', () => {
  test("mindwtr_add_task/mindwtr_update_task's recurrence object schema exposes exactly the shared 14-key set", () => {
    expect([...TASK_RECURRENCE_INPUT_FIELD_KEYS].sort()).toEqual([...PINNED_RECURRENCE_FIELD_KEYS].sort());
  });

  test("core's shared TASK_RECURRENCE_FIELD_KEYS matches the same pinned list", () => {
    expect([...TASK_RECURRENCE_FIELD_KEYS].sort()).toEqual([...PINNED_RECURRENCE_FIELD_KEYS].sort());
  });
});
