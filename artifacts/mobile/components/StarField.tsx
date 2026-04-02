import React, { memo, useEffect, useRef } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ── Star data (pre-computed once) ─────────────────────────────────────────
interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  twinkles: boolean;
  phase: number;
  speed: number;
  drifts: boolean;
  driftVx: number;
  driftVy: number;
}

function makeStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 120; i++) {
    // Size distribution: 60% tiny, 30% small, 10% medium
    let size: number;
    if (i < 72) size = 0.5 + Math.random() * 0.5;
    else if (i < 108) size = 1 + Math.random() * 1;
    else size = 2 + Math.random() * 1;

    // Color distribution: 70% white, 20% warm, 10% gold
    let color: string;
    if (i < 84) color = '#FFFFFF';
    else if (i < 108) color = '#FFF8E7';
    else color = '#FFD700';

    const twinkles = Math.random() < 0.4;
    const drifts = Math.random() < 0.15;

    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size,
      color,
      twinkles,
      phase: Math.random() * Math.PI * 2,
      speed: 1500 + Math.random() * 2500, // 1.5-4s cycle
      drifts,
      driftVx: drifts ? (Math.random() - 0.5) * 0.07 : 0, // ~2-5px/min
      driftVy: drifts ? (Math.random() - 0.5) * 0.07 : 0,
    });
  }
  return stars;
}

// ── Nebula clouds ─────────────────────────────────────────────────────────
interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  driftX: number;
  driftY: number;
}

const NEBULAE: Nebula[] = [
  { x: W * 0.85, y: H * 0.12, radius: 280, color: '26,5,51', alpha: 0.20, driftX: -0.05, driftY: 0.02 },
  { x: W * 0.12, y: H * 0.82, radius: 240, color: '10,26,15', alpha: 0.15, driftX: 0.02, driftY: -0.03 },
  { x: W * 0.78, y: H * 0.50, radius: 200, color: '26,10,0', alpha: 0.12, driftX: -0.07, driftY: 0.01 },
];

// ── Particle streams ──────────────────────────────────────────────────────
interface StreamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

function makeStreams(): StreamParticle[] {
  const streams: StreamParticle[] = [];
  const defs = [
    { color: 'rgba(255,215,0,0.3)', vx: 0.25, vy: -0.2 },
    { color: 'rgba(238,51,68,0.3)', vx: 0.1, vy: 0.2 },
    { color: 'rgba(255,165,0,0.3)', vx: -0.2, vy: 0.05 },
    { color: 'rgba(34,170,170,0.3)', vx: -0.1, vy: -0.25 },
  ];
  for (const d of defs) {
    for (let i = 0; i < 8; i++) {
      streams.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: d.vx,
        vy: d.vy,
        color: d.color,
      });
    }
  }
  return streams;
}

// ── Empire silhouettes (very faint, at edges) ─────────────────────────────
interface Silhouette {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  drawFn: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void;
}

function drawPyramidSil(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x - s * 0.6, y + s * 0.4);
  c.lineTo(x, y - s * 0.5);
  c.lineTo(x + s * 0.6, y + s * 0.4);
  c.closePath();
  c.fill();
}

function drawColosseumSil(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.arc(x, y - s * 0.1, s * 0.5, Math.PI, 0);
  c.lineTo(x + s * 0.5, y + s * 0.3);
  c.lineTo(x - s * 0.5, y + s * 0.3);
  c.closePath();
  c.fill();
}

function drawYurtSil(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x - s * 0.4, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.4, y - s * 0.2, x, y - s * 0.5, x, y - s * 0.5);
  c.bezierCurveTo(x, y - s * 0.5, x + s * 0.4, y - s * 0.2, x + s * 0.4, y + s * 0.3);
  c.closePath();
  c.fill();
}

function drawSphinxSil(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x - s * 0.5, y + s * 0.3);
  c.lineTo(x - s * 0.5, y);
  c.quadraticCurveTo(x - s * 0.2, y - s * 0.1, x + s * 0.1, y - s * 0.1);
  c.lineTo(x + s * 0.1, y - s * 0.4);
  c.lineTo(x + s * 0.35, y - s * 0.4);
  c.lineTo(x + s * 0.35, y);
  c.lineTo(x + s * 0.5, y + s * 0.1);
  c.lineTo(x + s * 0.5, y + s * 0.3);
  c.closePath();
  c.fill();
}

function drawPagodaSil(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // Simple torii/pagoda
  const pillarW = s * 0.06;
  c.fillRect(x - s * 0.3 - pillarW / 2, y - s * 0.1, pillarW, s * 0.4);
  c.fillRect(x + s * 0.3 - pillarW / 2, y - s * 0.1, pillarW, s * 0.4);
  // Top beam
  c.beginPath();
  c.moveTo(x - s * 0.4, y - s * 0.25);
  c.quadraticCurveTo(x, y - s * 0.4, x + s * 0.4, y - s * 0.25);
  c.lineTo(x + s * 0.4, y - s * 0.2);
  c.quadraticCurveTo(x, y - s * 0.33, x - s * 0.4, y - s * 0.2);
  c.closePath();
  c.fill();
}

const SILHOUETTES: Silhouette[] = [
  { x: W * 0.05, y: H * 0.18, size: 150, rotation: 0, rotSpeed: 0.0001, drawFn: drawPyramidSil },
  { x: W * 0.92, y: H * 0.28, size: 140, rotation: 0, rotSpeed: -0.00008, drawFn: drawColosseumSil },
  { x: W * 0.08, y: H * 0.75, size: 130, rotation: 0, rotSpeed: 0.00012, drawFn: drawYurtSil },
  { x: W * 0.90, y: H * 0.70, size: 160, rotation: 0, rotSpeed: -0.00006, drawFn: drawSphinxSil },
  { x: W * 0.50, y: H * 0.92, size: 120, rotation: 0, rotSpeed: 0.00009, drawFn: drawPagodaSil },
];

export default memo(function StarField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.scale(dpr, dpr);

    // Pre-allocate data
    const stars = makeStars();
    const streams = makeStreams();
    // Clone nebula positions for drift
    const nebs = NEBULAE.map(n => ({ ...n }));
    const sils = SILHOUETTES.map(s => ({ ...s }));

    // Static background: drawn once to offscreen canvas
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W * dpr;
    bgCanvas.height = H * dpr;
    const bgCtx = bgCanvas.getContext('2d')!;
    bgCtx.scale(dpr, dpr);

    // Base gradient
    const baseGrad = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    baseGrad.addColorStop(0, '#0f0f1a');
    baseGrad.addColorStop(1, '#050508');
    bgCtx.fillStyle = baseGrad;
    bgCtx.fillRect(0, 0, W, H);

    // Non-twinkling stars (static layer)
    for (const star of stars) {
      if (star.twinkles) continue;
      bgCtx.beginPath();
      bgCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      bgCtx.fillStyle = star.color;
      bgCtx.globalAlpha = 0.3 + Math.random() * 0.4;
      bgCtx.fill();
    }
    bgCtx.globalAlpha = 1;

    let lastFrame = performance.now();

    function frame(now: number) {
      const dt = Math.min((now - lastFrame) / 1000, 0.033);
      lastFrame = now;

      ctx.clearRect(0, 0, W, H);

      // Static background
      ctx.drawImage(bgCanvas, 0, 0, W, H);

      // ── Nebula clouds (very slow drift) ──
      for (const n of nebs) {
        n.x += n.driftX * dt;
        n.y += n.driftY * dt;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        grad.addColorStop(0, `rgba(${n.color},${n.alpha})`);
        grad.addColorStop(0.6, `rgba(${n.color},${(n.alpha * 0.3).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${n.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Empire silhouettes (barely visible) ──
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (const s of sils) {
        s.rotation += s.rotSpeed * dt * 60;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);
        ctx.translate(-s.x, -s.y);
        s.drawFn(ctx, s.x, s.y, s.size);
        ctx.restore();
      }

      // ── Twinkling stars ──
      for (const star of stars) {
        if (!star.twinkles) {
          // Drift only
          if (star.drifts) {
            star.x += star.driftVx * dt * 60;
            star.y += star.driftVy * dt * 60;
            if (star.x < 0) star.x += W;
            if (star.x > W) star.x -= W;
            if (star.y < 0) star.y += H;
            if (star.y > H) star.y -= H;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = star.color;
            ctx.globalAlpha = 0.4;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          continue;
        }
        if (star.drifts) {
          star.x += star.driftVx * dt * 60;
          star.y += star.driftVy * dt * 60;
          if (star.x < 0) star.x += W;
          if (star.x > W) star.x -= W;
          if (star.y < 0) star.y += H;
          if (star.y > H) star.y -= H;
        }
        const sinVal = Math.sin(now / star.speed + star.phase);
        const alpha = 0.2 + 0.7 * (sinVal * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Particle streams ──
      for (const p of streams) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H;
        if (p.y > H) p.y -= H;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // ── Vignette ──
      const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, Math.max(W, H) * 0.65);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (Platform.OS !== 'web') {
    // Non-web fallback: static dark background
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050508' }]} />;
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' } as any]}>
      <canvas
        ref={canvasRef as any}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          willChange: 'transform',
        } as any}
      />
    </View>
  );
});
