import { useRef, useEffect } from 'react';

export default function Radar({ asteroids = [] }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.44;
    let sweep = 0;

    // I'm learning how to position asteroids on a radar display! Using miss distance and threat level
    const blips = asteroids.slice(0, 20).map((ast) => {
      const lunar = parseFloat(ast.miss_distance_lunar) || 15;
      const dist = Math.min(lunar / 25, 0.95) * R;
      const ang = Math.random() * Math.PI * 2;
      const color = ast.threat_score >= 85 ? '#ff2d2d' : ast.threat_score >= 65 ? '#ff6b00' : ast.threat_score >= 40 ? '#ffc107' : '#00e5ff';
      return { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, color, score: ast.threat_score, ang, dist, trail: 0 };
    });

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // I'm learning about radar display backgrounds! This creates the dark radar screen
      ctx.fillStyle = 'rgba(1,8,18,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, R + 2, 0, Math.PI * 2);
      ctx.fill();

      // I'm learning how to draw concentric circles for radar range rings!
      [0.25, 0.5, 0.75, 1].forEach(f => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,229,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // I'm learning how to draw crosshairs on radar displays! These are the targeting lines
      ctx.strokeStyle = 'rgba(0,229,255,0.08)';
      ctx.lineWidth = 0.5;
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      });

      // I'm learning about radar sweep effects! This creates the rotating sweep gradient
      const gradient = ctx.createConicalGradient
        ? null
        : null;

      // I'm learning how to draw the radar sweep arc! This shows the scanning beam
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sweep - 0.8, sweep, false);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      sweepGrad.addColorStop(0, 'rgba(0,229,255,0)');
      sweepGrad.addColorStop(0.7, 'rgba(0,229,255,0.06)');
      sweepGrad.addColorStop(1, 'rgba(0,229,255,0.2)');
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // I'm learning how to draw the radar sweep line! This is the rotating beam
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.strokeStyle = 'rgba(0,229,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // I'm learning how to render object blips on a radar display! These dots show tracked asteroids
      blips.forEach(b => {
        const angleDiff = ((sweep - b.ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const brightness = Math.max(0, 1 - angleDiff / (Math.PI * 2));

        if (brightness > 0.01) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.score >= 65 ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.globalAlpha = 0.3 + brightness * 0.7;
          ctx.shadowBlur = brightness * 15;
          ctx.shadowColor = b.color;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
      });

      // I'm learning how to draw the center of the radar! This dot marks the origin
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00e5ff';
      ctx.fill();
      ctx.shadowBlur = 0;

      // I'm learning how to draw the outer radar boundary! This ring encloses the scanning area
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,229,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // I'm learning how to label the radar rings so the distances make sense
      ctx.fillStyle = 'rgba(0,229,255,0.3)';
      ctx.font = `8px Space Mono, monospace`;
      ['6LD', '12LD', '18LD'].forEach((label, i) => {
        ctx.fillText(label, cx + R * (i + 1) * 0.25 + 3, cy - 3);
      });

      sweep += 0.025;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [asteroids]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
      <div style={{ position: 'absolute', top: '10px', left: '12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(0,229,255,0.6)', letterSpacing: '2px' }}>PROXIMITY RADAR</span>
      </div>
    </div>
  );
}
