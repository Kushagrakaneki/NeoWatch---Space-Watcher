import ThreatRing from './ThreatRing.jsx';
import {
  DISPLAY_MODE,
  formatDate,
  formatDistance,
  formatSize,
  formatThreat,
  formatVelocity,
  generatePlainEnglishSummary,
} from '../utils/formatters.js';

const threatColors = {
  CRITICAL: '#ff7a45',
  HIGH: '#ffb347',
  MEDIUM: '#7ce9ff',
  LOW: '#3ddcff',
};

export default function AsteroidCard({ asteroid, compact = false, mode = DISPLAY_MODE.NERD }) {
  const accent = threatColors[asteroid.threat_level] || threatColors.LOW;
  const threat = formatThreat(asteroid.threat_score, mode);
  const summary = generatePlainEnglishSummary(asteroid, mode);
  const velocityKms = (Number.parseFloat(asteroid.relative_velocity_kph) || 0) / 3600;

  if (compact) {
    return (
      <article className="debris-list-card" style={{ '--card-accent': accent }}>
        <div className="debris-list-card__top">
          <p className="debris-list-card__id">OBJ {asteroid.id}</p>
          <span className="risk-badge" style={{ '--badge-color': accent }} title={`What does this mean for me? ${threat.tooltip}`}>
            {mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${threat.label}` : threat.label}
          </span>
        </div>

        <h3>{mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${asteroid.name}` : asteroid.name}</h3>
        {summary ? <p className="card-summary">{summary}</p> : null}

        <div className="debris-list-card__metrics">
          <span>{formatDistance(asteroid.miss_distance_lunar, mode)}</span>
          <span>{formatVelocity(velocityKms, mode)}</span>
        </div>

        <p className="debris-list-card__meta">{formatDate(asteroid.close_approach_date_full || asteroid.close_approach_date, mode)}</p>
      </article>
    );
  }

  return (
    <article className="registry-card" style={{ '--card-accent': accent }}>
      <div className="registry-card__head">
        <div>
          <p className="debris-list-card__id">signature {asteroid.id}</p>
          <h3>{mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${asteroid.name}` : asteroid.name}</h3>
          {summary ? <p className="card-summary">{summary}</p> : null}
          <a href={asteroid.nasa_jpl_url} target="_blank" rel="noreferrer">
            Open NASA JPL profile
          </a>
        </div>
        <ThreatRing score={asteroid.threat_score} size={78} strokeWidth={5} mode={mode} />
      </div>

      <div className="registry-card__grid">
        <div title={`What does this mean for me? ${threat.tooltip}`}>
          <span>risk tier</span>
          <strong>{mode === DISPLAY_MODE.HUMAN ? threat.display : threat.label}</strong>
        </div>
        <div>
          <span>closest pass</span>
          <strong>{formatDate(asteroid.close_approach_date_full || asteroid.close_approach_date, mode)}</strong>
        </div>
        <div>
          <span>miss distance</span>
          <strong>{formatDistance(asteroid.miss_distance_lunar, mode)}</strong>
        </div>
        <div>
          <span>velocity</span>
          <strong>{formatVelocity(velocityKms, mode)}</strong>
        </div>
        <div>
          <span>{mode === DISPLAY_MODE.HUMAN ? 'size' : 'diameter'}</span>
          <strong>{formatSize(asteroid.estimated_diameter_max_km, mode)}</strong>
        </div>
        <div>
          <span>hazard flag</span>
          <strong>{asteroid.is_potentially_hazardous ? 'potentially hazardous' : 'under watch'}</strong>
        </div>
      </div>
    </article>
  );
}
