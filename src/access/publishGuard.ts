import type { CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'
import { Forbidden } from 'payload'

import { hasRole } from './roles'

/**
 * Only publishers and administrators may change what the public sees.
 *
 * Runs before every write operation, on the REST API, the admin panel and any
 * Local API call made with `overrideAccess: false`. For staff below publisher:
 *  - a request to publish is rejected;
 *  - every other save is forced to be a draft save, so it is stored as a new
 *    draft version and can never change or withdraw the published revision.
 *
 * Trusted server code that calls the Local API with `overrideAccess: true`
 * (the default) is not restricted here; such code must live in narrow,
 * reviewed wrappers (implementation plan §5).
 */
export const draftOnlyBelowPublisher: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  const isWrite =
    operation === 'create' ||
    operation === 'update' ||
    operation === 'updateByID' ||
    operation === 'restoreVersion'
  if (!isWrite) return args

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args differ per operation
  const a = args as any
  if (a.overrideAccess === true) return args
  if (hasRole(req, 'publisher')) return args

  if (a.data?._status === 'published') {
    throw new Forbidden(req.t)
  }
  // Payload reads the draft flag for a version restore before this hook runs, so it cannot be
  // forced here. A restore is only allowed when it was already requested as "restore as draft";
  // a plain restore would overwrite or withdraw the published revision.
  if (operation === 'restoreVersion' && a.draft !== true) {
    throw new Forbidden(req.t)
  }
  a.draft = true
  if (a.publishAllLocales) a.publishAllLocales = false
  if (a.unpublishAllLocales) a.unpublishAllLocales = false
  return a
}

/**
 * Backstop for the guard above: a signed-in staff member below publisher can
 * never store a document with published status, whichever path the write took.
 */
export const blockPublishBelowPublisher: CollectionBeforeChangeHook = ({ data, req }) => {
  if (req.user && data?._status === 'published' && !hasRole(req, 'publisher')) {
    throw new Forbidden(req.t)
  }
  return data
}
