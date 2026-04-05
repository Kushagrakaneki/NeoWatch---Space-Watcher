import { useEffect, useMemo, useState } from 'react';
import AsteroidCard from '../components/AsteroidCard.jsx';
import ThreatRing from '../components/ThreatRing.jsx';
import { useAsteroids, useStats } from '../hooks/useNeoWatch.js';
import {
  DISPLAY_MODE,
  formatDate,
  formatDistance,
  formatSize,
  formatThreat,
  formatVelocity,
  generatePlainEnglishSummary,
} from '../utils/formatters.js';

const THREAT_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SORT_OPTIONS = [
  { value: 'threat_score', label: 'Threat score' },
  { value: 'close_approach_date', label: 'Approach date' },
  { value: 'miss_distance_km', label: 'Miss distance' },
  { value: 'relative_velocity_kph', label: 'Velocity' },
];

const threatColors = {
  CRITICAL: '#ff7a45',
  HIGH: '#ffb347',
  MEDIUM: '#7ce9ff',
  LOW: '#3ddcff',
};

export default function AsteroidTable({ mode = DISPLAY_MODE.NERD }) {
  const [threatFilter, setThreatFilter] = useState('ALL');
  const [sort, setSort] = useState('threat_score');
  const [order, setOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(7);
  const [viewMode, setViewMode] = useState('table');
  const [activeAsteroid, setActiveAsteroid] = useState(null);
  const { stats } = useStats();

  const filters = useMemo(() => ({
    page,
    limit: 24,
    sort,
    order,
    days,
    ...(threatFilter !== 'ALL' ? { threat_level: threatFilter } : {}),
  }), [days, order, page, sort, threatFilter]);

  const { data, pagination, loading } = useAsteroids(filters);

  useEffect(() => {
    if (!data.length) return;
    const next = data.find((item) => item.id === activeAsteroid?.id) || data[0];
    setActiveAsteroid(next);
  }, [data]);

  const registryMetrics = [
    { label: 'tracked this week', value: stats?.total_this_week ?? '--' },
    { label: 'hazard flagged', value: stats?.hazardous_count ?? '--' },
    { label: 'max threat score', value: mode === DISPLAY_MODE.HUMAN && activeAsteroid ? formatThreat(activeAsteroid.threat_score, mode).emoji : (stats?.max_threat_score ?? '--') },
    { label: 'closest pass', value: stats?.closest_lunar ? formatDistance(stats.closest_lunar, mode) : '--' },
  ];

  return (
    <div className="page-shell">
      <section className="page-hero panel">
        <div>
          <p className="panel-kicker">object registry</p>
          <h1>{mode === DISPLAY_MODE.HUMAN ? 'A plain-English catalog of what is flying near Earth.' : 'Catalogued signatures across the monitored approach window.'}</h1>
        </div>
        <p>
          {mode === DISPLAY_MODE.HUMAN
            ? 'Flip through the objects and every number turns into something a normal person can understand instantly.'
            : 'Filter by risk, scan horizon, and velocity to inspect the objects currently moving through the tracking envelope.'}
        </p>
      </section>

      <section className="registry-spotlight">
        <div className="panel registry-metric-rack">
          {registryMetrics.map((metric) => (
            <div key={metric.label} className="registry-metric-rack__card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="panel registry-preview">
          <div className="panel-kicker">live object spotlight</div>
          {activeAsteroid ? (
            <div className="registry-preview__content">
              <div className="registry-preview__headline">
                <div>
                  <p className="debris-list-card__id">signature {activeAsteroid.id}</p>
                  <h3>{mode === DISPLAY_MODE.HUMAN ? `${formatThreat(activeAsteroid.threat_score, mode).emoji} ${activeAsteroid.name}` : activeAsteroid.name}</h3>
                  <p>{mode === DISPLAY_MODE.HUMAN ? generatePlainEnglishSummary(activeAsteroid, mode) : (activeAsteroid.is_potentially_hazardous ? 'Potentially hazardous object under active watch.' : 'Tracked object currently inside the monitored approach window.')}</p>
                </div>
                <ThreatRing score={activeAsteroid.threat_score} size={86} strokeWidth={6} mode={mode} />
              </div>

              <div className="registry-preview__pulse">
                <div>
                  <span>miss distance</span>
                  <strong>{formatDistance(activeAsteroid.miss_distance_lunar, mode)}</strong>
                </div>
                <div>
                  <span>velocity</span>
                  <strong>{formatVelocity((Number.parseFloat(activeAsteroid.relative_velocity_kph) || 0) / 3600, mode)}</strong>
                </div>
                <div>
                  <span>{mode === DISPLAY_MODE.HUMAN ? 'size' : 'diameter'}</span>
                  <strong>{formatSize(activeAsteroid.estimated_diameter_max_km, mode)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-panel">Awaiting registry data.</p>
          )}
        </div>
      </section>

      <section className="registry-controls panel">
        <div className="filter-pills">
          {THREAT_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`filter-pill${threatFilter === filter ? ' is-active' : ''}`}
              style={{ '--pill-color': filter === 'ALL' ? '#3ddcff' : threatColors[filter] }}
              onClick={() => {
                setThreatFilter(filter);
                setPage(1);
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="registry-controls__group">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={3}>Next 3 days</option>
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>

          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button type="button" className="ghost-button" onClick={() => setOrder((current) => (current === 'DESC' ? 'ASC' : 'DESC'))}>
            {order === 'DESC' ? 'descending' : 'ascending'}
          </button>

          <div className="view-toggle">
            {['table', 'cards'].map((currentMode) => (
              <button
                key={currentMode}
                type="button"
                className={viewMode === currentMode ? 'is-active' : ''}
                onClick={() => setViewMode(currentMode)}
              >
                {currentMode}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="page-meta-row">
        <p>{loading ? 'Refreshing object registry...' : `${pagination.total || 0} objects in the current results`}</p>
        <p>Current page {page}{pagination.pages ? ` of ${pagination.pages}` : ''}</p>
      </div>

      {viewMode === 'table' ? (
        <section className="registry-table panel">
          <div className="registry-table__scroll">
            <table>
              <thead>
                <tr>
                  <th>{mode === DISPLAY_MODE.HUMAN ? 'risk' : 'score'}</th>
                  <th>object</th>
                  <th>{mode === DISPLAY_MODE.HUMAN ? 'what this means' : 'threat'}</th>
                  <th>{mode === DISPLAY_MODE.HUMAN ? 'when' : 'approach'}</th>
                  <th>{mode === DISPLAY_MODE.HUMAN ? 'how close' : 'miss distance'}</th>
                  <th>velocity</th>
                  <th>{mode === DISPLAY_MODE.HUMAN ? 'size' : 'diameter'}</th>
                  <th>hazard</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={cellIndex}>
                        <div className="table-skeleton" />
                      </td>
                    ))}
                  </tr>
                )) : data.map((asteroid) => {
                  const threat = formatThreat(asteroid.threat_score, mode);
                  return (
                    <tr key={asteroid.id} onMouseEnter={() => setActiveAsteroid(asteroid)}>
                      <td><ThreatRing score={asteroid.threat_score} size={52} strokeWidth={4} mode={mode} /></td>
                      <td>
                        <div className="registry-table__name">
                          <strong>{mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${asteroid.name}` : asteroid.name}</strong>
                          <span>OBJ {asteroid.id}</span>
                        </div>
                      </td>
                      <td title={`What does this mean for me? ${threat.tooltip}`}>
                        <span className="risk-badge" style={{ '--badge-color': threatColors[asteroid.threat_level] || '#3ddcff' }}>
                          {mode === DISPLAY_MODE.HUMAN ? threat.label : asteroid.threat_level}
                        </span>
                      </td>
                      <td>{formatDate(asteroid.close_approach_date_full || asteroid.close_approach_date, mode)}</td>
                      <td>{formatDistance(asteroid.miss_distance_lunar, mode)}</td>
                      <td>{formatVelocity((Number.parseFloat(asteroid.relative_velocity_kph) || 0) / 3600, mode)}</td>
                      <td>{formatSize(asteroid.estimated_diameter_max_km, mode)}</td>
                      <td>{asteroid.is_potentially_hazardous ? 'flagged' : 'watch'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="registry-card-grid">
          {(loading ? [] : data).map((asteroid) => (
            <div key={asteroid.id} onMouseEnter={() => setActiveAsteroid(asteroid)}>
              <AsteroidCard asteroid={asteroid} mode={mode} />
            </div>
          ))}
          {loading && Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="registry-card registry-card--placeholder" />
          ))}
        </section>
      )}

      {pagination.pages > 1 && (
        <div className="pagination-row">
          <button type="button" className="ghost-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>{page} / {pagination.pages}</span>
          <button type="button" className="ghost-button" disabled={page === pagination.pages} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
