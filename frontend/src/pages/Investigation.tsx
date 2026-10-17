import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3, FileText, MapPin, Network, Save, ShieldAlert, Smartphone, Store, WalletCards } from 'lucide-react'
import { useAppData, useTransaction } from '../context/AppData'
import { formatCurrency, formatDateTime } from '../lib/format'
import type { InvestigationStatus } from '../types'
import { Card, NotFound, PageHeading, RiskBadge, StatusBadge } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

const statuses: InvestigationStatus[] = ['New', 'Reviewing', 'Resolved', 'False Positive']

export function Investigation() {
  const scope = usePageMotion()
  const { id } = useParams()
  const transaction = useTransaction(id)
  const { updateStatus, saveNotes, alerts, loadTransaction, user } = useAppData()
  const [noteDraft, setNoteDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const [detailLoading, setDetailLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!id) {
      setDetailLoading(false)
      return
    }
    setDetailLoading(true)
    void loadTransaction(id).catch(() => undefined).finally(() => {
      if (active) setDetailLoading(false)
    })
    return () => { active = false }
  }, [id, loadTransaction])

  useEffect(() => {
    setNoteDraft('')
    setSaved(false)
  }, [transaction?.id, transaction?.notes])

  if (detailLoading) {
    return <div className="panel route-loading" role="status">Loading transaction investigation…</div>
  }

  if (!transaction) {
    return <div className="page-stack" ref={scope}><PageHeading eyebrow="INVESTIGATION" title="Transaction not found" description="This transaction ID does not exist in the backend." /><Card><NotFound title="No transaction with that ID" description="Check the ID or return to the transaction list." /><div className="center-action"><Link className="button button-secondary" to="/transactions"><ArrowLeft size={15} />Back to transactions</Link></div></Card></div>
  }
  const relatedAlert = alerts.find((alert) => alert.transactionId === transaction.id)

  async function handleSaveNotes() {
    if (!transaction) return
    if (!noteDraft.trim()) return
    await saveNotes(transaction.id, noteDraft.trim())
    setNoteDraft('')
    setSaved(true)
  }

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading eyebrow="WORKSPACE  /  FORENSIC DOSSIER" title={`Investigation ${transaction.id}`} description="Review transaction evidence and record a disposition." actions={<Link className="button button-secondary" to="/transactions"><ArrowLeft size={15} />Back to transactions</Link>} />
      <Card className="investigation-hero page-enter">
        <div className="case-title">
          <div className="case-score"><strong>{transaction.riskScore}</strong><span>/ 100</span></div>
          <div><RiskBadge level={transaction.riskLevel} /><h2>{transaction.riskScore >= 75 ? 'Suspicious capital movement' : transaction.riskScore >= 50 ? 'Elevated transaction activity' : 'Transaction review'}</h2><p>{formatDateTime(transaction.timestamp)} · Account: {transaction.accountId}</p></div>
        </div>
        <label className="status-picker"><span>Investigation status</span><select disabled={user?.role === 'viewer'} value={transaction.status} onChange={(event) => { void updateStatus(transaction.id, event.target.value as InvestigationStatus).catch(() => undefined) }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      </Card>
      <div className="investigation-grid">
        <div className="page-stack">
          <Card className="page-enter">
            <div className="detail-value-head"><div><span className="eyebrow">TRANSACTION VALUE</span><h2>{formatCurrency(transaction.amount, transaction.currency)}</h2></div><span className="surface-icon"><WalletCards size={18} /></span></div>
            <div className="detail-grid">
              <div><span><Store size={14} /> Beneficiary / merchant</span><strong>{transaction.merchant}</strong></div>
              <div><span><WalletCards size={14} /> Channel / settlement</span><strong>{transaction.channel} · {transaction.method}</strong></div>
              <div><span><MapPin size={14} /> Network / location</span><strong>{transaction.location}</strong></div>
              <div><span><Smartphone size={14} /> Customer / account</span><strong>{transaction.customer} · {transaction.accountId}</strong></div>
            </div>
          </Card>
          <Card className="page-enter">
            <div className="score-heading"><div><span className="section-icon"><ShieldAlert size={16} /></span><div><h2>Heuristic calculation</h2><p>Deterministic rule score · Engine v2.4</p></div></div><span className="score-total">{transaction.riskScore} <small>/ 100</small></span></div>
            <div className="risk-scale"><span style={{ width: `${transaction.riskScore}%` }} className={`scale-fill risk-bg-${transaction.riskLevel.toLowerCase()}`} /></div>
            <div className="risk-scale-labels"><span>Low · 0–24</span><span>Medium · 25–49</span><span>High · 50–74</span><span>Critical · 75–100</span></div>
            {transaction.reasons.length ? <div className="evidence-list">
              <div className="subsection-heading"><div><h3>Triggered evidence rules</h3><p>{transaction.reasons.length} available signal{transaction.reasons.length === 1 ? '' : 's'} on this seeded record</p></div></div>
              {transaction.reasons.map((reason, index) => <div className="evidence-item" key={reason}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{reason}</strong><small>Rule matched against the persisted transaction record.</small></div><Check size={15} /></div>)}
            </div> : <div className="info-callout">No active scoring rules were triggered for this transaction.</div>}
          </Card>
          <Card className="page-enter">
            <div className="score-heading"><div><span className="section-icon"><Clock3 size={16} /></span><div><h2>Investigation timeline</h2><p>Recorded evidence and analyst activity</p></div></div></div>
            <div className="timeline">
              <div><i /><span><strong>Transaction evaluated</strong><small>{formatDateTime(transaction.timestamp)} · Backend heuristic engine</small></span></div>
              {relatedAlert && <div><i /><span><strong>{relatedAlert.title}</strong><small>{formatDateTime(relatedAlert.createdAt)} · {relatedAlert.description}</small></span></div>}
              {transaction.status !== 'New' && <div><i /><span><strong>Status: {transaction.status}</strong><small>Persisted in the investigation database</small></span></div>}
            </div>
          </Card>
        </div>
        <div className="page-stack">
          <Card className="notes-card page-enter">
            <div className="score-heading"><div><span className="section-icon"><FileText size={16} /></span><div><h2>Investigation notes</h2><p>Stored with this investigation</p></div></div></div>
            <p className="notes-persistence">Analyst notes are stored with this investigation in MongoDB.</p>
            {transaction.notes.length > 0 && <div className="investigation-note-list">{transaction.notes.map((note, index) => <p key={`${index}-${note}`}>{note}</p>)}</div>}
            <label className="field-label" htmlFor="investigation-notes">Add analyst note</label>
            <textarea id="investigation-notes" value={noteDraft} maxLength={4000} onChange={(event) => { setNoteDraft(event.target.value); setSaved(false) }} placeholder="Add context, evidence reviewed, and next steps..." rows={7} />
            <div className="notes-footer"><span>{noteDraft.length}/4,000 characters</span><button className="button button-primary" disabled={!noteDraft.trim() || user?.role === 'viewer'} onClick={() => { void handleSaveNotes().catch(() => undefined) }}><Save size={15} />{saved ? 'Saved' : 'Save note'}</button></div>
            {saved && <div className="save-confirmation">Note saved to the backend.</div>}
          </Card>
          <Card className="page-enter">
            <div className="score-heading"><div><span className="section-icon"><Network size={16} /></span><div><h2>Case details</h2><p>Persisted transaction metadata</p></div></div></div>
            <div className="metadata-list"><div><span>Transaction ID</span><strong>{transaction.id}</strong></div><div><span>Account holder</span><strong>{transaction.customer}</strong></div><div><span>Channel</span><strong>{transaction.channel}</strong></div><div><span>Current disposition</span><StatusBadge status={transaction.status} /></div></div>
            <div className="info-callout">Location metadata is not provided by the backend API. Scores are deterministic risk signals, not proof of fraud.</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
