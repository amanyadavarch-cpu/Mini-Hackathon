import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CircleDollarSign,
  Clock3,
  Fingerprint,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppData } from '../context/AppData'
import { formatCurrency, formatDateTime } from '../lib/format'
import type { InvestigationStatus } from '../types'
import { Card, CardHeading, PageHeading, RiskBadge, StatCard } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

const riskColors = ['#64748b', '#4a9bd8', '#d4952e', '#dc3d46']

function formatVolume(amount: number, currency: 'INR' | 'USD') {
  return currency === 'INR' ? `₹${(amount / 10_000_000).toFixed(2)} Cr` : formatCurrency(amount, currency)
}

export function Dashboard() {
  const scope = usePageMotion()
  const { transactions, settings, overview, riskDistribution: riskCounts, loadActivity, refreshData } = useAppData()
  const currency = settings.currency
  const volume = overview.volumeByCurrency.find((bucket) => bucket.currency === currency)
  const totalVolume = volume?.totalVolume ?? 0
  const flaggedVolume = volume?.flaggedVolume ?? 0
  const [period, setPeriod] = useState<'Last 24 Hours' | '7 Days' | '30 Days'>('Last 24 Hours')
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ label: string; volume: number; flagged: number }[]>([])

  useEffect(() => {
    let active = true
    const range = period === 'Last 24 Hours' ? '24h' : period === '7 Days' ? '7d' : '30d'
    void loadActivity(range).then((buckets) => {
      if (!active) return
      if (range === '24h') {
        const rows = Array.from({ length: 24 }, (_, hour) => ({
          label: `${String((hour + 5) % 24).padStart(2, '0')}:00`,
          volume: 0,
          flagged: 0,
        }))
        buckets.forEach((bucket) => {
          const hour = (new Date(bucket.date).getUTCHours() + 5) % 24
          rows[hour].volume = bucket.transactions
          rows[hour].flagged = bucket.alerts
        })
        setActivity(rows)
      } else {
        setActivity(buckets.map((bucket) => ({
          label: new Date(bucket.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
          volume: bucket.transactions,
          flagged: bucket.alerts,
        })))
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [loadActivity, period])

  const riskDistribution = [
    { name: 'Low', value: riskCounts.Low },
    { name: 'Medium', value: riskCounts.Medium },
    { name: 'High', value: riskCounts.High },
    { name: 'Critical', value: riskCounts.Critical },
  ]
  const suspicious = transactions
    .filter((transaction) => transaction.riskScore >= 50)
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 3)
  const recentActivity = suspicious.slice(0, 3).map((transaction) => {
    const titles: Record<InvestigationStatus, string> = {
      New: 'High-risk alert created',
      Reviewing: 'Investigation moved to review',
      Resolved: 'Investigation resolved',
      'False Positive': 'Alert dismissed as false positive',
    }
    return {
      id: transaction.id,
      title: titles[transaction.status],
      note: `${transaction.id} · ${transaction.reasons[0] ?? 'Seeded risk signal'}`,
      time: formatDateTime(transaction.timestamp),
      icon: transaction.status === 'New' ? ShieldAlert : transaction.status === 'Reviewing' ? Fingerprint : TrendingUp,
    }
  })

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading
        eyebrow="WORKSPACE  /  LIVE RESPONSE"
        title="Overview"
        description=""
      />
      <div className="overview-intro page-enter">
        <div><h2>Fraud Overview</h2><p>Monitor transaction activity and investigate suspicious behavior.</p></div>
        <button className="button button-secondary overview-refresh" onClick={() => {
          void refreshData().then(() => {
            setRefreshedAt(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }))
          }).catch(() => undefined)
        }}><RefreshCw size={14} />{refreshedAt ? 'Updated' : 'Refresh dataset'}</button>
      </div>
      <div className="overview-controls">
        <label className="period-picker"><Clock3 size={14} /><select aria-label="Dashboard time range" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option>Last 24 Hours</option><option>7 Days</option><option>30 Days</option></select></label>
        <span className="stream-chip"><i />Live stream</span>
      </div>
      <div className="overview-note page-enter">
        <div className="note-icon"><Fingerprint size={17} /></div>
        <span><strong>Heuristic Engine v2.4</strong><i />Seeded synthetic dataset</span>
        <span className="synced-label"><span />{refreshedAt ? `UPDATED ${refreshedAt}` : 'SYNCED'}</span>
      </div>

      <div className="stat-grid">
        <StatCard label="Total txns" value={overview.totalTransactions.toLocaleString('en-IN')} detail={`${formatVolume(totalVolume, currency)} ${currency} volume`} icon={<TrendingUp size={17} />} />
        <StatCard label="High & critical" value={(riskCounts.High + riskCounts.Critical).toLocaleString('en-IN')} detail={`${riskCounts.Critical} crit · ${riskCounts.High} high`} icon={<ShieldAlert size={17} />} tone="red" />
        <StatCard label="Open alerts" value={overview.openAlerts.toLocaleString('en-IN')} detail={`${transactions.filter((item) => item.status === 'New' && item.riskScore >= 50).length} new · ${transactions.filter((item) => item.status === 'Reviewing' && item.riskScore >= 50).length} review`} icon={<BellRing size={17} />} tone="amber" />
        <StatCard label="Flagged value" value={formatCurrency(flaggedVolume, currency)} detail={`${(flaggedVolume / Math.max(totalVolume, 1) * 100).toFixed(1)}% of total · ${currency}`} icon={<CircleDollarSign size={17} />} tone="blue" />
      </div>

      <div className="dashboard-chart-grid">
        <Card className="chart-card page-enter">
          <CardHeading title="Transaction activity" description={`${period} volume and high-risk activity`} action={<span className="chart-legend"><i />Transactions <i className="legend-red" />High risk</span>} />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ top: 8, right: 7, bottom: 0, left: -15 }}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7DD3FC" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#7DD3FC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7ebf1" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dce3ed', borderRadius: 8, color: '#1a2438', boxShadow: '0 4px 14px rgba(11,28,48,.12)' }} />
                <Area type="monotone" dataKey="volume" name="Transactions" stroke="#4f46e5" strokeWidth={2} fill="url(#volumeGradient)" />
                <Area type="monotone" dataKey="flagged" name="High risk" stroke="#dc2626" strokeWidth={1.8} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card distribution-card page-enter">
          <CardHeading title="Risk distribution" description={`${overview.totalTransactions.toLocaleString('en-IN')} transactions evaluated`} />
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={67} outerRadius={88} paddingAngle={3} stroke="none">
                  {riskDistribution.map((entry, index) => <Cell key={entry.name} fill={riskColors[index]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dce3ed', borderRadius: 8, color: '#1a2438', boxShadow: '0 4px 14px rgba(11,28,48,.12)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{overview.totalTransactions.toLocaleString('en-IN')}</strong><span>Evaluated</span></div>
          </div>
          <div className="distribution-list">
            {riskDistribution.map((entry, index) => (
              <div key={entry.name}><i style={{ background: riskColors[index] }} /><span>{entry.name}</span><strong>{entry.value.toLocaleString('en-IN')}</strong><small>{(entry.value / Math.max(overview.totalTransactions, 1) * 100).toFixed(1)}%</small></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dashboard-lower-grid">
        <Card className="page-enter">
          <CardHeading title="Suspicious transactions" description="Priority cases that need investigation" action={<Link className="text-link" to="/transactions">All transactions <ArrowRight size={14} /></Link>} />
          <div className="transaction-list">
            {suspicious.map((transaction) => (
              <Link className="transaction-row" to={`/transactions/${transaction.id}`} key={transaction.id}>
                <span className="txn-mark"><ShieldAlert size={16} /></span>
                <span className="txn-main"><strong>{transaction.id} <i>·</i> {transaction.merchant}</strong><small>{transaction.accountId} · {transaction.reasons.slice(0, 2).join(' + ')}</small></span>
                <span className="txn-amount"><strong>{formatCurrency(transaction.amount, transaction.currency)}</strong><small>{formatDateTime(transaction.timestamp)}</small></span>
                <RiskBadge level={transaction.riskLevel} />
                <ArrowUpRight className="row-arrow" size={15} />
              </Link>
            ))}
          </div>
        </Card>
        <Card className="page-enter activity-card">
          <CardHeading title="Investigation activity" description="Latest analyst and detection events" action={<Clock3 size={16} className="muted-icon" />} />
          <div className="activity-list">
            {recentActivity.map(({ id, title, note, time, icon: Icon }) => (
              <div className="activity-item" key={id}>
                <span className="activity-icon"><Icon size={15} /></span>
                <span><strong>{title}</strong><small>{note}</small></span>
                <time>{time}</time>
              </div>
            ))}
          </div>
          <Link className="activity-footer" to="/alerts">View alert operations <ArrowRight size={14} /></Link>
        </Card>
      </div>
    </div>
  )
}
