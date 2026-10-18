# Highway to Dhyāna 3D

A Three.js rebuild of *Highway to Dhyāna* (from The Self-Driving Mind). The quiz, the three drive stages
(Manual → Lane assist → FSD), the three modes, the Awareness Pulse, sensors, demo mode and sharing all carry over
from the original single-file game. The road, car, gates, vṛttis and scenery are now real 3D.

## Campaign

Three chapters, one per question tier: **The Restless City** (Guindy, sunset city), **Mud on the Lens**
(monsoon highway with rain, lightning, drifting worries and mud puddles) and **Neti Neti** (desert road to
Sacramento with late-appearing mirages the autopilot cannot see). Each chapter: clear 4 toll gates, then a boss
looms over the road and you must win 2 of its 3 crimson boss gates. Stars: 3 for no wrong gates, 2 for one,
1 otherwise. Progress and stars are saved per difficulty in localStorage (`htd-camp-<mode>`). Free drive is the
original endless game.

## 2 players (split screen)

A local race on one road: same vṛttis, same 8 toll gates, one of the three chapter roads. Landscape screens split
left/right, portrait screens split top/bottom. Each player has their own lane, sensors, calm palette, drive stage,
score and pulse. A vṛtti you hit or pulse vanishes only from your view, and the rival's car shows as a ghost.
The difficulty applies to both (in Challenge/Mastery a player can be knocked out). Most gates wins; score breaks ties.

- Keyboard: P1 `A`/`D` steer, `W` pulse. P2 `←`/`→` steer, `↑` pulse. `P`/`Esc` pause.
- Gamepads (standard mapping): first pad is P1, second is P2. D-pad or left stick steers, `A`/`X`/bumpers pulse,
  Start pauses. On menus the d-pad moves focus, `A` confirms and `B` goes back.
- Touch: tap or swipe inside your own half.

Split screen draws one scene into two viewports without bloom; single player keeps bloom.

## Secret perpetual demo

An endless attract loop for a booth screen, a kiosk or recording footage. Bots play the three chapters (bosses
included), a split-screen race on a random road, then free drive to Dhyāna and a calm FSD cruise, then repeat.
They sometimes pick wrong gates, so lessons and wrecks show too. Visitor input is ignored, nothing is clickable,
the cursor is hidden, and campaign stars and best scores are never touched.

- Start or stop: type `dhyana` anywhere. On touch screens, hold the title for 3 s to start, and hold the
  top-left corner for 3 s to stop.
- Link: `?perpetual` starts it; add `&clean` to hide the brand line (for footage).
- It survives reloads and kiosk reboots until you stop it, and reloads itself if it ever hits repeated errors.

The old one-run demo is still there: type `demo` on the start screen (or tap the title 5 times).

## Run it

No install needed. **Double-click `Play.cmd`**: it starts a small local server and opens the game in your browser
(keep its window open while playing). Or from this folder:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8173. Opening index.html directly won't work, because browsers block module scripts on
`file://` pages; the page now says so instead of hanging on "Loading the road…".

Add `?debug` to the URL to get `window.__htd.step(frames)` for stepping the simulation by hand.

## Layout

| File | What it owns |
|---|---|
| `js/data.js` | Questions, vṛtti words, billboards, modes, track constants |
| `js/campaign.js` | The three chapters: theme, hazards mix, gate goal, stage curve, speed, boss |
| `js/game.js` | Rules and state: spawning, gates, scoring, stages, autopilot, demo bot, game over / arrival |
| `js/versus.js` | Two-player race rules, per-player HUD and results |
| `js/gamepad.js` | Gamepad polling and edge-triggered steer/pulse/menu events |
| `js/world.js` | Three.js scene: sky, road, city that sinks as calm rises, lamps/trees/mountains that rise, gates, vṛttis, particles, chase camera, bloom |
| `js/car.js` | The extruded EV model and its under-glow mood |
| `js/fx.js` | 2D screen overlay: windshield smudge, golden wiper, mental static, flashes |
| `js/ui.js` | HUD and prompt DOM helpers |
| `js/audio.js` | Procedural Web Audio (engine, tanpura, bells) |
| `js/main.js` | Boot, input, overlays wiring, main loop |

`game.js` never touches Three.js; `world.js` reads game state each frame. That split is what makes later steps
(campaign chapters, local split screen with two `G.S` states and two cameras) straightforward.

Three.js 0.160 loads from jsDelivr via the import map in `index.html`.

The player cars are `models/sedan-sports.glb` (P1) and `models/race-future.glb` (P2) from the
[Kenney Car Kit](https://kenney.nl/assets/car-kit), CC0 public domain (see `models/LICENSE-kenney-car-kit.txt`).
If they fail to load, the game falls back to its built-in procedural car. Real-time shadows come from one
directional "moon" light whose shadow box follows the cars.
