import { useRef, useEffect } from 'react';

export default function Globe({ asteroids = [] }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.35;
    let angle = 0;

    // I'm learning how to draw orbit paths for asteroids! This creates elliptical paths based on the asteroid data
    const orbits = asteroids.slice(0, 8).map((ast, i) => {
      const threat = ast.threat_score || 0;
      const lunarDist = parseFloat(ast.miss_distance_lunar) || 10;
      const orbitR = R * (1 + Math.min(lunarDist / 20, 1.5));
      const color = threat >= 85 ? '#ff2d2d' : threat >= 65 ? '#ff6b00' : threat >= 40 ? '#ffc107' : '#00e5ff';
      return {
        a: orbitR * (0.9 + Math.random() * 0.4),
        b: orbitR * (0.4 + Math.random() * 0.3),
        tilt: (Math.random() - 0.5) * 0.8,
        phase: (i / asteroids.length) * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.003,
        color,
        name: ast.name?.slice(0, 12) || '',
        threat,
        bodyAngle: Math.random() * Math.PI * 2,
      };
    });

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // I'm learning about canvas gradients! This creates a deep space glow effect behind Earth
      const glow = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.8);
      glow.addColorStop(0, 'rgba(0,80,180,0.12)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // I'm learning how to draw ellipses on canvas! These are the asteroid orbit paths
      orbits.forEach(o => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.tilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, o.a, o.b, 0, 0, Math.PI * 2);
        ctx.strokeStyle = o.color + '28';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      });

      // I'm learning how to draw Earth! This creates the main planet sphere
      const earthGrad = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, R * 0.1, cx, cy, R);
      earthGrad.addColorStop(0, '#1a6bcc');
      earthGrad.addColorStop(0.5, '#0d4a8a');
      earthGrad.addColorStop(1, '#051a3a');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();

      // I'm learning about atmospheric effects! This creates a glowing ring around Earth
      ctx.beginPath();
      ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,180,255,0.25)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // I'm learning how to draw latitude and longitude grid lines on the globe!
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = cy + (lat / 90) * R;
        const halfW = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
        ctx.beginPath();
        ctx.moveTo(cx - halfW, y);
        ctx.lineTo(cx + halfW, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((lon + angle * 10) * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(0, -R);
        ctx.lineTo(0, R);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // I'm learning how to animate asteroids moving along their orbits! This calculates their position
      orbits.forEach(o => {
        const t = angle * o.speed / 0.002 + o.phase;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.tilt);
        const x = Math.cos(t) * o.a;
        const y = Math.sin(t) * o.b;
        ctx.restore();

        // I'm learning about coordinate transformations! Converting 3D orbit position to 2D canvas coordinates
        const rx = cx + (Math.cos(o.tilt) * x - Math.sin(o.tilt) * y);
        const ry = cy + (Math.sin(o.tilt) * x + Math.cos(o.tilt) * y);

        // I'm learning how to draw glowing dots for asteroids! This creates the visual representation
        const dotSize = o.threat >= 65 ? 5 : 3;
        ctx.beginPath();
        ctx.arc(rx, ry, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = o.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = o.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // I'm learning about conditional rendering! Only showing labels for high-threat asteroids
        if (o.threat >= 65) {
          ctx.fillStyle = o.color;
          ctx.font = `600 9px Space Mono, monospace`;
          ctx.fillText(o.name, rx + 7, ry - 4);
        }
      });

      // I'm learning how to add the Moon to the scene! It orbits around Earth
      const moonAngle = angle * 0.3;
      const moonX = cx + Math.cos(moonAngle) * (R * 1.6);
      const moonY = cy + Math.sin(moonAngle) * (R * 0.5);
      ctx.beginPath();
      ctx.arc(moonX, moonY, R * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#8899aa';
      ctx.fill();

      // I'm learning how to add text labels to canvas! This labels the center of Earth
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `bold 9px Space Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('EARTH', cx, cy + 3);
      ctx.textAlign = 'left';

      angle += 0.008;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [asteroids]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', gap: '12px' }}>
        {[['CRITICAL','#ff2d2d'],['HIGH','#ff6b00'],['MEDIUM','#ffc107'],['TRACKING','#00e5ff']].map(([l,c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: c, letterSpacing: '1px' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
