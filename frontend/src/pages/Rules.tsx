import { useState } from 'react'
import { Check, RotateCcw, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useAppData } from '../context/AppData'
import type { ScoringRule } from '../types'
import { Card, CardHeading, PageHeading } from '../components/ui'
import { usePageMotion } from '../hooks/usePageMotion'

export function Rules() {
  const scope = usePageMotion()
  const { rules, resetRules, setRule, user } = useAppData()
  const canManageRules = user?.role === 'admin'
  const [message, setMessage] = useState('')
  const activeCount = rules.filter((rule) => rule.enabled).length

  async function changeWeight(rule: ScoringRule, raw: string) {
    if (raw === '') return
    const weight = Number(raw)
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      setMessage('Rule weights must be whole numbers between 0 and 100.')
      return
    }
    await setRule(rule.id, { weight })
    setMessage('Rule weight saved. Transaction scores are recalculated by the backend.')
  }

  async function toggleRule(rule: ScoringRule) {
    await setRule(rule.id, { enabled: !rule.enabled })
    setMessage(`${rule.label} ${rule.enabled ? 'disabled' : 'enabled'}. Backend scores updated.`)
  }

  return (
    <div className="page-stack" ref={scope}>
      <PageHeading eyebrow="WORKSPACE  /  CONFIGURATION" title="Detection Rules" description="Configure and understand how transaction risk is calculated." actions={<span className="active-engine"><ShieldCheck size={15} />v2.4 · Active</span>} />
      <div className="rules-overview-grid">
        <Card className="engine-card page-enter">
          <div className="engine-state"><span className="engine-icon"><SlidersHorizontal size={17} /></span><div><strong>Heuristic engine status</strong><small>Active · Deterministic scoring</small></div><span className="engine-count">{activeCount} active</span></div>
          <div className="formula-box"><span>SCORING FORMULA</span><strong>Risk score = min(100, Σ triggered rule weights)</strong><p>Maximum score is capped at 100. Scores represent heuristic signals, not probability or proof of fraud.</p></div>
          <div className="rules-note"><ShieldCheck size={15} />All data in this workspace is fictional and seeded for the demo.</div>
        </Card>
        <Card className="engine-card score-band-card page-enter">
          <CardHeading title="Risk classification" description="Applied consistently across the workspace" />
          <div className="score-band">
            <div><i className="risk-bg-low" /><span>Low risk</span><strong>0–24</strong></div>
            <div><i className="risk-bg-medium" /><span>Medium risk</span><strong>25–49</strong></div>
            <div><i className="risk-bg-high" /><span>High risk</span><strong>50–74</strong></div>
            <div><i className="risk-bg-critical" /><span>Critical risk</span><strong>75–100</strong></div>
          </div>
        </Card>
      </div>
      <Card className="rules-card page-enter">
        <CardHeading title="Configured rules" description={`${rules.length} rule signals · weight changes recalculate transaction risk`} action={canManageRules && <button className="button button-secondary button-small" onClick={() => { void resetRules().then(() => setMessage('Default scoring baselines restored.')).catch(() => undefined) }}><RotateCcw size={14} />Reset baselines</button>} />
        <div className="rule-list">
          {rules.map((rule) => (
            <article className={`rule-row ${rule.enabled ? '' : 'disabled-rule'}`} key={rule.id}>
              <div className="rule-icon"><SlidersHorizontal size={17} /></div>
              <div className="rule-info"><div className="rule-title"><h3>{rule.label}</h3><span className="rule-category">HEURISTIC SIGNAL</span></div><p>{rule.description}</p><div className="rule-controls"><label className="weight-control"><span>Assigned risk weight</span><span className="weight-input"><input disabled={!canManageRules} type="number" aria-label={`${rule.label} weight`} min="0" max="100" step="5" value={rule.weight} onChange={(event) => { void changeWeight(rule, event.target.value).catch(() => undefined) }} /><small>pts</small></span></label><label className="rule-toggle"><input disabled={!canManageRules} type="checkbox" checked={rule.enabled} onChange={() => { void toggleRule(rule).catch(() => undefined) }} /><span className="toggle-track" /><span>{rule.enabled ? 'Enabled' : 'Disabled'}</span></label></div></div>
              <span className={`rule-weight ${rule.enabled ? '' : 'muted-weight'}`}>{rule.enabled ? '+' : ''}{rule.weight} <small>pts</small></span>
            </article>
          ))}
        </div>
        <div className="rules-footer"><span>{message || (canManageRules ? 'Changes are stored in the backend and recalculate transaction risk.' : 'Only administrators can modify scoring rules.')}</span><span><Check size={14} />API CONFIG</span></div>
      </Card>
    </div>
  )
}
