# Dogfight — Lab 02: Objects, Prototypes, and `this`

A ship you fly and shoot on a canvas, driven by a fixed-timestep simulation (60 steps/s) and rendered
with interpolation. Lab 01 (loop, input, experiments) is unchanged; Lab 02 adds the entity model.

## Run

```bash
npm install
npm run dev      # open the printed URL (http://localhost:5173)
npm run lint
npm run build
```

Controls: `←` / `→` (or `A` / `D`) rotate, `↑` (or `W`) thrust, `Space` or mouse click to fire.
Pickups: **S** shield, **R** rapid fire, **H** homing bullets. Red asteroids are homing hunters.

`npm run smoke` runs headless checks of the sim; `?bug=1` demonstrates the `this` bug below.

## Structure

```txt
src/main.js           wires everything, experiment switches via URL
src/loop.js           createLoop({ step, simulate, render }) — rAF + clamped accumulator
src/input.js          createInput() — closure over key state (isDown, justPressed)
src/sim/vector.js     Vector2 (pure methods, *InPlace variants)
src/sim/entity.js     Entity base (private static #id counter, behaviors list)
src/sim/ship.js       Ship extends Entity (#hp, fire, pickups); integrate() kept for the lab-01 script
src/sim/bullet.js     Bullet (TTL) · asteroid.js · pickup.js · explosion.js — each extends Entity
src/sim/behaviors.js  homing() — composed behavior, attachable to any entity
src/sim/world.js      World: Map store, iterable, *ofKind, deferred sweep, collision rules, respawn
src/sim/collision.js  findCollisions(world) -> (a, b) pairs, naive O(n^2), swappable
src/sim/arena.js      wrap / bounce
src/render/canvas.js  DPR-aware, resizable canvas
src/render/draw.js    lerp/lerpAngle, background, drawWorld (all kinds), HUD
scripts/smoke.mjs     headless checks for Lab 02
scripts/determinism.mjs   offline illustration of experiment 3
```

## Ship tuning

| Constant    | Value | Why                                                      |
| ----------- | ----- | -------------------------------------------------------- |
| `TURN_RATE` | 3.5   | ~0.6 turn/s: responsive without being twitchy            |
| `ACCEL`     | 320   | reaches useful speed in ~1.5 s                           |
| `DRAG`      | 0.7   | ship slowly glides to a stop instead of drifting forever |
| `MAX_SPEED` | 420   | stops the ship from crossing the arena in under 3 s      |

## Design notes

- **Loop**: `requestAnimationFrame` + accumulator; frame delta is clamped to 0.25 s so a long hitch
  never causes a spiral of death. `render` receives `alpha = accumulator / step`.
- **Interpolation**: `previous` and `current` ship states are copied each step; the renderer draws at
  `lerp(previous, current, alpha)`, angle via shortest-arc `lerpAngle`. When the ship wraps around the
  arena, interpolation on that axis is skipped to avoid a streak across the screen.
- **Input**: closure over two private `Set`s; `justPressed` stays true until `endStep()` (called after
  every simulation step).
- **Sim** has no DOM/canvas dependency and is a pure function of state + input + dt.

## Lab 02 notes

### The `this` bug

`canvas.addEventListener("click", ship.fire)` passes the function, not the call. The browser calls the
listener with `this` = the canvas, so `fire` no longer sees the ship (`?bug=1` reproduces it; `fire()`
throws a `TypeError` on purpose). Fixes:

| Fix                                  | Downside                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| `() => world.player.fire()` (chosen) | none here; also picks up the _new_ ship after a respawn           |
| `ship.fire.bind(ship)`               | permanently bound to the old ship; a new bound copy per call site |
| `fire = () => {…}` class field       | one arrow function per instance (memory), not on the prototype    |

### Design: composition instead of a deep hierarchy

Inheritance is one level: `Ship`, `Bullet`, `Asteroid`, `Pickup`, `Explosion` all `extends Entity`.
Anything extra is a **behavior object** in `entity.behaviors` (`{ update(entity, dt, world) }`), run by
`Entity.update` before the entity moves.

- **Homing**: `homing({ seek, turnRate })` is attached to a player bullet (seeks asteroids, from the
  homing pickup) and to some asteroids (seek the ship). With inheritance this needs
  `Entity → Moving → Homing → HomingBullet` _and_ `HomingAsteroid`, duplicating `Homing` under
  `Bullet` and `Asteroid`, or a `HomingMixin` hack; with composition it is one function and
  `push`.
- **Pickup**: stationary and collidable but not a ship, so it must not inherit `Ship` or `Moving`.
  It is a plain `Entity` carrying an `effect` string; durations live in a data table (`EFFECTS`) and
  the ship maps effect → timer. A new pickup is one table row, not a new class.
- **Kept as classes**: `Ship`, `Bullet` etc. stay as one-level subclasses because they have real
  state (`#hp`, TTL, cooldown). Behaviors cover what varies _across_ kinds.

Trade-off: behaviors are looked up per entity at runtime (a loop over a short array), slightly slower
than a method call, and ordering between behaviors matters. Fine at this scale; revisit in Lab 7.

## Experiments (M4 of Lab 01)

HUD shows steps/s, frames/s, frame time and jitter (σ of frame time over the last second).
Switches are URL parameters, so no code edits are needed:

| Experiment | URL                                           |
| ---------- | --------------------------------------------- |
| baseline   | `http://localhost:5173/`                      |
| 1 busy     | `http://localhost:5173/?busy=1`               |
| 2 interval | `http://localhost:5173/?loop=interval`        |
| 3 variable | `http://localhost:5173/?step=variable&auto=1` |
| 3 fixed    | `http://localhost:5173/?auto=1`               |
