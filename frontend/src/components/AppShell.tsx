import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  CircleHelp,
  ChevronDown,
  LayoutDashboard,
  Settings2,
  Shield,
  SlidersHorizontal,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { useAppData } from '../context/AppData'

const desktopNavItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: WalletCards },
  { to: '/transactions/TXN-8942', label: 'Investigate', icon: Shield },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/rules', label: 'Rules', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

export function AppShell() {
  const location = useLocation()
  const { transactions, alerts, user, logout, error, feedback, clearFeedback, refreshData } = useAppData()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  useEffect(() => setAccountMenuOpen(false), [location.pathname])
  const openAlerts = alerts.filter((alert) => alert.status === 'Open' || alert.status === 'Reviewing').length
  const investigationId = transactions.find((item) => item.riskScore >= 50)?.id ?? transactions[0]?.id
  const navItems = desktopNavItems.map((item) => item.label === 'Investigate'
    ? { ...item, to: investigationId ? `/transactions/${investigationId}` : '/transactions' }
    : item)
  const mobileNavItems = navItems.filter((item) =>
    ['/dashboard', '/transactions', '/rules'].includes(item.to) || item.label === 'Investigate' || item.to === '/alerts',
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  const navigation = (items: typeof desktopNavItems) => items.map(({ to, label, icon: Icon }) => {
    const active = label === 'Investigate'
      ? location.pathname.startsWith('/transactions/') && location.pathname !== '/transactions/'
      : to === '/transactions'
        ? location.pathname === '/transactions'
        : location.pathname === to
    return (
      <Link
        key={to}
        to={to}
        aria-current={active ? 'page' : undefined}
        className={`nav-item ${active ? 'active' : ''}`}
        aria-label={label}
      >
        <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
      </Link>
    )
  })

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/dashboard" aria-label="Fraud Radar overview">
          <span className="brand-mark"><Shield size={19} strokeWidth={2.2} /><Activity size={10} /></span>
          <span className="brand-copy"><strong>Fraud Radar</strong><small>DEMO MODE · SEEDED</small></span>
        </NavLink>
        <div className="topbar-right">
          <span className="stream-indicator is-live"><span />API connected</span>
          <NavLink to="/alerts" className="icon-button notification-button" aria-label={`${openAlerts} open alerts`}>
            <Bell size={17} /><i>{Math.min(openAlerts, 99)}</i>
          </NavLink>
          <div className="account-menu-wrap">
            <button className="avatar-button" onClick={() => setAccountMenuOpen((open) => !open)} aria-label={`${user?.name ?? 'Analyst'} account menu`} aria-expanded={accountMenuOpen}><UserRound size={17} /><ChevronDown className="account-chevron" size={11} /></button>
            {accountMenuOpen && <div className="account-menu"><span>{user?.name} · {user?.role}</span><Link to="/analytics"><ChartNoAxesCombined size={14} />Analytics</Link><Link to="/settings"><Settings2 size={14} />Settings</Link><button onClick={logout}>Sign out</button></div>}
          </div>
        </div>
      </header>
      <aside className="desktop-sidebar" aria-label="Workspace navigation">
        <div className="sidebar-caption">WORKSPACE</div>
        {navigation(navItems)}
        <div className="sidebar-demo"><span /><div><strong>DEMO WORKSPACE</strong><small>Synthetic data only</small></div></div>
      </aside>
      <main className="workspace">
        {error && <div className="api-message api-error" role="alert"><span>{error}</span><button onClick={() => void refreshData().catch(() => undefined)}>Retry</button></div>}
        {feedback && <div className="api-message api-success" role="status"><span>{feedback}</span><button aria-label="Dismiss notification" onClick={clearFeedback}>×</button></div>}
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation(mobileNavItems)}
      </nav>
      <div className="demo-disclaimer"><CircleHelp size={12} /> Synthetic demo data · No real financial activity</div>
      <NavLink to="/settings" className="help-button" aria-label="Settings and help"><CircleHelp size={16} /></NavLink>
    </div>
  )
}
