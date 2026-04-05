import { DISPLAY_MODE, formatDate, formatSize, formatThreat, formatVelocity } from '../../utils/formatters.js';
import ResultsPanel from './ResultsPanel.jsx';

const SIM_SPEEDS = [0.5, 1, 2, 4];

function formatCoordinate(value, positive, negative) {
  const absolute = Math.abs(value).toFixed(4);
  return `${absolute}° ${value >= 0 ? positive : negative}`;
}

function humanDiameterComparison(km) {
  const meters = (Number.parseFloat(km) || 0) * 1000;
  const footballFields = Math.max(1, Math.round(meters / 91.44));
  return `~${footballFields} football fields wide`;
}

export default function ControlPanel({
  mode,
  asteroids,
  loading,
  selectedAsteroid,
  selectedId,
  onSelectAsteroid,
  impactPoint,
  hoveredRegion,
  terrainPreset,
  onPreset,
  onClearImpactPoint,
  advancedOpen,
  onToggleAdvanced,
  approachAngle,
  onApproachAngleChange,
  speedOverrideEnabled,
  onSpeedOverrideToggle,
  speedOverrideKms,
  onSpeedOverrideChange,
  simulationSpeed,
  onSimulationSpeedChange,
  canLaunch,
  onLaunch,
  onAbort,
  simulationState,
  timeline,
  resultCards,
  results,
  onShare,
  onReset,
}) {
  const threat = selectedAsteroid ? formatThreat(selectedAsteroid.threat_score, mode) : null;

  return (
    <aside className={`impact-lab__panel${simulationState.status === 'running' ? ' is-dimmed' : ''}`}>
      <section className="impact-lab__panel-section">
        <p className="impact-lab__eyebrow">Impact Lab</p>
        <h1>Impact Lab</h1>
        <p>Select an object. Choose a target. Run simulation.</p>
        <div className="impact-lab__separator" />
      </section>

      <section className="impact-lab__panel-section">
        <div className="impact-lab__section-head">
          <div>
            <p className="impact-lab__eyebrow">Object Selector</p>
            <h2>Select Asteroid</h2>
          </div>
        </div>

        <select value={selectedId || ''} onChange={(event) => onSelectAsteroid(event.target.value)} disabled={loading}>
          {(loading ? [] : asteroids).map((asteroid) => {
            const itemThreat = formatThreat(asteroid.threat_score, DISPLAY_MODE.NERD);
            return (
              <option key={asteroid.id} value={asteroid.id}>
                {`${asteroid.name} — Threat ${itemThreat.score} — ${itemThreat.label}`}
              </option>
            );
          })}
        </select>

        {selectedAsteroid && threat ? (
          <article className="impact-lab__selected-card" style={{ '--threat-color': threat.color }}>
            <div className="impact-lab__selected-card-head">
              <div>
                <p className="impact-lab__eyebrow">Tracked Object</p>
                <h3>{mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${selectedAsteroid.name}` : selectedAsteroid.name}</h3>
              </div>
              <span className="impact-lab__threat-badge">{mode === DISPLAY_MODE.HUMAN ? threat.label : `${threat.score}/100`}</span>
            </div>

            <div className="impact-lab__selected-grid">
              <div>
                <span>Diameter</span>
                <strong>{mode === DISPLAY_MODE.HUMAN ? humanDiameterComparison(selectedAsteroid.estimated_diameter_max_km) : formatSize(selectedAsteroid.estimated_diameter_max_km, mode)}</strong>
              </div>
              <div>
                <span>Velocity</span>
                <strong>{formatVelocity((Number.parseFloat(selectedAsteroid.relative_velocity_kph) || 0) / 3600, DISPLAY_MODE.HUMAN)}</strong>
              </div>
              <div>
                <span>Threat</span>
                <strong>{mode === DISPLAY_MODE.HUMAN ? threat.display : threat.label}</strong>
              </div>
              <div>
                <span>Closest Approach</span>
                <strong>{formatDate(selectedAsteroid.close_approach_date_full || selectedAsteroid.close_approach_date, mode)}</strong>
              </div>
            </div>
          </article>
        ) : null}
      </section>

      <section className="impact-lab__panel-section">
        <div className="impact-lab__section-head">
          <div>
            <p className="impact-lab__eyebrow">Impact Point</p>
            <h2>Target Coordinates</h2>
          </div>
        </div>

        {!impactPoint ? (
          <div className="impact-lab__target-state impact-lab__target-state--empty">
            <span className="impact-lab__crosshair-pulse">◎</span>
            <p>Click on the globe to set impact point</p>
            <small>{hoveredRegion ? `Hover region: ${hoveredRegion}` : 'Manual placement is armed when an asteroid is selected.'}</small>
          </div>
        ) : (
          <div className="impact-lab__target-state">
            <div>
              <span>LAT</span>
              <strong>{formatCoordinate(impactPoint.lat, 'N', 'S')}</strong>
            </div>
            <div>
              <span>LNG</span>
              <strong>{formatCoordinate(impactPoint.lng, 'E', 'W')}</strong>
            </div>
            <div>
              <span>Region</span>
              <strong>{impactPoint.region}</strong>
            </div>
            <button type="button" className="impact-lab__ghost-button impact-lab__ghost-button--small" onClick={onClearImpactPoint}>Clear</button>
          </div>
        )}

        <div className="impact-lab__preset-row">
          {[
            ['ocean', '🌊 Ocean Impact'],
            ['land', '🏙️ Land Impact'],
            ['random', '🏔️ Random'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`impact-lab__preset${terrainPreset === key ? ' is-active' : ''}`}
              onClick={() => onPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="impact-lab__panel-section">
        <button type="button" className="impact-lab__accordion" onClick={onToggleAdvanced}>
          <span>Advanced Parameters</span>
          <strong>{advancedOpen ? '▴' : '▾'}</strong>
        </button>

        {advancedOpen ? (
          <div className="impact-lab__advanced-grid">
            <div className="impact-lab__slider-card">
              <div className="impact-lab__slider-head">
                <span>Approach Angle</span>
                <strong>{approachAngle}°</strong>
              </div>
              <input type="range" min="10" max="90" value={approachAngle} onChange={(event) => onApproachAngleChange(Number(event.target.value))} />
              <small>{approachAngle < 30 ? 'Grazing entry' : approachAngle < 65 ? 'Controlled descent' : 'Direct strike'}</small>
            </div>

            <div className="impact-lab__slider-card">
              <div className="impact-lab__toggle-row">
                <span>Impact Speed Override</span>
                <button type="button" className={`impact-lab__inline-toggle${speedOverrideEnabled ? ' is-active' : ''}`} onClick={onSpeedOverrideToggle}>
                  {speedOverrideEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <input type="range" min="11" max="72" value={speedOverrideKms} onChange={(event) => onSpeedOverrideChange(Number(event.target.value))} disabled={!speedOverrideEnabled} />
              <small>{speedOverrideEnabled ? `${speedOverrideKms} km/s` : 'Using asteroid telemetry speed'}</small>
            </div>

            <div className="impact-lab__slider-card">
              <span>Simulation Speed</span>
              <div className="impact-lab__speed-row">
                {SIM_SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`impact-lab__speed-pill${simulationSpeed === value ? ' is-active' : ''}`}
                    onClick={() => onSimulationSpeedChange(value)}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="impact-lab__panel-section">
        <button
          type="button"
          className={`impact-lab__launch-button${simulationState.status === 'running' ? ' is-abort' : ''}${canLaunch ? ' is-active' : ''}`}
          onClick={simulationState.status === 'running' ? onAbort : onLaunch}
          disabled={simulationState.status !== 'running' && !canLaunch}
        >
          {simulationState.status === 'running' ? '■ Abort Simulation' : canLaunch ? '▶ Initiate Simulation' : 'Set impact point to continue'}
        </button>
      </section>

      {(simulationState.status === 'running' || simulationState.status === 'complete') ? (
        <section className="impact-lab__panel-section">
          <div className="impact-lab__section-head">
            <div>
              <p className="impact-lab__eyebrow">Simulation Timeline</p>
              <h2>Phases</h2>
            </div>
          </div>

          <div className="impact-lab__timeline">
            {timeline.map((phase) => (
              <div key={phase.id} className={`impact-lab__timeline-item is-${phase.state}`}>
                <span className="impact-lab__timeline-dot">◉</span>
                <div>
                  <strong>{phase.label}</strong>
                  <small>{phase.durationLabel}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {simulationState.status === 'complete' ? (
        <ResultsPanel cards={resultCards} results={results} onShare={onShare} onReset={onReset} />
      ) : null}
    </aside>
  );
}
