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

    // ── AMBIENT BATTLE SCENE (ghost war in background) ────────────────────
    const TWO_PI = Math.PI * 2;
    const BATTLE_OPACITY = 0.25; // all battle elements at this max
    const COLORS = ['68,238,102', '238,51,68', '255,180,50', '100,180,255'];

    // Ghost nodes scattered across screen
    interface GhostNode {
      x: number; y: number; r: number; owner: number; units: number;
      pulsePhase: number;
    }
    const ghostNodes: GhostNode[] = [];
    for (let i = 0; i < 10; i++) {
      ghostNodes.push({
        x: 40 + Math.random() * (W - 80),
        y: 60 + Math.random() * (H - 120),
        r: 8 + Math.random() * 6,
        owner: i < 4 ? 0 : i < 7 ? 1 : 2,
        units: 5 + Math.floor(Math.random() * 30),
        pulsePhase: Math.random() * TWO_PI,
      });
    }

    // Ghost fleets traveling between nodes
    interface GhostFleet {
      fromIdx: number; toIdx: number; progress: number; speed: number;
      owner: number; units: number; arc: number;
    }
    const ghostFleets: GhostFleet[] = [];
    function spawnGhostFleet() {
      const ownerNodes = ghostNodes.filter((n, i) => n.owner > 0);
      if (ownerNodes.length < 2) return;
      const srcIdx = Math.floor(Math.random() * ghostNodes.length);
      const src = ghostNodes[srcIdx];
      if (src.owner === 0 || src.units < 5) return;
      // Pick a different node
      let tgtIdx = Math.floor(Math.random() * ghostNodes.length);
      if (tgtIdx === srcIdx) tgtIdx = (tgtIdx + 1) % ghostNodes.length;
      ghostFleets.push({
        fromIdx: srcIdx, toIdx: tgtIdx,
        progress: 0, speed: 0.08 + Math.random() * 0.06,
        owner: src.owner, units: 2 + Math.floor(Math.random() * 4),
        arc: (Math.random() - 0.5) * 80,
      });
    }
    // Seed initial fleets
    for (let i = 0; i < 4; i++) spawnGhostFleet();

    // Clash sparks pool
    interface ClashSpark {
      active: boolean; x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; color: string; size: number;
    }
    const clashSparks: ClashSpark[] = [];
    for (let i = 0; i < 40; i++) {
      clashSparks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 300, color: '', size: 1 });
    }
    function spawnClash(x: number, y: number, color: string) {
      for (let s = 0; s < 6; s++) {
        for (const sp of clashSparks) {
          if (!sp.active) {
            const a = Math.random() * TWO_PI;
            const spd = 30 + Math.random() * 50;
            sp.active = true; sp.x = x; sp.y = y;
            sp.vx = Math.cos(a) * spd; sp.vy = Math.sin(a) * spd;
            sp.life = 0; sp.maxLife = 200 + Math.random() * 150;
            sp.color = color; sp.size = 1 + Math.random() * 1.5;
            break;
          }
        }
      }
    }

    // Shockwave rings
    interface ShockRing { active: boolean; x: number; y: number; t: number; color: string; }
    const shockRings: ShockRing[] = [];
    for (let i = 0; i < 6; i++) {
      shockRings.push({ active: false, x: 0, y: 0, t: 0, color: '' });
    }
    function spawnShock(x: number, y: number, color: string) {
      for (const sr of shockRings) {
        if (!sr.active) { sr.active = true; sr.x = x; sr.y = y; sr.t = 0; sr.color = color; break; }
      }
    }

    let nextFleetSpawn = 2000 + Math.random() * 3000;

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

      // ── AMBIENT BATTLE SCENE ────────────────────────────────────────────
      // Spawn new fleets periodically
      nextFleetSpawn -= dt * 1000;
      if (nextFleetSpawn <= 0) {
        spawnGhostFleet();
        nextFleetSpawn = 3000 + Math.random() * 4000;
      }

      // Draw ghost nodes (pulsing circles)
      for (const gn of ghostNodes) {
        const pulse = 0.6 + 0.4 * Math.sin(now / 1800 + gn.pulsePhase);
        const c = COLORS[gn.owner] || '141,110,99';
        const nodeOp = BATTLE_OPACITY * 0.6 * pulse;
        // Glow
        const glow = ctx.createRadialGradient(gn.x, gn.y, gn.r * 0.3, gn.x, gn.y, gn.r + 8);
        glow.addColorStop(0, `rgba(${c},${(nodeOp * 0.5).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gn.x, gn.y, gn.r + 8, 0, TWO_PI); ctx.fill();
        // Core
        ctx.beginPath(); ctx.arc(gn.x, gn.y, gn.r, 0, TWO_PI);
        ctx.fillStyle = `rgba(${c},${nodeOp.toFixed(3)})`;
        ctx.fill();
        // Ring
        ctx.beginPath(); ctx.arc(gn.x, gn.y, gn.r + 2, 0, TWO_PI);
        ctx.strokeStyle = `rgba(${c},${(nodeOp * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1; ctx.stroke();
      }

      // Connection web between same-owner nodes
      for (let i = 0; i < ghostNodes.length; i++) {
        const a = ghostNodes[i];
        if (a.owner === 0) continue;
        for (let j = i + 1; j < ghostNodes.length; j++) {
          const b = ghostNodes[j];
          if (b.owner !== a.owner) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 160) continue;
          const linkOp = BATTLE_OPACITY * 0.15 * (1 - d / 160);
          const c = COLORS[a.owner];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${c},${linkOp.toFixed(3)})`;
          ctx.lineWidth = 1; ctx.stroke();
        }
      }

      // Update and draw ghost fleets
      for (let fi = ghostFleets.length - 1; fi >= 0; fi--) {
        const gf = ghostFleets[fi];
        gf.progress += gf.speed * dt;
        const from = ghostNodes[gf.fromIdx];
        const to = ghostNodes[gf.toIdx];
        if (!from || !to) { ghostFleets.splice(fi, 1); continue; }

        if (gf.progress >= 1) {
          // Fleet arrived — clash!
          const c = COLORS[gf.owner] || '255,255,255';
          spawnClash(to.x, to.y, `rgba(${c},${BATTLE_OPACITY})`);
          spawnShock(to.x, to.y, c);
          // Flip node ownership occasionally
          if (to.owner !== gf.owner && Math.random() < 0.4) {
            to.owner = gf.owner;
          }
          ghostFleets.splice(fi, 1);
          continue;
        }

        // Bezier position
        const mx = (from.x + to.x) / 2 - Math.sin(Math.atan2(to.y - from.y, to.x - from.x)) * gf.arc;
        const my = (from.y + to.y) / 2 + Math.cos(Math.atan2(to.y - from.y, to.x - from.x)) * gf.arc;
        const mt = gf.progress;
        const mt1 = 1 - mt;
        const fx = mt1 * mt1 * from.x + 2 * mt1 * mt * mx + mt * mt * to.x;
        const fy = mt1 * mt1 * from.y + 2 * mt1 * mt * my + mt * mt * to.y;

        const c = COLORS[gf.owner] || '255,255,255';
        const fleetOp = BATTLE_OPACITY * 0.8;

        // Comet trail
        for (let t = 1; t <= 4; t++) {
          const tt = Math.max(0, gf.progress - t * 0.04);
          const tt1 = 1 - tt;
          const tx = tt1 * tt1 * from.x + 2 * tt1 * tt * mx + tt * tt * to.x;
          const ty = tt1 * tt1 * from.y + 2 * tt1 * tt * my + tt * tt * to.y;
          const tOp = fleetOp * (1 - t / 5);
          ctx.beginPath(); ctx.arc(tx, ty, 2 - t * 0.3, 0, TWO_PI);
          ctx.fillStyle = `rgba(${c},${tOp.toFixed(3)})`; ctx.fill();
        }

        // Fleet dot
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, TWO_PI);
        ctx.fillStyle = `rgba(${c},${fleetOp.toFixed(3)})`; ctx.fill();
        // Fleet glow
        const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 8);
        fg.addColorStop(0, `rgba(${c},${(fleetOp * 0.4).toFixed(3)})`);
        fg.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, 8, 0, TWO_PI); ctx.fill();
      }

      // Update and draw clash sparks
      for (const sp of clashSparks) {
        if (!sp.active) continue;
        sp.life += dt * 1000;
        if (sp.life >= sp.maxLife) { sp.active = false; continue; }
        sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        sp.vx *= 0.95; sp.vy *= 0.95;
        const t = sp.life / sp.maxLife;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.size * (1 - t * 0.5), 0, TWO_PI);
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = (1 - t) * BATTLE_OPACITY;
        ctx.fill(); ctx.globalAlpha = 1;
      }

      // Update and draw shockwave rings
      for (const sr of shockRings) {
        if (!sr.active) continue;
        sr.t += dt * 1.5;
        if (sr.t >= 1) { sr.active = false; continue; }
        const shR = sr.t * 50;
        const shOp = (1 - sr.t) * BATTLE_OPACITY * 0.6;
        ctx.beginPath(); ctx.arc(sr.x, sr.y, shR, 0, TWO_PI);
        ctx.strokeStyle = `rgba(${sr.color},${shOp.toFixed(3)})`;
        ctx.lineWidth = 2 * (1 - sr.t); ctx.stroke();
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
