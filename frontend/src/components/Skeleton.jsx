const pulse = {
  animation: 'pulse-glow 1.6s ease-in-out infinite',
  background: 'rgba(30, 80, 160, 0.1)',
  borderRadius: '6px',
};

export function SkeletonText({ width = '100%', height = 14, style = {} }) {
  return <div style={{ ...pulse, width, height, borderRadius: '4px', ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <SkeletonText width="60%" height={10} style={{ marginBottom: '10px' }} />
          <SkeletonText width="80%" height={18} style={{ marginBottom: '6px' }} />
          <SkeletonText width="40%" height={10} />
        </div>
        <div style={{ ...pulse, width: 72, height: 72, borderRadius: '50%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
            <SkeletonText width="50%" height={9} style={{ marginBottom: '6px' }} />
            <SkeletonText width="70%" height={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="glass-card" style={{ padding: '20px 22px' }}>
      <SkeletonText width="60%" height={10} style={{ marginBottom: '12px' }} />
      <SkeletonText width="40%" height={32} style={{ marginBottom: '6px' }} />
      <SkeletonText width="50%" height={10} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid rgba(30,80,160,0.08)' }}>
      {[40, 140, 80, 100, 80, 100, 80, 40].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{ ...pulse, width: w, height: 12, borderRadius: '4px' }} />
        </td>
      ))}
    </tr>
  );
}
