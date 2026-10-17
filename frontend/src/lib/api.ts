import type { InvestigationStatus, RiskLevel, ScoringRule, Transaction } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1').replace(/\/+$/, '')
const TOKEN_KEY = 'fraud-radar-access-token'

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'analyst' | 'viewer'
}

export interface ApiTransaction {
  _id: string
  transactionId: string
  customerId: string
  customerName: string
  accountId: string
  amount: number
  currency: string
  merchantName: string
  recipientId: string
  channel: string
  transactionType: string
  timestamp: string
  isNewRecipient: boolean
  riskScore: number
  riskLevel: RiskLevel
  riskReasons: string[]
  status: InvestigationStatus
  createdAt: string
  updatedAt: string
}

export interface ApiAlert {
  _id: string
  transaction: ApiTransaction | string
  severity: Exclude<RiskLevel, 'Low' | 'Medium'>
  title: string
  description: string
  status: 'Open' | 'Reviewing' | 'Resolved' | 'False Positive'
  createdAt: string
}

interface ApiInvestigation {
  _id: string
  transaction: ApiTransaction | string
  status: InvestigationStatus
  decision: 'Confirmed Fraud' | 'Legitimate Activity' | 'Inconclusive'
  notes: { body: string; createdAt: string; author?: { name: string; email: string } }[]
  createdAt: string
  updatedAt: string
}

interface ApiRule {
  _id: string
  name: string
  description: string
  ruleType: 'high_amount' | 'rapid_activity' | 'unusual_hour' | 'new_recipient' | 'account_behavior'
  weight: number
  enabled: boolean
}

export interface ApiOverview {
  totalTransactions: number
  volumeByCurrency: { currency: string; totalVolume: number; flaggedVolume: number }[]
  highRisk: number
  openAlerts: number
  confirmedFraud: number
  falsePositives: number
}

export interface ApiRiskBucket {
  riskLevel: RiskLevel
  count: number
}

export interface ApiActivityBucket {
  date: string
  transactions: number
  alerts: number
  volume: number
}

export interface CreateTransactionInput {
  customerId: string
  customerName: string
  accountId: string
  amount: number
  currency: string
  merchantName: string
  recipientId: string
  channel: 'Card' | 'Bank Transfer' | 'Online' | 'Mobile' | 'ATM'
  transactionType: string
  timestamp: string
  isNewRecipient: boolean
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  const token = authenticated ? getToken() : null
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch (error) {
    throw new ApiError(error instanceof Error ? `Cannot reach Fraud Radar API at ${API_BASE_URL}: ${error.message}` : `Cannot reach Fraud Radar API at ${API_BASE_URL}`, 0)
  }
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: string } | null
  if (!response.ok || !payload?.success) {
    if (response.status === 401 && authenticated) {
      setToken(null)
      window.dispatchEvent(new Event('fraud-radar:auth-expired'))
    }
    throw new ApiError(payload?.error ?? `API request failed (${response.status})`, response.status)
  }
  return payload.data as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

const ruleIds: Record<ApiRule['ruleType'], ScoringRule['id']> = {
  high_amount: 'amount',
  rapid_activity: 'velocity',
  unusual_hour: 'hour',
  new_recipient: 'recipient',
  account_behavior: 'behavior',
}

export function toTransaction(transaction: ApiTransaction, notes: string[] = []): Transaction {
  return {
    id: transaction.transactionId,
    accountId: transaction.accountId,
    customer: transaction.customerName,
    amount: transaction.amount,
    currency: transaction.currency,
    merchant: transaction.merchantName,
    timestamp: transaction.timestamp,
    updatedAt: transaction.updatedAt,
    channel: transaction.channel,
    method: transaction.transactionType,
    riskScore: transaction.riskScore,
    riskLevel: transaction.riskLevel,
    status: transaction.status,
    reasons: transaction.riskReasons,
    location: 'Not provided by the transaction API',
    notes,
  }
}

export function toRule(rule: ApiRule): ScoringRule {
  return {
    id: ruleIds[rule.ruleType],
    backendId: rule._id,
    label: rule.name,
    description: rule.description,
    weight: rule.weight,
    enabled: rule.enabled,
  }
}

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<{ token: string; user: ApiUser }>('/auth/login', json('POST', { email, password }), false)
    setToken(result.token)
    return result.user
  },
  register: async (name: string, email: string, password: string) => {
    const result = await request<{ token: string; user: ApiUser }>('/auth/register', json('POST', { name, email, password }), false)
    setToken(result.token)
    return result.user
  },
  me: () => request<ApiUser>('/auth/me'),
  logout: () => setToken(null),
  hasToken: () => Boolean(getToken()),
  transactions: (page = 1, limit = 100) =>
    request<{ items: ApiTransaction[]; page: number; limit: number; total: number; totalPages: number }>(`/transactions?page=${page}&limit=${limit}`),
  transaction: (id: string) => request<ApiTransaction>(`/transactions/${encodeURIComponent(id)}`),
  createTransaction: (input: CreateTransactionInput) =>
    request<ApiTransaction>('/transactions', json('POST', input)),
  evaluateTransaction: (id: string) =>
    request<ApiTransaction>(`/transactions/${encodeURIComponent(id)}/evaluate`, json('POST')),
  updateTransactionStatus: (id: string, status: InvestigationStatus) =>
    request<ApiTransaction>(`/transactions/${encodeURIComponent(id)}/status`, json('PATCH', { status })),
  alerts: (page = 1, limit = 100) =>
    request<{ items: ApiAlert[]; page: number; limit: number; total: number; totalPages: number }>(`/alerts?page=${page}&limit=${limit}`),
  addInvestigationNote: (id: string, body: string) =>
    request<ApiInvestigation>(`/investigations/transaction/${encodeURIComponent(id)}/notes`, json('POST', { body })),
  investigation: (id: string) =>
    request<ApiInvestigation | null>(`/investigations/transaction/${encodeURIComponent(id)}`),
  overview: () => request<ApiOverview>('/analytics/overview'),
  riskDistribution: () => request<ApiRiskBucket[]>('/analytics/risk-distribution'),
  activity: (range: '24h' | '7d' | '30d') => request<ApiActivityBucket[]>(`/analytics/activity?range=${range}`),
  rules: async () => (await request<ApiRule[]>('/rules')).map(toRule),
  updateRule: async (rule: ScoringRule, changes: Partial<Pick<ScoringRule, 'weight' | 'enabled'>>) => {
    if (!rule.backendId) throw new Error(`Rule ${rule.label} is missing its backend identifier`)
    return toRule(await request<ApiRule>(`/rules/${encodeURIComponent(rule.backendId)}`, json('PATCH', changes)))
  },
}
