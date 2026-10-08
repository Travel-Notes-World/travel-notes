import 'server-only'

import { unstable_rethrow } from 'next/navigation'

import { isCommunityError, type FieldErrors } from '../errors'

/**
 * What a form action returns to the page. On a validation error the submitted values are sent
 * back so the form can show them again: nothing the member typed is lost.
 */
export type ActionState = {
  ok?: boolean
  message?: string
  code?: string
  fields?: FieldErrors
  values?: Record<string, unknown>
  data?: Record<string, unknown>
}

/** Turn a service error into a message for the member. Unexpected errors are logged, never shown in detail. */
export function toState(error: unknown, values?: Record<string, unknown>): ActionState {
  unstable_rethrow(error)
  if (isCommunityError(error)) {
    const message = error.code === 'auth' ? 'Your session has ended. Sign in again in a new tab, then come back and press the button again. Your text is still here.' : error.message
    return { ok: false, code: error.code, message, fields: error.fields, values }
  }
  console.error('[community] action failed', error)
  return { ok: false, code: 'error', message: 'Something went wrong on our side. Your text is still here; please try again in a moment.', values }
}

export const str = (form: FormData, key: string): string => {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}
export const bool = (form: FormData, key: string): boolean => {
  const value = form.get(key)
  return value === 'on' || value === 'true' || value === '1'
}
export const strings = (form: FormData, key: string): string[] => form.getAll(key).filter((v): v is string => typeof v === 'string' && v.length > 0)
/** A JSON field written by a client-side editor (costs, itinerary days). Anything unparsable is treated as empty. */
export const json = (form: FormData, key: string): unknown => {
  try {
    return JSON.parse(str(form, key) || 'null')
  } catch {
    return null
  }
}

/** All plain text fields of a form as an object, for sending back after a validation error. */
export function formValues(form: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    if (key.startsWith('$ACTION') || typeof value !== 'string' || key === 'password' || key.toLowerCase().includes('password')) continue
    if (key in values) values[key] = ([] as unknown[]).concat(values[key], value)
    else values[key] = value
  }
  return values
}
