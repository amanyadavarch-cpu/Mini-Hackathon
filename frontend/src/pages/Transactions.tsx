import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAppData } from '../context/AppData'
import { formatCurrency, formatDateTime } from '../lib/format'
import type { CreateTransactionInput } from '../lib/api'
import type { InvestigationStatus, RiskLevel, Transaction } from '../types'
import { Card, EmptyState, PageHeading, RiskBadge, StatusBadge } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

type SortKey = 'timestamp' | 'amount' | 'riskScore'

const pageSize = 12

function makeDefaultTimestamp() {
  const now = new Date()
  const utcAtTwoAm = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2))
  const local = new Date(utcAtTwoAm.getTime() - utcAtTwoAm.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function Transactions() {
  const scope = usePageMotion()
  const navigate = useNavigate()
  const { transactions, settings, user, createTransaction } = useAppData()
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<'All' | RiskLevel>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | InvestigationStatus>('All')
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [ascending, setAscending] = useState(false)
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    customerId: 'C-DEMO-001',
    customerName: 'Demo Customer',
    accountId: 'ACC-DEMO-001',
    amount: '6800',
    merchantName: 'Demo recipient transfer',
    recipientId: 'REC-DEMO-001',
    channel: 'Bank Transfer' as CreateTransactionInput['channel'],
    timestamp: makeDefaultTimestamp(),
    isNewRecipient: true,
  })

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return transactions.filter((transaction) => {
      const matchesQuery = !normalized || [
        transaction.id, transaction.accountId, transaction.customer, transaction.merchant, transaction.channel,
      ].some((field) => field.toLowerCase().includes(normalized))
      return matchesQuery
        && (riskFilter === 'All' || transaction.riskLevel === riskFilter)
        && (statusFilter === 'All' || transaction.status === statusFilter)
    }).sort((a, b) => {
      const compare = sortKey === 'timestamp'
        ? a.timestamp.localeCompare(b.timestamp)
        : a[sortKey] - b[sortKey]
      return ascending ? compare : -compare
    })
  }, [transactions, query, riskFilter, statusFilter, sortKey, ascending])

  useEffect(() => setPage(1), [query, riskFilter, statusFilter, sortKey, ascending])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAscending((value) => !value)
    else {
      setSortKey(key)
      setAscending(key !== 'timestamp')
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown size={13} />
    return ascending ? <ArrowUp size={13} /> : <ArrowDown size={13} />
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const transaction = await createTransaction({
        ...draft,
        amount: Number(draft.amount),
        currency: settings.currency,
        transactionType: draft.channel,
        timestamp: new Date(draft.timestamp).toISOString(),
      })
      setCreateOpen(false)
      navigate(`/transactions/${transaction.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading
        eyebrow="WORKSPACE  /  LIVE RESPONSE"
        title="Transactions"
        description="Search, filter, and review transactions evaluated by the fraud service."
        actions={<><span className="live-status"><i />Backend connected</span>{user?.role !== 'viewer' && <button className="button button-primary" onClick={() => setCreateOpen((open) => !open)}><Plus size={15} />New transaction</button>}</>}
      />
      {createOpen && <Card className="create-transaction-card page-enter">
        <div className="card-heading"><div><h2>Create transaction</h2><p>Saved to MongoDB, scored by the backend, and alerted when it meets the high-risk threshold.</p></div><button className="icon-button" aria-label="Close transaction form" onClick={() => setCreateOpen(false)}><X size={16} /></button></div>
        <form className="transaction-create-form" onSubmit={(event) => { void handleCreate(event).catch(() => undefined) }}>
          <label>Customer name<input required value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} /></label>
          <label>Customer ID<input required value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })} /></label>
          <label>Account ID<input required value={draft.accountId} onChange={(event) => setDraft({ ...draft, accountId: event.target.value })} /></label>
          <label>Amount ({settings.currency})<input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          <label>Merchant / recipient<input required value={draft.merchantName} onChange={(event) => setDraft({ ...draft, merchantName: event.target.value })} /></label>
          <label>Recipient ID<input value={draft.recipientId} onChange={(event) => setDraft({ ...draft, recipientId: event.target.value })} /></label>
          <label>Channel<select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value as CreateTransactionInput['channel'] })}><option>Card</option><option>Bank Transfer</option><option>Online</option><option>Mobile</option><option>ATM</option></select></label>
          <label>Timestamp<input required type="datetime-local" value={draft.timestamp} onChange={(event) => setDraft({ ...draft, timestamp: event.target.value })} /></label>
          <label className="create-recipient-toggle"><input type="checkbox" checked={draft.isNewRecipient} onChange={(event) => setDraft({ ...draft, isNewRecipient: event.target.checked })} />New recipient</label>
          <button className="button button-primary" disabled={saving}>{saving ? 'Saving and evaluating…' : 'Create and evaluate'}</button>
        </form>
      </Card>}
      <Card className="transactions-panel page-enter">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input aria-label="Search transactions" placeholder="Search ID, account, customer or merchant..." value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
          </label>
          <label className="filter-control"><SlidersHorizontal size={15} /><select aria-label="Filter by risk" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as 'All' | RiskLevel)}><option value="All">All risk levels</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
          <select className="filter-select" aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | InvestigationStatus)}><option value="All">All statuses</option><option>New</option><option>Reviewing</option><option>Resolved</option><option>False Positive</option></select>
        </div>
        <div className="table-summary"><span><strong>{filtered.length.toLocaleString('en-IN')}</strong> matching transactions</span><span>Backend · {transactions.length.toLocaleString('en-IN')} persisted</span></div>
        {visibleRows.length ? (
          <>
            <div className="mobile-transaction-list">
              {visibleRows.map((transaction) => (
                <article className="mobile-transaction" key={transaction.id}>
                  <div className="mobile-txn-heading">
                    <span><Link className="transaction-id" to={`/transactions/${transaction.id}`}>{transaction.id}</Link><small>{formatDateTime(transaction.timestamp)}</small></span>
                    <StatusBadge status={transaction.status} />
                  </div>
                  <div className="mobile-txn-merchant"><strong>{transaction.merchant}</strong><span>{transaction.channel} · {transaction.method}</span></div>
                  <div className="mobile-txn-summary">
                    <span><small>Transaction value</small><strong>{formatCurrency(transaction.amount, transaction.currency)}</strong></span>
                    <span><small>Account</small><strong>{transaction.accountId} · {transaction.customer}</strong></span>
                  </div>
                  <div className="mobile-txn-footer">
                    <span className={`mobile-txn-score risk-text-${transaction.riskLevel.toLowerCase()}`}><strong>{transaction.riskScore}</strong><RiskBadge level={transaction.riskLevel} /></span>
                    <Link className="button button-primary button-small" to={`/transactions/${transaction.id}`}>View details <ChevronRight size={13} /></Link>
                  </div>
                  {transaction.reasons.length > 0 && <p className="mobile-txn-reason">{transaction.reasons.slice(0, 2).join(' · ')}</p>}
                </article>
              ))}
            </div>
            <div className="table-scroll">
              <table className={settings.compactRows ? 'compact-table' : ''}>
                <thead><tr>
                  <th>Transaction / Account</th>
                  <th>Merchant / Channel</th>
                  <th><button className="sort-button" onClick={() => toggleSort('amount')}>Amount {sortIcon('amount')}</button></th>
                  <th><button className="sort-button" onClick={() => toggleSort('riskScore')}>Risk score {sortIcon('riskScore')}</button></th>
                  <th>Status</th>
                  <th><button className="sort-button" onClick={() => toggleSort('timestamp')}>Timestamp {sortIcon('timestamp')}</button></th>
                  <th><span className="sr-only">Open investigation</span></th>
                </tr></thead>
                <tbody>
                  {visibleRows.map((transaction: Transaction) => (
                    <tr key={transaction.id}>
                      <td><Link className="transaction-id" to={`/transactions/${transaction.id}`}>{transaction.id}</Link><small>{transaction.accountId} · {transaction.customer}</small></td>
                      <td><strong className="merchant-name">{transaction.merchant}</strong><small>{transaction.channel} · {transaction.method}</small></td>
                      <td className="amount-cell">{formatCurrency(transaction.amount, transaction.currency)}</td>
                      <td><span className={`score-number risk-text-${transaction.riskLevel.toLowerCase()}`}>{transaction.riskScore}</span><RiskBadge level={transaction.riskLevel} /></td>
                      <td><StatusBadge status={transaction.status} /></td>
                      <td className="date-cell">{formatDateTime(transaction.timestamp)}</td>
                      <td><Link className="row-open" to={`/transactions/${transaction.id}`} aria-label={`Investigate ${transaction.id}`}><ChevronRight size={16} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>Showing <strong>{((page - 1) * pageSize + 1).toLocaleString('en-IN')}-{Math.min(page * pageSize, filtered.length).toLocaleString('en-IN')}</strong> of {filtered.length.toLocaleString('en-IN')}</span>
              <div><button className="icon-button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page <strong>{page.toLocaleString('en-IN')}</strong> of {totalPages.toLocaleString('en-IN')}</span><button className="icon-button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div>
            </div>
            <div className="mobile-pagination">
              <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} />Previous</button>
              <span>{page.toLocaleString('en-IN')} / {totalPages.toLocaleString('en-IN')}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={14} /></button>
            </div>
          </>
        ) : <EmptyState title="No matching transactions" description="Clear a filter or search for another transaction." />}
      </Card>
    </div>
  )
}
