import { describe, expect, test } from 'bun:test';
import { dirname } from 'path';
import {
    durablyPublishFile,
    type DurableFileSystem,
} from './server-storage';

type FailureStage =
    | 'open-temp'
    | 'write-temp'
    | 'fsync-temp'
    | 'close-temp'
    | 'rename'
    | 'open-parent'
    | 'fsync-parent'
    | 'close-parent';

function createDurableFileSystem(failureStage?: FailureStage) {
    const events: FailureStage[] = [];
    const files = new Map<string, string>([['/cloud/data.json', 'old']]);
    const handles = new Map<number, { kind: 'temp' | 'parent'; path: string }>();
    let nextHandle = 1;

    const enter = (stage: FailureStage): void => {
        events.push(stage);
        if (failureStage === stage) {
            throw new Error(`injected ${stage} failure`);
        }
    };

    const fileSystem: DurableFileSystem = {
        openSync(path, flags, mode) {
            const kind = flags === 'wx' ? 'temp' : 'parent';
            enter(kind === 'temp' ? 'open-temp' : 'open-parent');
            if (kind === 'temp') {
                expect(mode).toBe(0o600);
                if (files.has(path)) throw new Error('exclusive create collision');
                files.set(path, '');
            } else {
                expect(path).toBe(dirname('/cloud/data.json'));
            }
            const handle = nextHandle++;
            handles.set(handle, { kind, path });
            return handle;
        },
        writeFileSync(handle, data) {
            enter('write-temp');
            const openHandle = handles.get(handle);
            if (!openHandle || openHandle.kind !== 'temp') throw new Error('invalid temp handle');
            files.set(openHandle.path, typeof data === 'string' ? data : new TextDecoder().decode(data));
        },
        fsyncSync(handle) {
            const openHandle = handles.get(handle);
            if (!openHandle) throw new Error('invalid sync handle');
            enter(openHandle.kind === 'temp' ? 'fsync-temp' : 'fsync-parent');
        },
        closeSync(handle) {
            const openHandle = handles.get(handle);
            if (!openHandle) throw new Error('invalid close handle');
            enter(openHandle.kind === 'temp' ? 'close-temp' : 'close-parent');
            handles.delete(handle);
        },
        renameSync(source, destination) {
            enter('rename');
            const contents = files.get(source);
            if (contents === undefined) throw new Error('missing temp file');
            files.set(destination, contents);
            files.delete(source);
        },
        existsSync(path) {
            return files.has(path);
        },
        unlinkSync(path) {
            files.delete(path);
        },
    };

    return { events, fileSystem, files };
}

describe('durablyPublishFile', () => {
    test('syncs the temporary file and parent directory before acknowledging success', () => {
        const harness = createDurableFileSystem();

        expect(durablyPublishFile('/cloud/data.json', 'new', {
            fileSystem: harness.fileSystem,
            tempName: '.data.json.test.tmp',
        })).toBe(true);

        expect(harness.events).toEqual([
            'open-temp',
            'write-temp',
            'fsync-temp',
            'close-temp',
            'rename',
            'open-parent',
            'fsync-parent',
            'close-parent',
        ]);
        expect(harness.files.get('/cloud/data.json')).toBe('new');
        expect([...harness.files.keys()].filter((path) => path.endsWith('.tmp'))).toEqual([]);
    });

    for (const failureStage of [
        'open-temp',
        'write-temp',
        'fsync-temp',
        'close-temp',
        'rename',
        'open-parent',
        'fsync-parent',
        'close-parent',
    ] satisfies FailureStage[]) {
        test(`does not acknowledge success when ${failureStage} fails`, () => {
            const harness = createDurableFileSystem(failureStage);

            expect(() => durablyPublishFile('/cloud/data.json', 'new', {
                fileSystem: harness.fileSystem,
                tempName: '.data.json.test.tmp',
            })).toThrow(`injected ${failureStage} failure`);

            const publicationCompleted = failureStage === 'open-parent'
                || failureStage === 'fsync-parent'
                || failureStage === 'close-parent';
            expect(harness.files.get('/cloud/data.json')).toBe(publicationCompleted ? 'new' : 'old');
            expect([...harness.files.keys()].filter((path) => path.endsWith('.tmp'))).toEqual([]);
        });
    }

    test('aborts and cleans the temp file when the pre-publication safety check fails', () => {
        const harness = createDurableFileSystem();

        expect(durablyPublishFile('/cloud/data.json', 'new', {
            beforeRename: () => false,
            fileSystem: harness.fileSystem,
            tempName: '.data.json.test.tmp',
        })).toBe(false);

        expect(harness.events).toEqual([
            'open-temp',
            'write-temp',
            'fsync-temp',
            'close-temp',
        ]);
        expect(harness.files.get('/cloud/data.json')).toBe('old');
        expect([...harness.files.keys()].filter((path) => path.endsWith('.tmp'))).toEqual([]);
    });
});
