import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { api, type ApiActivityBucket, type ApiAlert, type ApiOverview, type ApiRiskBucket, type ApiUser, type CreateTransactionInput, toTransaction } from '../lib/api'
import type { AppSettings, FraudAlert, InvestigationStatus, RiskLevel, ScoringRule, Transaction } from '../types'

const SETTINGS_KEY = 'fraud-radar-preferences-v1'
const defaultSettings: AppSettings = { currency: 'USD', compactRows: false }
const emptyOverview: ApiOverview = { totalTransactions: 0, volumeByCurrency: [], highRisk: 0, openAlerts: 0, confirmedFraud: 0, falsePositives: 0 }
const riskLevels: RiskLevel[] = ['Low', 'Medium', 'High', 'Critical']

interface AppDataValue {
  user: ApiUser | null
  authLoading: boolean
  loading: boolean
  error: string | null
  feedback: string | null
  transactions: Transaction[]
  alerts: FraudAlert[]
  rules: ScoringRule[]
  settings: AppSettings
  overview: ApiOverview
  riskDistribution: Record<RiskLevel, number>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshData: () => Promise<void>
  loadTransaction: (id: string) => Promise<void>
  loadActivity: (range: '24h' | '7d' | '30d') => Promise<ApiActivityBucket[]>
  createTransaction: (input: CreateTransactionInput) => Promise<Transaction>
  updateStatus: (id: string, status: InvestigationStatus) => Promise<void>
  saveNotes: (id: string, notes: string) => Promise<void>
  setRule: (id: ScoringRule['id'], changes: Partial<Pick<ScoringRule, 'weight' | 'enabled'>>) => Promise<void>
  resetRules: () => Promise<void>
  setSettings: (settings: AppSettings) => void
  clearFeedback: () => void
}

const AppDataContext = createContext<AppDataValue | null>(null)

function getSettings(): AppSettings {
  const saved = localStorage.getItem(SETTINGS_KEY)
  if (!saved) return defaultSettings
  try {
    return { ...defaultSettings, ...JSON.parse(saved) as Partial<AppSettings> }
  } catch (error) {
    console.error('Could not read saved Fraud Radar preferences.', error)
    return defaultSettings
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected API error occurred.'
}

function getRiskDistribution(buckets: ApiRiskBucket[]) {
  return Object.fromEntries(riskLevels.map((level) => [
    level,
    buckets.find((bucket) => bucket.riskLevel === level)?.count ?? 0,
  ])) as Record<RiskLevel, number>
}

function transactionIdFromAlert(alert: ApiAlert) {
  return typeof alert.transaction === 'string' ? alert.transaction : alert.transaction.transactionId
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [rules, setRules] = useState<ScoringRule[]>([])
  const [settings, setSettingsState] = useState<AppSettings>(getSettings)
  const [overview, setOverview] = useState<ApiOverview>(emptyOverview)
  const [riskDistribution, setRiskDistribution] = useState<Record<RiskLevel, number>>(() => getRiskDistribution([]))

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const firstPage = await api.transactions(1, 100)
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) => api.transactions(index + 2, 100)),
      )
      const transactionRows = [...firstPage.items, ...remainingPages.flatMap((page) => page.items)]
      const alertFirstPage = await api.alerts(1, 100)
      const remainingAlertPages = await Promise.all(
        Array.from({ length: Math.max(0, alertFirstPage.totalPages - 1) }, (_, index) => api.alerts(index + 2, 100)),
      )
      const alertRows = [...alertFirstPage.items, ...remainingAlertPages.flatMap((page) => page.items)]
      const [ruleRows, summary, distribution] = await Promise.all([
        api.rules(),
        api.overview(),
        api.riskDistribution(),
      ])
      setTransactions((current) => {
        const existingNotes = new Map(current.map((item) => [item.id, item.notes]))
        return transactionRows.map((item) => toTransaction(item, existingNotes.get(item.transactionId) ?? []))
      })
      setAlerts(alertRows.map((alert) => ({
        id: alert._id,
        transactionId: transactionIdFromAlert(alert),
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        status: alert.status,
        createdAt: alert.createdAt,
      })))
      setRules(ruleRows)
      setOverview(summary)
      setRiskDistribution(getRiskDistribution(distribution))
    } catch (loadError) {
      setError(errorText(loadError))
      throw loadError
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setFeedback(null)
    const authenticatedUser = await api.login(email, password)
    setUser(authenticatedUser)
    await refreshData()
  }, [refreshData])

  const logout = useCallback(() => {
    api.logout()
    setUser(null)
    setTransactions([])
    setAlerts([])
    setRules([])
    setFeedback(null)
  }, [])

  useEffect(() => {
    let alive = true
    const onAuthExpired = () => {
      if (!alive) return
      logout()
      setError('Your session expired. Sign in again to continue.')
    }
    window.addEventListener('fraud-radar:auth-expired', onAuthExpired)

    if (!api.hasToken()) {
      setAuthLoading(false)
    } else {
      api.me()
        .then((authenticatedUser) => {
          if (!alive) return
          setUser(authenticatedUser)
          return refreshData()
        })
        .catch((authError: unknown) => {
          if (alive) {
            api.logout()
            setUser(null)
            setError(errorText(authError))
          }
        })
        .finally(() => {
          if (alive) setAuthLoading(false)
        })
    }
    return () => {
      alive = false
      window.removeEventListener('fraud-radar:auth-expired', onAuthExpired)
    }
  }, [logout, refreshData])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (storageError) {
      console.error('Could not save Fraud Radar preferences.', storageError)
    }
  }, [settings])

  const loadActivity = useCallback(async (range: '24h' | '7d' | '30d') => {
    try {
      return await api.activity(range)
    } catch (activityError) {
      setError(errorText(activityError))
      throw activityError
    }
  }, [])

  const loadTransaction = useCallback(async (id: string) => {
    setError(null)
    try {
      const [record, investigation] = await Promise.all([api.transaction(id), api.investigation(id)])
      const notes = investigation?.notes.map((note) => note.body) ?? []
      const transaction = toTransaction(record, notes)
      setTransactions((current) => {
        const index = current.findIndex((item) => item.id === transaction.id)
        if (index < 0) return [transaction, ...current]
        const next = current.slice()
        next[index] = transaction
        return next
      })
    } catch (loadError) {
      setError(errorText(loadError))
      throw loadError
    }
  }, [])

  const createTransaction = useCallback(async (input: CreateTransactionInput) => {
    setError(null)
    try {
      const created = await api.createTransaction(input)
      await refreshData()
      setFeedback(`Transaction ${created.transactionId} created and risk evaluated.`)
      return toTransaction(created)
    } catch (mutationError) {
      setError(errorText(mutationError))
      throw mutationError
    }
  }, [refreshData])

  const updateStatus = useCallback(async (id: string, status: InvestigationStatus) => {
    setError(null)
    try {
      await api.updateTransactionStatus(id, status)
      await refreshData()
      setFeedback(`${id} status updated to ${status}.`)
    } catch (mutationError) {
      setError(errorText(mutationError))
      throw mutationError
    }
  }, [refreshData])

  const saveNotes = useCallback(async (id: string, notes: string) => {
    setError(null)
    try {
      const investigation = await api.addInvestigationNote(id, notes)
      await refreshData()
      const noteHistory = investigation.notes.map((note) => note.body)
      setTransactions((current) => current.map((transaction) =>
        transaction.id === id ? { ...transaction, notes: noteHistory } : transaction,
      ))
      setFeedback(`Investigation note saved for ${id}.`)
    } catch (mutationError) {
      setError(errorText(mutationError))
      throw mutationError
    }
  }, [refreshData])

  const setRule = useCallback(async (id: ScoringRule['id'], changes: Partial<Pick<ScoringRule, 'weight' | 'enabled'>>) => {
    setError(null)
    const rule = rules.find((candidate) => candidate.id === id)
    if (!rule) throw new Error(`Scoring rule ${id} was not found.`)
    try {
      await api.updateRule(rule, changes)
      await refreshData()
      setFeedback(`${rule.label} updated; transaction scores were recalculated.`)
    } catch (mutationError) {
      setError(errorText(mutationError))
      throw mutationError
    }
  }, [refreshData, rules])

  const resetRules = useCallback(async () => {
    const defaults: Record<ScoringRule['id'], { weight: number; enabled: boolean }> = {
      amount: { weight: 25, enabled: true },
      velocity: { weight: 25, enabled: true },
      hour: { weight: 10, enabled: true },
      recipient: { weight: 15, enabled: true },
      behavior: { weight: 25, enabled: true },
    }
    setError(null)
    try {
      for (const rule of rules) await api.updateRule(rule, defaults[rule.id])
      await refreshData()
      setFeedback('Default scoring baselines restored on the backend.')
    } catch (mutationError) {
      setError(errorText(mutationError))
      throw mutationError
    }
  }, [refreshData, rules])

  const value = useMemo<AppDataValue>(() => ({
    user, authLoading, loading, error, feedback, transactions, alerts, rules, settings,
    overview, riskDistribution, login, logout, refreshData, loadTransaction, loadActivity, createTransaction,
    updateStatus, saveNotes, setRule, resetRules,
    setSettings: setSettingsState,
    clearFeedback: () => setFeedback(null),
  }), [user, authLoading, loading, error, feedback, transactions, alerts, rules, settings, overview, riskDistribution, login, logout, refreshData, loadTransaction, loadActivity, createTransaction, updateStatus, saveNotes, setRule, resetRules])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside AppDataProvider')
  return value
}

export function useTransaction(id: string | undefined) {
  const { transactions } = useAppData()
  return useMemo(() => transactions.find((transaction) => transaction.id === id), [transactions, id])
}
