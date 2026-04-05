import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// I'm learning how to set up API calls in React! This creates a base URL for all my API requests
const api = axios.create({ baseURL: '/api' });

// This hook helps me fetch asteroid data with filters. I'm learning about React hooks and API calls!
export function useAsteroids(filters = {}) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // I'm learning how to make API calls with error handling. This function fetches asteroid data!
  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res } = await api.get('/asteroids', { params: filters });
      setData(res.data);
      setPagination(res.pagination);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, pagination, loading, error, refetch: fetch };
}

// This hook gets stats about asteroids. I'm learning how to create reusable data fetching hooks!
export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // I'm learning about async/await and error handling in React hooks!
  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/asteroids/stats');
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { stats, loading, refetch: fetch };
}

// This hook fetches the most critical asteroids. I'm learning about simple data fetching patterns!
export function useCritical() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/asteroids/critical')
      .then((response) => setData(response.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

// This is my WebSocket hook for real-time updates! I'm learning about WebSockets in React!
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    // I'm learning how to set up WebSocket connections! This connects to my backend WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    // I'm learning how to handle WebSocket messages! This processes incoming alerts
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setLastEvent(msg);
        if (msg.type === 'HIGH_THREAT_DETECTED') {
          setAlerts((prev) => [msg, ...prev].slice(0, 10));
        }
      } catch {}
    };

    // I'm learning about keeping WebSocket connections alive with ping messages!
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, []);

  return { connected, lastEvent, alerts };
}

export async function subscribe(email, minScore) {
  try {
    const { data } = await api.post('/alerts/subscribe', { email, min_threat_score: minScore });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Unable to subscribe to alerts');
  }
}

export async function triggerSync() {
  const { data } = await api.post('/asteroids/sync');
  return data;
}
