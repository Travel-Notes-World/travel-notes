import * as migration_20261002_125631_initial from './20261002_125631_initial';
import * as migration_20261008_033441_community from './20261008_033441_community';
import * as migration_20261009_085007_member_support_actions from './20261009_085007_member_support_actions';

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
    up: migration_20261009_085007_member_support_actions.up,
    down: migration_20261009_085007_member_support_actions.down,
    name: '20261009_085007_member_support_actions'
  },
];
