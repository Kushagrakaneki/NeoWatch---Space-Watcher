import * as THREE from 'three';

export const SIMULATION_PHASES = [
  { id: 'approach', label: 'Approach', start: 1.5, end: 5.0 },
  { id: 'entry', label: 'Entry', start: 5.0, end: 7.5 },
  { id: 'impact', label: 'Impact', start: 7.5, end: 7.9 },
  { id: 'shockwave', label: 'Shockwave', start: 7.9, end: 14.0 },
  { id: 'aftermath', label: 'Aftermath', start: 14.0, end: 20.0 },
];

function createCraterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  gradient.addColorStop(0, 'rgba(0,0,0,0.86)');
  gradient.addColorStop(0.45, 'rgba(13,11,11,0.92)');
  gradient.addColorStop(0.62, 'rgba(255,122,69,0.5)');
  gradient.addColorStop(0.78, 'rgba(255,122,69,0.12)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 120);
  gradient.addColorStop(0, 'rgba(255,130,80,0.85)');
  gradient.addColorStop(0.35, 'rgba(72,72,72,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function tangentFrame(normal) {
  const up = Math.abs(normal.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return { tangent, bitangent };
}

function phaseByTime(time) {
  for (const phase of SIMULATION_PHASES) {
    if (time >= phase.start && time < phase.end) return phase.id;
  }
  return time < 1.5 ? 'pre' : 'complete';
}

function makeShockwaveMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function disposeMaterial(material) {
  if (!material) return;
  if (material.map) material.map.dispose();
  material.dispose();
}

export function createSimulationEngine({ scene, atmosphere }) {
  let active = false;
  let finished = false;
  let startTime = 0;
  let elapsed = 0;
  let speed = 1;
  let currentPhase = 'idle';
  let lastPhase = 'idle';
  let impactPoint = null;
  let incomingDirection = null;
  let path = null;
  let meteor = null;
  let meteorCore = null;
  let meteorTail = null;
  let fireball = null;
  let shockwaves = [];
  let tsunamiRings = [];
  let debris = null;
  let debrisVelocities = null;
  let crater = null;
  let impactLight = null;
  let smoke = null;
  let pulseMarker = null;
  const desiredCameraPosition = new THREE.Vector3(0, 0.8, 7);
  const desiredLookAt = new THREE.Vector3();
  const toDispose = [];
  const baseAtmosphereColor = atmosphere.material.color.clone();
  const baseAtmosphereOpacity = atmosphere.material.opacity;

  function addDisposable(object) {
    scene.add(object);
    toDispose.push(object);
    return object;
  }

  function resetVisuals() {
    while (toDispose.length) {
      const object = toDispose.pop();
      object.parent?.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) disposeMaterial(object.material);
    }
    meteor = null;
    meteorCore = null;
    meteorTail = null;
    fireball = null;
    shockwaves = [];
    tsunamiRings = [];
    debris = null;
    debrisVelocities = null;
    crater = null;
    impactLight = null;
    smoke = null;
    pulseMarker = null;
    atmosphere.material.color.copy(baseAtmosphereColor);
    atmosphere.material.opacity = baseAtmosphereOpacity;
  }

  function start({ surfacePoint, terrain, marker, options, onPhaseChange, onComplete }) {
    resetVisuals();
    active = true;
    finished = false;
    startTime = performance.now();
    elapsed = 0;
    currentPhase = 'pre';
    lastPhase = 'pre';
    impactPoint = surfacePoint.clone();
    pulseMarker = marker || null;
    speed = options.simulationSpeed || 1;

    const normal = surfacePoint.clone().normalize();
    const { tangent, bitangent } = tangentFrame(normal);
    const angleRad = THREE.MathUtils.degToRad(options.approachAngle || 45);
    incomingDirection = normal.clone().multiplyScalar(-Math.cos(angleRad)).add(tangent.clone().multiplyScalar(Math.sin(angleRad))).normalize();
    const startPosition = impactPoint.clone().add(incomingDirection.clone().multiplyScalar(-8));
    const controlPoint = impactPoint.clone().add(incomingDirection.clone().multiplyScalar(-3.5)).add(bitangent.multiplyScalar(1.4));
    path = new THREE.QuadraticBezierCurve3(startPosition, controlPoint, impactPoint.clone().multiplyScalar(1.01));

    meteor = new THREE.Group();
    meteorCore = new THREE.Mesh(
      new THREE.SphereGeometry(options.meteorScale || 0.12, 24, 24),
      new THREE.MeshStandardMaterial({
        color: '#ff6600',
        emissive: '#ff4400',
        emissiveIntensity: 2,
        roughness: 0.28,
        metalness: 0.06,
      })
    );
    const plasmaCone = new THREE.Mesh(
      new THREE.ConeGeometry((options.meteorScale || 0.12) * 1.8, (options.meteorScale || 0.12) * 3.2, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd79e',
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    plasmaCone.rotation.z = Math.PI / 2;
    plasmaCone.position.x = (options.meteorScale || 0.12) * 1.2;
    meteor.add(meteorCore, plasmaCone);
    meteor.position.copy(startPosition);
    scene.add(meteor);
    toDispose.push(meteor);

    const tailGeometry = new THREE.BufferGeometry();
    const tailPositions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i += 1) {
      tailPositions[i * 3] = startPosition.x;
      tailPositions[i * 3 + 1] = startPosition.y;
      tailPositions[i * 3 + 2] = startPosition.z;
    }
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
    meteorTail = new THREE.Points(
      tailGeometry,
      new THREE.PointsMaterial({
        color: '#ffd9b0',
        size: 0.05,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(meteorTail);
    toDispose.push(meteorTail);

    fireball = addDisposable(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 24, 24),
        new THREE.MeshBasicMaterial({
          color: '#ff6622',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    );
    fireball.position.copy(impactPoint.clone().multiplyScalar(1.01));
    fireball.scale.setScalar(0.01);

    const shockwaveQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    shockwaves = [0, 0.3, 0.6].map((offset) => {
      const ring = addDisposable(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 12, 64), makeShockwaveMaterial('#ffb347')));
      ring.position.copy(impactPoint.clone().multiplyScalar(1.01));
      ring.quaternion.copy(shockwaveQuaternion);
      ring.scale.setScalar(0.01);
      ring.userData.offset = offset;
      ring.visible = false;
      return ring;
    });

    if (terrain === 'ocean') {
      tsunamiRings = Array.from({ length: 6 }, (_, index) => {
        const ring = addDisposable(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.01, 10, 64), makeShockwaveMaterial('#33a1ff')));
        ring.position.copy(impactPoint.clone().multiplyScalar(1.005));
        ring.quaternion.copy(shockwaveQuaternion);
        ring.scale.setScalar(0.01);
        ring.userData.offset = 0.5 + index * 0.45;
        ring.visible = false;
        return ring;
      });
    }

    impactLight = addDisposable(new THREE.PointLight('#ffffff', 0, 7, 2));
    impactLight.position.copy(impactPoint.clone().multiplyScalar(1.02));

    const debrisGeometry = new THREE.BufferGeometry();
    const debrisPositions = new Float32Array(300 * 3);
    debrisVelocities = Array.from({ length: 300 }, () => {
      return tangent.clone().multiplyScalar((Math.random() - 0.5) * 0.45)
        .add(normal.clone().multiplyScalar(0.26 + Math.random() * 0.34))
        .add(bitangent.clone().multiplyScalar((Math.random() - 0.5) * 0.45));
    });
    for (let i = 0; i < 300; i += 1) {
      debrisPositions[i * 3] = impactPoint.x;
      debrisPositions[i * 3 + 1] = impactPoint.y;
      debrisPositions[i * 3 + 2] = impactPoint.z;
    }
    debrisGeometry.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));
    debris = new THREE.Points(
      debrisGeometry,
      new THREE.PointsMaterial({
        color: '#ff9966',
        size: 0.03,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    debris.visible = false;
    scene.add(debris);
    toDispose.push(debris);

    crater = addDisposable(new THREE.Sprite(new THREE.SpriteMaterial({
      map: createCraterTexture(),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })));
    crater.position.copy(impactPoint.clone().multiplyScalar(1.01));
    crater.scale.setScalar(options.craterScale || 0.35);
    crater.visible = false;

    smoke = addDisposable(new THREE.Sprite(new THREE.SpriteMaterial({
      map: createSmokeTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })));
    smoke.position.copy(impactPoint.clone().multiplyScalar(1.05));
    smoke.scale.setScalar(0.1);

    desiredLookAt.copy(impactPoint);
    desiredCameraPosition.copy(impactPoint.clone().normalize().multiplyScalar(5.4).add(new THREE.Vector3(0.9, 0.5, 1.8)));
    onPhaseChange?.({ phase: 'approach', elapsed: 0 });
    start.onPhaseChange = onPhaseChange;
    start.onComplete = onComplete;
  }

  function abort() {
    active = false;
    finished = false;
    currentPhase = 'aborted';
    resetVisuals();
  }

  function reset() {
    abort();
    lastPhase = 'idle';
  }

  function update(now, deltaSeconds) {
    if (!active) return { running: false, desiredCameraPosition, desiredLookAt, phase: currentPhase, elapsed };

    elapsed = ((now - startTime) / 1000) * speed;
    currentPhase = phaseByTime(elapsed);

    if (currentPhase !== lastPhase && currentPhase !== 'pre' && currentPhase !== 'complete') {
      const phaseMeta = SIMULATION_PHASES.find((item) => item.id === currentPhase);
      start.onPhaseChange?.({ phase: currentPhase, elapsed, duration: phaseMeta ? phaseMeta.end - phaseMeta.start : 0 });
    }
    lastPhase = currentPhase;

    if (pulseMarker) {
      pulseMarker.scale.setScalar(1 + Math.sin(now * 0.01) * (currentPhase === 'pre' ? 0.26 : 0.14));
    }

    const atmosphericIntensity = currentPhase === 'shockwave' || currentPhase === 'aftermath' ? 0.78 : currentPhase === 'entry' ? 0.56 : 0.3;
    atmosphere.material.opacity += (atmosphericIntensity - atmosphere.material.opacity) * 0.08;
    atmosphere.material.color.lerp(new THREE.Color(currentPhase === 'shockwave' ? '#ff8a3a' : '#53b7ff'), 0.06);

    if (currentPhase === 'pre' || currentPhase === 'approach' || currentPhase === 'entry') {
      const travel = THREE.MathUtils.clamp((elapsed - 1.5) / 6.0, 0, 1);
      const point = path.getPoint(THREE.MathUtils.smootherstep(travel, 0, 1));
      meteor.visible = true;
      meteor.position.copy(point);
      meteor.lookAt(point.clone().add(incomingDirection.clone().negate()));
      meteorCore.material.emissiveIntensity = currentPhase === 'entry' ? 3.1 : 2.0;

      const positions = meteorTail.geometry.attributes.position.array;
      for (let i = 0; i < 500; i += 1) {
        const lag = i / 500;
        const jitter = (Math.random() - 0.5) * 0.02;
        positions[i * 3] = point.x - incomingDirection.x * (lag * 0.8) + jitter;
        positions[i * 3 + 1] = point.y - incomingDirection.y * (lag * 0.8) + jitter;
        positions[i * 3 + 2] = point.z - incomingDirection.z * (lag * 0.8) + jitter;
      }
      meteorTail.geometry.attributes.position.needsUpdate = true;

      const approachBias = THREE.MathUtils.clamp((elapsed - 1.5) / 3.5, 0, 1);
      desiredLookAt.lerp(impactPoint, 0.08);
      desiredCameraPosition.lerp(impactPoint.clone().normalize().multiplyScalar(5.3 - approachBias * 0.8).add(new THREE.Vector3(1.1, 0.6, 1.9)), 0.08);
    }

    if (currentPhase === 'impact') {
      meteor.visible = false;
      meteorTail.visible = false;
      fireball.material.opacity = 1;
      fireball.scale.lerp(new THREE.Vector3(2.8, 2.8, 2.8), 0.28);
      impactLight.intensity = 50 * (1 - Math.min(1, (elapsed - 7.5) / 0.3));
      debris.visible = true;
    }

    if (currentPhase === 'shockwave' || currentPhase === 'aftermath') {
      const localShock = THREE.MathUtils.clamp((elapsed - 7.8) / 6.2, 0, 1);
      shockwaves.forEach((ring) => {
        const t = THREE.MathUtils.clamp((localShock - ring.userData.offset / 4.2), 0, 1);
        if (t > 0) {
          ring.visible = true;
          ring.scale.setScalar(1 + 17 * (1 - Math.pow(1 - t, 3)));
          ring.material.opacity = 0.85 * (1 - t);
        }
      });

      tsunamiRings.forEach((ring) => {
        const t = THREE.MathUtils.clamp((localShock - ring.userData.offset / 6.5), 0, 1);
        if (t > 0) {
          ring.visible = true;
          ring.scale.setScalar(1 + 14 * t);
          ring.material.opacity = 0.5 * (1 - t);
        }
      });

      fireball.material.opacity = Math.max(0, 1 - localShock * 0.85);
      fireball.scale.lerp(new THREE.Vector3(4.4, 4.4, 4.4), 0.08);
      fireball.position.copy(impactPoint.clone().multiplyScalar(1.01 + localShock * 0.09));

      crater.visible = true;
      smoke.material.opacity = Math.min(0.62, localShock * 0.7);
      smoke.scale.setScalar(1 + localShock * 3.8);
      smoke.position.copy(impactPoint.clone().multiplyScalar(1.05 + localShock * 0.15));

      const positions = debris.geometry.attributes.position.array;
      for (let i = 0; i < debrisVelocities.length; i += 1) {
        const velocity = debrisVelocities[i];
        velocity.addScaledVector(impactPoint.clone().normalize().negate(), deltaSeconds * 0.16);
        positions[i * 3] += velocity.x * deltaSeconds;
        positions[i * 3 + 1] += velocity.y * deltaSeconds;
        positions[i * 3 + 2] += velocity.z * deltaSeconds;
      }
      debris.geometry.attributes.position.needsUpdate = true;

      desiredLookAt.lerp(impactPoint, 0.08);
      desiredCameraPosition.lerp(impactPoint.clone().normalize().multiplyScalar(currentPhase === 'aftermath' ? 6.2 : 5.1).add(new THREE.Vector3(1.8, 1.2, 2.3)), 0.06);
    }

    if (currentPhase === 'aftermath') {
      const calm = THREE.MathUtils.clamp((elapsed - 14) / 6, 0, 1);
      debris.material.opacity = Math.max(0.18, 0.68 - calm * 0.5);
      smoke.material.opacity = Math.max(0.22, 0.62 - calm * 0.18);
    }

    if (elapsed >= 20 && !finished) {
      finished = true;
      active = false;
      currentPhase = 'complete';
      start.onComplete?.();
    }

    return { running: active, desiredCameraPosition, desiredLookAt, phase: currentPhase, elapsed };
  }

  function dispose() {
    resetVisuals();
  }

  return { start, update, reset, abort, dispose };
}
