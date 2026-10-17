import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider } from './context/AppData'
import { AppShell } from './components/AppShell'
import { Card, NotFound } from './components/ui'
import { useAppData } from './context/AppData'
import { Login } from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })))
const Transactions = lazy(() => import('./pages/Transactions').then((module) => ({ default: module.Transactions })))
const Investigation = lazy(() => import('./pages/Investigation').then((module) => ({ default: module.Investigation })))
const Alerts = lazy(() => import('./pages/Alerts').then((module) => ({ default: module.Alerts })))
const Analytics = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.Analytics })))
const Rules = lazy(() => import('./pages/Rules').then((module) => ({ default: module.Rules })))
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })))

function MissingPage() {
  return <Card><NotFound title="Page not found" description="Use the navigation to return to the Fraud Radar workspace." /></Card>
}

function RouteLoading() {
  return <div className="panel route-loading" role="status">Loading workspace…</div>
}

export default function App() {
  return (
    <AppDataProvider>
      <AuthenticatedApp />
    </AppDataProvider>
  )
}

function AuthenticatedApp() {
  const { user, authLoading, loading } = useAppData()
  if (authLoading || (user && loading)) return <div className="panel route-loading auth-loading" role="status">Connecting to Fraud Radar API…</div>
  if (!user) return <Login />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Suspense fallback={<RouteLoading />}><Dashboard /></Suspense>} />
        <Route path="/transactions" element={<Suspense fallback={<RouteLoading />}><Transactions /></Suspense>} />
        <Route path="/transactions/:id" element={<Suspense fallback={<RouteLoading />}><Investigation /></Suspense>} />
        <Route path="/alerts" element={<Suspense fallback={<RouteLoading />}><Alerts /></Suspense>} />
        <Route path="/analytics" element={<Suspense fallback={<RouteLoading />}><Analytics /></Suspense>} />
        <Route path="/rules" element={<Suspense fallback={<RouteLoading />}><Rules /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<RouteLoading />}><Settings /></Suspense>} />
        <Route path="*" element={<MissingPage />} />
      </Route>
    </Routes>
  )
}
