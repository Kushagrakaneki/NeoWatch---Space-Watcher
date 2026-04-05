import { useState } from 'react';
import { subscribe } from '../hooks/useNeoWatch.js';

export default function AlertsPage() {
  const [email, setEmail] = useState('');
  const [threshold, setThreshold] = useState(65);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email.includes('@')) {
      setStatus({ type: 'error', msg: 'Enter a valid email address to arm the alert protocol.' });
      return;
    }

    setLoading(true);
    try {
      const result = await subscribe(email, threshold);
      setStatus({
        type: result.emailStatus === 'sent' ? 'success' : 'warning',
        msg: result.message || `Alert protocol armed for threat scores at or above ${threshold}.`,
      });
      if (result.emailStatus === 'sent') setEmail('');
    } catch (error) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  const thresholdTone = threshold >= 85
    ? { label: 'critical only', color: '#ff7a45' }
    : threshold >= 65
      ? { label: 'high and above', color: '#ffb347' }
      : threshold >= 40
        ? { label: 'medium and above', color: '#7ce9ff' }
        : { label: 'broad watch', color: '#3ddcff' };

  return (
    <div className="page-shell alerts-shell">
      <section className="page-hero panel">
        <div>
          <p className="panel-kicker">alert protocols</p>
          <h1>Dispatch beautiful, immediate warnings when the sky gets uncomfortably interesting.</h1>
        </div>
        <p>
          Arm email notifications for the next scan cycle and tune the response threshold to your risk appetite.
        </p>
      </section>

      <section className="alerts-grid">
        <div className="panel alert-steps">
          <div className="panel-kicker">response flow</div>
          <div className="alert-step-list">
            {[
              ['01', 'NASA feed ingested', 'Telemetry sync refreshes the local object registry on the scheduled cadence.'],
              ['02', 'Threat score recomputed', 'Every object is weighted by speed, distance, size, and hazard classification.'],
              ['03', 'Confirmation sent now', 'Subscriptions now attempt a real confirmation email immediately so the feature never feels silent.'],
            ].map(([step, title, description]) => (
              <article key={step} className="alert-step-card">
                <span>{step}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel alert-form-panel">
          <div className="panel-kicker">activate alerts</div>

          <label className="field-label" htmlFor="alert-email">email address</label>
          <input
            id="alert-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSubscribe()}
            placeholder="operator@mission-control.com"
          />

          <div className="slider-head">
            <div>
              <span className="field-label">minimum threat score</span>
            </div>
            <div className="slider-value" style={{ '--slider-color': thresholdTone.color }}>
              <strong>{threshold}</strong>
              <span>{thresholdTone.label}</span>
            </div>
          </div>

          <input
            className="threshold-slider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ accentColor: thresholdTone.color }}
          />

          <div className="slider-scale">
            <span>0 broad watch</span>
            <span>40 medium+</span>
            <span>65 high+</span>
            <span>85 critical</span>
          </div>

          {status && (
            <div className={`feedback-banner feedback-banner--${status.type}`}>
              {status.msg}
            </div>
          )}

          <button type="button" className="primary-button" disabled={loading} onClick={handleSubscribe}>
            {loading ? 'Arming protocol...' : 'Arm alert subscription'}
          </button>
        </div>
      </section>

      <section className="alerts-interactive-grid">
        <div className="panel threshold-theater">
          <div className="panel-kicker">threshold theater</div>
          <div className="threshold-theater__dial">
            <div className="threshold-theater__ring" style={{ '--dial-angle': `${threshold * 3.6}deg`, '--dial-color': thresholdTone.color }}>
              <div className="threshold-theater__core">
                <strong>{threshold}</strong>
                <span>{thresholdTone.label}</span>
              </div>
            </div>
          </div>
          <div className="threshold-theater__bands">
            {[25, 50, 75, 100].map((value) => (
              <span key={value} style={{ width: `${value}%`, background: threshold >= value ? thresholdTone.color : 'rgba(255,255,255,0.08)' }} />
            ))}
          </div>
        </div>

        <div className="panel protocol-scenarios">
          <div className="panel-kicker">operator scenarios</div>
          {[
            { title: 'Wide watch', desc: 'Good for ambient monitoring when you want to feel everything moving nearby.', active: threshold < 40 },
            { title: 'Escalation mode', desc: 'Filters the noise and surfaces only objects with meaningful approach pressure.', active: threshold >= 40 && threshold < 85 },
            { title: 'Catastrophe only', desc: 'Reserved for the signatures that should wake the room instantly.', active: threshold >= 85 },
          ].map((scenario) => (
            <article key={scenario.title} className={`protocol-scenarios__card${scenario.active ? ' is-active' : ''}`}>
              <h3>{scenario.title}</h3>
              <p>{scenario.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mail-preview">
        <div className="panel-kicker">dispatch preview</div>
        <div className="mail-preview__card">
          <div className="mail-preview__subject">
            <span className="status-dot" style={{ '--status-color': '#ffb347' }} />
            <strong>HIGH PRIORITY OBJECT / THREAT SCORE 72</strong>
          </div>
          <p>
            Includes miss distance, projected close approach, diameter, hazard flag, and direct NASA reference links so responders can act fast.
          </p>
        </div>
      </section>
    </div>
  );
}
