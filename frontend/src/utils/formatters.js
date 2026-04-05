import { formatDistanceToNowStrict, isToday, parseISO } from 'date-fns';

export const DISPLAY_MODE = {
  NERD: 'nerd',
  HUMAN: 'human',
};

const threatBands = [
  {
    max: 20,
    emoji: '🟢',
    label: 'Harmless',
    description: 'Harmless - not even worth worrying about',
    tooltip: 'At this threat level, there is no meaningful danger. Sleep well.',
    color: '#67ffc6',
  },
  {
    max: 40,
    emoji: '🟡',
    label: 'Low Watch',
    description: "Low Watch - we're keeping an eye on it",
    tooltip: 'At this threat level, astronomers keep tracking it, but no action is needed.',
    color: '#ffdb70',
  },
  {
    max: 60,
    emoji: '🟠',
    label: 'Elevated',
    description: 'Elevated - scientists are paying attention',
    tooltip: 'At this threat level, scientists pay closer attention, but there is still no public danger.',
    color: '#ffb347',
  },
  {
    max: 80,
    emoji: '🔴',
    label: 'High Alert',
    description: 'High Alert - this one matters',
    tooltip: 'At this threat level, experts would watch it carefully and update models often.',
    color: '#ff7a45',
  },
  {
    max: 100,
    emoji: '☠️',
    label: 'Critical',
    description: 'Critical - planetary defense level threat',
    tooltip: 'At this threat level, the object would demand immediate attention from planetary defense teams.',
    color: '#ff4d4f',
  },
];

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pluralize = (value, singular, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;

const formatMoonDistanceHuman = (ld) => {
  const value = toFiniteNumber(ld, NaN);
  if (!Number.isFinite(value)) return 'distance unknown';
  if (value < 0.2) return 'DANGEROUSLY CLOSE - closer than most satellites orbit';
  if (Math.abs(value - 0.5) < 0.08) return 'Half the distance to the Moon';
  if (Math.abs(value - 1) < 0.08) return '1x the distance to the Moon';
  return `${value.toFixed(1)}x the distance to the Moon`;
};

export function formatDistance(ld, mode = DISPLAY_MODE.NERD) {
  const value = toFiniteNumber(ld, NaN);
  if (!Number.isFinite(value)) return '--';
  if (mode === DISPLAY_MODE.HUMAN) return formatMoonDistanceHuman(value);
  return `${value.toFixed(2)} LD`;
}

export function formatSize(km, mode = DISPLAY_MODE.NERD) {
  const value = toFiniteNumber(km, NaN);
  if (!Number.isFinite(value)) return '--';

  if (mode === DISPLAY_MODE.NERD) {
    return `${value.toFixed(value < 1 ? 3 : 2)} km`;
  }

  if (value < 0.1) return 'car-sized';
  if (value < 0.3) return 'skyscraper-sized';
  if (value < 1) return 'small city-sized (like downtown Manhattan)';
  if (value < 5) return 'mountain-sized';
  return 'continent-killer';
}

export function formatVelocity(kms, mode = DISPLAY_MODE.NERD) {
  const value = toFiniteNumber(kms, NaN);
  if (!Number.isFinite(value)) return '--';

  if (mode === DISPLAY_MODE.NERD) {
    return `${value.toFixed(2)} km/s`;
  }

  const bulletMultiple = Math.max(1, Math.round(value));
  const usCrossMinutes = Math.max(1, Math.round(7 / value));
  return `${bulletMultiple}x faster than a bullet - would cross the US in under ${pluralize(usCrossMinutes, 'minute')}`;
}

export function formatThreat(score, mode = DISPLAY_MODE.NERD) {
  const numericScore = Math.round(toFiniteNumber(score, 0));
  const band = threatBands.find((item) => numericScore <= item.max) || threatBands[threatBands.length - 1];

  if (mode === DISPLAY_MODE.NERD) {
    return {
      score: numericScore,
      emoji: band.emoji,
      label: band.label,
      display: `${numericScore}/100`,
      description: band.description,
      tooltip: band.tooltip,
      color: band.color,
    };
  }

  return {
    score: numericScore,
    emoji: band.emoji,
    label: band.label,
    display: `${band.emoji} ${band.description}`,
    description: band.description,
    tooltip: band.tooltip,
    color: band.color,
  };
}

export function formatDate(dateStr, mode = DISPLAY_MODE.NERD) {
  if (!dateStr) return '--';

  const parsedDate = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) return String(dateStr);

  if (mode === DISPLAY_MODE.NERD) {
    return parsedDate.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  if (isToday(parsedDate)) {
    return 'TODAY - closest approach happening now';
  }

  const relative = formatDistanceToNowStrict(parsedDate, { addSuffix: true });
  return parsedDate > new Date() ? relative.replace('about ', '') : `passed Earth safely ${relative.replace('about ', '')}`;
}

export function generatePlainEnglishSummary(asteroidObj, mode = DISPLAY_MODE.NERD) {
  if (mode === DISPLAY_MODE.NERD || !asteroidObj) return '';

  const size = formatSize(asteroidObj.estimated_diameter_max_km, mode);
  const velocityKms = toFiniteNumber(asteroidObj.relative_velocity_kph, 0) / 3600;
  const velocity = formatVelocity(velocityKms, mode).split(' - ')[0];
  const distance = formatDistance(asteroidObj.miss_distance_lunar, mode);
  const when = formatDate(asteroidObj.close_approach_date_full || asteroidObj.close_approach_date, mode);
  const threat = formatThreat(asteroidObj.threat_score, mode);

  return `A ${size} rock traveling ${velocity} will pass Earth at ${distance} ${when}. ${threat.label}.`;
}
