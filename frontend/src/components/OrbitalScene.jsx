import { useState } from 'react';
import {
  DISPLAY_MODE,
  formatDistance,
  formatThreat,
  formatVelocity,
  generatePlainEnglishSummary,
} from '../utils/formatters.js';

const threatMeta = {
  CRITICAL: { color: '#ff7a45', label: 'critical' },
  HIGH: { color: '#ffb347', label: 'high' },
  MEDIUM: { color: '#7ce9ff', label: 'medium' },
  LOW: { color: '#3ddcff', label: 'low' },
};

const getCollisionProbability = (asteroid) => {
  const score = Number.parseFloat(asteroid?.threat_score) || 0;
  const missDistance = Number.parseFloat(asteroid?.miss_distance_lunar) || 25;
  const velocity = Number.parseFloat(asteroid?.relative_velocity_kph) || 0;
  const normalizedVelocity = Math.min(velocity / 90000, 1);
  const normalizedDistance = 1 - Math.min(missDistance / 30, 1);
  const probability = score * 0.55 + normalizedVelocity * 28 + normalizedDistance * 17;
  return Math.min(99.2, Math.max(1.1, probability));
};

function buildOrbitObjects(asteroids) {
  return asteroids.slice(0, 9).map((asteroid, index) => {
    const meta = threatMeta[asteroid.threat_level] || threatMeta.LOW;
    const missDistance = Number.parseFloat(asteroid.miss_distance_lunar) || 10;
    const velocity = Number.parseFloat(asteroid.relative_velocity_kph) || 0;
    const orbitWidth = 280 + index * 62 + Math.min(missDistance * 4.5, 120);
    const orbitHeight = orbitWidth * (0.48 + (index % 4) * 0.08);
    const duration = 16 + index * 2.6 + Math.min(velocity / 18000, 6);
    const tilt = -70 + index * 18;
    const size = asteroid.threat_score >= 80 ? 15 : asteroid.threat_score >= 55 ? 12 : 10;

    return {
      asteroid,
      meta,
      orbitWidth,
      orbitHeight,
      duration,
      tilt,
      size,
      probability: getCollisionProbability(asteroid),
    };
  });
}

export default function OrbitalScene({ asteroids = [], selectedId, onSelect, mode = DISPLAY_MODE.NERD }) {
  const [hoveredId, setHoveredId] = useState(null);
  const orbitObjects = buildOrbitObjects(asteroids);

  return (
    <div className="orbital-scene">
      <div className="orbital-scene__backdrop" />
      <div className="orbital-scene__stars orbital-scene__stars--near" />
      <div className="orbital-scene__stars orbital-scene__stars--far" />
      <div className="orbital-scene__radar" />
      <div className="orbital-scene__ring orbital-scene__ring--inner" />
      <div className="orbital-scene__ring orbital-scene__ring--outer" />
      <div className="orbital-scene__crosshair orbital-scene__crosshair--h" />
      <div className="orbital-scene__crosshair orbital-scene__crosshair--v" />

      {orbitObjects.map((item, index) => {
        const isSelected = item.asteroid.id === selectedId;
        const isHovered = item.asteroid.id === hoveredId;
        const threat = formatThreat(item.asteroid.threat_score, mode);
        const velocityKms = (Number.parseFloat(item.asteroid.relative_velocity_kph) || 0) / 3600;

        return (
          <div
            key={item.asteroid.id}
            className={`orbit-shell${isHovered ? ' is-hovered' : ''}${isSelected ? ' is-selected' : ''}`}
            style={{
              '--orbit-width': `${item.orbitWidth}px`,
              '--orbit-height': `${item.orbitHeight}px`,
              '--orbit-tilt': `${item.tilt}deg`,
              '--orbit-duration': `${item.duration}s`,
              '--orbit-color': item.meta.color,
              '--orbit-delay': `${index * 0.22}s`,
            }}
          >
            <div className="orbit-track" />
            <div className="orbit-rotator">
              <button
                type="button"
                className={`orbit-node${isHovered ? ' is-selected' : ''}${isSelected ? ' is-armed' : ''}`}
                style={{ '--node-size': `${item.size}px`, '--node-color': item.meta.color }}
                onMouseEnter={() => {
                  setHoveredId(item.asteroid.id);
                  onSelect(item.asteroid);
                }}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => {
                  setHoveredId(item.asteroid.id);
                  onSelect(item.asteroid);
                }}
                onBlur={() => setHoveredId(null)}
                onClick={() => onSelect(item.asteroid)}
                aria-label={`Inspect ${item.asteroid.name}`}
                title={`What does this mean for me? ${threat.tooltip}`}
              >
                <span className="orbit-node__ping" />
              </button>

              <div className={`orbit-card${isHovered ? ' is-visible' : ''}`}>
                <div className="orbit-card__eyebrow">
                  <span className="status-dot" style={{ '--status-color': item.meta.color }} />
                  {mode === DISPLAY_MODE.HUMAN ? threat.display : `${item.meta.label} object`}
                </div>
                <p className="orbit-card__title">{mode === DISPLAY_MODE.HUMAN ? `${threat.emoji} ${item.asteroid.name}` : item.asteroid.name}</p>
                {mode === DISPLAY_MODE.HUMAN ? (
                  <p className="card-summary">{generatePlainEnglishSummary(item.asteroid, mode)}</p>
                ) : null}
                <div className="orbit-card__metrics">
                  <span>{formatDistance(item.asteroid.miss_distance_lunar, mode)}</span>
                  <span>{formatVelocity(velocityKms, mode)}</span>
                  <span>{mode === DISPLAY_MODE.HUMAN ? threat.label : `${item.probability.toFixed(1)}% risk`}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="orbital-earth">
        <div className="orbital-earth__glow" />
        <div className="orbital-earth__core" />
        <div className="orbital-earth__grid orbital-earth__grid--lat" />
        <div className="orbital-earth__grid orbital-earth__grid--lon" />
        <div className="orbital-earth__label">
          <span>earth watch axis</span>
        </div>
      </div>

      <div className="orbital-scene__legend">
        {Object.entries(threatMeta).map(([key, meta]) => (
          <div key={key} className="orbital-scene__legend-item">
            <span className="status-dot" style={{ '--status-color': meta.color }} />
            <span>{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
