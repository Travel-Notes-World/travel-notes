import * as migration_20261002_125631_initial from './20261002_125631_initial';
import * as migration_20261008_033441_community from './20261008_033441_community';
import * as migration_20261009_053037_media_storage_columns from './20261009_053037_media_storage_columns';

export const migrations = [
  {
    up: migration_20261002_125631_initial.up,
    down: migration_20261002_125631_initial.down,
    name: '20261002_125631_initial',
  },
  {
    up: migration_20261008_033441_community.up,
    down: migration_20261008_033441_community.down,
    name: '20261008_033441_community',
  },
  {
    up: migration_20261009_053037_media_storage_columns.up,
    down: migration_20261009_053037_media_storage_columns.down,
    name: '20261009_053037_media_storage_columns'
  },
];
