import { AiPreviews, AiRuns } from './AiRuns'
import { Contributions } from './Contributions'
import { ListingPayments } from './ListingPayments'
import { Bookmarks, Follows, Plans, Rsvps, Votes } from './Engagement'
import { Media } from './Media'
import { Members } from './Members'
import { EmailOutbox, Notifications } from './Messaging'
import { DestinationSuggestions, ModerationActions, Reports, Revisions } from './Moderation'
import { Replies } from './Replies'
import { JobRuns, MetricCounters, RateLimits } from './System'

export const communityCollections = [
  Members, Contributions, Replies, Revisions, Media, Votes, Bookmarks, Follows, Rsvps, Plans,
  Reports, ModerationActions, DestinationSuggestions, Notifications, EmailOutbox, RateLimits, MetricCounters, JobRuns,
  ListingPayments, AiRuns, AiPreviews,
]
