import * as migration_20261002_125631_initial from './20261002_125631_initial';

export const migrations = [
  {
    up: migration_20261002_125631_initial.up,
    down: migration_20261002_125631_initial.down,
    name: '20261002_125631_initial'
  },
];
