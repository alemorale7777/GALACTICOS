import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Fleet, Planet, useGame } from '@/context/GameContext';
import { EmpireConfig, NodeShape } from '@/constants/empires';

// Star sparkle positions (fraction of width/height)
const STAR_POSITIONS = [
  { x: 0.15, y: 0.12 }, { x: 0.32, y: 0.08 }, { x: 0.58, y: 0.05 },
  { x: 0.78, y: 0.11 }, { x: 0.92, y: 0.19 }, { x: 0.88, y: 0.42 },
  { x: 0.95, y: 0.65 }, { x: 0.83, y: 0.85 }, { x: 0.62, y: 0.92 },
  { x: 0.38, y: 0.95 }, { x: 0.18, y: 0.88 }, { x: 0.08, y: 0.62 },
];

const HIT_EXTRA = 20;
const FOG_RADIUS = 220;
const GHOST_RADIUS = 290;

function isVisible(px: number, py: number, playerPlanets: Planet[]): boolean {
  return playerPlanets.some(p => Math.hypot(p.x - px, p.y - py) < FOG_RADIUS);
}
function isGhost(px: number, py: number, playerPlanets: Planet[]): boolean {
  return playerPlanets.some(p => Math.hypot(p.x - px, p.y - py) < GHOST_RADIUS);
}

// ── Fantasy fallback palette ─────────────────────────────────────────────────
function ownerColor(o: 0 | 1 | 2) {
  return o === 1 ? '#44EE66' : o === 2 ? '#EE3344' : '#BB9955';
}
function ownerGlow(o: 0 | 1 | 2) {
  return o === 1 ? '68,238,102' : o === 2 ? '238,51,68' : '187,153,85';
}
function ownerGlowDark(o: 0 | 1 | 2) {
  return o === 1 ? '18,70,28' : o === 2 ? '90,10,18' : '65,50,22';
}
function ownerStone(o: 0 | 1 | 2) {
  return o === 1 ? '#228844' : o === 2 ? '#882222' : '#776644';
}

// ── Bezier helpers ────────────────────────────────────────────────────────────
function bezierControlPoint(
  x1: number, y1: number, x2: number, y2: number, arc: number
): { cx: number; cy: number } {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return { cx: mx - Math.sin(angle) * arc, cy: my + Math.cos(angle) * arc };
}

function bezierPoint(t: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return { x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2, y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2 };
}

function bezierTangentAngle(t: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return Math.atan2(2 * mt * (cy - y1) + 2 * t * (y2 - cy), 2 * mt * (cx - x1) + 2 * t * (x2 - cx));
}

function fleetPos(fleet: Fleet, from: Planet, to: Planet) {
  const { cx, cy } = bezierControlPoint(from.x, from.y, to.x, to.y, fleet.arc);
  const pos = bezierPoint(fleet.progress, from.x, from.y, cx, cy, to.x, to.y);
  const angle = bezierTangentAngle(fleet.progress, from.x, from.y, cx, cy, to.x, to.y);
  return { ...pos, angle, cx, cy };
}

// ── Empire node shape paths ──────────────────────────────────────────────────
function pyramidPath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const peak = cy - r, base = cy + r * 0.5;
  const gL = cx - r * 0.22, gR = cx + r * 0.22, gTop = base - r * 0.38;
  return [
    `M${f(cx - r)},${f(base)}`,
    `L${f(cx)},${f(peak)}`,
    `L${f(cx + r)},${f(base)}`,
    `L${f(gR)},${f(base)}`,
    `L${f(gR)},${f(gTop)}`,
    `Q${f(cx)},${f(gTop - r * 0.12)} ${f(gL)},${f(gTop)}`,
    `L${f(gL)},${f(base)} Z`,
  ].join(' ');
}

// Colosseum: outer rect + 3 arch cutouts (use fillRule="evenodd")
function colosseumPath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const bot = cy + r * 0.48, top = cy - r * 0.58;
  const wL = cx - r, wR = cx + r;
  const n = 3, segW = (2 * r) / n;
  const pad = r * 0.1, archW = segW - 2 * pad;
  const archMid = cy - r * 0.08, archPeak = cy - r * 0.52;
  let d = `M${f(wL)},${f(bot)} L${f(wL)},${f(top)} L${f(wR)},${f(top)} L${f(wR)},${f(bot)} Z`;
  // Cornice line
  const ledgeY = top + (bot - top) * 0.22;
  // Add ledge as a thin slice (it will be filled the same color)
  // Actually just add arch holes
  for (let i = 0; i < n; i++) {
    const ax = wL + i * segW + pad, ax2 = ax + archW, amx = (ax + ax2) / 2;
    d += ` M${f(ax)},${f(bot)} L${f(ax)},${f(archMid)} Q${f(amx)},${f(archPeak)} ${f(ax2)},${f(archMid)} L${f(ax2)},${f(bot)} Z`;
  }
  return d;
}

function yurtPath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const peak = cy - r * 0.95, domeBase = cy - r * 0.05, wallBot = cy + r * 0.48, wallW = r * 0.9;
  return [
    `M${f(cx - wallW)},${f(wallBot)}`,
    `L${f(cx - wallW)},${f(domeBase)}`,
    `C${f(cx - wallW)},${f(peak + r * 0.3)} ${f(cx - r * 0.12)},${f(peak)} ${f(cx)},${f(peak)}`,
    `C${f(cx + r * 0.12)},${f(peak)} ${f(cx + wallW)},${f(peak + r * 0.3)} ${f(cx + wallW)},${f(domeBase)}`,
    `L${f(cx + wallW)},${f(wallBot)} Z`,
  ].join(' ');
}

// Sphinx / pharaoh head with nemes headdress
function sphinxPath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const nemTop = cy - r * 0.85, nemW = r * 0.8;
  const flapsY = cy + r * 0.1, flapsW = r, beardBot = cy + r * 0.48, faceW = r * 0.48;
  return [
    `M${f(cx - nemW)},${f(nemTop)}`,
    `L${f(cx + nemW)},${f(nemTop)}`,
    `L${f(cx + flapsW)},${f(flapsY)}`,
    `L${f(cx + faceW)},${f(flapsY)}`,
    `L${f(cx)},${f(beardBot)}`,
    `L${f(cx - faceW)},${f(flapsY)}`,
    `L${f(cx - flapsW)},${f(flapsY)} Z`,
  ].join(' ');
}

// Flag position for each empire node shape
function empireNodeFlag(cx: number, cy: number, r: number, shape: NodeShape): { pole: string; flag: string } {
  const f = (n: number) => n.toFixed(1);
  let baseY: number;
  switch (shape) {
    case 'pyramid':  baseY = cy - r * 0.96; break;
    case 'colosseum': baseY = cy - r * 0.58; break;
    case 'yurt':     baseY = cy - r * 0.92; break;
    case 'sphinx':   baseY = cy - r * 0.83; break;
  }
  const staffX = cx - r * 0.04;
  const tipY = baseY - r * 0.5;
  return {
    pole: `M${f(staffX)},${f(baseY)} L${f(staffX)},${f(tipY)}`,
    flag: `${f(staffX)},${f(tipY)} ${f(staffX + r * 0.5)},${f(tipY + r * 0.22)} ${f(staffX)},${f(tipY + r * 0.44)}`,
  };
}

// ── Castle tower silhouette path (default / neutral) ─────────────────────────
function castleOutlinePath(cx: number, cy: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  const ml  = r * 0.30;
  const mw  = r * 0.18;
  const bot  = cy + r * 0.52;
  const wL   = cx - r * 1.05;
  const wR   = cx + r * 1.05;
  const wTop = cy - r * 0.08;
  const tW   = r * 0.42;
  const tTop = wTop - r * 0.55;
  const kL   = cx - r * 0.30;
  const kR   = cx + r * 0.30;
  const kTop = wTop - r * 1.08;
  const gL   = cx - r * 0.20;
  const gR   = cx + r * 0.20;
  const gTop = bot - r * 0.44;

  function mRow(x1: number, x2: number, baseY: number, n: number): string {
    const step = (x2 - x1) / n;
    let s = '';
    for (let i = 0; i < n; i++) {
      const mx = x1 + i * step + step * 0.18;
      s += ` L${f(mx)},${f(baseY)} L${f(mx)},${f(baseY - ml)}`
         + ` L${f(mx + mw)},${f(baseY - ml)} L${f(mx + mw)},${f(baseY)}`;
    }
    return s + ` L${f(x2)},${f(baseY)}`;
  }

  let d = `M${f(wL)},${f(bot)}`;
  d += ` L${f(wL)},${f(tTop)}`;
  d += mRow(wL, wL + tW, tTop, 2);
  d += ` L${f(wL + tW)},${f(wTop)}`;
  d += mRow(wL + tW, kL, wTop, 1);
  d += ` L${f(kL)},${f(kTop)}`;
  d += mRow(kL, kR, kTop, 2);
  d += ` L${f(kR)},${f(wTop)}`;
  d += mRow(kR, wR - tW, wTop, 1);
  d += ` L${f(wR - tW)},${f(tTop)}`;
  d += mRow(wR - tW, wR, tTop, 2);
  d += ` L${f(wR)},${f(bot)}`;
  d += ` L${f(gR)},${f(bot)} L${f(gR)},${f(gTop)}`;
  d += ` Q${f(cx)},${f(gTop - r * 0.14)} ${f(gL)},${f(gTop)}`;
  d += ` L${f(gL)},${f(bot)} Z`;
  return d;
}

function castleKeepFlag(cx: number, cy: number, r: number): { pole: string; flag: string } {
  const keepMerlonTop = (cy - r * 0.08) - r * 1.08 - r * 0.30;
  const staffX = cx - r * 0.04;
  const tipY = keepMerlonTop - r * 0.50;
  return {
    pole: `M${staffX},${keepMerlonTop} L${staffX},${tipY}`,
    flag: `${staffX},${tipY} ${staffX + r * 0.50},${tipY + r * 0.22} ${staffX},${tipY + r * 0.44}`,
  };
}

// ── Empire unit shape renderers ───────────────────────────────────────────────
function renderScarabUnit(bx: number, by: number, angle: number, sz: number, color: string): React.ReactElement {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const perp = angle + Math.PI / 2;
  const pc = Math.cos(perp), ps = Math.sin(perp);
  const f = (n: number) => n.toFixed(1);
  // Wing tip coords
  const wLx = bx + pc * sz * 2.6, wLy = by + ps * sz * 2.6;
  const wRx = bx - pc * sz * 2.6, wRy = by - ps * sz * 2.6;
  // Wing bend through a forward point
  const bendX = bx + cos * sz * 0.7, bendY = by + sin * sz * 0.7;
  const wPath = `M${f(wLx)},${f(wLy)} Q${f(bendX)},${f(bendY)} ${f(wRx)},${f(wRy)}`;
  // Oval body
  const bodyPts: [number, number][] = [
    [sz * 1.55, 0], [sz * 0.85, sz * 0.9],
    [-sz * 0.5, sz * 0.8], [-sz * 0.7, 0],
    [-sz * 0.5, -sz * 0.8], [sz * 0.85, -sz * 0.9],
  ];
  const bodyPoints = bodyPts.map(([px, py]) =>
    `${f(bx + px * cos - py * sin)},${f(by + px * sin + py * cos)}`
  ).join(' ');
  return (
    <G>
      <Path d={wPath} stroke={color} strokeWidth={sz * 0.38} fill="none" opacity={0.72} />
      <Polygon points={bodyPoints} fill={color} />
    </G>
  );
}

function renderShieldUnit(bx: number, by: number, angle: number, sz: number, color: string): React.ReactElement {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const f = (n: number) => n.toFixed(1);
  // Scutum (rectangular shield with domed top)
  const pts: [number, number][] = [
    [sz * 1.7, -sz * 0.85], [sz * 2.1, 0], [sz * 1.7, sz * 0.85],
    [-sz * 1.1, sz * 0.85], [-sz * 1.1, -sz * 0.85],
  ];
  const points = pts.map(([px, py]) =>
    `${f(bx + px * cos - py * sin)},${f(by + px * sin + py * cos)}`
  ).join(' ');
  // Boss (center stud)
  const bossCX = bx + cos * sz * 0.4, bossCY = by + sin * sz * 0.4;
  return (
    <G>
      <Polygon points={points} fill={color} />
      <Circle cx={bossCX} cy={bossCY} r={sz * 0.45} fill="rgba(255,255,255,0.22)" />
    </G>
  );
}

function renderHorseUnit(bx: number, by: number, angle: number, sz: number, color: string): React.ReactElement {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const f = (n: number) => n.toFixed(1);
  // Teardrop pointing forward
  const pts: [number, number][] = [
    [sz * 2.2, 0],
    [sz * 0.75, sz * 1.0], [-sz * 0.8, sz * 0.88],
    [-sz * 1.4, 0],
    [-sz * 0.8, -sz * 0.88], [sz * 0.75, -sz * 1.0],
  ];
  const points = pts.map(([px, py]) =>
    `${f(bx + px * cos - py * sin)},${f(by + px * sin + py * cos)}`
  ).join(' ');
  return <Polygon points={points} fill={color} />;
}

function renderAnkhUnit(bx: number, by: number, sz: number, color: string): React.ReactElement {
  const f = (n: number) => n.toFixed(1);
  // Always screen-upright ankh
  const shaftW = sz * 0.44;
  const crossY = by - sz * 0.4;
  const crossHalfW = sz * 1.55;
  const shaftBot = by + sz * 1.8;
  const loopCY = by - sz * 1.32;
  const loopR = sz * 0.82;
  const strokeW = sz * 0.82;
  // Vertical shaft
  const shaftPts = [
    `${f(bx + shaftW)},${f(crossY + sz * 0.35)}`,
    `${f(bx + shaftW)},${f(shaftBot)}`,
    `${f(bx - shaftW)},${f(shaftBot)}`,
    `${f(bx - shaftW)},${f(crossY + sz * 0.35)}`,
  ].join(' ');
  // Crossbar
  const crossPts = [
    `${f(bx + crossHalfW)},${f(crossY + sz * 0.38)}`,
    `${f(bx + crossHalfW)},${f(crossY - sz * 0.38)}`,
    `${f(bx - crossHalfW)},${f(crossY - sz * 0.38)}`,
    `${f(bx - crossHalfW)},${f(crossY + sz * 0.38)}`,
  ].join(' ');
  return (
    <G>
      <Polygon points={shaftPts} fill={color} />
      <Polygon points={crossPts} fill={color} />
      <Circle cx={bx} cy={loopCY} r={loopR} fill="none" stroke={color} strokeWidth={strokeW} />
    </G>
  );
}

// ── Default troop polygon (castle/neutral) ────────────────────────────────────
function troopPolygon(cx: number, cy: number, angle: number, sz: number): string {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts: [number, number][] = [
    [sz * 1.6, 0], [sz * 0.9, sz * 0.95],
    [-sz * 0.6, sz * 0.85], [-sz * 0.8, 0],
    [-sz * 0.6, -sz * 0.85], [sz * 0.9, -sz * 0.95],
  ];
  return pts
    .map(([px, py]) => `${(cx + px * cos - py * sin).toFixed(1)},${(cy + px * sin + py * cos).toFixed(1)}`)
    .join(' ');
}

function fleetFlagPoints(cx: number, cy: number, angle: number, sz: number): string {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts: [number, number][] = [
    [sz * 0.8, -sz * 1.3], [sz * 0.8, -sz * 2.4], [sz * 0.8 + sz * 1.0, -sz * 1.8],
  ];
  return pts
    .map(([px, py]) => `${(cx + px * cos - py * sin).toFixed(1)},${(cy + px * sin + py * cos).toFixed(1)}`)
    .join(' ');
}

// ── Arrowhead ─────────────────────────────────────────────────────────────────
function arrowheadPoints(x1: number, y1: number, x2: number, y2: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 13, spread = 0.45;
  const tip = { x: x2 - Math.cos(angle) * 4, y: y2 - Math.sin(angle) * 4 };
  const l = { x: tip.x - Math.cos(angle - spread) * len, y: tip.y - Math.sin(angle - spread) * len };
  const r = { x: tip.x - Math.cos(angle + spread) * len, y: tip.y - Math.sin(angle + spread) * len };
  return `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${l.x.toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${r.y.toFixed(1)}`;
}

function bezierPathStr(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string {
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  width: number;
  height: number;
  onSelectPlanet: (id: number | null) => void;
  onSendFleet: (fromId: number, toId: number) => void;
  onSendFleetFromAll: (toId: number) => void;
  onClearAll: () => void;
  selectedPlanetId: number | null;
  allSelected: boolean;
  pointerPos: { x: number; y: number };
  onPointerMove: (x: number, y: number) => void;
  playerEmpire?: EmpireConfig | null;
  aiEmpire?: EmpireConfig | null;
}

export default function GameCanvas({
  width, height,
  onSelectPlanet, onSendFleet, onSendFleetFromAll, onClearAll,
  selectedPlanetId, allSelected, pointerPos, onPointerMove,
  playerEmpire, aiEmpire,
}: Props) {
  const { state } = useGame();
  const { planets, fleets, particles, conquestFlashes, impactFlashes } = state;

  const planetsRef = useRef(planets); planetsRef.current = planets;
  const selIdRef = useRef<number | null>(null); selIdRef.current = selectedPlanetId;
  const allSelectedRef = useRef(false); allSelectedRef.current = allSelected;
  const selectRef = useRef(onSelectPlanet); selectRef.current = onSelectPlanet;
  const sendRef = useRef(onSendFleet); sendRef.current = onSendFleet;
  const sendAllRef = useRef(onSendFleetFromAll); sendAllRef.current = onSendFleetFromAll;
  const clearAllRef = useRef(onClearAll); clearAllRef.current = onClearAll;
  const moveRef = useRef(onPointerMove); moveRef.current = onPointerMove;

  // ── Screen shake ──────────────────────────────────────────────────────────
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;
  const prevCFLen = useRef(0);
  useEffect(() => {
    const len = conquestFlashes.length;
    if (len > prevCFLen.current) {
      prevCFLen.current = len;
      const cf = conquestFlashes[len - 1];
      const mag = cf?.owner === 1 ? 8 : 5;
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shakeX, { toValue: mag,        duration: 40, useNativeDriver: false }),
          Animated.timing(shakeX, { toValue: -mag * 0.6, duration: 35, useNativeDriver: false }),
          Animated.timing(shakeX, { toValue: mag * 0.3,  duration: 28, useNativeDriver: false }),
          Animated.timing(shakeX, { toValue: 0,          duration: 22, useNativeDriver: false }),
        ]),
        Animated.sequence([
          Animated.timing(shakeY, { toValue: -mag * 0.5, duration: 40, useNativeDriver: false }),
          Animated.timing(shakeY, { toValue: mag * 0.3,  duration: 35, useNativeDriver: false }),
          Animated.timing(shakeY, { toValue: 0,          duration: 50, useNativeDriver: false }),
        ]),
      ]).start();
    }
  }, [conquestFlashes.length]);

  // ── Capture crossfade state ───────────────────────────────────────────────
  const prevOwnersRef = useRef<Map<number, 0|1|2>>(new Map());
  const captureTransRef = useRef<Map<number, { prevOwner: 0|1|2; t: number }>>(new Map());

  // ── Empire helpers ────────────────────────────────────────────────────────
  const empireOf = (owner: 0|1|2): EmpireConfig | null => {
    if (owner === 1) return playerEmpire ?? null;
    if (owner === 2) return aiEmpire ?? null;
    return null;
  };
  const effectiveColor = (owner: 0|1|2): string => empireOf(owner)?.nodeColor ?? ownerColor(owner);
  const effectiveGlow  = (owner: 0|1|2): string => empireOf(owner)?.glowRgb ?? ownerGlow(owner);
  const effectiveGlowDark = (owner: 0|1|2): string => empireOf(owner)?.glowDarkRgb ?? ownerGlowDark(owner);
  const effectiveStone = (owner: 0|1|2): string => empireOf(owner)?.accentColor ?? ownerStone(owner);
  const effectiveUnitColor = (owner: 0|1|2): string => empireOf(owner)?.unitColor ?? ownerColor(owner);

  const getPlanetAt = useCallback((x: number, y: number) =>
    planetsRef.current.find(p => Math.hypot(p.x - x, p.y - y) < p.radius + HIT_EXTRA), []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        moveRef.current(x, y);
        if (allSelectedRef.current) return;
        if (selIdRef.current === null) {
          const planet = getPlanetAt(x, y);
          if (planet?.owner === 1) selectRef.current(planet.id);
        }
      },
      onPanResponderMove: e => moveRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: e => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (allSelectedRef.current) {
          const target = getPlanetAt(x, y);
          if (target && target.owner !== 1) { sendAllRef.current(target.id); clearAllRef.current(); }
          return;
        }
        const selId = selIdRef.current;
        const target = getPlanetAt(x, y);
        if (selId !== null) {
          if (target && target.id !== selId) {
            sendRef.current(selId, target.id);
            selectRef.current(target.owner === 1 ? target.id : null);
          } else if (!target) {
            selectRef.current(null);
          } else {
            selectRef.current(null);
          }
        } else {
          if (!target || target.owner !== 1) selectRef.current(null);
        }
      },
      onPanResponderTerminate: () => { selectRef.current(null); },
    })
  ).current;

  const playerPlanets = planets.filter(p => p.owner === 1);
  const visiblePlanets = planets.filter(p => p.owner === 1 || isVisible(p.x, p.y, playerPlanets));
  const ghostPlanets = planets.filter(
    p => p.owner !== 1 && !isVisible(p.x, p.y, playerPlanets) && isGhost(p.x, p.y, playerPlanets)
  );
  const selectedPlanet = planets.find(p => p.id === selectedPlanetId);

  const now = Date.now();
  const dashOffset = -((now / 38) % 15);
  const selectPulse = 1 + 0.18 * Math.sin(now / 190);
  const warnPulse = 1 + 0.14 * Math.sin(now / 145);
  const atmospherePulse = 1 + 0.04 * Math.sin(now / 2200);

  // Detect owner changes → start crossfade
  planets.forEach(p => {
    const prev = prevOwnersRef.current.get(p.id);
    if (prev !== undefined && prev !== p.owner) {
      captureTransRef.current.set(p.id, { prevOwner: prev, t: 0 });
    }
    prevOwnersRef.current.set(p.id, p.owner);
  });
  captureTransRef.current.forEach((trans, id) => {
    trans.t = Math.min(1, trans.t + (1 / 60) * 2.0);
    if (trans.t >= 1) captureTransRef.current.delete(id);
  });

  // Fog blob positions
  // Fog drift — 1.5× speed (time divisors ÷ 1.5)
  const fog1x = width * 0.28 + 55 * Math.sin(now / 6133);
  const fog1y = height * 0.38 + 38 * Math.cos(now / 7867);
  const fog2x = width * 0.71 + 48 * Math.cos(now / 8267);
  const fog2y = height * 0.62 + 44 * Math.sin(now / 5867);
  const fog3x = width * 0.50 + 60 * Math.sin(now / 7067 + 2.1);
  const fog3y = height * 0.22 + 32 * Math.cos(now / 6533 + 1.4);
  const fog4x = width * 0.15 + 40 * Math.sin(now / 8733 + 0.8);
  const fog4y = height * 0.70 + 35 * Math.cos(now / 6867 + 2.5);

  const DOT_SPACING = 44;
  const dotGrid = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let gx = DOT_SPACING; gx < width; gx += DOT_SPACING) {
      for (let gy = DOT_SPACING; gy < height; gy += DOT_SPACING) {
        dots.push({ x: gx, y: gy });
      }
    }
    return dots;
  }, [Math.floor(width / DOT_SPACING), Math.floor(height / DOT_SPACING)]);

  const hoveredPlanet = (selectedPlanetId !== null || allSelected)
    ? planets.find(p =>
        (allSelected ? p.owner !== 1 : p.id !== selectedPlanetId) &&
        Math.hypot(p.x - pointerPos.x, p.y - pointerPos.y) < p.radius + HIT_EXTRA
      )
    : undefined;

  const previewUnits = selectedPlanet
    ? Math.max(1, Math.floor(selectedPlanet.units * (state.fleetPercent / 100))) : 0;
  const underAttackIds = new Set(fleets.filter(f => f.owner === 2).map(f => f.toId));
  const showTargeting = pointerPos.x > 4 || pointerPos.y > 4;

  return (
    <Animated.View style={{ width, height, transform: [{ translateX: shakeX }, { translateY: shakeY }] }}>
      <Svg
        width={width} height={height}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' } as any]}
      >
        <Defs>
          {visiblePlanets.map(p => (
            <RadialGradient key={`rg${p.id}`} id={`rg${p.id}`} cx="40%" cy="40%" r="60%">
              <Stop offset="0%"   stopColor={effectiveColor(p.owner)} stopOpacity="0.35" />
              <Stop offset="60%"  stopColor={effectiveColor(p.owner)} stopOpacity="0.09" />
              <Stop offset="100%" stopColor={effectiveColor(p.owner)} stopOpacity="0" />
            </RadialGradient>
          ))}
          {fleets.map(fleet => {
            const gc = effectiveColor(fleet.owner as 0|1|2);
            return (
              <RadialGradient key={`fg${fleet.id}`} id={`fg${fleet.id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor={gc} stopOpacity="0.90" />
                <Stop offset="50%"  stopColor={gc} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={gc} stopOpacity="0" />
              </RadialGradient>
            );
          })}
          {/* Vignette gradient — dark edges, lighter center */}
          <RadialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <Stop offset="0%"   stopColor="#000000" stopOpacity="0" />
            <Stop offset="70%"  stopColor="#000000" stopOpacity="0" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.52" />
          </RadialGradient>
        </Defs>

        {/* ─── Terrain features ─── */}
        {[
          { x: width*0.12, y: height*0.28, r: 9,  color: '55,42,28',  a: 0.28 },
          { x: width*0.14, y: height*0.30, r: 6,  color: '50,38,25',  a: 0.22 },
          { x: width*0.84, y: height*0.33, r: 11, color: '55,42,28',  a: 0.26 },
          { x: width*0.87, y: height*0.31, r: 7,  color: '48,36,22',  a: 0.20 },
          { x: width*0.38, y: height*0.80, r: 8,  color: '52,40,26',  a: 0.24 },
          { x: width*0.40, y: height*0.82, r: 5,  color: '50,38,24',  a: 0.18 },
          { x: width*0.65, y: height*0.14, r: 10, color: '55,42,28',  a: 0.24 },
          { x: width*0.62, y: height*0.16, r: 6,  color: '48,36,22',  a: 0.18 },
          { x: width*0.06, y: height*0.48, r: 22, color: '20,40,18',  a: 0.40 },
          { x: width*0.09, y: height*0.46, r: 14, color: '18,36,16',  a: 0.30 },
          { x: width*0.94, y: height*0.52, r: 20, color: '20,40,18',  a: 0.38 },
          { x: width*0.92, y: height*0.55, r: 13, color: '18,34,16',  a: 0.28 },
          { x: width*0.50, y: height*0.06, r: 18, color: '20,38,16',  a: 0.34 },
          { x: width*0.48, y: height*0.09, r: 11, color: '18,36,15',  a: 0.24 },
          { x: width*0.52, y: height*0.94, r: 16, color: '20,38,16',  a: 0.32 },
        ].map((t, i) => (
          <Circle key={`terr${i}`} cx={t.x} cy={t.y} r={t.r}
            fill={`rgba(${t.color},${t.a})`} />
        ))}

        {/* ─── Star sparkles ─── */}
        {STAR_POSITIONS.map((sp, i) => {
          const twinkle = 0.5 + 0.5 * Math.sin(now / (1200 + i * 337) + i * 2.1);
          const r = 1 + (i % 2) * 0.8;
          return (
            <Circle key={`star${i}`} cx={sp.x * width} cy={sp.y * height}
              r={r} fill="rgba(255,240,200,1)" opacity={twinkle * 0.48} />
          );
        })}

        {/* ─── Dot grid ─── */}
        {dotGrid.map((d, i) => (
          <Circle key={`dg${i}`} cx={d.x} cy={d.y} r={0.7} fill="rgba(255,230,130,0.05)" />
        ))}

        {/* ─── Fog layer ─── */}
        {fog1x + 220 > 0 && fog1x - 220 < width && <Ellipse cx={fog1x} cy={fog1y} rx={220} ry={130} fill="rgba(80,110,60,0.04)" />}
        {fog1x + 185 > 0 && fog1x - 185 < width && <Ellipse cx={fog1x + 35} cy={fog1y - 22} rx={150} ry={88} fill="rgba(90,120,55,0.03)" />}
        {fog2x + 260 > 0 && fog2x - 260 < width && <Ellipse cx={fog2x} cy={fog2y} rx={260} ry={148} fill="rgba(60,90,45,0.04)" />}
        {fog3x + 190 > 0 && fog3x - 190 < width && <Ellipse cx={fog3x} cy={fog3y} rx={190} ry={112} fill="rgba(100,120,65,0.034)" />}
        {fog4x + 200 > 0 && fog4x - 200 < width && <Ellipse cx={fog4x} cy={fog4y} rx={200} ry={118} fill="rgba(70,100,55,0.038)" />}

        {/* ─── Ghost castles ─── */}
        {ghostPlanets.map(p => {
          const nearestDist = Math.min(...playerPlanets.map(pp => Math.hypot(pp.x - p.x, pp.y - p.y)));
          const fade = 1 - (nearestDist - FOG_RADIUS) / (GHOST_RADIUS - FOG_RADIUS);
          const opacity = Math.max(0, Math.min(0.14, fade * 0.14));
          return (
            <G key={`ghost${p.id}`}>
              <Path d={castleOutlinePath(p.x, p.y, p.radius * 0.7)}
                fill={effectiveColor(p.owner)} opacity={opacity} />
            </G>
          );
        })}

        {/* ─── Fleet arcs ─── */}
        {fleets.map(fleet => {
          const from = planets.find(p => p.id === fleet.fromId);
          const to = planets.find(p => p.id === fleet.toId);
          if (!from || !to) return null;
          const { cx: cpx, cy: cpy } = bezierControlPoint(from.x, from.y, to.x, to.y, fleet.arc);
          const glow = effectiveGlow(fleet.owner as 0|1|2);
          return (
            <Path key={`arc${fleet.id}`}
              d={bezierPathStr(from.x, from.y, cpx, cpy, to.x, to.y)}
              stroke={`rgba(${glow},0.07)`} strokeWidth={1.5} fill="none"
              strokeDasharray="5 10"
            />
          );
        })}

        {/* ─── Single-select targeting line ─── */}
        {selectedPlanet && showTargeting && (
          <G>
            <Line x1={selectedPlanet.x} y1={selectedPlanet.y} x2={pointerPos.x} y2={pointerPos.y}
              stroke="rgba(255,200,30,0.14)" strokeWidth={14} strokeLinecap="round" />
            <Line x1={selectedPlanet.x} y1={selectedPlanet.y} x2={pointerPos.x} y2={pointerPos.y}
              stroke="#FFCC22" strokeWidth={2.2} strokeDasharray="10 7"
              strokeDashoffset={dashOffset} opacity={0.9} />
            <Polygon
              points={arrowheadPoints(selectedPlanet.x, selectedPlanet.y, pointerPos.x, pointerPos.y)}
              fill="#FFCC22" opacity={0.95} />
            {previewUnits > 0 && (
              <G>
                <Circle cx={pointerPos.x + 20} cy={pointerPos.y - 18} r={14}
                  fill="rgba(20,12,4,0.92)" stroke="#FFCC22" strokeWidth={1.5} />
                <SvgText x={pointerPos.x + 20} y={pointerPos.y - 13}
                  textAnchor="middle" fontSize={10} fontWeight="bold" fill="#FFCC22">
                  {previewUnits}
                </SvgText>
              </G>
            )}
          </G>
        )}

        {/* ─── ALL-select targeting lines ─── */}
        {allSelected && showTargeting && playerPlanets.map((planet, i) => (
          <G key={`al${planet.id}`}>
            <Line x1={planet.x} y1={planet.y} x2={pointerPos.x} y2={pointerPos.y}
              stroke="rgba(255,200,30,0.1)" strokeWidth={10} strokeLinecap="round" />
            <Line x1={planet.x} y1={planet.y} x2={pointerPos.x} y2={pointerPos.y}
              stroke="#FFCC22" strokeWidth={1.8} strokeDasharray="10 7"
              strokeDashoffset={dashOffset - i * 5} opacity={0.6} />
          </G>
        ))}
        {allSelected && showTargeting && playerPlanets.length > 0 && (
          <G>
            <Polygon
              points={arrowheadPoints(pointerPos.x, pointerPos.y - 30, pointerPos.x, pointerPos.y)}
              fill="#FFCC22" opacity={0.92} />
            <Circle cx={pointerPos.x + 20} cy={pointerPos.y - 18} r={16}
              fill="rgba(20,12,4,0.92)" stroke="#FFCC22" strokeWidth={1.5} />
            <SvgText x={pointerPos.x + 20} y={pointerPos.y - 12}
              textAnchor="middle" fontSize={9} fontWeight="bold" fill="#FFCC22">
              ALL
            </SvgText>
          </G>
        )}

        {/* ─── Conquest flashes — 3 rings staggered 80ms apart ─── */}
        {conquestFlashes.map(cf => {
          const empireColor = effectiveColor(cf.owner);
          const rings = [
            { tOffset: 0,     maxR: 72, sw: 4,   opScale: 0.88 },
            { tOffset: -0.13, maxR: 96, sw: 2.5, opScale: 0.55 },
            { tOffset: -0.26, maxR: 58, sw: 1.5, opScale: 0.35 },
          ];
          const baseEased = 1 - Math.pow(1 - cf.t, 2);
          return (
            <G key={cf.id}>
              {rings.map((ring, ri) => {
                const rt = Math.max(0, cf.t + ring.tOffset);
                const eased = 1 - Math.pow(1 - rt, 2);
                const rr = 12 + eased * ring.maxR;
                const op = Math.max(0, 1 - rt) * ring.opScale;
                if (op <= 0.01) return null;
                return (
                  <Circle key={ri} cx={cf.x} cy={cf.y} r={rr} fill="none"
                    stroke={empireColor} strokeWidth={ring.sw - rt * (ring.sw * 0.7)}
                    opacity={op} />
                );
              })}
              {/* Center fill burst */}
              <Circle cx={cf.x} cy={cf.y} r={10 + baseEased * 40}
                fill={empireColor} opacity={Math.max(0, 0.22 - cf.t * 0.22)} />
            </G>
          );
        })}

        {/* ─── Impact flashes ─── */}
        {impactFlashes.map(inf => {
          const eased = 1 - Math.pow(1 - inf.t, 3);
          const r = 6 + eased * 24;
          const opacity = Math.max(0, 1 - inf.t);
          return (
            <G key={inf.id}>
              <Circle cx={inf.x} cy={inf.y} r={r} fill="none"
                stroke="rgba(255,240,160,0.95)" strokeWidth={2.5 - inf.t * 2} opacity={opacity} />
              <Circle cx={inf.x} cy={inf.y} r={r * 0.55}
                fill="rgba(255,240,160,0.25)" opacity={opacity * 0.6} />
            </G>
          );
        })}

        {/* ─── Castle / Empire nodes ─── */}
        {visiblePlanets.map(planet => {
          const nodeEmp = empireOf(planet.owner);
          const color = effectiveColor(planet.owner);
          const glow  = effectiveGlow(planet.owner);
          const glowDark = effectiveGlowDark(planet.owner);
          const stone = effectiveStone(planet.owner);
          const r = planet.radius;
          const isSelected = planet.id === selectedPlanetId || (allSelected && planet.owner === 1);
          const isHovered = hoveredPlanet?.id === planet.id;
          const isUnderAttack = underAttackIds.has(planet.id) && planet.owner === 1;

          const breathPhase = Math.sin((now / 1400) + planet.id * 0.72);
          const glowHaloR = r * (1.625 + 0.09 * breathPhase) * atmospherePulse;
          const breathScale = 0.97 + 0.03 * (1 + Math.sin(now / 318 + planet.id * 0.72));
          const selGlowOpacity = isSelected ? 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(now / 159)) : 0;

          const shimmerT = ((now / 1700) + planet.id * 0.41) % 1;
          const showShimmer = shimmerT < 0.5 && planet.owner !== 0;
          const shimmerR = r + shimmerT * 14;
          const shimmerOpacity = 0.42 * Math.sin(shimmerT * Math.PI);

          const nearImpact = impactFlashes.find(inf =>
            Math.hypot(inf.x - planet.x, inf.y - planet.y) < r + 18
          );
          const shakeAmt = nearImpact ? 2.8 * (1 - nearImpact.t) : 0;
          const shakeAngle = nearImpact ? nearImpact.t * Math.PI * 10 : 0;
          const px = planet.x + Math.cos(shakeAngle) * shakeAmt;
          const py = planet.y + Math.sin(shakeAngle) * shakeAmt * 0.6;

          const capTrans = captureTransRef.current.get(planet.id);
          const prevColor = capTrans ? effectiveColor(capTrans.prevOwner) : null;
          const bodyOpacity = capTrans ? capTrans.t : 1;

          // Node shape and flag — empire-specific or default castle
          const nodeShapeId = nodeEmp?.nodeShape;
          const nodePath = nodeShapeId === 'pyramid' ? pyramidPath(px, py, r)
            : nodeShapeId === 'colosseum' ? colosseumPath(px, py, r)
            : nodeShapeId === 'yurt'      ? yurtPath(px, py, r)
            : nodeShapeId === 'sphinx'    ? sphinxPath(px, py, r)
            : castleOutlinePath(px, py, r);
          const isColosseum = nodeShapeId === 'colosseum';
          const { pole, flag: flagPts } = nodeEmp
            ? empireNodeFlag(px, py, r, nodeEmp.nodeShape)
            : castleKeepFlag(px, py, r);
          const garrisonY = nodeShapeId === 'pyramid'   ? py + r * 0.12 + 5
            : nodeShapeId === 'colosseum' ? py + r * 0.08 + 5
            : nodeShapeId === 'yurt'      ? py + r * 0.14 + 5
            : nodeShapeId === 'sphinx'    ? py - r * 0.08 + 5
            : py - r * 0.48 + 4;

          const arcR = r + 6;
          const arcCircumf = 2 * Math.PI * arcR;
          const arcFill = Math.min(1, planet.units / 99);
          const arcDash = arcFill * arcCircumf;
          const arcOffset = arcCircumf * 0.25;

          return (
            <G key={planet.id}>
              {/* Breathing outer halo */}
              <Circle cx={px} cy={py} r={glowHaloR} fill={`url(#rg${planet.id})`} />

              {/* Garrison strength arc track */}
              <Circle cx={px} cy={py} r={arcR} fill="none"
                stroke={`rgba(${glow},0.10)`} strokeWidth={2} />
              {/* Garrison strength arc fill */}
              {arcFill > 0.01 && (
                <Circle cx={px} cy={py} r={arcR} fill="none"
                  stroke={`rgba(${glow},0.60)`} strokeWidth={2}
                  strokeDasharray={`${arcDash.toFixed(1)} ${arcCircumf.toFixed(1)}`}
                  strokeDashoffset={arcOffset.toFixed(1)}
                  strokeLinecap="round" />
              )}

              {/* Unit generation shimmer ring */}
              {showShimmer && (
                <Circle cx={px} cy={py} r={shimmerR} fill="none"
                  stroke={`rgba(${glow},${shimmerOpacity.toFixed(2)})`} strokeWidth={1.8} />
              )}

              {/* Incoming attack warning */}
              {isUnderAttack && (
                <>
                  <Circle cx={px} cy={py} r={(r + 20) * warnPulse}
                    fill="none" stroke="rgba(238,100,0,0.65)" strokeWidth={2.5} />
                  <Circle cx={px} cy={py} r={r + 9}
                    fill="none" stroke="rgba(238,80,0,0.3)" strokeWidth={1.5}
                    strokeDasharray="4 5" strokeDashoffset={-dashOffset} />
                </>
              )}

              {/* Hover ring */}
              {isHovered && (
                <>
                  <Circle cx={px} cy={py} r={r + 22}
                    fill="none" stroke="rgba(255,210,40,0.65)" strokeWidth={2.5} />
                  <Circle cx={px} cy={py} r={r + 30 + 3 * Math.sin(now / 130)}
                    fill="none" stroke="rgba(255,200,30,0.22)" strokeWidth={1.5} />
                </>
              )}

              {/* Selection rings */}
              {isSelected && (
                <>
                  <Circle cx={px} cy={py} r={r + 36} fill="rgba(255,200,30,0.06)" />
                  <Circle cx={px} cy={py} r={(r + 28) * selectPulse}
                    fill="none"
                    stroke={allSelected ? 'rgba(255,210,40,0.70)' : 'rgba(255,210,40,0.55)'}
                    strokeWidth={allSelected ? 3 : 2.5} />
                  <Circle cx={px} cy={py} r={r + 14}
                    fill="none" stroke="#FFCC22" strokeWidth={2}
                    strokeDasharray="7 4" strokeDashoffset={dashOffset * 1.4} opacity={0.9} />
                </>
              )}

              {/* Owner-color pulsing glow ring */}
              {isSelected && (
                <Circle cx={px} cy={py} r={r + 46}
                  fill="none" stroke={color} strokeWidth={3} opacity={selGlowOpacity} />
              )}

              {/* ── Node body (breathing scale 0.97→1.03) ── */}
              <G transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) scale(${breathScale.toFixed(4)}) translate(${(-px).toFixed(1)},${(-py).toFixed(1)})`}>
                {/* Body — crossfade on capture */}
                {prevColor && (
                  <Path d={nodePath} fill={prevColor} opacity={1 - bodyOpacity}
                    fillRule={isColosseum ? 'evenodd' : 'nonzero'} />
                )}
                <Path d={nodePath} fill={color} opacity={bodyOpacity}
                  fillRule={isColosseum ? 'evenodd' : 'nonzero'} />

                {/* Impact white flash (80ms) */}
                {nearImpact && nearImpact.t < 0.42 && (
                  <Path d={nodePath}
                    fill={`rgba(255,255,255,${Math.max(0, 0.72 * (1 - nearImpact.t / 0.42)).toFixed(2)})`}
                    fillRule={isColosseum ? 'evenodd' : 'nonzero'} />
                )}

                {/* Stone outline */}
                <Path d={nodePath} fill="none" stroke={stone} strokeWidth={1.5} opacity={0.7}
                  fillRule={isColosseum ? 'evenodd' : 'nonzero'} />

                {/* Shadow shading */}
                <Circle cx={px + r * 0.32} cy={py - r * 0.28} r={r * 0.95}
                  fill={`rgba(${glowDark},0.45)`} />

                {/* Interior light glow */}
                <Circle cx={px} cy={py - r * 0.35} r={r * 0.10}
                  fill="rgba(255,170,50,0.88)" />

                {/* Flag pole and pennant */}
                <Path d={pole} stroke={stone} strokeWidth={1.5} opacity={0.9} />
                <Polygon points={flagPts} fill={color} opacity={0.95} />

                {/* Garrison count */}
                <SvgText x={px} y={garrisonY}
                  textAnchor="middle" fontSize={11} fontWeight="bold"
                  fill="#FFFFFF" opacity={0.95}>
                  {Math.floor(planet.units)}
                </SvgText>
              </G>
            </G>
          );
        })}

        {/* ─── Army fleets ─── */}
        {fleets.map(fleet => {
          const from = planets.find(p => p.id === fleet.fromId);
          const to = planets.find(p => p.id === fleet.toId);
          if (!from || !to) return null;
          const { x: fx, y: fy, angle, cx: cpx, cy: cpy } = fleetPos(fleet, from, to);
          const fleetEmpire = empireOf(fleet.owner as 0|1|2);
          const color = effectiveColor(fleet.owner as 0|1|2);
          const unitColor = effectiveUnitColor(fleet.owner as 0|1|2);
          const glow = effectiveGlow(fleet.owner as 0|1|2);

          const bobPhase = Math.sin((now / 200) + fleet.id * 1.42);
          const perpAngle = angle + Math.PI / 2;
          const bobAmt = bobPhase * 1.8;
          const bx = fx + Math.cos(perpAngle) * bobAmt;
          const by = fy + Math.sin(perpAngle) * bobAmt;

          const trailOffsets = [0.03, 0.07, 0.12, 0.18, 0.25, 0.33];
          const unitSz = 7;
          const trailPoints = trailOffsets.map((offset, i) => ({
            pt: bezierPoint(Math.max(0, fleet.progress - offset), from.x, from.y, cpx, cpy, to.x, to.y),
            i,
          }));

          const aheadT = Math.min(1, fleet.progress + 0.06);
          const ahead = bezierPoint(aheadT, from.x, from.y, cpx, cpy, to.x, to.y);

          const perpX = -Math.sin(angle) * 14;
          const perpY = Math.cos(angle) * 14;

          return (
            <G key={fleet.id}>
              {/* Dust trail — wider, more visible */}
              {trailPoints.map(({ pt, i }) => (
                <Circle key={i} cx={pt.x} cy={pt.y}
                  r={Math.max(0.6, unitSz * (1 - i * 0.12))}
                  fill={`rgba(${glow},${Math.max(0, 0.50 - i * 0.082).toFixed(2)})`} />
              ))}

              {/* Approach sparkle */}
              <Circle cx={ahead.x} cy={ahead.y} r={10} fill={`rgba(${glow},0.10)`} />

              {/* Radial glow rings */}
              <Circle cx={bx} cy={by} r={26} fill={`url(#fg${fleet.id})`} />
              <Circle cx={bx} cy={by} r={15} fill={`url(#fg${fleet.id})`} />

              {/* Empire-specific unit body */}
              {fleetEmpire?.unitShape === 'scarab'  && renderScarabUnit(bx, by, angle, 7, unitColor)}
              {fleetEmpire?.unitShape === 'shield'  && renderShieldUnit(bx, by, angle, 7, unitColor)}
              {fleetEmpire?.unitShape === 'horse'   && renderHorseUnit(bx, by, angle, 7, unitColor)}
              {fleetEmpire?.unitShape === 'ankh'    && renderAnkhUnit(bx, by, 7, unitColor)}
              {!fleetEmpire && <Polygon points={troopPolygon(bx, by, angle, 7)} fill={color} />}

              {/* Pennant flag */}
              <Polygon points={fleetFlagPoints(bx, by, angle, 7)} fill={color} opacity={0.9} />

              {/* Unit count badge */}
              <Circle cx={bx + perpX} cy={by + perpY} r={10}
                fill="rgba(8,6,2,0.75)" stroke={color} strokeWidth={1} />
              <SvgText x={bx + perpX} y={by + perpY + 3.5}
                textAnchor="middle" fontSize={9} fontWeight="bold"
                fill={color} opacity={0.95}>
                {fleet.units}
              </SvgText>
            </G>
          );
        })}

        {/* ─── Battle particles (empire-colored) ─── */}
        {particles.map(p => {
          const rgb = p.owner === 1 ? effectiveGlow(1)
                    : p.owner === 2 ? effectiveGlow(2)
                    : p.color;
          return (
            <Circle key={p.id} cx={p.x} cy={p.y}
              r={2.5 + (p.id % 3) * 0.8}
              fill={`rgba(${rgb},${Math.max(0, p.alpha).toFixed(2)})`} />
          );
        })}

        {/* ─── Vignette overlay (dark edges, lighter center) ─── */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.touchLayer]} {...panResponder.panHandlers} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  touchLayer: { backgroundColor: 'transparent' },
});
