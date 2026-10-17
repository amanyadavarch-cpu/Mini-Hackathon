import { describe, expect, it } from 'vitest'
import { toRule, toTransaction, type ApiTransaction } from './api'

const backendTransaction: ApiTransaction = {
  _id: '66f0c0ffee1234567890abcd',
  transactionId: 'TX-TEST-01',
  customerId: 'C-001',
  customerName: 'Alex Morgan',
  accountId: 'ACC-001',
  amount: 6800,
  currency: 'USD',
  merchantName: 'Global Transfers',
  recipientId: 'REC-001',
  channel: 'Bank Transfer',
  transactionType: 'Payment',
  timestamp: '2026-10-17T02:00:00.000Z',
  updatedAt: '2026-10-17T02:00:01.000Z',
  isNewRecipient: true,
  riskScore: 50,
  riskLevel: 'High',
  riskReasons: ['High transaction amount', 'New recipient', 'Unusual UTC hour'],
  status: 'New',
  createdAt: '2026-10-17T02:00:01.000Z',
}

describe('API response adapters', () => {
  it('maps a persisted backend transaction without changing its amount currency or risk decision', () => {
    expect(toTransaction(backendTransaction, ['Reviewed evidence'])).toEqual({
      id: 'TX-TEST-01',
      accountId: 'ACC-001',
      customer: 'Alex Morgan',
      amount: 6800,
      currency: 'USD',
      merchant: 'Global Transfers',
      timestamp: '2026-10-17T02:00:00.000Z',
      updatedAt: '2026-10-17T02:00:01.000Z',
      channel: 'Bank Transfer',
      method: 'Payment',
      riskScore: 50,
      riskLevel: 'High',
      status: 'New',
      reasons: ['High transaction amount', 'New recipient', 'Unusual UTC hour'],
      location: 'Not provided by the transaction API',
      notes: ['Reviewed evidence'],
    })
  })

  it('maps backend rule types to the existing visual rule IDs and keeps backend identifiers', () => {
    expect(toRule({
      _id: '66f0c0ffee1234567890abcd',
      name: 'Rapid activity',
      description: 'Four transactions in ten minutes',
      ruleType: 'rapid_activity',
      weight: 25,
      enabled: false,
    })).toEqual({
      id: 'velocity',
      backendId: '66f0c0ffee1234567890abcd',
      label: 'Rapid activity',
      description: 'Four transactions in ten minutes',
      weight: 25,
      enabled: false,
    })
  })
})
