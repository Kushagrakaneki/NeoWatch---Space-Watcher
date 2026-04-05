import { useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import AsteroidTable from './pages/AsteroidTable.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import ImpactLab from './pages/ImpactLab.jsx';
import Navbar from './components/Navbar.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useWebSocket } from './hooks/useNeoWatch.js';
import { useDisplayMode } from './hooks/useDisplayMode.js';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const ws = useWebSocket();
  const { mode, toggleMode } = useDisplayMode();

  return (
    <div className={`app-shell app-shell--${mode}`} data-display-mode={mode}>
      <div className="app-shell__nebula app-shell__nebula--left" />
      <div className="app-shell__nebula app-shell__nebula--right" />
      <div className="app-shell__grain" />

      <Navbar page={page} setPage={setPage} connected={ws.connected} mode={mode} toggleMode={toggleMode} />
      <LiveFeed alerts={ws.alerts} lastEvent={ws.lastEvent} />

      <main className="app-main">
        <ErrorBoundary key={page}>
          {page === 'dashboard' && <Dashboard ws={ws} mode={mode} />}
          {page === 'asteroids' && <AsteroidTable mode={mode} />}
          {page === 'alerts' && <AlertsPage mode={mode} />}
          {page === 'impact' && <ImpactLab mode={mode} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
