import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PHONE_PROVIDER_CHAIN } from '../../phoneProviders/registry'
import { FetchFunction } from '../../phoneProviders/runProviderLookup'
import {
  createPhoneEnrichmentActivities,
  createPhoneLookupActivity,
  toPhoneEnrichmentUpdate,
} from './phoneEnrichment'

const enrichedAt = new Date('2026-11-21T10:00:00Z')
const lead = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO' }

describe('createPhoneLookupActivity', () => {
  it('calls the provider with its own key and aborts before the attempt timeout', async () => {
    const astraStep = PHONE_PROVIDER_CHAIN[1]
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetchFunction: FetchFunction = vi.fn(async () => Response.json({ phoneNmbr: '2502843895' }))
    const settings = { apiKey: 'fake-astra-key', baseUrl: 'https://astra.test/astraDialer' }

    const result = await createPhoneLookupActivity(astraStep, settings, fetchFunction)(lead)

    expect(result).toEqual({ status: 'found', phone: '2502843895' })
    expect(vi.mocked(fetchFunction).mock.calls[0][1]?.headers).toMatchObject({ apiKey: 'fake-astra-key' })
    expect(timeout).toHaveBeenCalledWith(astraStep.attemptTimeoutMs - 500)
  })
})

describe('toPhoneEnrichmentUpdate', () => {
  it('stores the phone, the provider, and the country code of a found phone', () => {
    const update = toPhoneEnrichmentUpdate(
      { status: 'found', phone: '8173646528', countryCode: 'ES', provider: 'nimbusLookup' },
      enrichedAt
    )

    expect(update).toEqual({
      phoneEnrichmentStatus: 'found',
      phoneNumber: '8173646528',
      phoneProvider: 'nimbusLookup',
      phoneCountryCode: 'ES',
      phoneEnrichedAt: enrichedAt,
    })
  })

  it.each(['not_found', 'failed'] as const)('stores only the status and the time for %s', (status) => {
    expect(toPhoneEnrichmentUpdate({ status }, enrichedAt)).toEqual({
      phoneEnrichmentStatus: status,
      phoneProvider: null,
      phoneCountryCode: null,
      phoneEnrichedAt: enrichedAt,
    })
  })
})

describe('createPhoneEnrichmentActivities', () => {
  it('updates the lead by id with updateMany, so a deleted lead does not fail the save', async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }))
    const prisma = { lead: { updateMany } } as unknown as PrismaClient

    await createPhoneEnrichmentActivities(prisma).savePhoneEnrichment(7, { status: 'not_found' })

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ phoneEnrichmentStatus: 'not_found' }),
    })
  })
})
