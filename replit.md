# Galácticos — Fantasy Kingdom Conquest Mobile Game

## Project Overview
Expo/React Native mobile game — a fantasy kingdom strategy game where players drag from their castles to march armies against enemy and neutral strongholds, use a War Cry ability to double garrisons, and face a strategic AI opponent. Fully App Store-ready with dark forest theme, gold/amber fantasy UI, difficulty selection, tutorial, and win/loss tracking.

**Theme:** Fantasy Kingdom (Realm Conquest). Visual language: dark forest green background, amber/gold targeting, stone castle nodes, marching army fleets, parchment typography.  
**Factions:** Emerald Kingdom (player, `#44EE66`) vs Crimson Legion (enemy, `#EE3344`) vs Neutral Strongholds (`#BB9955`).

## Architecture

### Artifacts
- **`artifacts/mobile`** — Expo mobile app (main game)
- **`artifacts/api-server`** — Express API server (unused in current version)
- **`artifacts/mockup-sandbox`** — Vite component preview server (for canvas)

### Key Files
| File | Purpose |
|------|---------|
| `artifacts/mobile/app/index.tsx` | Root orchestrator — manages screens (start/tutorial/game) |
| `artifacts/mobile/app/_layout.tsx` | Expo Router layout with fonts + SafeAreaProvider |
| `artifacts/mobile/context/GameContext.tsx` | **Game engine** — mutable ref + RAF loop + AI |
| `artifacts/mobile/components/GameCanvas.tsx` | SVG rendering + PanResponder touch handling |
| `artifacts/mobile/components/OverlayPlanetLabels.tsx` | Unit count labels over planets |
| `artifacts/mobile/components/HUD.tsx` | TopHUD (planet counts + progress bar) + BottomHUD (fleet% + ability) |
| `artifacts/mobile/components/GameOverlay.tsx` | Win/loss overlay with stats |
| `artifacts/mobile/components/StartScreen.tsx` | Difficulty picker + logo + stats |
| `artifacts/mobile/components/TutorialOverlay.tsx` | 5-step first-run tutorial |
| `artifacts/mobile/components/StarField.tsx` | Animated background stars |
| `artifacts/mobile/hooks/useGameStorage.ts` | AsyncStorage: wins, losses, bestTime, streak, tutorialSeen |
| `artifacts/mobile/constants/colors.ts` | Shared color palette |

## Visual Design

### Planet Rendering (SVG layers, inside out)
1. Radial gradient atmospheric halo (`r * 2.6`, slowly pulses with `atmospherePulse`)
2. Incoming attack warning rings (pulsing orange dashed rings on threatened player planets)
3. Hover target rings (animated double ring when drag is over this planet)
4. Selection rings (double pulsing dashed rings when selected / ALL mode)
5. Back orbital ring ellipse for planets r > 22 (behind body)
6. Planet body (solid color fill)
7. Dark hemisphere shadow (offset, two-layer) — 3D sphere depth
8. Terrain surface variation blobs for large planets
9. Inner glow on lit side
10. Primary + secondary specular highlight (two circles upper-left)
11. Front orbital ring ellipse (front half, using dasharray half-circle trick)
12. SVG Text unit count centered on planet

### Fleet Rendering (Bezier Curved Paths)
- Each fleet has `arc: number` — a random ±60-65px perpendicular midpoint offset
- Ships travel along a quadratic Bezier curve computed from `bezierPoint(t, from, control, to)`
- Ship orientation angle computed from `bezierTangentAngle` at each `t`
- Comet trail: 4 samples backwards along bezier at `t - [0.04, 0.08, 0.13, 0.20]`
- Trail dots fade in size and opacity toward the tail
- Engine glow: two concentric circles behind the nose
- Per-owner glow halo
- Fleet path arcs rendered as faint dashed SVG `<Path>` elements

### Targeting Line (when dragging)
- Wide glow shadow (10px, low opacity)
- Animated dashes (`strokeDashoffset = -Date.now()/40 % 15`)
- Arrowhead polygon at pointer tip

### Background
- 180 stars with 4 color tints, varied size/opacity
- 8 bright stars with radial halo
- 4 nebula blobs (large SVG radial gradients in dark blue/purple)

### Fleet Ships
- Unit count label rendered perpendicular to flight direction (above/beside ship)
- 3 engine trail dots behind ship with diminishing opacity
- Glow halo in owner color

### Conquest Ring Flash
- Expanding circle animates from planet radius → +55px over ~600ms
- Fades out with ease-out curve
- Color matches capturing owner (cyan for player, red for enemy)
- Stored in `conquestFlashes[]` inside `GameState`, ticked each frame

### Drag Preview
- Small cyan badge appears next to pointer showing unit count that would be sent
- Reads `fleetPercent` from state so it updates live as % changes

### Fog of War Ghost Dots
- Planets in GHOST_RADIUS (290px) but outside FOG_RADIUS (220px) render as tiny faint dots
- Opacity fades linearly from 0% at GHOST_RADIUS edge to 18% at FOG_RADIUS edge
- Only enemy/neutral planets get ghost dots (player always sees own planets)

### Touch System Fix
Two-layer approach in GameCanvas:
1. SVG renders below with `style.pointerEvents: 'none'` (no touch interception)
2. Transparent View on top receives all PanResponder events
- `locationX/Y` are in play-area local coords = same as planet coords ✓

## Game Engine Architecture

### Core Pattern: Mutable Ref + RAF + forceRender
- `gameRef.current` — mutable game state object mutated in-place each frame
- `requestAnimationFrame` loop calls `tick()` then `forceRender()` (useReducer counter)
- No stale closures: PanResponder callbacks stored in refs (`onSelectRef`, `onSendRef`, `onMoveRef`)
- No Redux/dispatch overhead — direct mutations for performance

### Coordinate System
- `GameCanvas` is a `flex:1` view between TopHUD and BottomHUD
- `onLayout` measures the play area, passes `width/height` to `setDimensions`
- Planet positions are in play area local space (0..playW × 0..playH)
- `PanResponder.locationX/Y` are relative to the play area view — matches planet coords exactly
- First `setDimensions` call regenerates planets in actual measured space

### Planet Ownership
- `owner: 0` = neutral (grey)
- `owner: 1` = player (green)
- `owner: 2` = AI (red)

### Fleet Sending
- Touch down on player planet → `selectedPlanetId` set
- Drag shows dashed targeting line from selected planet to pointer
- Release on target planet → `sendFleet(fromId, toId)` with current `fleetPercent`
- Fleet size: 25% / 50% / 75% selectable in BottomHUD

### AI Difficulty
| Level | Fire prob/frame | Threshold | Strategy |
|-------|----------------|-----------|---------|
| easy (Recruit) | 0.5% | 22 units | Random source + random target |
| medium (Commander) | 1.2% | 14 units | Strongest AI planet → weakest player/neutral |
| hard (Galáctico) | 2.4% | 8 units | Top 2 planets coordinate attacks; prefers closest attackable target; reinforces weak AI planets |

### Fog of War
- Fully visible: planets within `FOG_RADIUS` (220px) of any player planet
- Ghost dots: enemy/neutral planets within `GHOST_RADIUS` (290px) show as faint circles fading in at edge of fog
- Invisible: all planets beyond 290px

### Best Time Tracking
- `prevBestRef` in `GameView` snaps `stats.bestTimeMs` *before* calling `recordWin`
- `GameOverlay` receives `prevBestTimeMs` and shows "NEW BEST" only when `elapsedMs < prevBestTimeMs` (or first win)

## App Screens
1. **StartScreen** — Difficulty selection (Recruit/Commander/Galáctico), logo, lifetime stats
2. **TutorialOverlay** — 5-step bottom sheet (first-run only, AsyncStorage flag)
3. **Game** — TopHUD + Play Area + BottomHUD + optional overlays

## Dependencies
- `react-native-svg` — planet/fleet rendering
- `@react-native-async-storage/async-storage` — stats persistence
- `expo-haptics` — tactile feedback on buttons/sends
- `@expo/vector-icons` (Feather) — UI icons
- `@expo-google-fonts/inter` — Inter font family
- `react-native-safe-area-context` — notch/inset handling

## Platform Notes
- Web: `Platform.OS === 'web'` guards for top inset (67px) and bottom (34px)
- The shadow* deprecation warning on web is cosmetic and non-blocking
- Tested on web (Expo web preview)
