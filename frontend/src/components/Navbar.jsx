import { useEffect, useState } from 'react';
import DisplayModeToggle from './DisplayModeToggle.jsx';

const NAV = [
  { id: 'dashboard', label: 'Mission Control' },
  { id: 'asteroids', label: 'Object Registry' },
  { id: 'alerts', label: 'Alert Protocols' },
  { id: 'impact', label: 'Impact Lab' },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="nav-clock">
      <span className="nav-meta-label">UTC</span>
      <span>{now.toUTCString().slice(17, 25)}</span>
    </div>
  );
}

export default function Navbar({ page, setPage, connected, mode, toggleMode }) {
  return (
    <nav className={`command-nav${mode === 'human' ? ' command-nav--human' : ''}`}>
      <div className="command-nav__brand" onClick={() => setPage('dashboard')} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && setPage('dashboard')}>
        <div className="command-nav__mark">
          <span className="command-nav__mark-core" />
        </div>
        <div>
          <p className="nav-meta-label">orbital surveillance command</p>
          <h1 className="command-nav__title">NEOWATCH PRIME</h1>
        </div>
      </div>

      <div className="command-nav__links">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`command-nav__link${page === item.id ? ' is-active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="command-nav__status">
        <DisplayModeToggle mode={mode} toggleMode={toggleMode} />
        <LiveClock />
        <div className={`system-chip${connected ? ' is-live' : ' is-offline'}`}>
          <span className="status-dot" style={{ '--status-color': connected ? '#67ffc6' : '#ff7a45' }} />
          <span>{connected ? 'telemetry live' : 'telemetry offline'}</span>
        </div>
      </div>
    </nav>
  );
}
