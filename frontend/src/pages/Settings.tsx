import { useEffect, useState } from 'react'
import { Check, CircleDollarSign, Database, Save, Settings2, Sparkles } from 'lucide-react'
import { useAppData } from '../context/AppData'
import type { AppSettings } from '../types'
import { Card, CardHeading, PageHeading } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

export function Settings() {
  const scope = usePageMotion()
  const { settings, setSettings } = useAppData()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(settings), [settings])

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function save() {
    setSettings(draft)
    setSaved(true)
  }

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading eyebrow="WORKSPACE  /  PREFERENCES" title="Settings" description="Manage display preferences and the default currency for new transactions." actions={<span className="active-engine"><Sparkles size={15} />Sandbox · Seeded</span>} />
      <div className="settings-grid">
        <div className="page-stack">
          <Card className="page-enter">
            <CardHeading title="General & environment" description="Authenticated API connected to the MongoDB workspace." />
            <div className="environment-row"><span className="setting-icon"><Database size={16} /></span><span><strong>Environment</strong><small>Sandbox / Demo workspace</small></span><span className="setting-pill">ACTIVE SEED</span></div>
          </Card>
          <Card className="page-enter">
            <CardHeading title="Currency & display" description="Choose how values and transaction rows appear." />
            <label className="setting-select-row"><span className="setting-icon"><CircleDollarSign size={17} /></span><span><strong>New transaction currency</strong><small>Default currency for transactions created in this workspace</small></span><select value={draft.currency} onChange={(event) => update('currency', event.target.value as AppSettings['currency'])}><option value="INR">INR · Indian Rupee (₹)</option><option value="USD">USD · US Dollar ($)</option></select></label>
            <div className="environment-row"><span className="setting-icon"><Settings2 size={16} /></span><span><strong>Compact transaction rows</strong><small>Fit more results into each table view</small></span><label className="switch-control"><input aria-label="Compact transaction rows" type="checkbox" checked={draft.compactRows} onChange={(event) => update('compactRows', event.target.checked)} /><span className="toggle-track" /></label></div>
          </Card>
        </div>
        <div className="page-stack">
          <Card className="page-enter">
            <CardHeading title="Risk thresholds" description="Deterministic scoring tiers across the app." />
            <div className="threshold-list"><div><i className="risk-bg-low" /><span>Low risk</span><strong>0–24 pts</strong></div><div><i className="risk-bg-medium" /><span>Medium risk</span><strong>25–49 pts</strong></div><div><i className="risk-bg-high" /><span>High risk</span><strong>50–74 pts</strong></div><div><i className="risk-bg-critical" /><span>Critical risk</span><strong>75–100 pts</strong></div></div>
            <p className="setting-explainer">Risk scores are calculated by backend rules against available transaction signals. Scores are capped at 100.</p>
          </Card>
          <Card className="settings-warning page-enter"><ShieldAlertIcon /><strong>Demo data only</strong><p>Fraud Radar is a frontend simulation. No real financial accounts or payment activity are connected.</p></Card>
        </div>
      </div>
      <div className="settings-save-bar"><span>{saved && <><Check size={15} />Preferences saved on this device.</>}</span><button className="button button-primary" onClick={save}><Save size={15} />Save preferences</button></div>
    </div>
  )
}

function ShieldAlertIcon() {
  return <span className="warning-icon"><Settings2 size={17} /></span>
}
