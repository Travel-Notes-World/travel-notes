/** Error codes a member can be shown. Anything else is a bug and is reported as a generic failure. */
export type CommunityErrorCode =
  | 'auth' // not signed in, or the session has expired
  | 'forbidden' // signed in, but not allowed to do this
  | 'validation' // the input is wrong; see `fields`
  | 'not_found'
  | 'rate_limited'
  | 'conflict' // the item is not in a state that allows this
  | 'closed' // the community, sign-ups or submissions are switched off
  | 'unavailable' // a required service (email, photo storage) is not configured

export type FieldErrors = Record<string, string>

export class CommunityError extends Error {
  code: CommunityErrorCode
  fields?: FieldErrors
  constructor(code: CommunityErrorCode, message: string, fields?: FieldErrors) {
    super(message)
    this.name = 'CommunityError'
    this.code = code
    this.fields = fields
  }
}

export const fail = (code: CommunityErrorCode, message: string, fields?: FieldErrors): never => {
  throw new CommunityError(code, message, fields)
}

export const invalid = (fields: FieldErrors, message = 'Please check the highlighted fields.'): never => {
  throw new CommunityError('validation', message, fields)
}

export const isCommunityError = (error: unknown): error is CommunityError =>
  error instanceof CommunityError || (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'CommunityError')
