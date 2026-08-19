/**
 * Root of the rebuilt kid face (owner directive #23).
 *
 * THIS PAGE IS SCAFFOLDING. Everything below the runtime hook is a deliberately
 * unstyled proof that the contract works - live tasks in, add/complete out,
 * sync running. The design agent commissioned to build the real face should
 * delete the markup wholesale and keep only useKidFaceRuntime().
 * The contract is documented in apps/desktop/KID-FACE-CONTRACT.md.
 */
import { useMemo, useState } from 'react';
import { useTaskStore } from '@tinybubbles/core';
import { useKidFaceRuntime } from './runtime';

export function KidFaceApp() {
    const { hydrated, lastSyncError, requestSync } = useKidFaceRuntime();
    const tasks = useTaskStore((state) => state.tasks);
    const addTask = useTaskStore((state) => state.addTask);
    const updateTask = useTaskStore((state) => state.updateTask);
    const [draft, setDraft] = useState('');

    const openTasks = useMemo(
        () => tasks.filter((t) => !t.deletedAt && t.status !== 'done' && t.status !== 'archived'),
        [tasks],
    );
    const doneTasks = useMemo(() => tasks.filter((t) => !t.deletedAt && t.status === 'done'), [tasks]);

    if (!hydrated) return <main style={{ padding: 24 }}>Loading…</main>;

    return (
        <main style={{ padding: 24, maxWidth: 560, margin: '0 auto', fontFamily: 'inherit' }}>
            <h1>Kid face scaffold</h1>
            <p style={{ opacity: 0.7 }}>
                Proof page: same live data and sync as the stock shell on this origin.
                {lastSyncError ? ` Sync error: ${lastSyncError}` : ''}
            </p>
            <button type="button" onClick={requestSync}>Sync now</button>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    const title = draft.trim();
                    if (!title) return;
                    void addTask(title);
                    setDraft('');
                }}
            >
                <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Add something…"
                    aria-label="Add task"
                />
                <button type="submit">Add</button>
            </form>
            <h2>To do ({openTasks.length})</h2>
            <ul>
                {openTasks.map((task) => (
                    <li key={task.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={false}
                                onChange={() => void updateTask(task.id, { status: 'done' })}
                            />
                            {' '}{task.title}
                        </label>
                    </li>
                ))}
            </ul>
            <h2>Done ({doneTasks.length})</h2>
            <ul>
                {doneTasks.map((task) => (
                    <li key={task.id} style={{ opacity: 0.6 }}>{task.title}</li>
                ))}
            </ul>
        </main>
    );
}
