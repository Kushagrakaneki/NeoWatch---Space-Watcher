import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AsteroidCard from '../components/AsteroidCard.jsx';
import OrbitalScene from '../components/OrbitalScene.jsx';
import ThreatRing from '../components/ThreatRing.jsx';
import { useAsteroids, useCritical, useStats } from '../hooks/useNeoWatch.js';
import {
  DISPLAY_MODE,
  formatDate,
  formatDistance,
  formatSize,
  formatThreat,
  formatVelocity,
  generatePlainEnglishSummary,
} from '../utils/formatters.js';

const chartColors = ['#ff7a45', '#ffb347', '#7ce9ff', '#3ddcff'];

function CountMetric({ value, suffix = '', decimals = 0 }) {
  const target = Number.parseFloat(value) || 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frameId;
    const startedAt = performance.now();
    const duration = 1200;

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target]);

  return `${display.toFixed(decimals)}${suffix}`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p>{payload[0].name}</p>
      <strong>{payload[0].value} tracked</strong>
    </div>
  );
};

export default function Dashboard({ ws, mode = DISPLAY_MODE.NERD }) {
  const { stats } = useStats();
  const { data: critical } = useCritical();
  const { data: allAsteroids } = useAsteroids({ limit: 18, days: 7, sort: 'threat_score', order: 'DESC' });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!allAsteroids.length) return;
    const stillExists = allAsteroids.find((item) => item.id === selected?.id);
    if (stillExists) return;
    setSelected(allAsteroids[0]);
  }, [allAsteroids, selected]);

  const selectedAsteroid = selected || allAsteroids[0];
  const selectedThreat = selectedAsteroid ? formatThreat(selectedAsteroid.threat_score, mode) : null;
  const velocityKms = selectedAsteroid ? (Number.parseFloat(selectedAsteroid.relative_velocity_kph) || 0) / 3600 : 0;

  const chartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Critical', value: Number.parseInt(stats.critical_count, 10) || 0 },
      { name: 'High', value: Number.parseInt(stats.high_count, 10) || 0 },
      { name: 'Medium', value: Number.parseInt(stats.medium_count, 10) || 0 },
      { name: 'Low', value: Number.parseInt(stats.low_count, 10) || 0 },
    ];
  }, [stats]);

  const selectedForecast = selectedAsteroid ? [
    {
      label: 'collision probability',
      value: Math.min(99, Math.max(2, (Number.parseFloat(selectedAsteroid.threat_score) || 0) * 0.86)),
      accent: '#ff7a45',
    },
    {
      label: 'thermal decay exposure',
      value: Math.min(100, 24 + (Number.parseFloat(selectedAsteroid.estimated_diameter_max_km) || 0) * 100),
      accent: '#7ce9ff',
    },
    {
      label: 'tracking confidence',
      value: Math.max(52, 100 - (Number.parseFloat(selectedAsteroid.miss_distance_lunar) || 10) * 1.7),
      accent: '#67ffc6',
    },
  ] : [];

  const missionStats = [
    { label: 'objects tracked', value: stats?.total_this_week, decimals: 0 },
    { label: 'high risk', value: stats?.high_count, decimals: 0 },
    { label: 'decaying orbits', value: Math.max(2, Math.round((Number.parseInt(stats?.high_count, 10) || 0) * 0.6)), decimals: 0 },
    {
      label: 'closest pass',
      value: mode === DISPLAY_MODE.HUMAN ? stats?.closest_lunar : stats?.closest_lunar,
      decimals: mode === DISPLAY_MODE.HUMAN ? 1 : 2,
      suffix: mode === DISPLAY_MODE.HUMAN ? 'x moon' : ' LD',
    },
  ];

  const warningCount = [stats?.critical_count, stats?.high_count]
    .map((value) => Number.parseInt(value, 10) || 0)
    .filter((value) => value > 0)
    .length;

  return (
    <div className="dashboard-shell">
      <section className="hero-layout">
        <aside className="mission-panel mission-panel--left panel-intro">
          <div className="panel-kicker">active debris queue</div>
          <h2>Live objects are orbiting the edge of catastrophe.</h2>
          <p>
            Hover any tracked signature in the central field to freeze its orbit and expose the latest collision telemetry.
          </p>

          <div className="mission-list">
            {(critical.length ? critical : allAsteroids.slice(0, 6)).map((asteroid) => (
              <button
                key={asteroid.id}
                type="button"
                className={`mission-list__item${selectedAsteroid?.id === asteroid.id ? ' is-active' : ''}`}
                onClick={() => setSelected(asteroid)}
              >
                <AsteroidCard asteroid={asteroid} compact mode={mode} />
              </button>
            ))}
          </div>
        </aside>

        <section className="hero-stage">
          <div className="hero-stage__topbar panel">
            <div>
              <p className="panel-kicker">mission status</p>
              <h2>{mode === DISPLAY_MODE.HUMAN ? 'IS EARTH IN DANGER?' : 'NEAR-EARTH OBJECT RESPONSE GRID'}</h2>
            </div>

            <div className="hero-stage__status-strip">
              <div className="system-chip is-live">
                <span className="status-dot" style={{ '--status-color': '#67ffc6' }} />
                <span>{mode === DISPLAY_MODE.HUMAN ? 'science team watching' : 'tracking stable'}</span>
              </div>
              <div className={`system-chip${warningCount > 1 ? ' is-warning' : ''}`}>
                <span className="status-dot" style={{ '--status-color': warningCount > 1 ? '#ffb347' : '#7ce9ff' }} />
                <span>{warningCount > 1 ? '2 warnings active' : 'nominal warnings'}</span>
              </div>
              <div className={`system-chip${ws.connected ? ' is-live' : ' is-offline'}`}>
                <span className="status-dot" style={{ '--status-color': ws.connected ? '#67ffc6' : '#ff7a45' }} />
                <span>{ws.connected ? 'websocket uplink' : 'uplink lost'}</span>
              </div>
            </div>
          </div>

          <div className="hero-copy">
            <div>
              <p className="panel-kicker">{mode === DISPLAY_MODE.HUMAN ? 'human mode' : 'deep space luxury interface'}</p>
              <h1>{mode === DISPLAY_MODE.HUMAN ? 'The sky is busy. Here is what actually matters.' : 'Watch the void calculate whether Earth gets lucky.'}</h1>
            </div>
            <p>
              {mode === DISPLAY_MODE.HUMAN
                ? 'Every asteroid is translated into plain English so you can tell, at a glance, whether it is harmless, worth watching, or a genuine problem.'
                : 'Cold telemetry, luminous orbital paths, and a live radar rhythm tuned for operators who need beauty and precision in the same breath.'}
            </p>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <span className="metric-card__label">debris count</span>
              <strong><CountMetric value={stats?.total_this_week} /></strong>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">{mode === DISPLAY_MODE.HUMAN ? 'objects worth watching' : 'collision alerts'}</span>
              <strong><CountMetric value={stats?.critical_count} /></strong>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">{mode === DISPLAY_MODE.HUMAN ? 'highest concern' : 'max threat'}</span>
              <strong>{selectedThreat ? (mode === DISPLAY_MODE.HUMAN ? selectedThreat.emoji : selectedThreat.display) : '--'}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">closest pass</span>
              <strong>{stats?.closest_lunar ? formatDistance(stats.closest_lunar, mode) : '--'}</strong>
            </div>
          </div>

          <div className="hero-orbit-panel panel">
            <OrbitalScene asteroids={allAsteroids} selectedId={selectedAsteroid?.id} onSelect={setSelected} mode={mode} />
          </div>
        </section>

        <aside className="mission-panel mission-panel--right">
          <div className="panel-kicker">selected object deep dive</div>

          {selectedAsteroid ? (
            <>
              <div className="selected-object-card">
                <div>
                  <p className="debris-list-card__id">tracking signature {selectedAsteroid.id}</p>
                  <h3>{mode === DISPLAY_MODE.HUMAN ? `${selectedThreat.emoji} ${selectedAsteroid.name}` : selectedAsteroid.name}</h3>
                  {mode === DISPLAY_MODE.HUMAN ? <p className="card-summary">{generatePlainEnglishSummary(selectedAsteroid, mode)}</p> : null}
                </div>
                <ThreatRing score={selectedAsteroid.threat_score} size={88} strokeWidth={6} mode={mode} />
              </div>

              <div className="detail-grid">
                <div className="detail-tile">
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'how close' : 'altitude proxy'}</span>
                  <strong>{formatDistance(selectedAsteroid.miss_distance_lunar, mode)}</strong>
                </div>
                <div className="detail-tile">
                  <span>velocity</span>
                  <strong>{formatVelocity(velocityKms, mode)}</strong>
                </div>
                <div className="detail-tile">
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'size' : 'diameter max'}</span>
                  <strong>{formatSize(selectedAsteroid.estimated_diameter_max_km, mode)}</strong>
                </div>
                <div className="detail-tile" title={`What does this mean for me? ${selectedThreat.tooltip}`}>
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'how worried to be' : 'hazard state'}</span>
                  <strong>{mode === DISPLAY_MODE.HUMAN ? selectedThreat.display : (selectedAsteroid.is_potentially_hazardous ? 'hazard flagged' : 'watch only')}</strong>
                </div>
              </div>

              <div className="forecast-panel">
                <div className="panel-kicker">trajectory forecast</div>
                {selectedForecast.map((metric) => (
                  <div key={metric.label} className="forecast-row">
                    <div className="forecast-row__head">
                      <span>{metric.label}</span>
                      <strong>{metric.value.toFixed(1)}%</strong>
                    </div>
                    <div className="forecast-row__bar">
                      <span style={{ width: `${metric.value}%`, background: metric.accent }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel orbital-params">
                <div className="panel-kicker">orbital parameters</div>
                <div className="orbital-params__row">
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'when it gets closest' : 'close approach'}</span>
                  <strong>{formatDate(selectedAsteroid.close_approach_date_full || selectedAsteroid.close_approach_date, mode)}</strong>
                </div>
                <div className="orbital-params__row">
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'distance from Earth' : 'lunar distance'}</span>
                  <strong>{formatDistance(selectedAsteroid.miss_distance_lunar, mode)}</strong>
                </div>
                <div className="orbital-params__row" title={`What does this mean for me? ${selectedThreat.tooltip}`}>
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'what this means for me' : 'threat tier'}</span>
                  <strong>{mode === DISPLAY_MODE.HUMAN ? selectedThreat.display : selectedThreat.label}</strong>
                </div>
                <div className="orbital-params__row">
                  <span>live event queue</span>
                  <strong>{ws.alerts.length} recent signals</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="panel empty-panel">Awaiting telemetry feed.</div>
          )}
        </aside>
      </section>

      <section className="stats-ribbon panel">
        {missionStats.map((item) => (
          <div key={item.label} className="stats-ribbon__item">
            <span>{item.label}</span>
            <strong>
              {item.label === 'closest pass' ? formatDistance(stats?.closest_lunar, mode) : <CountMetric value={item.value} decimals={item.decimals} suffix={item.suffix || ''} />}
            </strong>
          </div>
        ))}
        <div className="stats-ribbon__item">
          <span>last scan</span>
          <strong>{stats?.last_sync?.fetched_at ? formatDate(stats.last_sync.fetched_at, mode) : 'pending sync'}</strong>
        </div>
      </section>

      <section className="dashboard-lower">
        <div className="panel analytics-panel">
          <div className="panel-kicker">threat distribution</div>
          <h3>{mode === DISPLAY_MODE.HUMAN ? 'How many objects are worth caring about' : 'Risk posture across the current feed'}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="24%">
              <XAxis dataKey="name" tick={{ fill: '#89afc7', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52748e', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(61, 220, 255, 0.05)' }} />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index]} fillOpacity={0.92} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel incident-panel">
          <div className="panel-kicker">incident feed</div>
          <h3>{mode === DISPLAY_MODE.HUMAN ? 'Objects you should understand first' : 'Recent high-priority signatures'}</h3>
          <div className="incident-panel__list">
            {(critical.length ? critical : allAsteroids.slice(0, 4)).map((asteroid) => (
              <AsteroidCard key={asteroid.id} asteroid={asteroid} mode={mode} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
