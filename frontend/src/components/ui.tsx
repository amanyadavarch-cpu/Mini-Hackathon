import type { PropsWithChildren, ReactNode } from 'react'
import { ArrowUpRight, CircleHelp, Search } from 'lucide-react'
import type { InvestigationStatus, RiskLevel } from '../types'

export function PageHeading({ eyebrow, title, description, actions }: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="page-heading page-enter">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>
}

export function CardHeading({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, detail, icon, tone = 'mint' }: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  tone?: 'mint' | 'red' | 'amber' | 'blue'
}) {
  return (
    <article className={`stat-card stagger-enter tone-${tone}`}>
      <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge risk-${level.toLowerCase()}`}><span className="badge-dot" />{level}</span>
}

export function StatusBadge({ status }: { status: InvestigationStatus }) {
  return <span className={`badge status-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Search size={24} /><strong>{title}</strong><span>{description}</span></div>
}

export function NotFound({ title = 'Nothing to show yet', description = 'Try changing your search or filters.' }: {
  title?: string
  description?: string
}) {
  return <div className="empty-state"><CircleHelp size={24} /><strong>{title}</strong><span>{description}</span></div>
}

export function InlineLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return <a className="inline-link" href={href}>{children}<ArrowUpRight size={14} /></a>
}
