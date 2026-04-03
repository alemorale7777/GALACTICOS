import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, PanResponder, StyleSheet, View, Text } from 'react-native';
import { Fleet, NodeType, Planet, useGame } from '@/context/GameContext';
import { EmpireConfig, NodeShape } from '@/constants/empires';

// Polyfill for roundRect (Safari < 16)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x: number, y: number, w: number, h: number, r: number | number[]) {
    const rad = typeof r === 'number' ? r : r[0] ?? 0;
    this.moveTo(x + rad, y);
    this.lineTo(x + w - rad, y); this.arcTo(x + w, y, x + w, y + rad, rad);
    this.lineTo(x + w, y + h - rad); this.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    this.lineTo(x + rad, y + h); this.arcTo(x, y + h, x, y + h - rad, rad);
    this.lineTo(x, y + rad); this.arcTo(x, y, x + rad, y, rad);
    this.closePath();
  };
}

const HIT_EXTRA = 20;
const FOG_RADIUS = 220;
const WATCHTOWER_RADIUS = 380;
const INTEL_RADIUS = 200; // War fog: hide enemy unit counts beyond this range
const INTEL_RADIUS_WATCHTOWER = 350;
const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

// ── Intel check: can the player see unit counts on this node? ────────────────
function hasIntel(px: number, py: number, planets: Planet[]): boolean {
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if (p.owner !== 1) continue;
    const r = p.nodeType === 'watchtower' ? INTEL_RADIUS_WATCHTOWER : INTEL_RADIUS;
    if (Math.hypot(p.x - px, p.y - py) < r) return true;
  }
  return false;
}

// ── Performance thresholds (3-level adaptive quality) ────────────────────────
const MAX_PARTICLES_HIGH = 120;
const MAX_PARTICLES_MED = 50;
const MAX_PARTICLES_LOW = 20;
const MAX_TRAIL_HIGH = 4;
const MAX_TRAIL_MED = 2;
const MAX_TRAIL_LOW = 0;
const MAX_FOG_WISPS_HIGH = 3;
const MAX_FOG_WISPS_MED = 1;
const MAX_FOG_WISPS_LOW = 0;
const FPS_L2_THRESHOLD = 45;  // below this → quality L2
const FPS_L1_THRESHOLD = 36;  // below this → quality L1
const FPS_RESTORE_THRESHOLD = 55; // above this → restore quality

// ── Visibility ───────────────────────────────────────────────────────────────
function isVisible(px: number, py: number, planets: Planet[]): boolean {
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if (p.owner !== 1) continue;
    const r = p.nodeType === 'watchtower' ? WATCHTOWER_RADIUS : FOG_RADIUS;
    if (Math.hypot(p.x - px, p.y - py) < r) return true;
  }
  return false;
}

// ── Bezier helpers ───────────────────────────────────────────────────────────
function bezCtrl(x1: number, y1: number, x2: number, y2: number, arc: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return { cx: (x1 + x2) / 2 - Math.sin(a) * arc, cy: (y1 + y2) / 2 + Math.cos(a) * arc };
}
function bezPt(t: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return { x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2, y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2 };
}
function bezAngle(t: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return Math.atan2(2 * mt * (cy - y1) + 2 * t * (y2 - cy), 2 * mt * (cx - x1) + 2 * t * (x2 - cx));
}

// ── Node size scaling based on unit count ────────────────────────────────────
function nodeScale(units: number): number {
  if (units <= 10) return 1.0;
  if (units <= 25) return 1.0 + 0.15 * ((units - 10) / 15);
  if (units <= 50) return 1.15 + 0.15 * ((units - 25) / 25);
  return 1.3 + 0.15 * Math.min(1, (units - 50) / 50);
}

// ── Canvas 2D shape draws — ENHANCED ─────────────────────────────────────────

function drawPyramid(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const widthR = r * 1.3; // wider base ratio ~1.6:1
  const peak = y - r, base = y + r * 0.5;

  // Main triangle body
  c.beginPath(); c.moveTo(x - widthR, base); c.lineTo(x, peak); c.lineTo(x + widthR, base); c.closePath();
  c.fillStyle = color; c.fill();

  // Stepped texture: 2 horizontal lines across pyramid
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
  const h = base - peak;
  for (let step = 1; step <= 2; step++) {
    const ly = peak + h * (step / 3);
    const frac = (ly - peak) / h;
    const hw = widthR * frac;
    c.beginPath(); c.moveTo(x - hw, ly); c.lineTo(x + hw, ly); c.stroke();
  }

  // Base platform line
  c.strokeStyle = accent; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - widthR - 3, base); c.lineTo(x + widthR + 3, base); c.stroke();

  // Outline
  c.strokeStyle = accent; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x - widthR, base); c.lineTo(x, peak); c.lineTo(x + widthR, base); c.closePath(); c.stroke();

  // Gold capstone with 4 rays
  c.fillStyle = '#FFD700';
  c.beginPath(); c.arc(x, peak, 3, 0, TWO_PI); c.fill();
  c.strokeStyle = '#FFD700'; c.lineWidth = 1; c.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) {
    const a = (i * 90) * DEG_TO_RAD;
    c.beginPath(); c.moveTo(x + Math.cos(a) * 3, peak + Math.sin(a) * 3);
    c.lineTo(x + Math.cos(a) * 7, peak + Math.sin(a) * 7); c.stroke();
  }
  c.globalAlpha = 1;

  // Gate
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x - r * 0.18, base - r * 0.32, r * 0.36, r * 0.32);
}

function drawColosseum(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const top = y - r * 0.6, bot = y + r * 0.48;

  // Semicircular arch shape
  c.beginPath();
  c.arc(x, top + (bot - top) * 0.3, r, Math.PI, 0);
  c.lineTo(x + r, bot); c.lineTo(x - r, bot); c.closePath();
  c.fillStyle = color; c.fill();

  // 3 arch openings cut into base
  const n = 3, segW = (2 * r) / n, pad = r * 0.14;
  c.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < n; i++) {
    const ax = x - r + i * segW + pad, aw = segW - pad * 2;
    c.beginPath(); c.arc(ax + aw / 2, y + r * 0.05, aw / 2, Math.PI, 0);
    c.lineTo(ax + aw, bot); c.lineTo(ax, bot); c.closePath(); c.fill();
  }

  // Battlements: 5 merlons on top
  const mw = r * 0.18, mh = r * 0.2;
  c.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const mx = x - r + r * 0.15 + i * (2 * r * 0.7 / 4) - mw / 2;
    c.fillRect(mx, top - mh, mw, mh);
  }

  // Column lines on sides
  c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
  for (let side = -1; side <= 1; side += 2) {
    for (let col = 0; col < 2; col++) {
      const cx = x + side * (r * 0.5 + col * r * 0.2);
      c.beginPath(); c.moveTo(cx, top + r * 0.2); c.lineTo(cx, bot); c.stroke();
    }
  }

  // Outline
  c.strokeStyle = accent; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, top + (bot - top) * 0.3, r, Math.PI, 0);
  c.lineTo(x + r, bot); c.lineTo(x - r, bot); c.closePath(); c.stroke();

  // Silver accent ledge
  c.strokeStyle = '#C0C0C0'; c.lineWidth = 1; c.globalAlpha = 0.4;
  c.beginPath(); c.moveTo(x - r, top + (bot - top) * 0.25); c.lineTo(x + r, top + (bot - top) * 0.25); c.stroke();
  c.globalAlpha = 1;
}

function drawYurt(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const wallW = r * 0.9, wallBot = y + r * 0.48, peak = y - r * 0.95;

  // Dome body
  c.beginPath(); c.moveTo(x - wallW, wallBot); c.lineTo(x - wallW, y);
  c.bezierCurveTo(x - wallW, peak + r * 0.3, x, peak, x, peak);
  c.bezierCurveTo(x, peak, x + wallW, peak + r * 0.3, x + wallW, y);
  c.lineTo(x + wallW, wallBot); c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = accent; c.lineWidth = 1.5; c.stroke();

  // Lattice crosshatch pattern
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.8;
  const steps = 5;
  for (let i = 1; i < steps; i++) {
    const frac = i / steps;
    // Horizontal bands
    const ly = peak + (wallBot - peak) * frac;
    const hw = wallW * Math.min(1, frac * 1.3);
    c.beginPath(); c.moveTo(x - hw, ly); c.lineTo(x + hw, ly); c.stroke();
  }
  // Diagonal lines for lattice
  c.globalAlpha = 0.08;
  for (let d = -2; d <= 2; d++) {
    const dx = d * r * 0.25;
    c.beginPath(); c.moveTo(x + dx - r * 0.3, peak + r * 0.3);
    c.lineTo(x + dx + r * 0.3, wallBot); c.stroke();
    c.beginPath(); c.moveTo(x + dx + r * 0.3, peak + r * 0.3);
    c.lineTo(x + dx - r * 0.3, wallBot); c.stroke();
  }
  c.globalAlpha = 1;

  // Door arch
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.arc(x, wallBot - r * 0.18, r * 0.15, Math.PI, 0);
  c.lineTo(x + r * 0.15, wallBot); c.lineTo(x - r * 0.15, wallBot); c.closePath(); c.fill();

  // Rope/tension lines from finial to base edges (3 each side)
  c.strokeStyle = accent; c.lineWidth = 0.8; c.globalAlpha = 0.3;
  for (let side = -1; side <= 1; side += 2) {
    for (let rope = 0; rope < 3; rope++) {
      const bx = x + side * (wallW * 0.3 + rope * wallW * 0.25);
      c.beginPath(); c.moveTo(x, peak); c.lineTo(bx, wallBot); c.stroke();
    }
  }
  c.globalAlpha = 1;

  // Pointed finial on top
  c.fillStyle = '#FFCC44';
  c.beginPath(); c.moveTo(x, peak - 5); c.lineTo(x - 2, peak); c.lineTo(x + 2, peak); c.closePath(); c.fill();
  c.beginPath(); c.arc(x, peak - 5, 2, 0, TWO_PI); c.fill();
}

function drawSphinx(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  // Reclining lion body with raised head
  const bodyL = x - r * 0.9, bodyR = x + r * 0.9;
  const bodyTop = y + r * 0.05, bodyBot = y + r * 0.48;
  const headX = x + r * 0.5, headTop = y - r * 0.85;

  // Lion body (elongated)
  c.beginPath();
  c.moveTo(bodyL, bodyBot); // rear
  c.lineTo(bodyL, bodyTop + r * 0.2);
  c.quadraticCurveTo(bodyL + r * 0.3, bodyTop, x, bodyTop);
  // Neck rise
  c.lineTo(headX - r * 0.15, bodyTop);
  c.lineTo(headX - r * 0.15, headTop + r * 0.3);
  // Head + headdress (nemes)
  c.lineTo(headX - r * 0.35, headTop);
  c.lineTo(headX + r * 0.35, headTop);
  c.lineTo(headX + r * 0.35, headTop + r * 0.5);
  c.lineTo(headX + r * 0.15, bodyTop + r * 0.1);
  c.lineTo(bodyR, bodyTop + r * 0.2);
  c.lineTo(bodyR, bodyBot);
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = accent; c.lineWidth = 1.5; c.stroke();

  // Headdress lines (nemes stripes)
  c.strokeStyle = '#FFD700'; c.lineWidth = 0.8; c.globalAlpha = 0.4;
  for (let i = 1; i <= 3; i++) {
    const hy = headTop + i * r * 0.12;
    c.beginPath(); c.moveTo(headX - r * 0.32, hy); c.lineTo(headX + r * 0.32, hy); c.stroke();
  }
  c.globalAlpha = 1;

  // Extended paw
  c.fillStyle = color;
  c.fillRect(bodyL - r * 0.15, bodyBot - r * 0.12, r * 0.35, r * 0.12);
  c.strokeStyle = accent; c.lineWidth = 1;
  c.strokeRect(bodyL - r * 0.15, bodyBot - r * 0.12, r * 0.35, r * 0.12);

  // Eye
  c.fillStyle = '#FFD700';
  c.beginPath(); c.arc(headX + r * 0.05, headTop + r * 0.2, 2, 0, TWO_PI); c.fill();
}

function drawTorii(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const bot = y + r * 0.48, pillarW = r * 0.15;
  const topBeam = y - r * 0.7, midBeam = y - r * 0.35;
  const gateW = r * 0.85;

  // Two pillars
  c.fillStyle = color;
  c.fillRect(x - gateW - pillarW / 2, midBeam, pillarW, bot - midBeam);
  c.fillRect(x + gateW - pillarW / 2, midBeam, pillarW, bot - midBeam);

  // Top beam (curved upward at edges — iconic torii shape)
  c.beginPath();
  c.moveTo(x - gateW - r * 0.2, topBeam + r * 0.08);
  c.quadraticCurveTo(x, topBeam - r * 0.1, x + gateW + r * 0.2, topBeam + r * 0.08);
  c.lineTo(x + gateW + r * 0.2, topBeam + r * 0.18);
  c.quadraticCurveTo(x, topBeam + r * 0.02, x - gateW - r * 0.2, topBeam + r * 0.18);
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = accent; c.lineWidth = 1; c.stroke();

  // Middle crossbeam
  c.fillStyle = color;
  c.fillRect(x - gateW, midBeam, gateW * 2, r * 0.1);
  c.strokeStyle = accent; c.lineWidth = 0.8;
  c.strokeRect(x - gateW, midBeam, gateW * 2, r * 0.1);

  // Pillar outlines
  c.strokeStyle = accent; c.lineWidth = 1;
  c.strokeRect(x - gateW - pillarW / 2, midBeam, pillarW, bot - midBeam);
  c.strokeRect(x + gateW - pillarW / 2, midBeam, pillarW, bot - midBeam);

  // Small roof cap
  c.fillStyle = accent;
  c.beginPath(); c.arc(x, topBeam - r * 0.05, 2.5, 0, TWO_PI); c.fill();
}

function drawLonghouse(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const w = r * 1.2, h = r * 0.5;
  const bot = y + h, top = y - r * 0.6;
  // Rectangular base
  c.fillStyle = color;
  c.fillRect(x - w, y - h * 0.3, w * 2, h + h * 0.3);
  // Curved roof
  c.beginPath(); c.moveTo(x - w - 2, y - h * 0.3);
  c.quadraticCurveTo(x, top, x + w + 2, y - h * 0.3);
  c.fill();
  // Door
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x - r * 0.12, bot - r * 0.3, r * 0.24, r * 0.3);
  // Cross beams
  c.strokeStyle = accent; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - w * 0.3, y - h * 0.3); c.lineTo(x + w * 0.3, y - h * 0.3); c.stroke();
  // Outline
  c.strokeStyle = accent; c.lineWidth = 1.5;
  c.strokeRect(x - w, y - h * 0.3, w * 2, h + h * 0.3);
}

function drawStepPyramid(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const steps = 4, baseW = r * 1.4, baseY = y + r * 0.45;
  c.fillStyle = color;
  for (let i = 0; i < steps; i++) {
    const frac = 1 - i / steps;
    const sw = baseW * frac, sh = r * 0.25;
    const sy = baseY - i * sh;
    c.fillRect(x - sw, sy - sh, sw * 2, sh);
  }
  // Temple block on top
  const topY = baseY - steps * r * 0.25;
  c.fillRect(x - r * 0.15, topY - r * 0.2, r * 0.3, r * 0.2);
  // Step lines
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
  for (let i = 1; i < steps; i++) {
    const sy = baseY - i * r * 0.25;
    const sw = baseW * (1 - i / steps);
    c.beginPath(); c.moveTo(x - sw, sy); c.lineTo(x + sw, sy); c.stroke();
  }
  // Outline accent
  c.strokeStyle = accent; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - baseW, baseY); c.lineTo(x + baseW, baseY); c.stroke();
}

function drawPalace(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const bot = y + r * 0.48, top = y - r * 0.5;
  const w = r * 0.9;
  // Main body
  c.fillStyle = color;
  c.fillRect(x - w, top, w * 2, bot - top);
  // Columns
  const colW = r * 0.08;
  c.fillStyle = accent; c.globalAlpha = 0.3;
  c.fillRect(x - w * 0.6, top + r * 0.1, colW, bot - top - r * 0.1);
  c.fillRect(x + w * 0.6 - colW, top + r * 0.1, colW, bot - top - r * 0.1);
  c.globalAlpha = 1;
  // Pointed arch doorway
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath();
  c.moveTo(x - r * 0.2, bot);
  c.lineTo(x - r * 0.2, y);
  c.quadraticCurveTo(x, y - r * 0.3, x + r * 0.2, y);
  c.lineTo(x + r * 0.2, bot);
  c.closePath(); c.fill();
  // Dome on top
  c.fillStyle = accent;
  c.beginPath(); c.arc(x, top, r * 0.2, Math.PI, 0); c.fill();
  // Outline
  c.strokeStyle = accent; c.lineWidth = 1.5;
  c.strokeRect(x - w, top, w * 2, bot - top);
}

function drawMosque(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const bot = y + r * 0.48, baseTop = y - r * 0.1;
  const w = r * 0.8;
  // Base
  c.fillStyle = color;
  c.fillRect(x - w, baseTop, w * 2, bot - baseTop);
  // Large dome
  c.beginPath(); c.arc(x, baseTop, r * 0.6, Math.PI, 0);
  c.fillStyle = color; c.fill();
  // Crescent on dome
  const crescentY = baseTop - r * 0.6 - 3;
  c.fillStyle = accent;
  c.beginPath(); c.arc(x, crescentY, 3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + 1.5, crescentY, 2.5, 0, Math.PI * 2);
  c.fillStyle = color; c.fill();
  // Minarets
  const mW = r * 0.06;
  c.fillStyle = color;
  c.fillRect(x - w - mW, baseTop - r * 0.5, mW, r * 0.5 + bot - baseTop);
  c.fillRect(x + w, baseTop - r * 0.5, mW, r * 0.5 + bot - baseTop);
  // Minaret caps
  c.fillStyle = accent; c.globalAlpha = 0.5;
  c.beginPath(); c.arc(x - w - mW / 2, baseTop - r * 0.5, mW, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + w + mW / 2, baseTop - r * 0.5, mW, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  // Doorway
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.arc(x, bot - r * 0.2, r * 0.12, Math.PI, 0);
  c.lineTo(x + r * 0.12, bot); c.lineTo(x - r * 0.12, bot); c.closePath(); c.fill();
  // Outline
  c.strokeStyle = accent; c.lineWidth = 1;
  c.strokeRect(x - w, baseTop, w * 2, bot - baseTop);
}

function drawPagoda(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const bot = y + r * 0.48;
  const tiers = 3;
  c.fillStyle = color;
  for (let i = 0; i < tiers; i++) {
    const frac = 1 - i * 0.25;
    const tw = r * 0.9 * frac;
    const th = r * 0.28;
    const ty = bot - i * th - th;
    // Body
    c.fillRect(x - tw * 0.7, ty, tw * 1.4, th);
    // Roof with upturned corners
    c.beginPath();
    c.moveTo(x - tw - r * 0.15, ty + r * 0.06);
    c.quadraticCurveTo(x, ty - r * 0.08, x + tw + r * 0.15, ty + r * 0.06);
    c.lineTo(x + tw, ty + r * 0.02);
    c.lineTo(x - tw, ty + r * 0.02);
    c.closePath(); c.fill();
  }
  // Spire
  const topY = bot - tiers * r * 0.28 - r * 0.28;
  c.fillStyle = accent;
  c.beginPath(); c.moveTo(x, topY - r * 0.15); c.lineTo(x - 2, topY); c.lineTo(x + 2, topY); c.closePath(); c.fill();
  // Accent lines
  c.strokeStyle = accent; c.lineWidth = 0.8; c.globalAlpha = 0.4;
  c.beginPath(); c.moveTo(x - r * 0.3, bot); c.lineTo(x + r * 0.3, bot); c.stroke();
  c.globalAlpha = 1;
}

function drawCastle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, accent: string) {
  const bot = y + r * 0.52, wL = x - r, wR = x + r, wTop = y - r * 0.08;
  const kTop = wTop - r * 1.08, kL = x - r * 0.3, kR = x + r * 0.3;

  c.fillStyle = color;
  // Main wall
  c.fillRect(wL, wTop, wR - wL, bot - wTop);
  // Keep tower
  c.fillRect(kL, kTop, kR - kL, wTop - kTop);
  // Side towers
  c.fillRect(wL, wTop - r * 0.55, r * 0.42, r * 0.55);
  c.fillRect(wR - r * 0.42, wTop - r * 0.55, r * 0.42, r * 0.55);

  // Battlements on keep (5 merlons)
  const mw = r * 0.12, ml = r * 0.18;
  for (let i = 0; i < 5; i++) {
    const mx = kL + (kR - kL) * (i / 4) - mw / 2;
    c.fillRect(mx, kTop - ml, mw, ml);
  }
  // Battlements on side towers
  for (let side = 0; side < 2; side++) {
    const tL = side === 0 ? wL : wR - r * 0.42;
    for (let i = 0; i < 3; i++) {
      const mx = tL + r * 0.42 * (i / 2) - mw / 2;
      c.fillRect(mx, wTop - r * 0.55 - ml, mw, ml);
    }
  }

  // Arrow slit window
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(x - 1.5, kTop + r * 0.15, 3, r * 0.35);
  c.fillRect(x - 4, kTop + r * 0.25, 8, 3);

  // Stone texture: subtle darker lines
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.5;
  for (let sy = wTop + r * 0.15; sy < bot; sy += r * 0.2) {
    c.beginPath(); c.moveTo(wL, sy); c.lineTo(wR, sy); c.stroke();
  }

  // Gate arch
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath(); c.arc(x, bot - r * 0.3, r * 0.18, Math.PI, 0);
  c.lineTo(x + r * 0.18, bot); c.lineTo(x - r * 0.18, bot); c.closePath(); c.fill();

  c.strokeStyle = accent; c.lineWidth = 1; c.globalAlpha = 0.6;
  c.strokeRect(wL, wTop, wR - wL, bot - wTop); c.globalAlpha = 1;
}

// ── Node type icons ──────────────────────────────────────────────────────────
function drawNodeIcon(c: CanvasRenderingContext2D, x: number, y: number, r: number, nodeType: NodeType) {
  const iy = y - r - 14;
  c.fillStyle = 'rgba(255,255,240,0.85)'; c.strokeStyle = 'rgba(255,255,240,0.85)'; c.lineWidth = 1.5;
  switch (nodeType) {
    case 'fortress':
      c.beginPath(); c.moveTo(x - 7, iy); c.lineTo(x, iy - 8); c.lineTo(x + 7, iy); c.lineTo(x, iy + 8); c.closePath(); c.fill(); break;
    case 'barracks':
      c.beginPath(); c.moveTo(x, iy - 8); c.lineTo(x, iy + 6); c.stroke();
      c.beginPath(); c.moveTo(x - 5, iy - 2); c.lineTo(x + 5, iy - 2); c.stroke(); break;
    case 'capital':
      c.fillStyle = '#FFD700';
      c.beginPath(); c.moveTo(x - 9, iy + 3); c.lineTo(x - 9, iy - 1); c.lineTo(x - 4, iy + 1);
      c.lineTo(x, iy - 7); c.lineTo(x + 4, iy + 1); c.lineTo(x + 9, iy - 1); c.lineTo(x + 9, iy + 3); c.closePath(); c.fill(); break;
    case 'watchtower':
      c.beginPath(); c.ellipse(x, iy, 7, 4.5, 0, 0, TWO_PI); c.stroke();
      c.beginPath(); c.arc(x, iy, 2.5, 0, TWO_PI); c.fill(); break;
    case 'ruins':
      c.globalAlpha = 0.45;
      c.fillRect(x - 7, iy - 4, 5, 8); c.fillRect(x - 1, iy - 2, 4, 6); c.fillRect(x + 4, iy - 5, 3, 9);
      c.globalAlpha = 1; break;
  }
}

// ── Unit shapes ──────────────────────────────────────────────────────────────
function drawRotatedPoly(c: CanvasRenderingContext2D, bx: number, by: number, angle: number, pts: number[][], color: string) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    const rx = bx + px * cos - py * sin, ry = by + px * sin + py * cos;
    if (i === 0) c.moveTo(rx, ry); else c.lineTo(rx, ry);
  }
  c.closePath(); c.fillStyle = color; c.fill();
}

// Scarab: golden oval with wing lines
const SCARAB_PTS = [[6, 0], [3.5, 4], [-3, 3.5], [-4, 0], [-3, -3.5], [3.5, -4]];
// Shield: rectangle with rounded top
const SHIELD_PTS = [[5, -4], [5, 4], [-4, 4], [-5, 2], [-5, -2], [-4, -4]];
// Horse: teardrop pointing forward
const HORSE_PTS = [[8, 0], [3, 4.5], [-4, 4], [-6, 0], [-4, -4], [3, -4.5]];
// Ankh: simplified cross with loop
const ANKH_PTS = [[0, -7], [2.5, -5], [2.5, -2], [5, -2], [5, 2], [2.5, 2], [2.5, 6], [-2.5, 6], [-2.5, 2], [-5, 2], [-5, -2], [-2.5, -2], [-2.5, -5]];
// Viking ship: elongated oval with dragon head
const VIKING_SHIP_PTS = [[8, 0], [5, 3.5], [-5, 3], [-7, 0], [-5, -3], [5, -3.5]];
// Warrior: circle body with headdress fan
const WARRIOR_PTS = [[4, 0], [2, 4], [-3, 4], [-4, 0], [-3, -4], [2, -4]];
// Immortal: rectangle with spear
const IMMORTAL_PTS = [[7, 0], [3, 3], [-4, 3], [-5, 0], [-4, -3], [3, -3]];
// Janissary: tall rectangle with hat
const JANISSARY_PTS = [[5, 0], [3, 4], [-3, 4], [-5, 0], [-3, -4], [3, -4]];
// Han soldier: circle with banner
const HAN_SOLDIER_PTS = [[6, 0], [3, 4], [-4, 3.5], [-5, 0], [-4, -3.5], [3, -4]];
// Default troop
const TROOP_PTS = [[6, 0], [3.5, 4.5], [-3, 4], [-4, 0], [-3, -4], [3.5, -4.5]];

function drawUnit(c: CanvasRenderingContext2D, bx: number, by: number, angle: number, shape: string | undefined, color: string) {
  switch (shape) {
    case 'scarab': {
      drawRotatedPoly(c, bx, by, angle, SCARAB_PTS, color);
      // Wing lines
      const cos = Math.cos(angle), sin = Math.sin(angle);
      c.strokeStyle = 'rgba(255,215,0,0.5)'; c.lineWidth = 0.8;
      for (let side = -1; side <= 1; side += 2) {
        const wx = bx + (3 * cos - side * 3 * sin);
        const wy = by + (3 * sin + side * 3 * cos);
        const wx2 = bx + (-1 * cos - side * 5 * sin);
        const wy2 = by + (-1 * sin + side * 5 * cos);
        c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx2, wy2); c.stroke();
      }
      // Head circle
      c.beginPath();
      c.arc(bx + Math.cos(angle) * 5, by + Math.sin(angle) * 5, 1.5, 0, TWO_PI);
      c.fillStyle = '#FFD700'; c.fill();
      break;
    }
    case 'shield': {
      drawRotatedPoly(c, bx, by, 0, SHIELD_PTS, color); // Shields don't rotate
      // Boss dot in center
      c.beginPath(); c.arc(bx, by, 1.5, 0, TWO_PI);
      c.fillStyle = '#C0C0C0'; c.fill();
      // Silver rim
      c.strokeStyle = '#C0C0C0'; c.lineWidth = 0.8;
      drawRotatedPoly(c, bx, by, 0, SHIELD_PTS, color);
      break;
    }
    case 'horse': {
      drawRotatedPoly(c, bx, by, angle, HORSE_PTS, color);
      // Head bump
      const headX = bx + Math.cos(angle) * 7;
      const headY = by + Math.sin(angle) * 7;
      c.beginPath(); c.arc(headX, headY, 2, 0, TWO_PI);
      c.fillStyle = color; c.fill();
      break;
    }
    case 'ankh':
      drawRotatedPoly(c, bx, by, 0, ANKH_PTS, color);
      // Loop at top
      c.beginPath(); c.arc(bx, by - 6, 3, 0, TWO_PI);
      c.strokeStyle = color; c.lineWidth = 1.5; c.stroke();
      break;
    case 'katana': {
      // Blade (rotated to face direction)
      const kcos = Math.cos(angle), ksin = Math.sin(angle);
      c.strokeStyle = color; c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(bx - kcos * 6, by - ksin * 6);
      c.lineTo(bx + kcos * 8, by + ksin * 8);
      c.stroke();
      // Slight curve at tip
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(bx + kcos * 8, by + ksin * 8);
      c.quadraticCurveTo(
        bx + kcos * 10 + ksin * 2, by + ksin * 10 - kcos * 2,
        bx + kcos * 9, by + ksin * 9
      );
      c.stroke();
      // Guard (tsuba) — small perpendicular line
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(bx - ksin * 3, by + kcos * 3);
      c.lineTo(bx + ksin * 3, by - kcos * 3);
      c.stroke();
      break;
    }
    case 'viking_ship':
      drawRotatedPoly(c, bx, by, angle, VIKING_SHIP_PTS, color);
      // Dragon head bump
      c.beginPath(); c.arc(bx + Math.cos(angle) * 7, by + Math.sin(angle) * 7, 2, 0, TWO_PI);
      c.fillStyle = '#E0E0E0'; c.fill();
      break;
    case 'warrior':
      drawRotatedPoly(c, bx, by, angle, WARRIOR_PTS, color);
      // Headdress fan
      c.beginPath();
      c.arc(bx - Math.cos(angle) * 2, by - Math.sin(angle) * 2, 5, angle - 1.2, angle + 1.2);
      c.strokeStyle = color; c.lineWidth = 1; c.stroke();
      break;
    case 'immortal':
      drawRotatedPoly(c, bx, by, angle, IMMORTAL_PTS, color);
      // Shield circle
      c.beginPath(); c.arc(bx, by, 2, 0, TWO_PI);
      c.fillStyle = '#FFD700'; c.fill();
      break;
    case 'janissary':
      drawRotatedPoly(c, bx, by, angle, JANISSARY_PTS, color);
      // Tall hat
      const hx = bx - Math.sin(angle) * 4, hy = by + Math.cos(angle) * 4;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.sin(angle) * 4, hy + Math.cos(angle) * 4);
      c.strokeStyle = '#00BCD4'; c.lineWidth = 1.5; c.stroke();
      break;
    case 'han_soldier':
      drawRotatedPoly(c, bx, by, angle, HAN_SOLDIER_PTS, color);
      // Banner on back
      const bkx = bx - Math.cos(angle) * 5, bky = by - Math.sin(angle) * 5;
      c.beginPath(); c.moveTo(bkx, bky);
      c.lineTo(bkx - Math.sin(angle) * 5, bky + Math.cos(angle) * 5);
      c.strokeStyle = '#FDD835'; c.lineWidth = 1; c.stroke();
      break;
    default: drawRotatedPoly(c, bx, by, angle, TROOP_PTS, color); break;
  }
}

// ── Formation system ─────────────────────────────────────────────────────────
// Dynamic formations based on fleet size
const DIAMOND_FORMATION: number[][] = [
  [10, 0], [0, 6], [0, -6], [-10, 0],
];

const V_FORMATION: number[][] = [
  [14, 0],       // Lead at apex
  [5, -7], [5, 7],
  [-4, -14], [-4, 14],
  [-13, -7], [-13, 7],
  [-22, -14], [-22, 14],
  [-22, 0],
  [-31, -7], [-31, 7],
];

const COLUMN_FORMATION: number[][] = (() => {
  const offsets: number[][] = [];
  const cols = 3, spacing = 8;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < cols; c++) {
      offsets.push([10 - r * spacing, (c - 1) * spacing]);
    }
  }
  return offsets;
})();

function getFormationOffsets(unitCount: number): number[][] {
  if (unitCount <= 4) return DIAMOND_FORMATION.slice(0, unitCount);
  if (unitCount <= 12) return V_FORMATION.slice(0, unitCount);
  return COLUMN_FORMATION.slice(0, Math.min(unitCount, 15));
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

// ── Dynamic lighting helper ─────────────────────────────────────────────────
function getLightInfluence(ux: number, uy: number, planets: Planet[]): number {
  let maxLight = 0;
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if (p.owner !== 1) continue;
    const dx = ux - p.x, dy = uy - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 75) {
      const influence = 1 - (d / 75) * (d / 75);
      if (influence > maxLight) maxLight = influence;
    }
  }
  return maxLight;
}

// ── VFX Particle type ────────────────────────────────────────────────────────
interface VFXParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  type: 'spark' | 'ember' | 'ring';
  radius: number;
  maxRadius: number;
  strokeWidth: number;
}

// ── Star twinkle object ──────────────────────────────────────────────────────
interface StarObj {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

// ── Firefly object ───────────────────────────────────────────────────────────
interface FireflyObj {
  x: number;
  y: number;
  phaseX: number;
  phaseY: number;
  freqX: number;
  freqY: number;
  ampX: number;
  ampY: number;
  baseX: number;
  baseY: number;
}

// ── Cloud object ─────────────────────────────────────────────────────────────
interface CloudObj {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

// ── Rain line object ─────────────────────────────────────────────────────────
interface RainLine {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  width: number;
  height: number;
  onSelectPlanet: (id: number | null) => void;
  onSendFleet: (fromId: number, toId: number) => void;
  onSendFleetFromAll: (toId: number) => void;
  onClearAll: () => void;
  onDoubleTapSelectAll: () => void;
  onToggleMultiSelect: (id: number) => void;
  selectedPlanetId: number | null;
  selectedPlanetIds: Set<number>;
  allSelected: boolean;
  pointerPos: { x: number; y: number };
  onPointerMove: (x: number, y: number) => void;
  playerEmpire?: EmpireConfig | null;
  aiEmpire?: EmpireConfig | null;
}

export default function GameCanvas({
  width, height,
  onSelectPlanet, onSendFleet, onSendFleetFromAll, onClearAll,
  onDoubleTapSelectAll, onToggleMultiSelect,
  selectedPlanetId, selectedPlanetIds, allSelected, pointerPos, onPointerMove,
  playerEmpire, aiEmpire,
}: Props) {
  const { state } = useGame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const fpsRef = useRef({ frames: 0, fps: 60, lastTime: performance.now() });
  const perfRef = useRef({
    maxParticles: MAX_PARTICLES_HIGH,
    maxTrail: MAX_TRAIL_HIGH,
    maxFogWisps: MAX_FOG_WISPS_HIGH,
    degraded: false,
    qualityLevel: 3, // 3=high, 2=reduced, 1=minimal
    restoreTimer: 0,
    frameTimes: new Float32Array(60),
    frameTimeIdx: 0,
  });
  // Track last node scale for smooth lerping
  const nodeScaleCache = useRef<Map<number, number>>(new Map());
  // Ambient motes (8 tiny floating particles)
  const ambientMotes = useRef<{ x: number; y: number; vx: number; vy: number; alpha: number }[]>([]);
  // Selection cascade timing
  const selCascadeRef = useRef<number>(0);
  // Prevent double-dispatch in ALL mode (grant + release)
  const allDispatchedRef = useRef(false);
  // Screen shake state (F3)
  const screenShakeRef = useRef({ x: 0, y: 0, timer: 0, intensity: 0 });
  // Fleet angle lerping (F1)
  const fleetAngleMap = useRef<Map<number, number>>(new Map());
  // Frame graph toggle (F14)
  const fpsGraphVisible = useRef(false);
  const fpsTapCount = useRef({ count: 0, lastTime: 0 });
  // Evenly matched cooldown (F15)
  const evenlyMatchedRef = useRef({ lastShow: 0, opacity: 0 });

  // Refs for latest props/state
  const stateRef = useRef(state); stateRef.current = state;
  const planetsRef = useRef(state.planets); planetsRef.current = state.planets;
  const selIdRef = useRef<number | null>(null); selIdRef.current = selectedPlanetId;
  const allSelRef = useRef(false); allSelRef.current = allSelected;
  const ptrRef = useRef(pointerPos); ptrRef.current = pointerPos;
  const pEmpRef = useRef(playerEmpire); pEmpRef.current = playerEmpire;
  const aEmpRef = useRef(aiEmpire); aEmpRef.current = aiEmpire;

  // Multi-select refs
  const selIdsRef = useRef(selectedPlanetIds); selIdsRef.current = selectedPlanetIds;
  // Double tap tracking
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  // Callback refs
  const selectRef = useRef(onSelectPlanet); selectRef.current = onSelectPlanet;
  const sendRef = useRef(onSendFleet); sendRef.current = onSendFleet;
  const sendAllRef = useRef(onSendFleetFromAll); sendAllRef.current = onSendFleetFromAll;
  const clearAllRef = useRef(onClearAll); clearAllRef.current = onClearAll;
  const dblTapRef = useRef(onDoubleTapSelectAll); dblTapRef.current = onDoubleTapSelectAll;
  const toggleMultiRef = useRef(onToggleMultiSelect); toggleMultiRef.current = onToggleMultiSelect;
  const moveRef = useRef(onPointerMove); moveRef.current = onPointerMove;

  // Color helpers
  const eColor = useCallback((owner: 0|1|2): string => {
    if (owner === 1) return pEmpRef.current?.nodeColor ?? '#44EE66';
    if (owner === 2) return aEmpRef.current?.nodeColor ?? '#EE3344';
    return '#8D6E63'; // Neutral: warm brown
  }, []);
  const eGlow = useCallback((owner: 0|1|2): string => {
    if (owner === 1) return pEmpRef.current?.glowRgb ? `rgba(${pEmpRef.current.glowRgb},` : 'rgba(68,238,102,';
    if (owner === 2) return aEmpRef.current?.glowRgb ? `rgba(${aEmpRef.current.glowRgb},` : 'rgba(238,51,68,';
    return 'rgba(141,110,99,';
  }, []);
  const eAccent = useCallback((owner: 0|1|2): string => {
    if (owner === 1) return pEmpRef.current?.accentColor ?? '#228844';
    if (owner === 2) return aEmpRef.current?.accentColor ?? '#882222';
    return '#6D4C41';
  }, []);
  const eUnitColor = useCallback((owner: 0|1|2): string => {
    if (owner === 1) return pEmpRef.current?.unitColor ?? '#44EE66';
    if (owner === 2) return aEmpRef.current?.unitColor ?? '#EE3344';
    return '#8D6E63';
  }, []);
  const eShape = useCallback((owner: 0|1|2): NodeShape | null => {
    if (owner === 1) return pEmpRef.current?.nodeShape ?? null;
    if (owner === 2) return aEmpRef.current?.nodeShape ?? null;
    return null;
  }, []);
  const eUnitShape = useCallback((owner: 0|1|2): string | undefined => {
    if (owner === 1) return pEmpRef.current?.unitShape;
    if (owner === 2) return aEmpRef.current?.unitShape;
    return undefined;
  }, []);

  const getPlanetAt = useCallback((x: number, y: number) =>
    planetsRef.current.find(p => Math.hypot(p.x - x, p.y - y) < p.radius + HIT_EXTRA), []);

  // ── Touch handling via PanResponder ────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        moveRef.current(x, y);

        // ── F14: Triple-tap FPS area to toggle frame graph ──
        if (x < 70 && y < 24) {
          const ft = fpsTapCount.current;
          const tnow = performance.now();
          if (tnow - ft.lastTime < 500) { ft.count++; } else { ft.count = 1; }
          ft.lastTime = tnow;
          if (ft.count >= 3) { fpsGraphVisible.current = !fpsGraphVisible.current; ft.count = 0; }
        }

        // ── DOUBLE TAP DETECTION ──
        const now = performance.now();
        const lt = lastTapRef.current;
        const dtap = now - lt.time;
        const ddist = Math.sqrt((x - lt.x) ** 2 + (y - lt.y) ** 2);
        if (dtap < 300 && ddist < 40) {
          // Double tap — select all owned nodes
          dblTapRef.current();
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          // Prevent release handler from immediately dispatching
          allDispatchedRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([15, 10, 15]);
          return;
        }
        lastTapRef.current = { time: now, x, y };

        // ALL mode: defer all dispatch to release (supports drag-to-target)
        if (allSelRef.current) {
          allDispatchedRef.current = false;
          return;
        }
        // Multi-select dispatch
        if (selIdsRef.current.size > 0) {
          const target = getPlanetAt(x, y);
          if (target) {
            if (target.owner === 1) {
              toggleMultiRef.current(target.id);
              return;
            }
            sendAllRef.current(target.id);
            clearAllRef.current();
            allDispatchedRef.current = true;
          }
          return;
        }
        allDispatchedRef.current = false;
        const selId = selIdRef.current;
        const planet = getPlanetAt(x, y);
        if (selId === null) {
          // Nothing selected — select own planet
          if (planet?.owner === 1) selectRef.current(planet.id);
        } else {
          // Already have a selection — tap on another owned node adds to multi-select
          if (planet && planet.owner === 1 && planet.id !== selId) {
            toggleMultiRef.current(planet.id);
          } else if (planet && planet.id !== selId) {
            // Tap on enemy/neutral: send fleet
            sendRef.current(selId, planet.id);
            selectRef.current(planet.owner === 1 ? planet.id : null);
          }
          // Tapping same planet or empty space is handled in release
        }
      },
      onPanResponderMove: e => moveRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: e => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        // ALL mode: dispatch on release (supports both tap and drag-to-target)
        if (allSelRef.current) {
          if (!allDispatchedRef.current) {
            const target = getPlanetAt(x, y);
            if (target && target.owner !== 1) {
              // Release on enemy/neutral: dispatch from all nodes
              sendAllRef.current(target.id);
              clearAllRef.current();
            } else if (!target) {
              // Release on empty space: deselect all
              clearAllRef.current();
            }
            // Release on own node: keep selection (allow retry drag)
          }
          allDispatchedRef.current = false;
          return;
        }
        const selId = selIdRef.current;
        const target = getPlanetAt(x, y);
        if (selId !== null) {
          if (target && target.id !== selId) {
            // Drag-release on different planet: send fleet
            sendRef.current(selId, target.id);
            selectRef.current(target.owner === 1 ? target.id : null);
          } else if (target && target.id === selId) {
            // Released on same planet: keep it selected (tap-tap flow)
          } else {
            // Released on empty space: deselect
            selectRef.current(null);
          }
        }
      },
      onPanResponderTerminate: () => { selectRef.current(null); },
    })
  ).current;

  // ── Draw static background (offscreen canvas, once) ────────────────────────
  const drawBg = useCallback((c: CanvasRenderingContext2D, w: number, h: number) => {
    // Layer 1: Deep dark gradient with green-black tint
    const baseGrad = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    baseGrad.addColorStop(0, '#0f160f');
    baseGrad.addColorStop(1, '#080c08');
    c.fillStyle = baseGrad; c.fillRect(0, 0, w, h);

    // Layer 2: Terrain texture — 300 tiny + 20 medium + 8 star/fire points
    c.fillStyle = 'rgba(255,240,200,0.12)';
    for (let i = 0; i < 300; i++) {
      const s = 0.5 + Math.random() * 0.5;
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, s, 0, TWO_PI); c.fill();
    }
    c.fillStyle = 'rgba(255,240,200,0.06)';
    for (let i = 0; i < 20; i++) {
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 0.5, 0, TWO_PI); c.fill();
    }
    c.fillStyle = 'rgba(255,220,140,0.15)';
    for (let i = 0; i < 8; i++) {
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random(), 0, TWO_PI); c.fill();
    }

    // Layer 3: Hex grid (barely visible tactical overlay)
    const hexSize = 45;
    c.strokeStyle = 'rgba(255,255,255,0.025)'; c.lineWidth = 0.5;
    const hexH = hexSize * Math.sqrt(3);
    for (let row = -1; row < h / hexH + 1; row++) {
      for (let col = -1; col < w / (hexSize * 1.5) + 1; col++) {
        const cx = col * hexSize * 1.5;
        const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (60 * i - 30) * DEG_TO_RAD;
          const hx = cx + hexSize * 0.5 * Math.cos(angle);
          const hy = cy + hexSize * 0.5 * Math.sin(angle);
          if (i === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy);
        }
        c.closePath(); c.stroke();
      }
    }

    // Layer 4: Vignette (elliptical, stronger)
    const vg = c.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }, []);

  // ── Main render loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const gameC = canvasRef.current;
    const bgC = bgCanvasRef.current;
    if (!gameC || !bgC || !width || !height) return;

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    for (const cv of [gameC, bgC]) {
      cv.width = width * dpr; cv.height = height * dpr;
      cv.style.width = width + 'px'; cv.style.height = height + 'px';
      cv.style.willChange = 'transform';
    }
    const bgCtx = bgC.getContext('2d')! as CanvasRenderingContext2D;
    bgCtx.scale(dpr, dpr);
    drawBg(bgCtx, width, height);

    const ctx = gameC.getContext('2d')! as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Init ambient motes
    if (ambientMotes.current.length === 0) {
      for (let i = 0; i < 8; i++) {
        ambientMotes.current.push({
          x: Math.random() * width, y: Math.random() * height,
          vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
          alpha: 0.2 + Math.random() * 0.2,
        });
      }
    }

    // Capture transition tracking
    const prevOwners = new Map<number, 0|1|2>();
    const captureTrans = new Map<number, { prevOwner: 0|1|2; t: number }>();

    // ── PRE-ALLOCATE VFX PARTICLE POOL (150 particles) ────────────────────
    const VFX_POOL_SIZE = 150;
    const VFX_POOL_LOW = 60;
    const vfxPool: VFXParticle[] = [];
    for (let i = 0; i < VFX_POOL_SIZE; i++) {
      vfxPool[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        size: 0, alpha: 0, color: '', life: 0, maxLife: 0, gravity: 0,
        type: 'spark', radius: 0, maxRadius: 0, strokeWidth: 0,
      };
    }
    let vfxActiveCount = 0;

    function spawnVFX(
      x: number, y: number, vx: number, vy: number,
      size: number, color: string, maxLife: number, gravity: number,
      type: 'spark' | 'ember' | 'ring',
      maxRadius?: number, strokeWidth?: number
    ): void {
      const budget = perfRef.current.degraded ? VFX_POOL_LOW : VFX_POOL_SIZE;
      if (vfxActiveCount >= budget) return;
      for (let i = 0; i < VFX_POOL_SIZE; i++) {
        const p = vfxPool[i];
        if (!p.active) {
          p.active = true;
          p.x = x; p.y = y; p.vx = vx; p.vy = vy;
          p.size = size; p.alpha = 1; p.color = color;
          p.life = 0; p.maxLife = maxLife; p.gravity = gravity;
          p.type = type;
          p.radius = 0;
          p.maxRadius = maxRadius ?? 0;
          p.strokeWidth = strokeWidth ?? 1;
          vfxActiveCount++;
          return;
        }
      }
    }

    // ── PRE-ALLOCATE STAR TWINKLE SYSTEM (30 stars) ──────────────────────
    const stars: StarObj[] = [];
    for (let i = 0; i < 30; i++) {
      stars[i] = {
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * TWO_PI,
        speed: 1000 + Math.random() * 2000,
      };
    }

    // ── PRE-ALLOCATE FIREFLY SYSTEM (6 fireflies) ────────────────────────
    const fireflies: FireflyObj[] = [];
    for (let i = 0; i < 6; i++) {
      fireflies[i] = {
        x: 0, y: 0,
        phaseX: Math.random() * TWO_PI,
        phaseY: Math.random() * TWO_PI,
        freqX: 0.0005 + Math.random() * 0.001,
        freqY: 0.0007 + Math.random() * 0.0008,
        ampX: 40 + Math.random() * 80,
        ampY: 30 + Math.random() * 60,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
      };
    }

    // ── PRE-ALLOCATE WEATHER SYSTEM ──────────────────────────────────────
    const clouds: CloudObj[] = [];
    for (let i = 0; i < 3; i++) {
      clouds[i] = {
        x: Math.random() * width,
        y: 50 + Math.random() * (height * 0.4),
        w: 150 + Math.random() * 100,
        h: 50 + Math.random() * 40,
        speed: 0.15 + Math.random() * 0.2,
      };
    }
    const rainLines: RainLine[] = [];
    for (let i = 0; i < 20; i++) {
      rainLines[i] = { x: 0, y: 0, vx: 0, vy: 0, active: false };
    }
    let lastLightningTime = 0;
    let nextLightningInterval = 8000 + Math.random() * 7000;
    let lightningFlashTimer = 0;
    let rainBurstTimer = 0;

    // ── PRE-ALLOCATE departure tracking ──────────────────────────────────
    const departureTimestamps = new Map<number, number>(); // fleetFromId -> timestamp
    let lastFleetCount = 0;
    let lastConquestFlashCount = 0;
    let lastImpactFlashCount = 0;

    // ── PRE-ALLOCATE per-frame lookup structures ──────────────────────────
    const planetMap = new Map<number, Planet>();
    const underAttackByEnemy = new Set<number>();
    const underAttackByPlayer = new Set<number>();
    const underAttackAny = new Set<number>();
    const incomingUnits = new Map<number, number>();
    const intelMap = new Map<number, boolean>();

    let lastFrameTime = performance.now();

    function frame(now: number) {
      // Delta time (capped to prevent spiral of death)
      const dtMs = Math.min(now - lastFrameTime, 33);
      const dt = dtMs / 1000; // seconds
      lastFrameTime = now;

      // FPS tracking with rolling frame time buffer
      const fp = fpsRef.current;
      const perf = perfRef.current;
      fp.frames++;

      // Record frame time
      perf.frameTimes[perf.frameTimeIdx] = dtMs;
      perf.frameTimeIdx = (perf.frameTimeIdx + 1) % 60;

      if (now - fp.lastTime >= 500) {
        fp.fps = Math.round(fp.frames / ((now - fp.lastTime) / 1000));
        fp.frames = 0; fp.lastTime = now;

        // Calculate rolling average frame time
        let avgFrameTime = 0;
        for (let i = 0; i < 60; i++) avgFrameTime += perf.frameTimes[i];
        avgFrameTime /= 60;

        // 3-level adaptive quality
        if (avgFrameTime > 28 && perf.qualityLevel > 1) {
          // Below 36fps → minimal
          perf.qualityLevel = 1;
          perf.degraded = true;
          perf.maxParticles = MAX_PARTICLES_LOW;
          perf.maxTrail = MAX_TRAIL_LOW;
          perf.maxFogWisps = MAX_FOG_WISPS_LOW;
          perf.restoreTimer = 0;
        } else if (avgFrameTime > 22 && perf.qualityLevel > 2) {
          // Below 45fps → reduced
          perf.qualityLevel = 2;
          perf.degraded = true;
          perf.maxParticles = MAX_PARTICLES_MED;
          perf.maxTrail = MAX_TRAIL_MED;
          perf.maxFogWisps = MAX_FOG_WISPS_MED;
          perf.restoreTimer = 0;
        } else if (avgFrameTime < 14 && perf.qualityLevel < 3) {
          // Above 71fps for 5 seconds → restore one level
          perf.restoreTimer += 500;
          if (perf.restoreTimer >= 5000) {
            perf.qualityLevel = Math.min(3, perf.qualityLevel + 1);
            perf.restoreTimer = 0;
            if (perf.qualityLevel === 3) {
              perf.degraded = false;
              perf.maxParticles = MAX_PARTICLES_HIGH;
              perf.maxTrail = MAX_TRAIL_HIGH;
              perf.maxFogWisps = MAX_FOG_WISPS_HIGH;
            } else {
              perf.maxParticles = MAX_PARTICLES_MED;
              perf.maxTrail = MAX_TRAIL_MED;
              perf.maxFogWisps = MAX_FOG_WISPS_MED;
            }
          }
        } else {
          perf.restoreTimer = 0;
        }
      }

      const s = stateRef.current;
      const { planets, fleets, particles, conquestFlashes, impactFlashes, floatingTexts, nodeHits } = s;
      const selId = selIdRef.current;
      const allSel = allSelRef.current;
      const ptr = ptrRef.current;
      const degraded = perf.degraded;

      // ── PRE-COMPUTE LOOKUPS (clear + reuse pre-allocated structures) ──
      planetMap.clear();
      for (let i = 0; i < planets.length; i++) planetMap.set(planets[i].id, planets[i]);
      underAttackByEnemy.clear();
      underAttackByPlayer.clear();
      underAttackAny.clear();
      incomingUnits.clear();
      for (let i = 0; i < fleets.length; i++) {
        const f = fleets[i];
        const tgt = planetMap.get(f.toId);
        if (!tgt) continue;
        if (f.owner === 2 && tgt.owner === 1) underAttackByEnemy.add(f.toId);
        if (f.owner === 1 && tgt.owner === 2) underAttackByPlayer.add(f.toId);
        if (f.owner !== tgt.owner) underAttackAny.add(f.toId);
        incomingUnits.set(f.toId, (incomingUnits.get(f.toId) || 0) + f.units);
      }

      // ── F3: Screen shake trigger — detect new conquest/impact flashes ──
      if (conquestFlashes.length > lastConquestFlashCount) {
        // New conquests → big shake
        screenShakeRef.current = { x: 0, y: 0, timer: 180, intensity: 4 };
      } else if (impactFlashes.length > lastImpactFlashCount) {
        // New impacts → small shake (only for significant ones)
        const newCount = impactFlashes.length - lastImpactFlashCount;
        if (newCount >= 2) {
          screenShakeRef.current = { x: 0, y: 0, timer: 180, intensity: 2.5 };
        }
      }
      lastConquestFlashCount = conquestFlashes.length;
      lastImpactFlashCount = impactFlashes.length;

      // ── Elapsed time for weather system ──
      const gameStartTime = s.gameStartTime || now;
      const elapsedMs = now - gameStartTime;
      const stormMode = elapsedMs > 240000; // 4 minutes

      // ── Tension state ──
      let playerNodeCount = 0;
      let aiNodeCount = 0;
      let totalOwnedNodes = 0;
      for (let i = 0; i < planets.length; i++) {
        if (planets[i].owner === 1) { playerNodeCount++; totalOwnedNodes++; }
        if (planets[i].owner === 2) { aiNodeCount++; totalOwnedNodes++; }
      }
      const playerTension = totalOwnedNodes > 0 && playerNodeCount / planets.length < 0.2;
      const aiTension = totalOwnedNodes > 0 && aiNodeCount / planets.length < 0.2;

      ctx.clearRect(0, 0, width, height);

      // ── SCREEN MICRO-SHAKE (F3) ──────────────────────────────────────────
      const shake = screenShakeRef.current;
      if (shake.timer > 0) {
        shake.timer -= dtMs;
        const progress = Math.max(0, shake.timer / 180);
        const freq = 3;
        shake.x = Math.sin((1 - progress) * Math.PI * freq * 2) * shake.intensity * progress;
        shake.y = Math.cos((1 - progress) * Math.PI * freq * 1.5) * shake.intensity * 0.6 * progress;
        if (shake.timer <= 0) { shake.x = 0; shake.y = 0; shake.timer = 0; }
      }
      ctx.save();
      ctx.translate(shake.x, shake.y);

      // ── Background layer (cached) ──
      ctx.drawImage(bgC!, 0, 0, width, height);

      // ── STAR TWINKLE SYSTEM ──
      for (let i = 0; i < 30; i++) {
        const star = stars[i];
        const sinVal = Math.sin(now / star.speed + star.phase);
        const absSin = sinVal < 0 ? -sinVal : sinVal;
        // Only 20% twinkle brightly at any time (based on phase alignment)
        const twinkleFactor = Math.sin(now / 4000 + star.phase * 3);
        const isTwinkling = twinkleFactor > 0.6;
        const starAlpha = isTwinkling ? 0.1 + 0.5 * absSin : 0.1 + 0.05 * absSin;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,255,240,' + starAlpha.toFixed(3) + ')';
        ctx.fill();
      }

      // ── FIREFLY SYSTEM ──
      if (!degraded) {
        for (let i = 0; i < 6; i++) {
          const ff = fireflies[i];
          ff.x = ff.baseX + Math.sin(now * ff.freqX + ff.phaseX) * ff.ampX;
          ff.y = ff.baseY + Math.cos(now * ff.freqY + ff.phaseY) * ff.ampY;
          // Wrap around screen
          if (ff.x < -20) ff.x += width + 40;
          if (ff.x > width + 20) ff.x -= width + 40;
          if (ff.y < -20) ff.y += height + 40;
          if (ff.y > height + 20) ff.y -= height + 40;
          // Pulse opacity 0.3-0.6
          const ffAlpha = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.003 + i * 1.7));
          ctx.beginPath();
          ctx.arc(ff.x, ff.y, 2, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,250,240,' + ffAlpha.toFixed(3) + ')';
          ctx.fill();
          // Soft glow around firefly
          ctx.beginPath();
          ctx.arc(ff.x, ff.y, 6, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,250,240,' + (ffAlpha * 0.15).toFixed(3) + ')';
          ctx.fill();
        }
      }

      // ── Dynamic fog wisps ──
      const maxWisps = perf.maxFogWisps;
      for (let i = 0; i < maxWisps; i++) {
        const phase = now / (6000 + i * 2000);
        const wx = (width * (0.2 + i * 0.3) + 60 * Math.sin(phase)) % (width + 300) - 150;
        const wy = height * (0.3 + i * 0.15) + 30 * Math.cos(phase * 0.7);
        ctx.fillStyle = 'rgba(200,220,200,0.025)';
        ctx.beginPath(); ctx.ellipse(wx, wy, 150, 60, 0, 0, TWO_PI); ctx.fill();
      }

      // ── WEATHER SYSTEM ──
      if (stormMode) {
        // Dark clouds
        for (let i = 0; i < 3; i++) {
          const cl = clouds[i];
          cl.x += cl.speed * dt * 60;
          if (cl.x > width + cl.w) cl.x = -cl.w;
          ctx.beginPath();
          ctx.ellipse(cl.x, cl.y, cl.w * 0.5, cl.h * 0.5, 0, 0, TWO_PI);
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fill();
        }

        // Lightning
        if (now - lastLightningTime > nextLightningInterval) {
          lastLightningTime = now;
          nextLightningInterval = 8000 + (((now * 13) % 7000) | 0);
          lightningFlashTimer = now;
          rainBurstTimer = now;
        }
        // Lightning flash: 80ms white flash
        if (lightningFlashTimer > 0 && now - lightningFlashTimer < 80) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(0, 0, width, height);
        }
        // Rain burst: 1 second after lightning
        if (rainBurstTimer > 0 && now - rainBurstTimer < 1000 && !degraded) {
          const rainProgress = (now - rainBurstTimer) / 1000;
          for (let i = 0; i < 20; i++) {
            const rl = rainLines[i];
            if (!rl.active && rainProgress < 0.1) {
              rl.active = true;
              rl.x = ((i * 37 + now * 0.1) % width);
              rl.y = ((i * 53) % height);
              rl.vx = 2;
              rl.vy = 12;
            }
            if (rl.active) {
              rl.x += rl.vx;
              rl.y += rl.vy;
              if (rl.y > height) { rl.active = false; continue; }
              ctx.beginPath();
              ctx.moveTo(rl.x, rl.y);
              ctx.lineTo(rl.x + 2, rl.y + 8);
              ctx.strokeStyle = 'rgba(180,200,255,0.08)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        } else {
          // Reset rain lines
          for (let i = 0; i < 20; i++) rainLines[i].active = false;
        }
      }

      // ── F4: ATMOSPHERE COLOR SHIFT (winning=amber, losing=blue) ──
      if (planets.length > 0) {
        const tRatio = playerNodeCount / planets.length;
        if (tRatio > 0.70 && playerNodeCount > 0) {
          const intensity = (tRatio - 0.70) / 0.30;
          ctx.fillStyle = `rgba(255,180,50,${(intensity * 0.05).toFixed(3)})`;
          ctx.fillRect(0, 0, width, height);
        } else if (tRatio < 0.30 && aiNodeCount > 0) {
          const intensity = (0.30 - tRatio) / 0.30;
          ctx.fillStyle = `rgba(50,60,100,${(intensity * 0.06).toFixed(3)})`;
          ctx.fillRect(0, 0, width, height);
        }
      }

      // ── Empire atmosphere glow ──
      if (planets.length > 0) {
        const capital = planets[0]; // Player capital is always id 0
        if (capital.owner === 1) {
          const empColor = pEmpRef.current?.glowRgb ?? '68,238,102';
          const atmOp = 0.03 + 0.02 * Math.sin(now / 3000);
          const atmGrad = ctx.createRadialGradient(capital.x, capital.y, 0, capital.x, capital.y, 80);
          atmGrad.addColorStop(0, `rgba(${empColor},${atmOp.toFixed(3)})`);
          atmGrad.addColorStop(1, `rgba(${empColor},0)`);
          ctx.fillStyle = atmGrad; ctx.beginPath(); ctx.arc(capital.x, capital.y, 80, 0, TWO_PI); ctx.fill();
        }
      }

      // ── Fog & mirage state ──
      const fogOn = s.fogEnabled;
      const mirageActive = s.abilityActive && s.playerEmpireId === 'ptolemaic';

      // ── Territory zone shading (subtle radial fills around owned nodes) ──
      if (!degraded) {
        for (let i = 0; i < planets.length; i++) {
          const p = planets[i];
          if (p.owner === 0) continue;
          if (fogOn && p.owner !== 1 && !isVisible(p.x, p.y, planets)) continue;
          const zoneR = p.radius + 50;
          const zoneGrad = ctx.createRadialGradient(p.x, p.y, p.radius, p.x, p.y, zoneR);
          const zGlow = eGlow(p.owner);
          zoneGrad.addColorStop(0, zGlow + '0.04)');
          zoneGrad.addColorStop(1, zGlow + '0)');
          ctx.fillStyle = zoneGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, zoneR, 0, TWO_PI);
          ctx.fill();
        }
      }

      // ── F5: NODE NETWORK PULSE (every ~4s, all owned nodes pulse simultaneously) ──
      if (!degraded) {
        const pulsePhase = (now % 4000) / 4000;
        if (pulsePhase < 0.15) {
          const pulseT = pulsePhase / 0.15;
          const pulseRadius = pulseT * 28;
          const pulseOp = (1 - pulseT) * 0.35;
          for (let i = 0; i < planets.length; i++) {
            const p = planets[i];
            if (p.owner !== 1) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + pulseRadius, 0, TWO_PI);
            ctx.strokeStyle = eColor(1);
            ctx.lineWidth = 2;
            ctx.globalAlpha = pulseOp;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      // ── Territory connection web (glowing lines between nearby same-owner nodes) ──
      const TERRITORY_LINK_DIST = 180;
      for (let i = 0; i < planets.length; i++) {
        const a = planets[i];
        if (a.owner === 0) continue;
        if (fogOn && a.owner !== 1 && !isVisible(a.x, a.y, planets)) continue;
        for (let j = i + 1; j < planets.length; j++) {
          const b = planets[j];
          if (b.owner !== a.owner) continue;
          if (fogOn && b.owner !== 1 && !isVisible(b.x, b.y, planets)) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > TERRITORY_LINK_DIST) continue;
          const linkOp = 0.035 * (1 - d / TERRITORY_LINK_DIST);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = eGlow(a.owner) + `${linkOp.toFixed(3)})`;
          ctx.lineWidth = 1.5; ctx.stroke();
        }
      }

      // ── Ambient motes (very subtle, only 4) ──
      const motes = ambientMotes.current;
      for (let i = 0; i < Math.min(4, motes.length); i++) {
        const m = motes[i];
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -10) m.x = width + 10;
        if (m.x > width + 10) m.x = -10;
        if (m.y < -10) m.y = height + 10;
        if (m.y > height + 10) m.y = -10;
        ctx.beginPath(); ctx.arc(m.x, m.y, 0.8, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      }

      // ── Visible planets ──
      // Track captures
      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const prev = prevOwners.get(p.id);
        if (prev !== undefined && prev !== p.owner) captureTrans.set(p.id, { prevOwner: prev, t: 0 });
        prevOwners.set(p.id, p.owner);
      }
      captureTrans.forEach((tr, id) => {
        tr.t = Math.min(1, tr.t + dt * 3.33); // 300ms spin (F9)
        if (tr.t >= 1) captureTrans.delete(id);
      });

      // ── ENHANCED Conquest flashes ──
      for (let i = 0; i < conquestFlashes.length; i++) {
        const cf = conquestFlashes[i];
        if (cf.t < 0) continue;
        const t = cf.t; // 0 to 1

        // Phase 1 (0-0.15): White flash circle
        if (t < 0.15) {
          const p1 = t / 0.15;
          const flashR = 40 * p1;
          const flashOp = 0.9 * (1 - p1);
          ctx.beginPath();
          ctx.arc(cf.x, cf.y, flashR, 0, TWO_PI);
          ctx.fillStyle = 'rgba(255,255,255,' + flashOp.toFixed(3) + ')';
          ctx.fill();
        }

        // Phase 2 (0.15-0.6): Spawn VFX particles (only once at start of phase)
        if (t >= 0.14 && t < 0.18) {
          const cColor = eColor(cf.owner);
          // 8 large sparks
          for (let j = 0; j < 8; j++) {
            const ang = (j / 8) * TWO_PI;
            const speed = 80 + (j * 17 % 40);
            spawnVFX(cf.x, cf.y,
              Math.cos(ang) * speed, Math.sin(ang) * speed,
              3.5, cColor, 500, 0, 'spark');
          }
          // 12 small sparks
          for (let j = 0; j < 12; j++) {
            const ang = (j / 12) * TWO_PI + 0.3;
            const speed = 40 + (j * 23 % 30);
            spawnVFX(cf.x, cf.y,
              Math.cos(ang) * speed, Math.sin(ang) * speed,
              1.5, cColor, 400, 0, 'spark');
          }
        }

        // Phase 3 (0.3-0.9): 3 expanding rings
        if (t >= 0.29 && t < 0.33) {
          const cColor = eColor(cf.owner);
          for (let j = 0; j < 3; j++) {
            spawnVFX(cf.x, cf.y, 0, 0, 0, cColor, 500 + j * 100, 0, 'ring', 40 + j * 15, 2.5 - j * 0.5);
          }
        }

        // Phase 4 (0.6-1.0): 8 ember particles drifting upward
        if (t >= 0.59 && t < 0.63) {
          const cColor = eColor(cf.owner);
          for (let j = 0; j < 8; j++) {
            const ang = (j / 8) * TWO_PI;
            spawnVFX(cf.x + Math.cos(ang) * 5, cf.y + Math.sin(ang) * 5,
              Math.cos(ang) * 15, -30 - (j * 7 % 20),
              2, cColor, 800, 5, 'ember');
          }
        }

        // Original ring effects (kept for continuous visual)
        const eased = 1 - (1 - t) * (1 - t);
        const ringIdx = i % 3;
        const baseR = [12, 18, 25][ringIdx] || 12;
        const maxR = [40, 55, 70][ringIdx] || 40;
        const rr = baseR + eased * (maxR - baseR);
        const op = Math.max(0, (1 - t) * 0.88);
        if (op > 0.01) {
          ctx.beginPath(); ctx.arc(cf.x, cf.y, rr, 0, TWO_PI);
          ctx.strokeStyle = eColor(cf.owner); ctx.lineWidth = 3.5 - t * 2.5; ctx.globalAlpha = op; ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // Fill burst
        ctx.beginPath(); ctx.arc(cf.x, cf.y, 10 + eased * 40, 0, TWO_PI);
        ctx.fillStyle = eColor(cf.owner); ctx.globalAlpha = Math.max(0, 0.25 - t * 0.25); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── ENHANCED Impact flashes + F6 death sparks ──
      for (let i = 0; i < impactFlashes.length; i++) {
        const inf = impactFlashes[i];
        const t = inf.t;
        const eased = 1 - (1 - t) * (1 - t) * (1 - t);

        // F6: Spawn 3 death micro-sparks on new impacts
        if (t < 0.03 && !degraded) {
          for (let ds = 0; ds < 3; ds++) {
            const dsAngle = Math.random() * TWO_PI;
            const dsSpeed = 40 + Math.random() * 50;
            spawnVFX(
              inf.x + (Math.random() - 0.5) * 10, inf.y + (Math.random() - 0.5) * 10,
              Math.cos(dsAngle) * dsSpeed, Math.sin(dsAngle) * dsSpeed,
              1.5 + Math.random(), 'rgba(255,200,100,1)', 250 + Math.random() * 100, 80, 'ember'
            );
          }
        }

        // Ring shockwave: 0→35px, 200ms (t < ~0.25)
        if (t < 0.25) {
          const ringP = t / 0.25;
          const ringR = ringP * 35;
          const ringOp = 1 - ringP;
          ctx.beginPath();
          ctx.arc(inf.x, inf.y, ringR, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(255,240,160,' + ringOp.toFixed(3) + ')';
          ctx.lineWidth = 2.5 - ringP * 2;
          ctx.stroke();
        }

        // Spawn sparks at the start
        if (t >= 0.01 && t < 0.05) {
          // 6 large sparks
          for (let j = 0; j < 6; j++) {
            const ang = (j / 6) * TWO_PI + t;
            const tangAng = ang + Math.PI * 0.3; // tangential velocity
            spawnVFX(inf.x, inf.y,
              Math.cos(tangAng) * 120, Math.sin(tangAng) * 120,
              4, 'rgba(255,240,160,1)', 500, 0, 'spark');
          }
          // 6 small embers with arc
          for (let j = 0; j < 6; j++) {
            const ang = (j / 6) * TWO_PI + 0.5;
            const tangAng = ang - Math.PI * 0.25;
            spawnVFX(inf.x, inf.y,
              Math.cos(tangAng) * 60, Math.sin(tangAng) * 60,
              2, 'rgba(255,200,100,1)', 300, 20, 'ember');
          }
        }

        // Original flash ring
        const r = 6 + eased * 24;
        const op = Math.max(0, 1 - t);
        ctx.beginPath(); ctx.arc(inf.x, inf.y, r, 0, TWO_PI);
        ctx.strokeStyle = 'rgba(255,240,160,0.95)'; ctx.lineWidth = 2.5 - t * 2; ctx.globalAlpha = op; ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ── Fleet arcs (subtle dashed paths) ──
      for (let i = 0; i < fleets.length; i++) {
        const f = fleets[i];
        const from = planetMap.get(f.fromId);
        const to = planetMap.get(f.toId);
        if (!from || !to) continue;
        const { cx: cpx, cy: cpy } = bezCtrl(from.x, from.y, to.x, to.y, f.arc);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(cpx, cpy, to.x, to.y);
        ctx.strokeStyle = eGlow(f.owner as 0|1|2) + '0.06)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 10]); ctx.stroke(); ctx.setLineDash([]);
      }

      // ── Targeting lines (animated dashes scroll toward target) ──
      const showTarget = ptr.x > 4 || ptr.y > 4;
      const selPlanet = selId !== null ? planetMap.get(selId) : undefined;
      const dashOffset = -(now / 40) % 17; // Animated dash scroll

      if (selPlanet && showTarget) {
        const empColor = eColor(1);
        // Glow line
        ctx.beginPath(); ctx.moveTo(selPlanet.x, selPlanet.y); ctx.lineTo(ptr.x, ptr.y);
        ctx.strokeStyle = eGlow(1) + '0.14)'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke();
        // Dashed line with animated offset
        ctx.beginPath(); ctx.moveTo(selPlanet.x, selPlanet.y); ctx.lineTo(ptr.x, ptr.y);
        ctx.strokeStyle = empColor; ctx.globalAlpha = 0.7; ctx.lineWidth = 2.2;
        ctx.setLineDash([10, 7]); ctx.lineDashOffset = dashOffset; ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
        ctx.lineCap = 'butt';
        // Arrowhead (pulses size slightly)
        const aa = Math.atan2(ptr.y - selPlanet.y, ptr.x - selPlanet.x);
        const arrowScale = 1 + 0.1 * Math.sin(now / 200);
        const arrowLen = 13 * arrowScale;
        ctx.beginPath();
        ctx.moveTo(ptr.x - Math.cos(aa) * 4, ptr.y - Math.sin(aa) * 4);
        ctx.lineTo(ptr.x - Math.cos(aa - 0.45) * arrowLen, ptr.y - Math.sin(aa - 0.45) * arrowLen);
        ctx.lineTo(ptr.x - Math.cos(aa + 0.45) * arrowLen, ptr.y - Math.sin(aa + 0.45) * arrowLen);
        ctx.closePath(); ctx.fillStyle = empColor; ctx.fill();
        // Preview badge with battle outcome estimate
        const pu = Math.max(1, Math.floor(selPlanet.units * (s.fleetPercent / 100)));
        const targetP = getPlanetAt(ptr.x, ptr.y);
        const badgeX = ptr.x + 22, badgeY = ptr.y - 20;

        ctx.beginPath(); ctx.arc(badgeX, badgeY, 14, 0, TWO_PI);
        ctx.fillStyle = 'rgba(20,12,4,0.92)'; ctx.fill();
        ctx.strokeStyle = empColor; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = empColor; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(pu), badgeX, badgeY + 4);

        // Battle outcome preview when hovering over a target
        if (targetP && targetP.owner !== 1) {
          const defUnits = Math.floor(targetP.units);
          const outcome = pu - defUnits;
          const outcomeColor = outcome > 0 ? '#66FF88' : '#FF6644';
          const outcomeText = outcome > 0 ? `WIN +${outcome}` : outcome === 0 ? 'DRAW' : `LOSE`;
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillText(outcomeText, badgeX + 1, badgeY + 16);
          ctx.fillStyle = outcomeColor;
          ctx.fillText(outcomeText, badgeX, badgeY + 15);
        }
      }
      // Multi-select targeting lines
      const multiIds = selIdsRef.current;
      if (multiIds.size > 0 && showTarget && !allSel) {
        for (let i = 0; i < planets.length; i++) {
          const p = planets[i];
          if (!multiIds.has(p.id)) continue;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ptr.x, ptr.y);
          ctx.strokeStyle = eColor(1); ctx.lineWidth = 1.8; ctx.globalAlpha = 0.5;
          ctx.setLineDash([10, 7]); ctx.lineDashOffset = dashOffset; ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
        }
      }
      if (allSel && showTarget) {
        // Multi-select: stagger ring appearance by 50ms per node (cascade)
        let nodeIdx = 0;
        for (let i = 0; i < planets.length; i++) {
          const p = planets[i];
          if (p.owner !== 1) continue;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ptr.x, ptr.y);
          ctx.strokeStyle = eColor(1); ctx.lineWidth = 1.8; ctx.globalAlpha = 0.5;
          ctx.setLineDash([10, 7]); ctx.lineDashOffset = dashOffset; ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
          nodeIdx++;
        }
      }

      // ── Pre-compute intel for war fog (reuse pre-allocated map) ──
      intelMap.clear();
      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        if (p.owner === 1 || p.owner === 0) {
          intelMap.set(p.id, true); // Always have intel on own + neutral nodes
        } else {
          intelMap.set(p.id, hasIntel(p.x, p.y, planets));
        }
      }

      // ── Nodes ──
      for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        if (fogOn && p.owner !== 1 && !isVisible(p.x, p.y, planets)) continue;

        const playerHasIntel = intelMap.get(p.id) ?? false;

        // Enemy capital is HIDDEN until player has intel on it
        if (p.owner === 2 && p.nodeType === 'capital' && !playerHasIntel) continue;

        const color = eColor(p.owner);
        const glow = eGlow(p.owner);
        const accent = eAccent(p.owner);
        const baseR = p.radius;
        const shape = eShape(p.owner);

        // Node size scaling based on unit count (smooth lerp)
        const targetScale = nodeScale(p.units);
        const prevScale = nodeScaleCache.current.get(p.id) ?? targetScale;
        const currentScale = prevScale + (targetScale - prevScale) * 0.05; // smooth lerp
        nodeScaleCache.current.set(p.id, currentScale);
        const r = baseR * currentScale;

        const isSel = p.id === selId || (allSel && p.owner === 1) || selIdsRef.current.has(p.id);

        // Impact shake (enhanced: close battle = stronger shake)
        let px = p.x, py = p.y;
        for (let j = 0; j < impactFlashes.length; j++) {
          const inf = impactFlashes[j];
          if (Math.hypot(inf.x - p.x, inf.y - p.y) < r + 18) {
            const shakeIntensity = p.units <= 3 ? 5.5 : 2.8;
            px += Math.cos(inf.t * Math.PI * 10) * shakeIntensity * (1 - inf.t);
            py += Math.sin(inf.t * Math.PI * 10) * (shakeIntensity * 0.6) * (1 - inf.t);
            break;
          }
        }

        // Node hit red flash on number
        let nodeHitFlash = 0;
        for (let j = 0; j < nodeHits.length; j++) {
          if (nodeHits[j].nodeId === p.id) {
            nodeHitFlash = Math.max(nodeHitFlash, 1 - nodeHits[j].t);
            break;
          }
        }

        // War fog: is this enemy node hidden (no intel)?
        const enemyHidden = p.owner === 2 && !playerHasIntel;

        // Breathing scale (offset by node index * 0.3s for desync)
        const breathPhase = now / 1600 + p.id * 0.3;
        const breathScale = 0.97 + 0.03 * (1 + Math.sin(breathPhase));

        // ── ENHANCED NODE GLOW SYSTEM ──
        if (p.owner !== 0 && !enemyHidden) {
          const glowBreath = 0.5 + 0.5 * Math.sin(now / 1400 + p.id * 0.72);
          // Radial fill glow behind node
          const fillGlow = ctx.createRadialGradient(px, py, r * 0.3, px, py, r + 16);
          fillGlow.addColorStop(0, glow + (0.18 * (0.7 + 0.3 * glowBreath)).toFixed(3) + ')');
          fillGlow.addColorStop(1, glow + '0)');
          ctx.fillStyle = fillGlow; ctx.beginPath(); ctx.arc(px, py, r + 16, 0, TWO_PI); ctx.fill();
          // Glow rings
          const glowRings = degraded ? 1 : 3;
          for (let gr = 0; gr < glowRings; gr++) {
            const ringOffset = (gr + 1) * 5;
            const ringOp = [0.32, 0.18, 0.10][gr] * (0.7 + 0.3 * glowBreath);
            const ringStroke = [2.0, 1.2, 0.6][gr];
            ctx.beginPath();
            ctx.arc(px, py, r + ringOffset, 0, TWO_PI);
            ctx.strokeStyle = glow + ringOp.toFixed(3) + ')';
            ctx.lineWidth = ringStroke;
            ctx.stroke();
          }
        } else {
          // Original halo for neutral/hidden
          const haloR = r * (1.35 + 0.05 * Math.sin(now / 1400 + p.id * 0.72));
          const haloGrad = ctx.createRadialGradient(px, py, r * 0.5, px, py, haloR);
          if (p.owner !== 0) {
            const haloOp = enemyHidden ? '0.1)' : '0.18)';
            haloGrad.addColorStop(0, glow + haloOp); haloGrad.addColorStop(1, glow + '0)');
          } else {
            haloGrad.addColorStop(0, 'rgba(141,110,99,0.05)'); haloGrad.addColorStop(1, 'rgba(141,110,99,0)');
          }
          ctx.fillStyle = haloGrad; ctx.beginPath(); ctx.arc(px, py, haloR, 0, TWO_PI); ctx.fill();
        }

        // Capital crown breathing + pulse when under attack
        if (p.nodeType === 'capital') {
          const underAttackCap = underAttackAny.has(p.id);
          const crownPulseSpeed = underAttackCap ? 200 : 600;
          const cp = 0.3 + 0.2 * Math.sin(now / crownPulseSpeed);
          ctx.beginPath(); ctx.arc(px, py, r + 18, 0, TWO_PI);
          ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = cp; ctx.stroke(); ctx.globalAlpha = 1;
        }

        // ── ENHANCED Selection rings with orbiting sparkles ──
        if (isSel) {
          const selPulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now / 600)); // 1.2s cycle
          ctx.beginPath(); ctx.arc(px, py, r + 8, 0, TWO_PI);
          ctx.strokeStyle = eColor(1); ctx.lineWidth = 2; ctx.globalAlpha = selPulse; ctx.stroke(); ctx.globalAlpha = 1;
          // Inner dashed ring
          ctx.beginPath(); ctx.arc(px, py, r + 14, 0, TWO_PI);
          ctx.strokeStyle = '#FFCC22'; ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]); ctx.stroke(); ctx.setLineDash([]);

          // 4 orbiting sparkle dots
          if (!degraded) {
            const orbitR = r + 20;
            const rotSpeed = TWO_PI / 1500; // 1.5s full rotation
            for (let sp = 0; sp < 4; sp++) {
              const spAngle = now * rotSpeed + (sp * Math.PI * 0.5);
              const spx = px + Math.cos(spAngle) * orbitR;
              const spy = py + Math.sin(spAngle) * orbitR;
              ctx.beginPath();
              ctx.arc(spx, spy, 2, 0, TWO_PI);
              ctx.fillStyle = eColor(1);
              ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200 + sp);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        }

        // ── ENERGY ARCS for high-unit nodes (50+) ──
        if (p.units >= 50 && p.owner !== 0 && !enemyHidden && !degraded) {
          const arcCheck = (now % 3000 + p.id * 700) % 3000;
          if (arcCheck < 150) {
            const arcT = arcCheck / 150;
            const arcAngle = (p.id * 1.7 + now * 0.003) % TWO_PI;
            const arcStartX = px + Math.cos(arcAngle) * r;
            const arcStartY = py + Math.sin(arcAngle) * r;
            const arcEndX = px + Math.cos(arcAngle + 0.5) * (r + 12);
            const arcEndY = py + Math.sin(arcAngle + 0.5) * (r + 12);
            const arcCpX = px + Math.cos(arcAngle + 0.25) * (r + 20);
            const arcCpY = py + Math.sin(arcAngle + 0.25) * (r + 20);
            ctx.beginPath();
            ctx.moveTo(arcStartX, arcStartY);
            ctx.quadraticCurveTo(arcCpX, arcCpY, arcEndX, arcEndY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6 * (1 - arcT);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        // Under attack warning
        const underAttack = p.owner === 1 && underAttackByEnemy.has(p.id);
        if (underAttack) {
          const wp = 1 + 0.14 * Math.sin(now / 145);
          ctx.beginPath(); ctx.arc(px, py, (r + 20) * wp, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(238,100,0,0.65)'; ctx.lineWidth = 2.5; ctx.stroke();
        }

        // ── TENSION STATE: losing player flicker ──
        let tensionOpacity = 1.0;
        if (playerTension && p.owner === 1) {
          const flickerPhase = now * 0.01 + p.id * 2.3;
          tensionOpacity = 0.85 + 0.15 * Math.sin(flickerPhase);
        }
        if (aiTension && p.owner === 2 && !enemyHidden) {
          const flickerPhase = now * 0.01 + p.id * 3.1;
          tensionOpacity = 0.85 + 0.15 * Math.sin(flickerPhase);
        }

        // ── Draw node body with breathing + capture spin (F9) ──
        const capSpin = captureTrans.get(p.id);
        const spinScaleX = capSpin ? Math.abs(Math.cos(capSpin.t * Math.PI)) : 1;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(breathScale * spinScaleX, breathScale);
        ctx.translate(-px, -py);
        ctx.globalAlpha = tensionOpacity;

        if (p.nodeType === 'ruins') ctx.globalAlpha = 0.65 * tensionOpacity;
        if (shape === 'pyramid') drawPyramid(ctx, px, py, r, color, accent);
        else if (shape === 'colosseum') drawColosseum(ctx, px, py, r, color, accent);
        else if (shape === 'yurt') drawYurt(ctx, px, py, r, color, accent);
        else if (shape === 'sphinx') drawSphinx(ctx, px, py, r, color, accent);
        else if (shape === 'torii') drawTorii(ctx, px, py, r, color, accent);
        else if (shape === 'longhouse') drawLonghouse(ctx, px, py, r, color, accent);
        else if (shape === 'step_pyramid') drawStepPyramid(ctx, px, py, r, color, accent);
        else if (shape === 'palace') drawPalace(ctx, px, py, r, color, accent);
        else if (shape === 'mosque') drawMosque(ctx, px, py, r, color, accent);
        else if (shape === 'pagoda') drawPagoda(ctx, px, py, r, color, accent);
        else drawCastle(ctx, px, py, r, color, accent);
        ctx.globalAlpha = 1;

        // Garrison count (with war fog, red flash + scale on hit)
        const showMirage = mirageActive && p.owner === 1;
        const displayUnits = enemyHidden ? -1 : showMirage ? Math.round(p.units * (s.mirageOffsets[p.id] || 1)) : Math.floor(p.units);
        const garrisonY = shape === 'pyramid' ? py + r * 0.12 + 8
          : shape === 'colosseum' ? py + r * 0.08 + 8
          : shape === 'yurt' ? py + r * 0.14 + 8
          : shape === 'sphinx' ? py - r * 0.08 + 8
          : py - r * 0.48 + 7;

        // Number scale pulse on hit (1.0 → 1.2 → 1.0, 80ms)
        const numScale = 1 + nodeHitFlash * 0.2;
        ctx.save();
        ctx.translate(px, garrisonY); ctx.scale(numScale, numScale); ctx.translate(-px, -garrisonY);

        // Scale font inversely with node scale to keep readable
        const fontSize = Math.max(11, Math.round(13 / currentScale));
        ctx.font = `bold ${fontSize}px sans-serif`; ctx.textAlign = 'center';
        ctx.globalAlpha = showMirage ? 0.7 + 0.3 * Math.sin(now / 120) : 0.95;
        const numStr = enemyHidden ? '?' : String(displayUnits);
        const numY = garrisonY + 5;
        // Text shadow for readability
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(numStr, px + 1, numY + 1);
        // Main text color
        if (enemyHidden) {
          ctx.fillStyle = 'rgba(255,100,100,0.5)';
        } else if (nodeHitFlash > 0.1) {
          ctx.fillStyle = `rgba(255,${Math.floor(80 + 175 * (1 - nodeHitFlash))},${Math.floor(80 * (1 - nodeHitFlash))},0.95)`;
        } else if (showMirage) {
          ctx.fillStyle = '#AAFFFF';
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillText(numStr, px, numY);
        // Incoming fleet indicator (only if we have intel)
        if (!enemyHidden) {
          const incoming = incomingUnits.get(p.id);
          if (incoming && incoming > 0 && p.owner !== 0) {
            const isHostile = underAttackAny.has(p.id);
            const incColor = isHostile ? '#FF6644' : '#66FF88';
            const incText = isHostile ? `-${incoming}` : `+${incoming}`;
            ctx.font = `bold ${Math.max(8, fontSize - 2)}px sans-serif`;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(incText, px + 1, numY + fontSize + 1);
            ctx.fillStyle = incColor;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 300);
            ctx.fillText(incText, px, numY + fontSize);
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        ctx.restore();

        // Node type icon
        if (p.nodeType !== 'standard') drawNodeIcon(ctx, px, py, r, p.nodeType);

        // ── Node upgrade stars (1-3 stars based on hold time) ──
        const nodeLevel = s.nodeLevels?.[p.id] || 0;
        if (nodeLevel > 0 && p.owner !== 0 && !enemyHidden) {
          const starY = py + r + 10;
          const starSpacing = 10;
          const startX = px - ((nodeLevel - 1) * starSpacing) / 2;
          ctx.fillStyle = '#FFD700';
          ctx.globalAlpha = 0.85;
          for (let star = 0; star < nodeLevel; star++) {
            const sx = startX + star * starSpacing;
            // Tiny 5-point star
            ctx.beginPath();
            for (let pt = 0; pt < 5; pt++) {
              const angle = -Math.PI / 2 + (pt * TWO_PI) / 5;
              const outerR = 4;
              const innerR = 1.8;
              ctx.lineTo(sx + Math.cos(angle) * outerR, starY + Math.sin(angle) * outerR);
              const midAngle = angle + Math.PI / 5;
              ctx.lineTo(sx + Math.cos(midAngle) * innerR, starY + Math.sin(midAngle) * innerR);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Ruins timer bar
        if (p.nodeType === 'ruins' && p.owner !== 0 && p.ruinsTimer > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(px - 15, py + r + 8, 30, 3);
          ctx.fillStyle = color; ctx.globalAlpha = 0.7;
          ctx.fillRect(px - 15, py + r + 8, 30 * (1 - p.ruinsTimer / 15), 3);
          ctx.globalAlpha = 1;
        }

        // ── TENSION: Winner's capital golden halo ──
        if (p.nodeType === 'capital') {
          if ((aiTension && p.owner === 1) || (playerTension && p.owner === 2 && !enemyHidden)) {
            const haloPhase = now / 2000;
            const goldenR = r + 25 + 5 * Math.sin(haloPhase);
            ctx.beginPath();
            ctx.arc(px, py, goldenR, 0, TWO_PI);
            ctx.strokeStyle = 'rgba(255,215,0,' + (0.15 + 0.1 * Math.sin(haloPhase * 1.5)).toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // ── Ability visual effects ──

        // Eye of Ra: 6 golden rays per owned node, rotate slowly
        if (s.abilityActive && s.playerEmpireId === 'egypt' && p.owner === 1) {
          for (let d = 0; d < 6; d++) {
            const rad = (d * 60 + now / 30) * DEG_TO_RAD;
            const rayLen = r + 25 + 10 * Math.sin(now / 200 + d);
            const rayGrad = ctx.createLinearGradient(px, py, px + Math.cos(rad) * rayLen, py + Math.sin(rad) * rayLen);
            rayGrad.addColorStop(0, 'rgba(255,215,0,0.5)');
            rayGrad.addColorStop(1, 'rgba(255,215,0,0)');
            ctx.beginPath(); ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(rad) * rayLen, py + Math.sin(rad) * rayLen);
            ctx.strokeStyle = rayGrad; ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 150 + d);
            ctx.stroke(); ctx.globalAlpha = 1;
          }
          // Gold pulse on node
          ctx.beginPath(); ctx.arc(px, py, r + 3, 0, TWO_PI);
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 300);
          ctx.stroke(); ctx.globalAlpha = 1;
        }

        // Rome Testudo: silver shimmer ripple
        if (s.abilityActive && s.playerEmpireId === 'rome' && p.owner === 1) {
          const rippleR = r + 8 + (now / 100 % 20);
          ctx.beginPath(); ctx.arc(px, py, rippleR, 0, TWO_PI);
          ctx.strokeStyle = '#C0C0C0'; ctx.lineWidth = 1.5;
          ctx.globalAlpha = Math.max(0, 0.4 - (rippleR - r - 8) / 20 * 0.4);
          ctx.stroke(); ctx.globalAlpha = 1;
        }

        // Ptolemaic Mirage: wavy distortion + teal smoke wisps
        if (showMirage) {
          // Shimmer ring
          ctx.beginPath(); ctx.arc(px + 3 * Math.sin(now / 80), py, r + 4, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(34,170,170,0.3)'; ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
          // Teal smoke wisp drifting upward
          const wispY = py - r - 4 - (now / 60 % 20);
          const wispOp = Math.max(0, 0.15 - (now / 60 % 20) / 20 * 0.15);
          ctx.beginPath(); ctx.ellipse(px + 3 * Math.sin(now / 200), wispY, 8, 4, 0, 0, TWO_PI);
          ctx.fillStyle = `rgba(34,170,170,${wispOp.toFixed(3)})`; ctx.fill();
        }

        // Bushido: crimson aura + slash marks around owned nodes
        if (s.abilityActive && s.playerEmpireId === 'japan' && p.owner === 1) {
          ctx.beginPath(); ctx.arc(px, py, r + 10, 0, TWO_PI);
          ctx.strokeStyle = '#DC143C'; ctx.lineWidth = 2;
          ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 200);
          ctx.stroke(); ctx.globalAlpha = 1;
          // Small slash marks
          for (let sl = 0; sl < 3; sl++) {
            const sa = (sl * 120 + now / 15) * DEG_TO_RAD;
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(sa) * (r + 4), py + Math.sin(sa) * (r + 4));
            ctx.lineTo(px + Math.cos(sa) * (r + 14), py + Math.sin(sa) * (r + 14));
            ctx.strokeStyle = '#FF6688'; ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
          }
        }

        // Vikings Berserker Rage: frost crystal aura
        if (s.abilityActive && s.playerEmpireId === 'vikings' && p.owner === 1) {
          for (let d = 0; d < 6; d++) {
            const a = (d / 6) * TWO_PI + now / 3000;
            const len = r + 14 + Math.sin(now / 400 + d) * 4;
            ctx.beginPath(); ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
            ctx.strokeStyle = 'rgba(128,216,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
            // Ice branch
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(a) * len * 0.5, py + Math.sin(a) * len * 0.5);
            ctx.lineTo(px + Math.cos(a + 0.5) * len * 0.7, py + Math.sin(a + 0.5) * len * 0.7);
            ctx.strokeStyle = 'rgba(128,216,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
          }
        }

        // Aztec Blood Sacrifice: red pulse + gold generation rings
        if (s.abilityActive && s.playerEmpireId === 'aztec' && p.owner === 1) {
          const redPulse = Math.sin(now / 150) * 0.5 + 0.5;
          ctx.globalAlpha = redPulse * 0.30;
          ctx.beginPath(); ctx.arc(px, py, r + 8, 0, TWO_PI);
          ctx.fillStyle = '#C62828'; ctx.fill(); ctx.globalAlpha = 1;
          const ringProg = (now % 400) / 400;
          ctx.globalAlpha = (1 - ringProg) * 0.7;
          ctx.beginPath(); ctx.arc(px, py, ringProg * (r + 12), 0, TWO_PI);
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
        }

        // Persian Immortal Legion: rotating hexagon shield
        if (s.abilityActive && s.playerEmpireId === 'persian' && p.owner === 1) {
          ctx.save(); ctx.translate(px, py); ctx.rotate(now / 2000);
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const ha = (h / 6) * TWO_PI;
            if (h === 0) ctx.moveTo(Math.cos(ha) * (r + 10), Math.sin(ha) * (r + 10));
            else ctx.lineTo(Math.cos(ha) * (r + 10), Math.sin(ha) * (r + 10));
          }
          ctx.closePath();
          ctx.strokeStyle = 'rgba(206,147,216,0.50)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
        }

        // Ottoman Grand Bazaar: teal shimmer on neutral nodes
        if (s.abilityActive && s.playerEmpireId === 'ottoman' && p.owner === 0) {
          const tealShimmer = Math.sin(now / 600 + px) * 0.5 + 0.5;
          ctx.globalAlpha = tealShimmer * 0.25;
          ctx.beginPath(); ctx.arc(px, py, r + 8, 0, TWO_PI);
          ctx.fillStyle = '#00BCD4'; ctx.fill(); ctx.globalAlpha = 1;
          // Crescent above
          const cY = py - r - 14 + Math.sin(now / 800) * 3;
          ctx.beginPath(); ctx.arc(px, cY, 6, 0.3, Math.PI * 1.7);
          ctx.strokeStyle = 'rgba(0,188,212,0.65)'; ctx.lineWidth = 2; ctx.stroke();
        }

        // Han Great Wall: gold wall segments + pulse ring
        if (s.abilityActive && s.playerEmpireId === 'han' && p.owner === 1 && p.id === 0) {
          const wallR = r + 14;
          for (let w = 0; w < 4; w++) {
            const wa = (w / 4) * TWO_PI + 0.4;
            const wx = px + Math.cos(wa) * wallR, wy = py + Math.sin(wa) * wallR;
            ctx.save(); ctx.translate(wx, wy); ctx.rotate(wa + Math.PI / 2);
            const wallFlash = Math.sin(now / 200) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255,235,59,${(wallFlash * 0.80).toFixed(2)})`;
            ctx.fillRect(-10, -3, 20, 6); ctx.restore();
          }
          ctx.beginPath(); ctx.arc(px, py, wallR + 2, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(255,235,59,0.45)'; ctx.lineWidth = 2; ctx.stroke();
        }

        // Garrison arc (hidden for enemies without intel)
        if (!enemyHidden) {
          const arcR = r + 6, arcFill = Math.min(1, p.units / 99);
          if (arcFill > 0.01 && p.owner !== 0) {
            ctx.beginPath(); ctx.arc(px, py, arcR, -Math.PI / 2, -Math.PI / 2 + TWO_PI * arcFill);
            ctx.strokeStyle = glow + '0.6)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
          }
        }
      }

      // ── Fleets (with V-formation for >1 unit, badge for >8) ──
      // Track departures for puff effect
      if (fleets.length !== lastFleetCount) {
        if (fleets.length > lastFleetCount) {
          // New fleet(s) added - record departure
          for (let i = 0; i < fleets.length; i++) {
            const f = fleets[i];
            if (f.progress < 0.05) {
              departureTimestamps.set(f.fromId, now);
            }
          }
        }
        lastFleetCount = fleets.length;
      }

      for (let i = 0; i < fleets.length; i++) {
        const f = fleets[i];
        const from = planetMap.get(f.fromId);
        const to = planetMap.get(f.toId);
        if (!from || !to) continue;
        const { cx: cpx, cy: cpy } = bezCtrl(from.x, from.y, to.x, to.y, f.arc);
        const pos = bezPt(f.progress, from.x, from.y, cpx, cpy, to.x, to.y);
        const angle = bezAngle(f.progress, from.x, from.y, cpx, cpy, to.x, to.y);

        const color = eUnitColor(f.owner as 0|1|2);
        const glow = eGlow(f.owner as 0|1|2);
        const unitShape = eUnitShape(f.owner as 0|1|2);

        const cos = Math.cos(angle), sin = Math.sin(angle);
        const perpCos = Math.cos(angle + Math.PI / 2), perpSin = Math.sin(angle + Math.PI / 2);

        // ── FLEET DEPARTURE PUFF ──
        if (f.progress < 0.05 && !degraded) {
          const depT = f.progress / 0.05; // 0→1
          const fleetColor = eGlow(f.owner as 0|1|2);
          for (let puff = 0; puff < 3; puff++) {
            const puffAngle = (puff * TWO_PI / 3) + depT * 2;
            const puffR = from.radius + 5 + depT * 15;
            const puffX = from.x + Math.cos(puffAngle) * puffR;
            const puffY = from.y + Math.sin(puffAngle) * puffR;
            const puffOp = 0.3 * (1 - depT);
            ctx.beginPath();
            ctx.arc(puffX, puffY, 4 + depT * 6, 0, TWO_PI);
            ctx.fillStyle = fleetColor + puffOp.toFixed(3) + ')';
            ctx.fill();
          }
        }

        // ── COMBAT AURA BEAM (progress > 0.7 heading to enemy) ──
        if (f.progress > 0.7 && !degraded) {
          const tgt = planetMap.get(f.toId);
          if (tgt && f.owner !== tgt.owner && tgt.owner !== 0) {
            // Faint energy beam from fleet to target
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.strokeStyle = eGlow(f.owner as 0|1|2) + '0.12)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Flowing dots along beam
            const beamDist = Math.hypot(tgt.x - pos.x, tgt.y - pos.y);
            const dotCount = 3;
            for (let d = 0; d < dotCount; d++) {
              const dotT = ((now * 0.002 + d * 0.33) % 1);
              const dotX = pos.x + (tgt.x - pos.x) * dotT;
              const dotY = pos.y + (tgt.y - pos.y) * dotT;
              ctx.beginPath();
              ctx.arc(dotX, dotY, 1.5, 0, TWO_PI);
              ctx.fillStyle = eGlow(f.owner as 0|1|2) + '0.2)';
              ctx.fill();
            }
          }
        }

        // ── CRITICAL FLEET GLOW (20+ units) ──
        if (f.units >= 20 && !degraded) {
          const pulseSize = 22 + 4 * Math.sin(now / 300 + f.id);
          const glowOp = f.units >= 50 ? 0.25 : f.units >= 35 ? 0.18 : 0.12;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, pulseSize, 0, TWO_PI);
          ctx.fillStyle = glow + glowOp.toFixed(3) + ')';
          ctx.fill();
          // Outer ring for massive fleets (50+)
          if (f.units >= 50) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pulseSize + 8, 0, TWO_PI);
            ctx.strokeStyle = glow + '0.1)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Empire-specific trails
        const maxTrail = perf.maxTrail;
        for (let t = 0; t < maxTrail; t++) {
          const tp = bezPt(Math.max(0, f.progress - (t + 1) * 0.06), from.x, from.y, cpx, cpy, to.x, to.y);
          const trailOp = (0.35 - t * 0.12);
          if (unitShape === 'scarab') {
            // Golden sparkle dots
            ctx.beginPath(); ctx.arc(tp.x + (Math.random() - 0.5) * 3, tp.y + (Math.random() - 0.5) * 3, 2 - t * 0.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(255,215,0,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'shield') {
            // Silver streak, straight line
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 3 - t, 0, TWO_PI);
            ctx.fillStyle = `rgba(192,192,192,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'horse') {
            // Orange dust cloud (soft circles)
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 5 - t * 1.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(204,119,34,${(trailOp * 0.5).toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'ankh') {
            // Teal glow dots
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.5 - t * 0.6, 0, TWO_PI);
            ctx.fillStyle = `rgba(34,170,170,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'katana') {
            // Cherry blossom petals / crimson slash
            ctx.beginPath(); ctx.arc(tp.x + (Math.random() - 0.5) * 4, tp.y + (Math.random() - 0.5) * 4, 2 - t * 0.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(255,182,193,${(trailOp * 0.7).toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'viking_ship') {
            // Frost crystals
            ctx.beginPath(); ctx.arc(tp.x + (Math.random() - 0.5) * 3, tp.y + (Math.random() - 0.5) * 3, 2 - t * 0.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(79,195,247,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'warrior') {
            // Jade green + red embers
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.5 - t * 0.6, 0, TWO_PI);
            ctx.fillStyle = `rgba(76,175,80,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'immortal') {
            // Purple royal smoke
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 3 - t, 0, TWO_PI);
            ctx.fillStyle = `rgba(123,31,162,${(trailOp * 0.6).toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'janissary') {
            // Crimson + turquoise sparks
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 2 - t * 0.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(183,28,28,${trailOp.toFixed(2)})`; ctx.fill();
          } else if (unitShape === 'han_soldier') {
            // Yellow imperial sparks + red ribbon
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 2 - t * 0.5, 0, TWO_PI);
            ctx.fillStyle = `rgba(253,216,53,${trailOp.toFixed(2)})`; ctx.fill();
          } else {
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 4 - t * 1.2, 0, TWO_PI);
            ctx.fillStyle = glow + `${trailOp.toFixed(2)})`; ctx.fill();
          }
        }

        // Glow
        const gg = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, 18);
        gg.addColorStop(0, glow + '0.45)'); gg.addColorStop(1, glow + '0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(pos.x, pos.y, 18, 0, TWO_PI); ctx.fill();

        // ── F1: DYNAMIC FORMATIONS (diamond ≤4, V 5-12, column 13+) ──
        // Smooth angle lerping
        const prevAngle = fleetAngleMap.current.get(f.id);
        const smoothAngle = prevAngle !== undefined ? lerpAngle(prevAngle, angle, 0.15) : angle;
        fleetAngleMap.current.set(f.id, smoothAngle);
        const fcos = Math.cos(smoothAngle), fsin = Math.sin(smoothAngle);

        const visibleCount = Math.min(f.units, 15);
        const formationOffsets = getFormationOffsets(visibleCount);

        for (let u = 0; u < formationOffsets.length; u++) {
          const off = formationOffsets[u];
          const ux = pos.x + off[0] * fcos - off[1] * fsin;
          const uy = pos.y + off[0] * fsin + off[1] * fcos;
          const unitAngle = unitShape === 'ankh'
            ? smoothAngle + Math.sin(now / 300 + u) * 5 * DEG_TO_RAD
            : smoothAngle;
          drawUnit(ctx, ux, uy, unitAngle, unitShape, color);

          // F2: Dynamic lighting — warm glow near owned nodes
          if (!degraded && f.owner === 1) {
            const light = getLightInfluence(ux, uy, planets);
            if (light > 0.1) {
              ctx.globalAlpha = light * 0.3;
              ctx.beginPath(); ctx.arc(ux, uy, 8, 0, TWO_PI);
              ctx.fillStyle = '#FFFAE0'; ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        }

        // Count badge for fleets > 15 units
        if (f.units > 15) {
          const badgeX = pos.x - perpCos * 14;
          const badgeY = pos.y - perpSin * 14;
          const badgeW = f.units >= 100 ? 28 : f.units >= 10 ? 22 : 18;
          const badgeH = 14;
          ctx.beginPath();
          ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
          ctx.fillStyle = 'rgba(8,6,2,0.82)'; ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(badgeX - badgeW / 2 + 1, badgeY - badgeH / 2 + 1, badgeW, badgeH, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(String(f.units), badgeX, badgeY + 3);
        }

        // Testudo overlay
        if (s.abilityActive && s.playerEmpireId === 'rome' && f.owner === 1) {
          // Silver shield overlay on units
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 12, 0, TWO_PI);
          ctx.strokeStyle = 'rgba(200,200,220,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
          // Silver flash
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, TWO_PI);
          ctx.fillStyle = `rgba(192,192,192,${(0.15 + 0.1 * Math.sin(now / 200)).toFixed(2)})`; ctx.fill();
        }

        // Blitz speed lines (longer trails + lightning bolt)
        if (s.abilityActive && s.playerEmpireId === 'mongols' && f.owner === 1) {
          for (let sl = -1; sl <= 1; sl++) {
            const ox = perpCos * sl * 5;
            const oy = perpSin * sl * 5;
            ctx.beginPath();
            ctx.moveTo(pos.x + ox - cos * 20, pos.y + oy - sin * 20);
            ctx.lineTo(pos.x + ox - cos * 38, pos.y + oy - sin * 38);
            ctx.strokeStyle = '#FF9933'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
          }
          // Lightning bolt above
          const boltX = pos.x - perpCos * 10, boltY = pos.y - perpSin * 10;
          const boltOp = 0.4 + 0.3 * Math.sin(now / 100);
          ctx.fillStyle = `rgba(255,153,51,${boltOp.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(boltX - 2, boltY - 6); ctx.lineTo(boltX + 1, boltY - 1);
          ctx.lineTo(boltX - 1, boltY - 1); ctx.lineTo(boltX + 2, boltY + 6);
          ctx.lineTo(boltX - 1, boltY + 1); ctx.lineTo(boltX + 1, boltY + 1);
          ctx.closePath(); ctx.fill();
        }
      }

      // ── Particles ──
      let particlesDrawn = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active || p.alpha <= 0) continue;
        if (particlesDrawn >= perf.maxParticles) break;
        // Particle tapers from 3px to 0
        const pSize = (2.5 + (p.id % 3) * 0.8) * Math.max(0.1, p.alpha);
        ctx.beginPath(); ctx.arc(p.x, p.y, pSize, 0, TWO_PI);
        ctx.fillStyle = `rgba(${p.color},${Math.max(0, p.alpha).toFixed(2)})`; ctx.fill();
        particlesDrawn++;
      }

      // ── UPDATE AND DRAW VFX PARTICLES ──
      vfxActiveCount = 0;
      for (let i = 0; i < VFX_POOL_SIZE; i++) {
        const vp = vfxPool[i];
        if (!vp.active) continue;
        vp.life += dtMs;
        if (vp.life >= vp.maxLife) {
          vp.active = false;
          continue;
        }
        vfxActiveCount++;
        const t = vp.life / vp.maxLife;
        vp.alpha = 1 - t;

        if (vp.type === 'spark') {
          // Move with velocity, decelerate
          vp.x += vp.vx * dt;
          vp.y += vp.vy * dt;
          vp.vx *= 0.96;
          vp.vy *= 0.96;
          const sparkSize = vp.size * (1 - t * 0.5);
          ctx.beginPath();
          ctx.arc(vp.x, vp.y, sparkSize, 0, TWO_PI);
          ctx.fillStyle = vp.color;
          ctx.globalAlpha = vp.alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (vp.type === 'ember') {
          // Move with gravity
          vp.x += vp.vx * dt;
          vp.y += vp.vy * dt;
          vp.vy += vp.gravity * dt;
          vp.vx *= 0.98;
          const emberSize = vp.size * (1 - t * 0.3);
          ctx.beginPath();
          ctx.arc(vp.x, vp.y, emberSize, 0, TWO_PI);
          ctx.fillStyle = vp.color;
          ctx.globalAlpha = vp.alpha * 0.8;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (vp.type === 'ring') {
          // Expanding ring
          vp.radius = vp.maxRadius * t;
          const ringOp = vp.alpha * 0.7;
          if (ringOp > 0.01) {
            ctx.beginPath();
            ctx.arc(vp.x, vp.y, vp.radius, 0, TWO_PI);
            ctx.strokeStyle = vp.color;
            ctx.lineWidth = vp.strokeWidth * (1 - t * 0.5);
            ctx.globalAlpha = ringOp;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      // ── ENHANCED Floating combat text ──
      for (let i = 0; i < floatingTexts.length; i++) {
        const ft = floatingTexts[i];
        const op = ft.t < 0.15 ? ft.t / 0.15 : Math.max(0, 1 - (ft.t - 0.15) / 0.85);
        if (op < 0.01) continue;

        // Horizontal drift
        const driftX = ft.x + Math.sin(ft.t * 6) * 5;

        ctx.font = `bold ${ft.size}px sans-serif`;
        ctx.textAlign = 'center';

        // Text outline shadow for readability (draw black offset first)
        ctx.globalAlpha = op * 0.6;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(ft.text, driftX + 1, ft.y + 1);

        // Main colored text
        ctx.globalAlpha = op;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, driftX, ft.y);
        ctx.globalAlpha = 1;
      }

      // ── Fog of war overlay ──
      if (fogOn) {
        ctx.fillStyle = 'rgba(6,10,6,0.6)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < planets.length; i++) {
          const p = planets[i];
          if (p.owner !== 1) continue;
          const fogR = p.nodeType === 'watchtower' ? WATCHTOWER_RADIUS : FOG_RADIUS;
          const fogGrad = ctx.createRadialGradient(p.x, p.y, fogR * 0.5, p.x, p.y, fogR);
          fogGrad.addColorStop(0, 'rgba(0,0,0,1)'); fogGrad.addColorStop(0.7, 'rgba(0,0,0,0.8)'); fogGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fogGrad;
          ctx.beginPath(); ctx.arc(p.x, p.y, fogR, 0, TWO_PI); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── Victory anticipation vignette ──
      let playerCount = 0, totalOwned = 0;
      for (let i = 0; i < planets.length; i++) {
        if (planets[i].owner === 1) playerCount++;
        if (planets[i].owner !== 0) totalOwned++;
      }
      if (totalOwned > 0 && playerCount / planets.length > 0.8) {
        const vigOp = 0.06 + 0.02 * Math.sin(now / 1000);
        const vigGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.7);
        vigGrad.addColorStop(0, 'rgba(255,215,0,0)');
        vigGrad.addColorStop(1, `rgba(255,215,0,${vigOp.toFixed(3)})`);
        ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, width, height);
      }

      // ── Close battle red vignette ──
      let closeBattle = false;
      for (let i = 0; i < planets.length; i++) {
        if (planets[i].units <= 3 && planets[i].owner !== 0) {
          const isUnderAttack = underAttackAny.has(planets[i].id);
          if (isUnderAttack) { closeBattle = true; break; }
        }
      }
      if (closeBattle) {
        const redOp = 0.04 + 0.03 * Math.sin(now / 200);
        const redVig = ctx.createRadialGradient(width / 2, height / 2, width * 0.35, width / 2, height / 2, width * 0.65);
        redVig.addColorStop(0, 'rgba(255,0,0,0)');
        redVig.addColorStop(1, `rgba(255,0,0,${redOp.toFixed(3)})`);
        ctx.fillStyle = redVig; ctx.fillRect(0, 0, width, height);
      }

      // ── Combo counter HUD (top-center) ──
      if (s.playerComboCount >= 2) {
        const comboX = width / 2;
        const comboY = 28;
        const comboText = `${s.playerComboCount}x COMBO`;
        const comboScale = 1 + 0.05 * Math.sin(now / 150);
        const comboColor = s.playerComboCount >= 5 ? '#FF44FF' : s.playerComboCount >= 3 ? '#44FFFF' : '#FFCC44';
        ctx.save();
        ctx.translate(comboX, comboY);
        ctx.scale(comboScale, comboScale);
        ctx.translate(-comboX, -comboY);
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(comboText, comboX + 1, comboY + 1);
        ctx.fillStyle = comboColor;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
        ctx.fillText(comboText, comboX, comboY);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // ── Momentum label (territory advantage indicator) ──
      if (playerNodeCount > 0 && aiNodeCount > 0) {
        const ratio = playerNodeCount / (playerNodeCount + aiNodeCount);
        if (ratio > 0.65 || ratio < 0.35) {
          const momText = ratio > 0.65 ? 'DOMINATING' : 'UNDER PRESSURE';
          const momColor = ratio > 0.65 ? 'rgba(100,255,130,0.4)' : 'rgba(255,100,80,0.4)';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillStyle = momColor;
          ctx.fillText(momText, width - 8, 24);
        }
        // F16: Comeback/Dominant bonus labels
        if (aiNodeCount > playerNodeCount * 1.5 && playerNodeCount > 0) {
          ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(100,255,130,0.5)';
          ctx.fillText('COMEBACK +25%', width - 8, 36);
        } else if (playerNodeCount > aiNodeCount * 1.5 && aiNodeCount > 0) {
          ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(255,215,0,0.4)';
          ctx.fillText('DOMINANT', width - 8, 36);
        }
      }

      // ── Battle stats overlay (bottom-left, subtle) ──
      if (s.playerConquestTotal > 0 || s.enemyConquestTotal > 0) {
        const statsX = 8;
        const statsY = height - 8;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText(`CAP ${s.playerConquestTotal}/${s.enemyConquestTotal}`, statsX, statsY);
        if (s.playerMaxCombo >= 3) {
          ctx.fillText(`BEST ${s.playerMaxCombo}x`, statsX, statsY - 12);
        }
      }

      // ── FPS counter (color-coded) ──
      const fpsColor = fp.fps > 55 ? 'rgba(80,255,80,0.6)' : fp.fps >= 45 ? 'rgba(255,220,60,0.6)' : 'rgba(255,60,60,0.7)';
      const ql = perf.qualityLevel;
      ctx.fillStyle = fpsColor; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${fp.fps} FPS`, 6, 12);
      if (ql < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText(`L${ql}`, 56, 12);
      }

      // ── F15: EVENLY MATCHED text ──────────────────────────────────────────
      const playerRatio = planets.length > 0 ? playerNodeCount / planets.length : 0;
      const em = evenlyMatchedRef.current;
      if (playerRatio >= 0.48 && playerRatio <= 0.52 && playerNodeCount > 0 && aiNodeCount > 0) {
        if (now - em.lastShow > 8000) {
          em.lastShow = now;
          em.opacity = 1;
        }
      }
      if (em.opacity > 0) {
        const emAge = now - em.lastShow;
        em.opacity = emAge < 1500 ? Math.min(1, emAge / 300) : Math.max(0, 1 - (emAge - 1500) / 500);
        if (em.opacity > 0.01) {
          ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.globalAlpha = em.opacity;
          ctx.fillText('EVENLY MATCHED', width / 2 + 1, height / 2 - 59);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('EVENLY MATCHED', width / 2, height / 2 - 60);
          ctx.globalAlpha = 1;
        }
      }

      // ── F14: Performance frame graph ──────────────────────────────────────
      if (fpsGraphVisible.current) {
        const gx = width - 98, gy = height - 52;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(gx, gy, 92, 48);
        for (let i = 0; i < 60; i++) {
          const idx = (perf.frameTimeIdx - 60 + i + 60) % 60;
          const ms = perf.frameTimes[idx];
          const barH = Math.min(42, (ms / 33) * 42);
          ctx.fillStyle = ms < 16 ? '#00E676' : ms < 22 ? '#FFEB3B' : '#FF1744';
          ctx.fillRect(gx + 2 + i * 1.5, gy + 44 - barH, 1, barH);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(gx + 2, gy + 44 - 20); ctx.lineTo(gx + 90, gy + 44 - 20); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '7px monospace'; ctx.textAlign = 'left';
        ctx.fillText('60fps', gx + 2, gy + 44 - 21);
      }

      // ── Restore screen shake transform ────────────────────────────────────
      ctx.restore();

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, drawBg, eColor, eGlow, eAccent, eUnitColor, eShape, eUnitShape]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width, height, backgroundColor: '#0A140A' }} {...panResponder.panHandlers}>
        <Text style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>Canvas rendering requires web</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <canvas ref={bgCanvasRef as any} style={{ position: 'absolute', top: 0, left: 0, width, height } as any} />
      <canvas ref={canvasRef as any} style={{ position: 'absolute', top: 0, left: 0, width, height } as any} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} {...panResponder.panHandlers} />
    </View>
  );
}
