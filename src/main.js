import { createLoop } from "./loop.js";
import { createInput } from "./input.js";
import { World } from "./sim/world.js";
import { setupCanvas } from "./render/canvas.js";
import { drawBackground, drawHud, drawWorld, makeStars } from "./render/draw.js";

// Experiment switches (Lab 01, M4), set through the URL:
//   ?busy=1           experiment 1: 100 ms busy-wait in render every 60th frame
//   ?loop=interval    experiment 2: setInterval(frame, 16) instead of requestAnimationFrame
//   ?step=variable    experiment 3: no accumulator, simulate(dt) once per frame
//   ?auto=1           hold "thrust" automatically and report position after 5 s of sim time
//                     (asteroids and pickups are off so the result stays comparable)
// Lab 02:
//   ?bug=1            wire the click handler naively (ship.fire) to show the `this` bug
const params = new URLSearchParams(location.search);
const busy = params.has("busy");
const mode = params.get("loop") === "interval" ? "interval" : "raf";
const fixed = params.get("step") !== "variable";
const auto = params.has("auto");
const bug = params.has("bug");

const canvas = document.getElementById("game");
const { ctx, size } = setupCanvas(canvas);

const realInput = createInput(window);
const input = auto
  ? { isDown: (code) => code === "ArrowUp", justPressed: () => false, endStep() {} }
  : realInput;

const world = new World(size, { hazards: !auto });
world.start();

// `this` bug (README): handing over the method loses the ship, because the browser calls
// the listener with this = canvas. Also the player changes on respawn, so wrap in an arrow.
if (bug) canvas.addEventListener("click", world.player.fire);
else canvas.addEventListener("click", () => world.player.fire());

let stars = makeStars(140, size.w, size.h);
window.addEventListener("resize", () => {
  stars = makeStars(140, size.w, size.h);
});

let autoResult = null;
let frameCounter = 0;

const loop = createLoop({
  mode,
  fixed,
  simulate(dt) {
    world.step(dt, input);
    input.endStep();

    if (auto && autoResult === null && loop.stats.simTime + dt >= 5 - 1e-6) {
      const { x, y } = world.player.pos;
      autoResult = `x=${x.toFixed(3)} y=${y.toFixed(3)}`;
      console.log(
        `[auto] ${fixed ? "fixed" : "variable"} step, ${mode}: after ~5 s sim time -> ${autoResult}`,
      );
    }
  },
  render(alpha, stats) {
    frameCounter++;
    if (busy && frameCounter % 60 === 0) {
      const t = performance.now();
      while (performance.now() < t + 100) {
        // deliberate synchronous block (experiment 1)
      }
    }

    const p = world.player;
    drawBackground(ctx, size.w, size.h, stars);
    drawWorld(ctx, world, alpha, size);
    drawHud(ctx, stats, [
      `score: ${world.score}`,
      p.alive ? `hp: ${p.hp}` : `respawn in: ${world.respawnIn?.toFixed(1) ?? "-"} s`,
      `shield ${p.shield.toFixed(1)}  rapid ${p.rapid.toFixed(1)}  homing ${p.homingAmmo.toFixed(1)}`,
      `entities: ${world.count}`,
      ...(auto ? [`auto @5s: ${autoResult ?? "running..."}`] : []),
    ]);
  },
});

loop.start();
