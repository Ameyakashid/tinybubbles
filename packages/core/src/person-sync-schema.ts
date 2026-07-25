import schemaFixture from './person-sync-schema.fixture.json';
import type { Person } from './types';
import {
    deriveSqliteColumnEntries,
    sqliteColumnsFromEntries,
    sqliteMigrationColumnsFromEntries,
    type EntityCloudWriteSemantics,
    type EntityFieldNullability,
    type EntitySqliteColumnType,
} from './entity-sync-schema';

export type PersonSyncFieldSpec = {
    name: keyof Person;
    nullability: EntityFieldNullability;
    cloudSynced: boolean;
    cloudWrite: EntityCloudWriteSemantics;
    sqliteColumn: string | null;
    sqliteOrder: number | null;
    sqliteType: EntitySqliteColumnType | null;
};

type PersonSyncSchemaFixture = {
    schemaVersion: number;
    fields: PersonSyncFieldSpec[];
    fixture: Person;
};

const schema = schemaFixture as PersonSyncSchemaFixture;

export const PERSON_SYNC_SCHEMA_VERSION = schema.schemaVersion;
export const PERSON_SYNC_FIELD_SCHEMA: readonly PersonSyncFieldSpec[] = schema.fields;
export const PERSON_SYNC_SCHEMA_FIXTURE: Person = schema.fixture;

// Generated SQLite column list + ensurePeopleTable migration list — see the equivalent
// comment in project-sync-schema.ts for why this lives here rather than sqlite-adapter.ts.
const PERSON_SQLITE_COLUMN_ENTRIES = deriveSqliteColumnEntries(PERSON_SYNC_FIELD_SCHEMA, 'person-sync-schema');

export const PERSON_SQLITE_COLUMNS: readonly string[] = sqliteColumnsFromEntries(PERSON_SQLITE_COLUMN_ENTRIES);
export const PERSON_SQLITE_MIGRATION_COLUMNS = sqliteMigrationColumnsFromEntries(PERSON_SQLITE_COLUMN_ENTRIES, 'people');
