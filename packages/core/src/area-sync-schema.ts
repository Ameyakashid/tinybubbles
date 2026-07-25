import schemaFixture from './area-sync-schema.fixture.json';
import type { Area } from './types';
import {
    deriveSqliteColumnEntries,
    sqliteColumnsFromEntries,
    sqliteMigrationColumnsFromEntries,
    type EntityCloudWriteSemantics,
    type EntityFieldNullability,
    type EntitySqliteColumnType,
} from './entity-sync-schema';

export type AreaSyncFieldSpec = {
    name: keyof Area;
    nullability: EntityFieldNullability;
    cloudSynced: boolean;
    cloudWrite: EntityCloudWriteSemantics;
    sqliteColumn: string | null;
    sqliteOrder: number | null;
    sqliteType: EntitySqliteColumnType | null;
};

type AreaSyncSchemaFixture = {
    schemaVersion: number;
    fields: AreaSyncFieldSpec[];
    fixture: Area;
};

const schema = schemaFixture as AreaSyncSchemaFixture;

export const AREA_SYNC_SCHEMA_VERSION = schema.schemaVersion;
export const AREA_SYNC_FIELD_SCHEMA: readonly AreaSyncFieldSpec[] = schema.fields;
export const AREA_SYNC_SCHEMA_FIXTURE: Area = schema.fixture;

// Generated SQLite column list + ensureAreaColumns migration list — see the equivalent
// comment in project-sync-schema.ts for why this lives here rather than sqlite-adapter.ts.
const AREA_SQLITE_COLUMN_ENTRIES = deriveSqliteColumnEntries(AREA_SYNC_FIELD_SCHEMA, 'area-sync-schema');

export const AREA_SQLITE_COLUMNS: readonly string[] = sqliteColumnsFromEntries(AREA_SQLITE_COLUMN_ENTRIES);
export const AREA_SQLITE_MIGRATION_COLUMNS = sqliteMigrationColumnsFromEntries(AREA_SQLITE_COLUMN_ENTRIES, 'areas');
