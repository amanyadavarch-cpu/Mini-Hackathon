import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CheckCircle2, ChevronDown, ChevronRight, Clock3, Search, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { useAppData } from '../context/AppData'
import { formatCurrency, formatDateTime } from '../lib/format'
import type { FraudAlert, InvestigationStatus, Transaction } from '../types'
import { Card, EmptyState, PageHeading, StatusBadge, StatCard } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

type SeverityFilter = 'All' | 'Critical' | 'High'
type StatusFilter = 'All' | 'New' | 'Reviewing' | 'Resolved' | 'False Positive'

export function Alerts() {
  const scope = usePageMotion()
  const { transactions, alerts, updateStatus, user } = useAppData()
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<SeverityFilter>('All')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [visibleCount, setVisibleCount] = useState(8)

  const flagged = useMemo(() => alerts
    .map((alert) => ({ alert, transaction: transactions.find((transaction) => transaction.id === alert.transactionId) }))
    .filter((item): item is { alert: FraudAlert; transaction: Transaction } => Boolean(item.transaction)), [alerts, transactions])
  const openCount = flagged.filter(({ alert }) => alert.status === 'Open' || alert.status === 'Reviewing').length
  const criticalCount = flagged.filter(({ alert }) => alert.severity === 'Critical').length
  const reviewingCount = flagged.filter(({ alert }) => alert.status === 'Reviewing').length
  const falsePositiveCount = flagged.filter(({ alert }) => alert.status === 'False Positive').length
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return flagged.filter(({ alert, transaction }) => {
      const matchesSearch = !term || [alert.id, transaction.id, transaction.accountId, transaction.customer, transaction.merchant].some((field) => field.toLowerCase().includes(term))
      return matchesSearch
        && (severity === 'All' || alert.severity === severity)
        && (status === 'All' || transaction.status === status)
    }).sort((a, b) => b.transaction.riskScore - a.transaction.riskScore || a.alert.createdAt.localeCompare(b.alert.createdAt))
  }, [flagged, query, severity, status])

  const severityOptions: { label: SeverityFilter; value: number }[] = [
    { label: 'All', value: flagged.length },
    { label: 'Critical', value: criticalCount },
    { label: 'High', value: flagged.length - criticalCount },
  ]
  const statusOptions: { label: StatusFilter; value: number }[] = [
    { label: 'All', value: flagged.length },
    { label: 'New', value: flagged.filter((item) => item.alert.status === 'Open').length },
    { label: 'Reviewing', value: reviewingCount },
    { label: 'Resolved', value: flagged.filter((item) => item.alert.status === 'Resolved').length },
    { label: 'False Positive', value: falsePositiveCount },
  ]

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading eyebrow="WORKSPACE  /  TRIAGE QUEUE" title="Alert Management" description="Review, prioritize, and manage transactions requiring investigation." actions={<span className="sync-label"><Clock3 size={14} />Synced just now</span>} />
      <div className="stat-grid alerts-stats">
        <StatCard label="Open alerts" value={openCount.toLocaleString('en-IN')} detail={`${flagged.filter((item) => item.alert.status === 'Open').length} new · ${reviewingCount} reviewing`} icon={<BellRing size={17} />} tone="amber" />
        <StatCard label="Critical (≥75)" value={criticalCount.toLocaleString('en-IN')} detail="Highest risk tier" icon={<ShieldAlert size={17} />} tone="red" />
        <StatCard label="Under review" value={reviewingCount.toLocaleString('en-IN')} detail="Assigned for investigation" icon={<SlidersHorizontal size={17} />} tone="blue" />
        <StatCard label="False positives" value={falsePositiveCount.toLocaleString('en-IN')} detail="Dismissed from the queue" icon={<CheckCircle2 size={17} />} tone="mint" />
      </div>
      <Card className="alerts-panel page-enter">
        <div className="table-toolbar">
          <label className="search-field"><Search size={16} /><input aria-label="Search alerts" placeholder="Search alert, transaction, account..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="filter-control"><SlidersHorizontal size={15} /><select aria-label="Filter alerts by severity" value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}>{severityOptions.map((option) => <option key={option.label} value={option.label}>{option.label === 'All' ? 'All severity' : option.label} · {option.value.toLocaleString('en-IN')}</option>)}</select></label>
          <label className="filter-control"><select aria-label="Filter alerts by status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>{statusOptions.map((option) => <option key={option.label} value={option.label}>{option.label === 'All' ? 'All statuses' : option.label} · {option.value.toLocaleString('en-IN')}</option>)}</select></label>
        </div>
        <div className="alert-filter-tabs" role="group" aria-label="Quick alert filters">
          {severityOptions.map((option) => <button key={option.label} className={severity === option.label ? 'selected' : ''} onClick={() => setSeverity(option.label)}>{option.label}<span>{option.value.toLocaleString('en-IN')}</span></button>)}
          <span className="filter-divider" />
          {(['New', 'Reviewing'] as StatusFilter[]).map((item) => <button key={item} className={status === item ? 'selected' : ''} onClick={() => setStatus(status === item ? 'All' : item)}>{item}<span>{statusOptions.find((option) => option.label === item)?.value.toLocaleString('en-IN')}</span></button>)}
          <span className="results-count">Showing {Math.min(filtered.length, visibleCount)} of {filtered.length.toLocaleString('en-IN')}</span>
        </div>
        {filtered.length ? (
          <div className="alert-list">
            {filtered.slice(0, visibleCount).map(({ alert, transaction }) => (
              <article className="alert-card" key={alert.id}>
                <div className={`alert-priority ${transaction.riskLevel.toLowerCase()}`}><span>{transaction.riskScore}</span><small>{transaction.riskLevel}</small></div>
                <div className="alert-content">
                  <div className="alert-card-head">
                    <div><span className="alert-id">{alert.id}</span><span className="bullet-separator">·</span><span className="alert-age">{formatDateTime(alert.createdAt)}</span><span className="bullet-separator">·</span><Link to={`/transactions/${transaction.id}`}>{transaction.id}</Link></div>
                    <StatusBadge status={transaction.status} />
                  </div>
                  <div className="alert-transaction-line"><span><small>Target account</small><strong>{transaction.accountId} · {transaction.customer}</strong></span><span><small>Transaction sum</small><strong>{formatCurrency(transaction.amount, transaction.currency)}</strong></span></div>
                  <div className="alert-merchant"><span>Counterparty</span><strong>{transaction.merchant}</strong><i>{transaction.channel} · {transaction.method}</i></div>
                  <div className="alert-reasons"><span>{alert.title}</span><span className="reason-chip">{alert.description}</span></div>
                  <div className="alert-card-actions">
                    <Link className="button button-primary button-small" to={`/transactions/${transaction.id}`}>Investigate dossier <ArrowRight size={14} /></Link>
                    {user?.role !== 'viewer' && <label className="inline-status"><span className="sr-only">Update status for {transaction.id}</span><select value={transaction.status} onChange={(event) => { void updateStatus(transaction.id, event.target.value as InvestigationStatus).catch(() => undefined) }}><option>New</option><option>Reviewing</option><option>Resolved</option><option>False Positive</option></select><ChevronDown size={13} /></label>}
                  </div>
                </div>
              </article>
            ))}
            {visibleCount < filtered.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + 8)}>Load next 8 alerts <span>({(filtered.length - visibleCount).toLocaleString('en-IN')} remaining)</span><ChevronRight size={15} /></button>}
          </div>
        ) : <EmptyState title="No alerts match these filters" description="Try another status, severity, or search phrase." />}
        <div className="audit-note"><ShieldAlert size={15} /><span><strong>Backend alert queue</strong><small>Alert dispositions are persisted in MongoDB. Risk scoring is deterministic and is not proof of fraud.</small></span></div>
      </Card>
    </div>
  )
}
