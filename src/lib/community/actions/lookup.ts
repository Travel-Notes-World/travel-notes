'use server'

import { searchDestinations } from '../destinations'
import { hashSubject, hit } from '../ratelimit'
import { clientIp } from '../next/session'

export type DestinationOption = { id: string; label: string; kind: string; timeZone: string | null }

/** Destination suggestions for the picker. Public, read-only, rate-limited per network address. */
export async function findDestinationsAction(query: string): Promise<DestinationOption[]> {
  const ip = await clientIp()
  if (ip && !(await hit('search_ip', hashSubject(ip))).allowed) return []
  const found = await searchDestinations(query, 8)
  return found.map((d) => ({ id: d.id, label: d.label, kind: d.kind, timeZone: d.timeZone }))
}
