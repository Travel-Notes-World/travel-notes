import * as migration_20261002_125631_initial from './20261002_125631_initial';
import * as migration_20261008_033441_community from './20261008_033441_community';
import * as migration_20261009_053037_media_storage_columns from './20261009_053037_media_storage_columns';
import * as migration_20261009_085007_member_support_actions from './20261009_085007_member_support_actions';
import * as migration_20261009_100426_contact_messages from './20261009_100426_contact_messages';
import * as migration_20261009_133919_staff_two_factor from './20261009_133919_staff_two_factor';
import * as migration_20261009_144120_article_travel_styles from './20261009_144120_article_travel_styles';
import * as migration_20261009_150327_newsletter_subscribers from './20261009_150327_newsletter_subscribers';
import * as migration_20261009_152739_redirects from './20261009_152739_redirects';
import * as migration_20261009_160847_article_search from './20261009_160847_article_search';
import * as migration_20261009_163759_travel_updates from './20261009_163759_travel_updates';
import * as migration_20261010_062047_scheduled_publishing from './20261010_062047_scheduled_publishing';
import * as migration_20261010_083000_search_trigram from './20261010_083000_search_trigram';
import * as migration_20261011_074339_destination_pages from './20261011_074339_destination_pages';
import * as migration_20261011_083215_guide_photos_sources from './20261011_083215_guide_photos_sources';
import * as migration_20261012_044025_smart_publish from './20261012_044025_smart_publish';
import * as migration_20261012_045421_report_sexual_content from './20261012_045421_report_sexual_content';
import * as migration_20261012_062418_paid_listings from './20261012_062418_paid_listings';
import * as migration_20261012_233814_reply_likes from './20261012_233814_reply_likes';
import * as migration_20261013_000421_reply_love from './20261013_000421_reply_love';
import * as migration_20261013_015441_trip_planner from './20261013_015441_trip_planner';

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
    up: migration_20261009_085007_member_support_actions.up,
    down: migration_20261009_085007_member_support_actions.down,
    name: '20261009_085007_member_support_actions',
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
    up: migration_20261009_150327_newsletter_subscribers.up,
    down: migration_20261009_150327_newsletter_subscribers.down,
    name: '20261009_150327_newsletter_subscribers',
  },
  {
    up: migration_20261009_152739_redirects.up,
    down: migration_20261009_152739_redirects.down,
    name: '20261009_152739_redirects',
  },
  {
    up: migration_20261009_160847_article_search.up,
    down: migration_20261009_160847_article_search.down,
    name: '20261009_160847_article_search',
  },
  {
    up: migration_20261009_163759_travel_updates.up,
    down: migration_20261009_163759_travel_updates.down,
    name: '20261009_163759_travel_updates',
  },
  {
    up: migration_20261010_062047_scheduled_publishing.up,
    down: migration_20261010_062047_scheduled_publishing.down,
    name: '20261010_062047_scheduled_publishing',
  },
  {
    up: migration_20261010_083000_search_trigram.up,
    down: migration_20261010_083000_search_trigram.down,
    name: '20261010_083000_search_trigram',
  },
  {
    up: migration_20261011_074339_destination_pages.up,
    down: migration_20261011_074339_destination_pages.down,
    name: '20261011_074339_destination_pages',
  },
  {
    up: migration_20261011_083215_guide_photos_sources.up,
    down: migration_20261011_083215_guide_photos_sources.down,
    name: '20261011_083215_guide_photos_sources',
  },
  {
    up: migration_20261012_044025_smart_publish.up,
    down: migration_20261012_044025_smart_publish.down,
    name: '20261012_044025_smart_publish',
  },
  {
    up: migration_20261012_045421_report_sexual_content.up,
    down: migration_20261012_045421_report_sexual_content.down,
    name: '20261012_045421_report_sexual_content',
  },
  {
    up: migration_20261012_062418_paid_listings.up,
    down: migration_20261012_062418_paid_listings.down,
    name: '20261012_062418_paid_listings',
  },
  {
    up: migration_20261012_233814_reply_likes.up,
    down: migration_20261012_233814_reply_likes.down,
    name: '20261012_233814_reply_likes',
  },
  {
    up: migration_20261013_000421_reply_love.up,
    down: migration_20261013_000421_reply_love.down,
    name: '20261013_000421_reply_love',
  },
  {
    up: migration_20261013_015441_trip_planner.up,
    down: migration_20261013_015441_trip_planner.down,
    name: '20261013_015441_trip_planner'
  },
];
