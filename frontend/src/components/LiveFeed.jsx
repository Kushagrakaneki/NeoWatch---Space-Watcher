import { useEffect, useState } from 'react';

export default function LiveFeed({ lastEvent }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!lastEvent) return undefined;

    let timeoutId;

    if (lastEvent.type === 'HIGH_THREAT_DETECTED') {
      const toast = {
        id: Date.now(),
        tone: 'warning',
        title: 'High-threat debris clustered on the latest scan',
        body: `${lastEvent.data?.count || 0} object${lastEvent.data?.count === 1 ? '' : 's'} crossed the elevated risk threshold.`,
      };
      setToasts((current) => [toast, ...current].slice(0, 3));
      timeoutId = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 6500);
    }

    if (lastEvent.type === 'SYNC_COMPLETE') {
      const toast = {
        id: Date.now(),
        tone: 'success',
        title: 'Deep-space sweep completed',
        body: `${lastEvent.data?.total || 0} objects processed, ${lastEvent.data?.inserted || 0} new signatures catalogued.`,
      };
      setToasts((current) => [toast, ...current].slice(0, 3));
      timeoutId = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4200);
    }

    return () => window.clearTimeout(timeoutId);
  }, [lastEvent]);

  if (!toasts.length) return null;

  return (
    <div className="live-feed">
      {toasts.map((toast) => (
        <article key={toast.id} className={`live-feed__toast live-feed__toast--${toast.tone}`}>
          <div className="live-feed__header">
            <span className="status-dot" style={{ '--status-color': toast.tone === 'success' ? '#67ffc6' : '#ffb347' }} />
            <span>{toast.tone === 'success' ? 'system event' : 'priority warning'}</span>
          </div>
          <h3>{toast.title}</h3>
          <p>{toast.body}</p>
        </article>
      ))}
    </div>
  );
}
