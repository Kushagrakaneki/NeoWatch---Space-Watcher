import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createSimulationEngine } from './SimulationEngine.js';

const EARTH_RADIUS = 2;
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

let geoJsonCache = null;
let geoJsonPromise = null;

function latLngToVector3(lat, lng, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function vectorToLatLng(vector) {
  const normalized = vector.clone().normalize();
  const lat = 90 - (Math.acos(normalized.y) * 180) / Math.PI;
  const lng = ((Math.atan2(normalized.z, -normalized.x) * 180) / Math.PI) - 180;
  return { lat, lng: ((lng + 540) % 360) - 180 };
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-6) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonContains(lat, lng, geometry) {
  const point = [lng, lat];
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates;
    if (!pointInRing(point, outer)) return false;
    return !holes.some((hole) => pointInRing(point, hole));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => {
      const [outer, ...holes] = polygon;
      if (!pointInRing(point, outer)) return false;
      return !holes.some((hole) => pointInRing(point, hole));
    });
  }
  return false;
}

async function loadGeoJson() {
  if (geoJsonCache) return geoJsonCache;
  if (!geoJsonPromise) {
    geoJsonPromise = fetch(GEOJSON_URL)
      .then((response) => response.json())
      .then((data) => {
        geoJsonCache = data;
        return data;
      });
  }
  return geoJsonPromise;
}

function buildCountryLines(features) {
  const positions = [];
  features.forEach((feature) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        for (let index = 0; index < ring.length - 1; index += 1) {
          const current = latLngToVector3(ring[index][1], ring[index][0], EARTH_RADIUS * 1.001);
          const next = latLngToVector3(ring[index + 1][1], ring[index + 1][0], EARTH_RADIUS * 1.001);
          positions.push(current.x, current.y, current.z, next.x, next.y, next.z);
        }
      });
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(8000 * 3);
  const colors = new Float32Array(8000 * 3);
  const colorChoices = [new THREE.Color('#ffffff'), new THREE.Color('#fff8e7'), new THREE.Color('#e8f0ff')];

  for (let i = 0; i < 8000; i += 1) {
    const radius = 150 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const index = i * 3;
    positions[index] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index + 1] = radius * Math.cos(phi);
    positions[index + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
}

function createAtmosphere() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.07, 64, 64),
    new THREE.MeshBasicMaterial({
      color: '#53b7ff',
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
}

function createGridOverlay() {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05 });

  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lng = -180; lng <= 180; lng += 4) {
      points.push(latLngToVector3(lat, lng, EARTH_RADIUS * 1.002));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material.clone()));
  }

  for (let lng = -150; lng <= 180; lng += 30) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 3) {
      points.push(latLngToVector3(lat, lng, EARTH_RADIUS * 1.002));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material.clone()));
  }

  group.visible = false;
  return group;
}

function hashCoordinates(seed) {
  const source = String(seed || '0');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return {
    lat: ((hash % 120) - 60),
    lng: ((((hash * 7) % 360) + 540) % 360) - 180,
  };
}

const GlobeRenderer = forwardRef(function GlobeRenderer(
  {
    selectedAsteroid,
    impactPoint,
    simulationConfig,
    onImpactPointSelect,
    onHoverRegion,
    onSimulationPhase,
    onSimulationComplete,
    onVisualStateChange,
  },
  ref
) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const earthGroupRef = useRef(null);
  const earthMeshRef = useRef(null);
  const atmosphereRef = useRef(null);
  const countryMaterialRef = useRef(null);
  const countryFeaturesRef = useRef([]);
  const starFieldRef = useRef(null);
  const gridRef = useRef(null);
  const animationFrameRef = useRef(0);
  const markerGroupRef = useRef(null);
  const engineRef = useRef(null);
  const simulationConfigRef = useRef(null);
  const processedSimulationTokenRef = useRef(null);
  const selectedAsteroidRef = useRef(selectedAsteroid);
  const hoverRegionRef = useRef('');
  const visualStateRef = useRef({ flash: false, vignette: false, aftermath: false, phase: 'idle' });
  const dragStateRef = useRef({ active: false, x: 0, y: 0, velocityX: 0, velocityY: 0, lastInteraction: 0, touchDistance: null });
  const zoomTargetRef = useRef(7);
  const autoRotateRef = useRef(true);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0.6, 7));
  const lookAtTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  function findRegion(lat, lng) {
    const region = countryFeaturesRef.current.find((feature) => polygonContains(lat, lng, feature.geometry));
    return region?.properties?.ADMIN || region?.properties?.name || 'Oceanic Impact Zone';
  }

  function clearMarker() {
    const group = markerGroupRef.current;
    if (!group) return;
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    group.visible = false;
  }

  function placeMarker(nextPoint) {
    const group = markerGroupRef.current;
    if (!group) return;
    clearMarker();
    const surface = latLngToVector3(nextPoint.lat, nextPoint.lng, EARTH_RADIUS * 1.012);
    const normal = surface.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    [0.14, 0.22, 0.3].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.01, radius, 48),
        new THREE.MeshBasicMaterial({
          color: '#ff5a4f',
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      ring.position.copy(surface);
      ring.quaternion.copy(quaternion);
      ring.userData.baseScale = 1 + index * 0.22;
      group.add(ring);
    });
    const crosshair = new THREE.Mesh(
      new THREE.CircleGeometry(0.028, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    crosshair.position.copy(surface);
    group.add(crosshair);
    group.visible = true;
  }

  useImperativeHandle(ref, () => ({
    setPresetPoint(point) {
      placeMarker(point);
    },
    clearPoint() {
      clearMarker();
    },
    getGeoFeatures() {
      return countryFeaturesRef.current;
    },
  }));

  useEffect(() => {
    selectedAsteroidRef.current = selectedAsteroid;
  }, [selectedAsteroid]);

  useEffect(() => {
    simulationConfigRef.current = simulationConfig;
  }, [simulationConfig]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0.6, 7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    scene.add(new THREE.AmbientLight('#1a2040', 0.4));
    const directional = new THREE.DirectionalLight('#ffffff', 1.2);
    directional.position.set(5, 3, 5);
    scene.add(directional);
    const fill = new THREE.PointLight('#4488ff', 0.3);
    fill.position.set(-5, -2, -3);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight('#0a1628', '#000510', 0.5));

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({
        color: '#0a1628',
        specular: '#d7ecff',
        shininess: 18,
        emissive: '#07111f',
        emissiveIntensity: 0.5,
      })
    );
    earthGroup.add(earth);
    earthMeshRef.current = earth;

    const atmosphere = createAtmosphere();
    earthGroup.add(atmosphere);
    atmosphereRef.current = atmosphere;

    const markerGroup = new THREE.Group();
    markerGroup.visible = false;
    earthGroup.add(markerGroup);
    markerGroupRef.current = markerGroup;

    const starField = createStarField();
    scene.add(starField);
    starFieldRef.current = starField;

    const gridOverlay = createGridOverlay();
    earthGroup.add(gridOverlay);
    gridRef.current = gridOverlay;

    engineRef.current = createSimulationEngine({ scene, atmosphere });

    loadGeoJson()
      .then((geojson) => {
        countryFeaturesRef.current = geojson.features;
        const geometry = buildCountryLines(geojson.features);
        const material = new THREE.LineBasicMaterial({ color: '#64c8ff', transparent: true, opacity: 0.25 });
        earthGroup.add(new THREE.LineSegments(geometry, material));
        countryMaterialRef.current = material;
      })
      .catch(() => {});

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const setPointer = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickGlobePoint = (clientX, clientY) => {
      setPointer(clientX, clientY);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObject(earth);
      if (!hit) return null;
      const local = earthGroup.worldToLocal(hit.point.clone());
      const spherical = vectorToLatLng(local);
      const region = findRegion(spherical.lat, spherical.lng);
      return {
        lat: spherical.lat,
        lng: spherical.lng,
        region,
        terrain: region === 'Oceanic Impact Zone' ? 'ocean' : 'land',
      };
    };

    const onPointerDown = (event) => {
      dragStateRef.current.active = true;
      dragStateRef.current.x = event.clientX;
      dragStateRef.current.y = event.clientY;
      dragStateRef.current.velocityX = 0;
      dragStateRef.current.velocityY = 0;
      autoRotateRef.current = false;
      container.style.cursor = 'grabbing';
    };

    const onPointerMove = (event) => {
      if (dragStateRef.current.active) {
        const deltaX = event.clientX - dragStateRef.current.x;
        const deltaY = event.clientY - dragStateRef.current.y;
        dragStateRef.current.velocityX = deltaX * 0.0025;
        dragStateRef.current.velocityY = deltaY * 0.0025;
        earthGroup.rotation.y += dragStateRef.current.velocityX;
        earthGroup.rotation.x = THREE.MathUtils.clamp(earthGroup.rotation.x + dragStateRef.current.velocityY, -1.1, 1.1);
        dragStateRef.current.x = event.clientX;
        dragStateRef.current.y = event.clientY;
        dragStateRef.current.lastInteraction = performance.now();
        return;
      }
      const point = pickGlobePoint(event.clientX, event.clientY);
      const nextRegion = point?.region || '';
      if (nextRegion !== hoverRegionRef.current) {
        hoverRegionRef.current = nextRegion;
        onHoverRegion?.(nextRegion);
      }
    };

    const onPointerUp = () => {
      dragStateRef.current.active = false;
      dragStateRef.current.lastInteraction = performance.now();
      container.style.cursor = selectedAsteroidRef.current ? 'grab' : 'default';
    };

    const onClick = (event) => {
      if (!selectedAsteroidRef.current || simulationConfigRef.current?.status === 'running') return;
      const point = pickGlobePoint(event.clientX, event.clientY);
      if (!point) return;
      placeMarker(point);
      onImpactPointSelect?.(point);
    };

    const onWheel = (event) => {
      zoomTargetRef.current = THREE.MathUtils.clamp(zoomTargetRef.current + event.deltaY * 0.0022, 3.0, 9.0);
    };

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        dragStateRef.current.touchDistance = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (event) => {
      if (event.touches.length === 2 && dragStateRef.current.touchDistance) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        zoomTargetRef.current = THREE.MathUtils.clamp(zoomTargetRef.current - (distance - dragStateRef.current.touchDistance) * 0.004, 3.0, 9.0);
        dragStateRef.current.touchDistance = distance;
      }
    };

    const onKeyDown = (event) => {
      if (event.key === '+' || event.key === '=') zoomTargetRef.current = Math.max(3.0, zoomTargetRef.current - 0.4);
      if (event.key === '-') zoomTargetRef.current = Math.min(9.0, zoomTargetRef.current + 0.4);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    let previous = performance.now();
    const animate = (now) => {
      const delta = Math.min(0.033, (now - previous) / 1000);
      previous = now;

      if (!dragStateRef.current.active) {
        const since = now - dragStateRef.current.lastInteraction;
        if (since > 3000) autoRotateRef.current = true;
        earthGroup.rotation.y += autoRotateRef.current ? 0.0008 * (60 * delta) : dragStateRef.current.velocityX;
        earthGroup.rotation.x = THREE.MathUtils.clamp(earthGroup.rotation.x + dragStateRef.current.velocityY, -1.1, 1.1);
        dragStateRef.current.velocityX *= 0.95;
        dragStateRef.current.velocityY *= 0.95;
      }

      if (markerGroup.visible) {
        markerGroup.children.forEach((child, index) => {
          if (child.userData.baseScale) {
            const pulse = 1 + Math.sin(now * 0.004 + index) * 0.08;
            child.scale.setScalar(child.userData.baseScale * pulse);
            child.material.opacity = 0.52 + (Math.sin(now * 0.006 + index) + 1) * 0.16;
          }
        });
      }

      starField.rotation.y -= 0.0001 * (60 * delta);
      starField.rotation.x -= 0.00003 * (60 * delta);
      camera.position.z += (zoomTargetRef.current - camera.position.z) * 0.08;

      if (countryMaterialRef.current) {
        countryMaterialRef.current.opacity = THREE.MathUtils.lerp(0.25, 0.5, THREE.MathUtils.clamp((5 - camera.position.z) / 2, 0, 1));
      }
      if (gridRef.current) {
        gridRef.current.visible = camera.position.z <= 3.2;
      }

      const engineState = engineRef.current?.update(now, delta);
      if (engineState?.desiredCameraPosition) {
        cameraTargetRef.current.lerp(engineState.desiredCameraPosition, 0.08);
        lookAtTargetRef.current.lerp(engineState.desiredLookAt, 0.08);
      } else {
        cameraTargetRef.current.set(0, 0.6, camera.position.z);
        lookAtTargetRef.current.set(0, 0, 0);
      }

      camera.position.x += (cameraTargetRef.current.x - camera.position.x) * 0.08;
      camera.position.y += (cameraTargetRef.current.y - camera.position.y) * 0.08;
      camera.lookAt(lookAtTargetRef.current);

      const phase = engineState?.phase || 'idle';
      const nextVisualState = {
        flash: phase === 'impact',
        vignette: phase !== 'idle' && phase !== 'complete',
        aftermath: phase === 'aftermath' || phase === 'complete',
        phase,
      };
      if (
        nextVisualState.phase !== visualStateRef.current.phase
        || nextVisualState.flash !== visualStateRef.current.flash
        || nextVisualState.vignette !== visualStateRef.current.vignette
        || nextVisualState.aftermath !== visualStateRef.current.aftermath
      ) {
        visualStateRef.current = nextVisualState;
        onVisualStateChange?.(nextVisualState);
      }

      renderer.render(scene, camera);
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
      engineRef.current?.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!selectedAsteroid || !earthGroupRef.current) return;
    const target = hashCoordinates(selectedAsteroid.id);
    const vector = latLngToVector3(target.lat, target.lng, EARTH_RADIUS);
    const spherical = new THREE.Spherical().setFromVector3(vector.clone().normalize());
    earthGroupRef.current.rotation.y = -spherical.theta;
    earthGroupRef.current.rotation.x = THREE.MathUtils.clamp((Math.PI / 2) - spherical.phi, -1.0, 1.0);
  }, [selectedAsteroid?.id]);

  useEffect(() => {
    if (!impactPoint) {
      clearMarker();
      return;
    }
    placeMarker(impactPoint);
  }, [impactPoint]);

  useEffect(() => {
    if (!simulationConfig || processedSimulationTokenRef.current === simulationConfig.token) return;
    processedSimulationTokenRef.current = simulationConfig.token;
    if (simulationConfig.type === 'start' && impactPoint) {
      const surfacePoint = latLngToVector3(impactPoint.lat, impactPoint.lng, EARTH_RADIUS * 1.01);
      engineRef.current?.start({
        surfacePoint,
        terrain: impactPoint.terrain,
        marker: markerGroupRef.current,
        options: simulationConfig.options,
        onPhaseChange: ({ phase, elapsed }) => onSimulationPhase?.(phase, elapsed),
        onComplete: () => onSimulationComplete?.(),
      });
    }
    if (simulationConfig.type === 'abort') {
      engineRef.current?.abort();
    }
    if (simulationConfig.type === 'reset') {
      engineRef.current?.reset();
      clearMarker();
    }
  }, [impactPoint, onSimulationComplete, onSimulationPhase, simulationConfig]);

  return (
    <div className="impact-lab__globe-shell">
      <div className="impact-lab__canvas" ref={containerRef} />
      <div className="impact-lab__zoom-ui">
        <button type="button" onClick={() => { zoomTargetRef.current = Math.max(3.0, zoomTargetRef.current - 0.5); }}>+</button>
        <div className="impact-lab__zoom-dots">
          {[7.0, 5.0, 3.8, 3.0].map((target) => (
            <span key={target} className={zoomTargetRef.current <= target + 0.2 ? 'is-active' : ''} />
          ))}
        </div>
        <button type="button" onClick={() => { zoomTargetRef.current = Math.min(9.0, zoomTargetRef.current + 0.5); }}>-</button>
      </div>
    </div>
  );
});

export default GlobeRenderer;
