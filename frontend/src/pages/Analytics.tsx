import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, BadgeCheck, CircleDollarSign, Clock3, ShieldCheck } from 'lucide-react'
import { useAppData } from '../context/AppData'
import { formatCurrency } from '../lib/format'
import { Card, CardHeading, PageHeading, StatCard } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

type Range = '24 Hours' | '7 Days' | '30 Days'
const colors = ['#64748b', '#4a9bd8', '#d4952e', '#dc3d46']

export function Analytics() {
  const scope = usePageMotion()
  const { transactions, settings, rules, overview, riskDistribution, loadActivity } = useAppData()
  const [range, setRange] = useState<Range>('7 Days')
  const [activity, setActivity] = useState<{ label: string; transactions: number; alerts: number }[]>([])
  const stats = useMemo(() => {
    const outcomes = { New: 0, Reviewing: 0, Resolved: 0, 'False Positive': 0 }
    transactions.forEach((transaction) => {
      outcomes[transaction.status] += 1
    })
    return { outcomes }
  }, [transactions])

  useEffect(() => {
    let active = true
    const apiRange = range === '24 Hours' ? '24h' : range === '7 Days' ? '7d' : '30d'
    void loadActivity(apiRange).then((buckets) => {
      if (!active) return
      setActivity(buckets.map((bucket) => ({
        label: range === '24 Hours'
          ? new Date(bucket.date).toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
          : new Date(bucket.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        transactions: bucket.transactions,
        alerts: bucket.alerts,
      })))
    }).catch(() => undefined)
    return () => { active = false }
  }, [loadActivity, range])

  const currency = settings.currency
  const volume = overview.volumeByCurrency.find((bucket) => bucket.currency === currency)

  const riskRows = [
    { name: 'Low risk', value: riskDistribution.Low },
    { name: 'Medium', value: riskDistribution.Medium },
    { name: 'High risk', value: riskDistribution.High },
    { name: 'Critical', value: riskDistribution.Critical },
  ]
  const outcomes = [
    { name: 'New', value: stats.outcomes.New },
    { name: 'Reviewing', value: stats.outcomes.Reviewing },
    { name: 'Resolved', value: stats.outcomes.Resolved },
    { name: 'False positive', value: stats.outcomes['False Positive'] },
  ]
  const falsePositiveRate = stats.outcomes['False Positive'] / Math.max(transactions.length, 1) * 100

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading eyebrow="WORKSPACE  /  FORENSIC INTELLIGENCE" title="Fraud Analytics" description="Understand risk patterns, rule triggers, and investigation outcomes across persisted transactions." actions={<span className="sync-label"><Clock3 size={14} />Backend · Synced now</span>} />
      <Card className="analytics-toolbar page-enter">
        <div className="range-switch" role="group" aria-label="Analytics date range">
          {(['24 Hours', '7 Days', '30 Days'] as Range[]).map((item) => <button className={range === item ? 'selected' : ''} onClick={() => setRange(item)} key={item}>{item}</button>)}
        </div>
        <span>{transactions.length.toLocaleString('en-IN')} transactions evaluated <i /> High-fidelity deterministic filter</span>
      </Card>
      <div className="stat-grid analytics-stats">
        <StatCard label="Flagged capital" value={formatCurrency(volume?.flaggedVolume ?? 0, currency)} detail={`${((volume?.flaggedVolume ?? 0) / Math.max(volume?.totalVolume ?? 0, 1) * 100).toFixed(1)}% of ${currency} volume`} icon={<CircleDollarSign size={17} />} tone="red" />
        <StatCard label="Open investigations" value={(stats.outcomes.New + stats.outcomes.Reviewing).toLocaleString('en-IN')} detail={`${stats.outcomes.Reviewing.toLocaleString('en-IN')} currently reviewing`} icon={<Clock3 size={17} />} tone="amber" />
        <StatCard label="False positive rate" value={`${falsePositiveRate.toFixed(1)}%`} detail={`${stats.outcomes['False Positive'].toLocaleString('en-IN')} dismissed cases`} icon={<BadgeCheck size={17} />} tone="blue" />
        <StatCard label="Rules active" value={rules.filter((rule) => rule.enabled).length.toLocaleString('en-IN')} detail="Configured scoring rules" icon={<ShieldCheck size={17} />} />
      </div>
      <div className="analytics-chart-grid">
        <Card className="chart-card page-enter">
          <CardHeading title="Transaction volume" description={`${range} transaction activity and risk alerts`} action={<span className="chart-legend"><i />Transactions <i className="legend-amber" />Alerts</span>} />
          <div className="chart-area analytics-volume">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 8, right: 10, bottom: 0, left: -15 }}>
                <CartesianGrid stroke="#e7ebf1" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} interval={range === '30 Days' ? 3 : 0} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dce3ed', borderRadius: 8, color: '#1a2438', boxShadow: '0 4px 14px rgba(11,28,48,.12)' }} />
                <Bar dataKey="transactions" name="Transactions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="alerts" name="Alerts" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card page-enter">
          <CardHeading title="Risk score distribution" description="Tier segmentation across the seeded dataset" />
          <div className="analytics-donut-layout">
            <div className="donut-wrap small-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={riskRows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={3} stroke="none">{riskRows.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><Tooltip contentStyle={{ background: '#fff', border: '1px solid #dce3ed', borderRadius: 8, color: '#1a2438', boxShadow: '0 4px 14px rgba(11,28,48,.12)' }} /></PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>{overview.totalTransactions.toLocaleString('en-IN')}</strong><span>txns</span></div>
            </div>
            <div className="distribution-list">
              {riskRows.map((entry, index) => <div key={entry.name}><i style={{ background: colors[index] }} /><span>{entry.name}</span><strong>{entry.value.toLocaleString('en-IN')}</strong><small>{(entry.value / Math.max(overview.totalTransactions, 1) * 100).toFixed(1)}%</small></div>)}
            </div>
          </div>
        </Card>
      </div>
      <Card className="outcomes-card page-enter">
        <CardHeading title="Investigation outcomes" description="Disposition counts for all transactions" action={<span className="subtle-metric"><ArrowDownRight size={14} />Status updates persist in MongoDB</span>} />
        <div className="outcome-grid">{outcomes.map((item, index) => <div className={`outcome-tile outcome-${index}`} key={item.name}><span>{item.name}</span><strong>{item.value.toLocaleString('en-IN')}</strong><div><i style={{ width: `${item.value / Math.max(transactions.length, 1) * 100}%` }} /></div><small>{(item.value / Math.max(transactions.length, 1) * 100).toFixed(1)}% of transactions</small></div>)}</div>
      </Card>
      <div className="info-callout analytics-footnote">Analytics summarize fictional transactions stored by the backend. Risk scores represent rule signals, not a probability of fraud.</div>
    </div>
  )
}
