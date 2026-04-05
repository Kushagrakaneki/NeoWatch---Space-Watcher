const ROCK_DENSITY = 3000;
const MEGATON_JOULES = 4.184e15;
const TSAR_BOMBA_MEGATONS = 50;
const LONDON_AREA_KM2 = 1572;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function latBandDensity(lat) {
  const absolute = Math.abs(lat);
  if (absolute <= 25) return 410;
  if (absolute <= 40) return 290;
  if (absolute <= 55) return 160;
  return 42;
}

function regionMultiplier(region) {
  if (!region) return 0.12;
  if (region === 'Oceanic Impact Zone') return 0.03;
  return 0.22;
}

function verdictForMegatons(megatons) {
  if (megatons < 10) return { label: 'LOCAL EVENT', detail: 'Regional damage only', emoji: '🟡', color: '#ffdb70' };
  if (megatons < 1000) return { label: 'REGIONAL CATASTROPHE', detail: 'Multiple cities would be devastated', emoji: '🟠', color: '#ff9b47' };
  if (megatons < 100000) return { label: 'CONTINENTAL DISASTER', detail: 'Entire nations would feel the impact', emoji: '🔴', color: '#ff6b4d' };
  if (megatons < 1000000) return { label: 'CIVILIZATION THREATENING', detail: 'Global systems would break under the shock', emoji: '☠️', color: '#ff4d4f' };
  return { label: 'EXTINCTION LEVEL EVENT', detail: 'Planetary-scale consequences become likely', emoji: '💀', color: '#ff2f2f' };
}

function largeAreaComparison(radiusKm) {
  const area = Math.PI * radiusKm * radiusKm;
  const londonCount = Math.max(1, Math.round(area / LONDON_AREA_KM2));
  return `Large enough to swallow Greater London ${londonCount} times over`;
}

function formatPopulation(population) {
  if (population >= 1e9) return `${(population / 1e9).toFixed(1)} billion`;
  if (population >= 1e6) return `${(population / 1e6).toFixed(1)} million`;
  if (population >= 1e3) return `${Math.round(population / 1e3)} thousand`;
  return `${Math.round(population)}`;
}

export function diameterToMeters(diameterKm) {
  return toNumber(diameterKm) * 1000;
}

export function estimateMassKg(diameterKm, density = ROCK_DENSITY) {
  const radiusMeters = diameterToMeters(diameterKm) / 2;
  return density * ((4 / 3) * Math.PI * Math.pow(radiusMeters, 3));
}

export function computeImpactMetrics(asteroid, impactPoint, options = {}) {
  const diameterKm = toNumber(asteroid?.estimated_diameter_max_km, 0.15);
  const velocityKph = toNumber(asteroid?.relative_velocity_kph, 0);
  const baseVelocityKms = velocityKph / 3600;
  const velocityKms = options.overrideSpeed ? toNumber(options.overrideSpeedKms, baseVelocityKms || 20) : (baseVelocityKms || 20);
  const velocityMs = velocityKms * 1000;
  const massKg = estimateMassKg(diameterKm);
  const energyJoules = 0.5 * massKg * velocityMs * velocityMs;
  const energyMegatons = energyJoules / MEGATON_JOULES;
  const craterKm = 1.8 * Math.pow(Math.max(energyMegatons, 1), 0.294);
  const blastRadiusKm = 1.0 * Math.pow(Math.max(energyMegatons, 1), 0.33);
  const fireballKm = 0.6 * Math.pow(Math.max(energyMegatons, 1), 0.33);
  const thermalKm = 2.0 * Math.pow(Math.max(energyMegatons, 1), 0.33);
  const magnitude = (Math.log10(Math.max(energyJoules, 1)) - 4.8) / 1.5;
  const tsunamiHeightM = impactPoint?.terrain === 'ocean'
    ? Math.max(8, Math.pow(Math.max(energyMegatons, 1), 0.21) * 4.2)
    : null;
  const populationZoneKm = thermalKm;
  const population = clamp(
    Math.PI * populationZoneKm * populationZoneKm * latBandDensity(impactPoint?.lat ?? 0) * regionMultiplier(impactPoint?.region),
    5000,
    7.8e9
  );
  const comparisonBombs = Math.max(1, Math.round(energyMegatons / TSAR_BOMBA_MEGATONS));
  const verdict = verdictForMegatons(energyMegatons);

  return {
    diameterKm,
    velocityKms,
    energyJoules,
    energyMegatons,
    craterKm,
    blastRadiusKm,
    fireballKm,
    thermalKm,
    magnitude,
    tsunamiHeightM,
    affectedPopulation: population,
    populationLabel: formatPopulation(population),
    comparisonBombs,
    verdict,
  };
}

export function buildResultCards(results, impactPoint) {
  const cards = [
    {
      id: 'energy',
      icon: '💥',
      title: 'Impact Energy',
      value: `${Math.round(results.energyMegatons).toLocaleString()} megatons`,
      tone: results.verdict.color,
      description: `${results.comparisonBombs.toLocaleString()}x the largest nuclear bomb ever detonated`,
    },
    {
      id: 'crater',
      icon: '🕳️',
      title: 'Crater Diameter',
      value: `${results.craterKm.toFixed(0)} km`,
      tone: '#7ce9ff',
      description: largeAreaComparison(results.craterKm / 2),
    },
    {
      id: 'blast',
      icon: '🔥',
      title: 'Total Destruction Radius',
      value: `${results.blastRadiusKm.toFixed(0)} km`,
      tone: '#ff9b47',
      description: 'Everything within this radius is vaporized instantly',
    },
    {
      id: 'thermal',
      icon: '🌡️',
      title: 'Thermal Radiation Radius',
      value: `${results.thermalKm.toFixed(0)} km`,
      tone: '#ffd080',
      description: 'Severe heat burns would spread far beyond the blast front',
    },
    {
      id: 'population',
      icon: '🌍',
      title: 'Affected Population',
      value: `${results.populationLabel}`,
      tone: '#67ffc6',
      description: `Estimated within the thermal danger zone around ${impactPoint?.region || 'the impact site'}`,
    },
    {
      id: 'quake',
      icon: '📊',
      title: 'Equivalent Earthquake',
      value: `M ${results.magnitude.toFixed(1)}`,
      tone: '#d7ecff',
      description: 'No earthquake in recorded history has exceeded 9.5',
    },
  ];

  if (results.tsunamiHeightM) {
    cards.splice(4, 0, {
      id: 'tsunami',
      icon: '🌊',
      title: 'Tsunami Height',
      value: `${results.tsunamiHeightM.toFixed(0)} meters`,
      tone: '#5daeff',
      description: `Higher than a ${Math.max(5, Math.round(results.tsunamiHeightM / 3.2))}-story building at 500 km from impact`,
    });
  }

  return cards;
}
