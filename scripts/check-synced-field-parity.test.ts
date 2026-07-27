import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

// This script is a CLI entry point (top-level code runs the whole check suite
// and may call process.exit), not a library, so it can't be imported directly
// in a test. Mirrors scripts/mindwtr-cli.test.ts: spawn the real script and
// assert on exit code + output instead.
const REPO_ROOT = join(import.meta.dir, '..');
const SCHEMA_PATH = join(REPO_ROOT, 'packages/core/src/cloudkit-production-schema.json');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/check-synced-field-parity.ts');
const BUN_BIN = Bun.which('bun') || process.execPath;

const originalSchema = readFileSync(SCHEMA_PATH, 'utf8');
type ProductionRecord = { deployed: string[]; pendingProduction: string[] };
type ProductionSchema = { records: Record<string, ProductionRecord> };

// Safety net: restore the real, checked-in schema file even if a test throws
// before its own try/finally runs.
afterEach(() => {
    writeFileSync(SCHEMA_PATH, originalSchema);
});

const runCheck = (args: string[] = []) => (
    spawnSync(BUN_BIN, ['run', SCRIPT_PATH, ...args], { cwd: REPO_ROOT, encoding: 'utf8' })
);

const runCheckWithSchema = (schema: unknown, args: string[] = []) => {
    writeFileSync(SCHEMA_PATH, JSON.stringify(schema, null, 4) + '\n');
    try {
        return runCheck(args);
    } finally {
        writeFileSync(SCHEMA_PATH, originalSchema);
    }
};

const parseSchema = (): ProductionSchema => JSON.parse(originalSchema);

const markAllDeployed = (schema: ProductionSchema) => {
    for (const record of Object.values(schema.records)) {
        record.deployed = [...record.deployed, ...record.pendingProduction];
        record.pendingProduction = [];
    }
};

describe('CloudKit production schema gate', () => {
    test('passes on the current repo state without --release-gate', () => {
        const result = runCheck();
        expect(result.status).toBe(0);
    });

    test('fails when a CloudKit-mapped field is listed in neither deployed nor pendingProduction', () => {
        const schema = parseSchema();
        schema.records.MindwtrTask.deployed = schema.records.MindwtrTask.deployed.filter((key) => key !== 'title');
        const result = runCheckWithSchema(schema);
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain('missing from both lists');
        expect(result.stdout + result.stderr).toContain('MindwtrTask.title');
    });

    test('fails when a key is listed in both deployed and pendingProduction', () => {
        const schema = parseSchema();
        schema.records.MindwtrTask.pendingProduction.push('title');
        const result = runCheckWithSchema(schema);
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain('listed in both deployed and pendingProduction');
    });

    test('fails when a listed key no longer exists in its CloudKit record schema', () => {
        const schema = parseSchema();
        schema.records.MindwtrPerson.deployed.push('notARealCloudKitKey');
        const result = runCheckWithSchema(schema);
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain('stale');
        expect(result.stdout + result.stderr).toContain('MindwtrPerson.notARealCloudKitKey');
    });

    test('requires every synced CloudKit record type to be classified', () => {
        const schema = parseSchema();
        delete schema.records.MindwtrArea;
        const result = runCheckWithSchema(schema);
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain('missing record type MindwtrArea');
    });

    test('keeps unverified project taskSortBy pending Production deployment', () => {
        const schema = parseSchema();
        expect(schema.records.MindwtrProject.deployed).not.toContain('taskSortBy');
        expect(schema.records.MindwtrProject.pendingProduction).toContain('taskSortBy');
    });

    test('--release-gate fails while pendingProduction is non-empty', () => {
        const schema = parseSchema();
        markAllDeployed(schema);
        schema.records.MindwtrTask.deployed = schema.records.MindwtrTask.deployed.filter((key) => key !== 'title');
        schema.records.MindwtrTask.pendingProduction.push('title');
        const result = runCheckWithSchema(schema, ['--release-gate']);
        expect(result.status).toBe(1);
        expect(result.stdout + result.stderr).toContain('pending Production deployment');
        expect(result.stdout + result.stderr).toContain('MindwtrTask.title');
    });

    test('--release-gate passes once pendingProduction is empty', () => {
        const schema = parseSchema();
        markAllDeployed(schema);
        const result = runCheckWithSchema(schema, ['--release-gate']);
        expect(result.status).toBe(0);
    });
});
