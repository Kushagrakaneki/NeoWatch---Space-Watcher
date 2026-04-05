export default function StatCard({ label, value, sub, color = 'var(--text-primary)', accent }) {
  return (
    <div className="glass-card" style={{
      padding: '20px 22px',
      borderColor: accent ? `${accent}33` : undefined,
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', color, lineHeight: 1, marginBottom: '4px',
        textShadow: accent ? `0 0 20px ${accent}55` : 'none',
      }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}
