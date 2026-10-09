import * as migration_20261002_125631_initial from './20261002_125631_initial';
import * as migration_20261008_033441_community from './20261008_033441_community';
import * as migration_20261009_053037_media_storage_columns from './20261009_053037_media_storage_columns';
import * as migration_20261009_100426_contact_messages from './20261009_100426_contact_messages';
import * as migration_20261009_133919_staff_two_factor from './20261009_133919_staff_two_factor';
import * as migration_20261009_144120_article_travel_styles from './20261009_144120_article_travel_styles';
import * as migration_20261009_152051_redirects from './20261009_152051_redirects';

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
    name: '20261009_053037_media_storage_columns',
  },
  {
    up: migration_20261009_100426_contact_messages.up,
    down: migration_20261009_100426_contact_messages.down,
    name: '20261009_100426_contact_messages',
  },
  {
    up: migration_20261009_133919_staff_two_factor.up,
    down: migration_20261009_133919_staff_two_factor.down,
    name: '20261009_133919_staff_two_factor',
  },
  {
    up: migration_20261009_144120_article_travel_styles.up,
    down: migration_20261009_144120_article_travel_styles.down,
    name: '20261009_144120_article_travel_styles',
  },
  {
    up: migration_20261009_152051_redirects.up,
    down: migration_20261009_152051_redirects.down,
    name: '20261009_152051_redirects'
  },
];
