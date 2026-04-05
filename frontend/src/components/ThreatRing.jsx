import { DISPLAY_MODE, formatThreat } from '../utils/formatters.js';

export default function ThreatRing({ score = 0, size = 80, strokeWidth = 5, mode = DISPLAY_MODE.NERD }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;
  const threat = formatThreat(score, mode);
  const ringText = mode === DISPLAY_MODE.HUMAN ? threat.emoji : score;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} title={threat.display}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(124, 233, 255, 0.08)" strokeWidth={strokeWidth} />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={threat.color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 10px ${threat.color})`, transition: 'stroke-dashoffset 0.9s ease' }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: `${cx}px ${cy}px`,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
        }}
        fill={threat.color}
        fontSize={mode === DISPLAY_MODE.HUMAN ? size * 0.19 : size * 0.22}
      >
        {ringText}
      </text>
    </svg>
  );
}
