import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsteroids } from '../../hooks/useNeoWatch.js';
import { DISPLAY_MODE, formatThreat, generatePlainEnglishSummary } from '../../utils/formatters.js';
import { buildResultCards, computeImpactMetrics } from './ImpactCalculator.js';
import GlobeRenderer from './GlobeRenderer.jsx';
import ControlPanel from './ControlPanel.jsx';
import { SIMULATION_PHASES } from './SimulationEngine.js';
import './ImpactLab.css';

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTimelineState(currentPhase, status) {
  const currentIndex = SIMULATION_PHASES.findIndex((phase) => phase.id === currentPhase);
  return SIMULATION_PHASES.map((phase, index) => {
    let state = 'pending';
    if (status === 'complete' || (currentIndex > index && currentIndex !== -1)) state = 'complete';
    if (currentPhase === phase.id && status === 'running') state = 'active';
    return {
      ...phase,
      state,
      durationLabel: `${(phase.end - phase.start).toFixed(1)} seconds`,
    };
  });
}

function createImpactAudioController() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return { update() {}, stop() {} };
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.0001;
  master.connect(context.destination);

  const drone = context.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 40;
  const droneGain = context.createGain();
  droneGain.gain.value = 0.0001;
  drone.connect(droneGain);
  droneGain.connect(master);
  drone.start();

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.8, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  let impactPlayed = false;

  return {
    update(phase) {
      const now = context.currentTime;
      if (phase === 'approach') {
        master.gain.cancelScheduledValues(now);
        master.gain.linearRampToValueAtTime(0.18, now + 0.25);
        droneGain.gain.linearRampToValueAtTime(0.28, now + 0.35);
        drone.frequency.linearRampToValueAtTime(52, now + 0.45);
      }
      if (phase === 'entry') {
        drone.frequency.linearRampToValueAtTime(800, now + 2.2);
        droneGain.gain.linearRampToValueAtTime(0.42, now + 0.4);
      }
      if (phase === 'impact' && !impactPlayed) {
        impactPlayed = true;
        const boom = context.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(60, now);
        const boomGain = context.createGain();
        boomGain.gain.setValueAtTime(1, now);
        boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
        boom.connect(boomGain);
        boomGain.connect(master);
        boom.start();
        boom.stop(now + 3.2);

        const noise = context.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = context.createGain();
        noiseGain.gain.setValueAtTime(0.45, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
        noise.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(now);
      }
    },
    stop() {
      const now = context.currentTime;
      master.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      drone.stop(now + 1);
      window.setTimeout(() => context.close().catch(() => {}), 1200);
    },
  };
}

export default function ImpactLab({ mode = DISPLAY_MODE.NERD }) {
  const { data, loading } = useAsteroids({ limit: 120, days: 365, sort: 'threat_score', order: 'DESC' });
  const globeRef = useRef(null);
  const audioRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [impactPoint, setImpactPoint] = useState(null);
  const [hoveredRegion, setHoveredRegion] = useState('');
  const [terrainPreset, setTerrainPreset] = useState('land');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [approachAngle, setApproachAngle] = useState(45);
  const [speedOverrideEnabled, setSpeedOverrideEnabled] = useState(false);
  const [speedOverrideKms, setSpeedOverrideKms] = useState(28);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [simulationState, setSimulationState] = useState({ status: 'idle', currentPhase: 'idle', token: 0 });
  const [simulationRequest, setSimulationRequest] = useState(null);
  const [sceneFx, setSceneFx] = useState({ flash: false, vignette: false, aftermath: false, phase: 'idle' });
  const [copied, setCopied] = useState(false);

  const asteroids = useMemo(() => [...data].sort((a, b) => toNumber(b.threat_score) - toNumber(a.threat_score)), [data]);

  useEffect(() => {
    if (!asteroids.length) return;
    if (!selectedId || !asteroids.find((item) => item.id === selectedId)) {
      setSelectedId(asteroids[0].id);
    }
  }, [asteroids, selectedId]);

  useEffect(() => () => audioRef.current?.stop(), []);

  const selectedAsteroid = asteroids.find((item) => item.id === selectedId) || null;

  const results = useMemo(() => {
    if (!selectedAsteroid || !impactPoint) return null;
    return computeImpactMetrics(selectedAsteroid, impactPoint, {
      overrideSpeed: speedOverrideEnabled,
      overrideSpeedKms,
    });
  }, [impactPoint, selectedAsteroid, speedOverrideEnabled, speedOverrideKms]);

  const resultCards = useMemo(() => (results && impactPoint ? buildResultCards(results, impactPoint) : []), [impactPoint, results]);
  const timeline = useMemo(() => getTimelineState(simulationState.currentPhase, simulationState.status), [simulationState.currentPhase, simulationState.status]);
  const canLaunch = Boolean(selectedAsteroid && impactPoint);
  const selectedThreat = selectedAsteroid ? formatThreat(selectedAsteroid.threat_score, mode) : null;

  const presetImpactPoint = (preset) => {
    const features = globeRef.current?.getGeoFeatures?.() || [];
    setTerrainPreset(preset);

    const isLand = (lat, lng) => features.some((feature) => {
      const point = [lng, lat];
      const pointInRing = (ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
          const xi = ring[i][0];
          const yi = ring[i][1];
          const xj = ring[j][0];
          const yj = ring[j][1];
          const intersects = ((yi > point[1]) !== (yj > point[1])) && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-6) + xi);
          if (intersects) inside = !inside;
        }
        return inside;
      };
      if (feature.geometry.type === 'Polygon') return pointInRing(feature.geometry.coordinates[0]);
      if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.some(([outer]) => pointInRing(outer));
      return false;
    });

    let candidate = null;
    if (preset === 'random') {
      candidate = { lat: (Math.random() * 140) - 70, lng: (Math.random() * 360) - 180 };
    } else {
      for (let attempt = 0; attempt < 48; attempt += 1) {
        const lat = (Math.random() * 140) - 70;
        const lng = (Math.random() * 360) - 180;
        const land = isLand(lat, lng);
        if ((preset === 'land' && land) || (preset === 'ocean' && !land)) {
          candidate = { lat, lng };
          break;
        }
      }
    }

    if (!candidate) {
      candidate = preset === 'ocean' ? { lat: 12.8, lng: -144.2 } : { lat: 40.7128, lng: -74.006 };
    }

    const nextPoint = {
      ...candidate,
      region: preset === 'ocean' ? 'Oceanic Impact Zone' : hoveredRegion || 'Target Region',
      terrain: preset === 'ocean' ? 'ocean' : 'land',
    };
    setImpactPoint(nextPoint);
    globeRef.current?.setPresetPoint?.(nextPoint);
  };

  const handleLaunch = () => {
    if (!canLaunch || !selectedAsteroid || !impactPoint || !results) return;
    audioRef.current?.stop();
    audioRef.current = createImpactAudioController();
    const token = Date.now();
    setCopied(false);
    setSimulationState({ status: 'running', currentPhase: 'approach', token });
    setSimulationRequest({
      type: 'start',
      token,
      status: 'running',
      options: {
        approachAngle,
        overrideSpeed: speedOverrideEnabled,
        overrideSpeedKms,
        simulationSpeed,
        craterScale: Math.min(0.8, Math.max(0.28, results.craterKm / 120)),
        meteorScale: Math.min(0.3, Math.max(0.05, results.diameterKm / 8)),
      },
    });
  };

  const handleAbort = () => {
    audioRef.current?.stop();
    const token = Date.now();
    setSimulationState((current) => ({ ...current, status: 'idle', currentPhase: 'idle', token }));
    setSimulationRequest({ type: 'abort', token });
    setSceneFx({ flash: false, vignette: false, aftermath: false, phase: 'idle' });
  };

  const handleReset = () => {
    audioRef.current?.stop();
    setImpactPoint(null);
    setCopied(false);
    setSimulationState({ status: 'idle', currentPhase: 'idle', token: Date.now() });
    setSimulationRequest({ type: 'reset', token: Date.now() });
    globeRef.current?.clearPoint?.();
  };

  const handleShare = async () => {
    if (!results || !selectedAsteroid || !impactPoint) return;
    const message = `I simulated asteroid ${selectedAsteroid.name} hitting ${impactPoint.region} on NeoWatch. Impact energy: ${Math.round(results.energyMegatons).toLocaleString()} megatons. ${results.verdict.label}. ${window.location.href}`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`impact-lab impact-lab--${mode}`}>
      <ControlPanel
        mode={mode}
        asteroids={asteroids}
        loading={loading}
        selectedAsteroid={selectedAsteroid}
        selectedId={selectedId}
        onSelectAsteroid={setSelectedId}
        impactPoint={impactPoint}
        hoveredRegion={hoveredRegion}
        terrainPreset={terrainPreset}
        onPreset={presetImpactPoint}
        onClearImpactPoint={() => {
          setImpactPoint(null);
          globeRef.current?.clearPoint?.();
        }}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
        approachAngle={approachAngle}
        onApproachAngleChange={setApproachAngle}
        speedOverrideEnabled={speedOverrideEnabled}
        onSpeedOverrideToggle={() => setSpeedOverrideEnabled((current) => !current)}
        speedOverrideKms={speedOverrideKms}
        onSpeedOverrideChange={setSpeedOverrideKms}
        simulationSpeed={simulationSpeed}
        onSimulationSpeedChange={setSimulationSpeed}
        canLaunch={canLaunch}
        onLaunch={handleLaunch}
        onAbort={handleAbort}
        simulationState={simulationState}
        timeline={timeline}
        resultCards={resultCards}
        results={results}
        onShare={handleShare}
        onReset={handleReset}
      />

      <section className="impact-lab__theater">
        <div className={`impact-lab__scene-fx${sceneFx.vignette ? ' is-armed' : ''}${sceneFx.aftermath ? ' is-aftermath' : ''}`}>
          <div className={`impact-lab__flash${sceneFx.flash ? ' is-active' : ''}`} />
        </div>

        <div className="impact-lab__hero-copy">
          <div>
            <p className="impact-lab__eyebrow">Simulation Studio</p>
            <h2>The edge of catastrophe, rendered in full.</h2>
            <p>
              {mode === DISPLAY_MODE.HUMAN && selectedAsteroid
                ? generatePlainEnglishSummary(selectedAsteroid, mode)
                : 'Pick a tracked body, choose an impact point, then watch the strike unfold through approach, entry, impact, shockwave, and aftermath.'}
            </p>
          </div>

          <div className="impact-lab__hero-stats">
            <article>
              <span>Selected Object</span>
              <strong>{selectedAsteroid?.name || 'Awaiting selection'}</strong>
            </article>
            <article>
              <span>Threat Tier</span>
              <strong>{selectedThreat ? (mode === DISPLAY_MODE.HUMAN ? selectedThreat.label : `${selectedThreat.score}/100`) : '--'}</strong>
            </article>
            <article>
              <span>Target Region</span>
              <strong>{impactPoint?.region || hoveredRegion || 'Choose on globe'}</strong>
            </article>
          </div>
        </div>

        <GlobeRenderer
          ref={globeRef}
          selectedAsteroid={selectedAsteroid}
          impactPoint={impactPoint}
          simulationConfig={simulationRequest}
          onImpactPointSelect={setImpactPoint}
          onHoverRegion={setHoveredRegion}
          onSimulationPhase={(phase) => {
            setSimulationState((current) => ({ ...current, currentPhase: phase, status: 'running' }));
            audioRef.current?.update(phase);
          }}
          onSimulationComplete={() => {
            setSimulationState((current) => ({ ...current, currentPhase: 'complete', status: 'complete' }));
            window.setTimeout(() => audioRef.current?.stop(), 1200);
          }}
          onVisualStateChange={setSceneFx}
        />

        {copied ? <div className="impact-lab__share-toast">Impact summary copied to clipboard.</div> : null}
      </section>
    </div>
  );
}
