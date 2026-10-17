export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'
export type InvestigationStatus = 'New' | 'Reviewing' | 'Resolved' | 'False Positive'
export type RuleId = 'amount' | 'velocity' | 'hour' | 'recipient' | 'behavior'

export interface Transaction {
  id: string
  accountId: string
  customer: string
  amount: number
  currency: string
  merchant: string
  timestamp: string
  updatedAt?: string
  channel: string
  method: string
  riskScore: number
  riskLevel: RiskLevel
  status: InvestigationStatus
  reasons: string[]
  location?: string
  notes: string[]
}

export interface ScoringRule {
  id: RuleId
  backendId?: string
  label: string
  description: string
  weight: number
  enabled: boolean
}

export interface FraudAlert {
  id: string
  transactionId: string
  severity: Exclude<RiskLevel, 'Low' | 'Medium'>
  title: string
  description: string
  status: 'Open' | InvestigationStatus
  createdAt: string
}

export interface AppSettings {
  currency: 'INR' | 'USD'
  compactRows: boolean
}
