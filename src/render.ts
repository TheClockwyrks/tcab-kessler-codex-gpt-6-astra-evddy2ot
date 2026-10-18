import type { RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import { RAD, polar, span, menuRect, type StateView } from "./model";
export const BACKGROUND = "#070e19";
const INK = "#e6f4f5",
  MUTED = "#6d8c9c",
  CYAN = "#91e3ec",
  GOLD = "#efbd7e";
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 14,
  color = INK,
  align: CanvasTextAlign = "left",
  weight = 400,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 18 ? "monospace" : "Arial, sans-serif"}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function arc(
  ctx: Context,
  r: number,
  start = 0,
  end = 360,
  color = MUTED,
  width = 1,
) {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, r, start * RAD, end * RAD);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function sector(
  ctx: Context,
  inner: number,
  outer: number,
  a: number,
  b: number,
) {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, outer, a * RAD, b * RAD);
  ctx.arc(C.STAGE_CX, C.STAGE_CY, inner, b * RAD, a * RAD, true);
  ctx.closePath();
}
function sprite(
  ctx: Context,
  s: StateView,
  path: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.drawImage(s.assets.images[path], x - size / 2, y - size / 2);
}
const stars = Array.from({ length: 190 }, (_, i) => {
  const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    x: hash(i + 1) * C.STAGE_W,
    y: hash(i + 501) * C.STAGE_H,
    r: 0.4 + hash(i + 101) * 1.1,
    a: 0.1 + hash(i + 301) * 0.45,
  };
});
function background(ctx: Context) {
  const glow = ctx.createRadialGradient(480, 450, 20, 500, 500, 660);
  glow.addColorStop(0, "#142936");
  glow.addColorStop(0.55, "#0b1724");
  glow.addColorStop(1, BACKGROUND);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (const star of stars) {
    ctx.fillStyle = `rgba(176,213,224,${star.a})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
function field(ctx: Context, s: StateView) {
  arc(ctx, C.FIELD_RADIUS, 0, 360, "#456071", 1.2);
  arc(ctx, C.FIELD_RADIUS - 5, 0, 360, "#142c3b", 1);
  for (let a = 0; a < 360; a += 5) {
    const p = polar(C.FIELD_RADIUS + 2, a),
      q = polar(C.FIELD_RADIUS + (a % 30 === 0 ? 10 : 5), a);
    line(ctx, p.x, p.y, q.x, q.y, a % 30 === 0 ? "#547482" : "#243c4a");
  }
  for (let i = 0; i < C.RINGS.length; i++) {
    const def = C.RINGS[i],
      ring = s.rings[i];
    arc(ctx, def.midRadius, 0, 360, "#152b39");
    for (let slot = 0; slot < ring.hp.length; slot++) {
      const hp = ring.hp[slot];
      if (hp === 0) continue;
      const start =
          ring.angleDeg + slot * def.slotWidthDeg + C.STRUCTURAL_GAP_DEG,
        end = start + def.targetArcDeg;
      const damaged = hp < def.hitPoints;
      sector(ctx, def.innerRadius, def.outerRadius, start, end);
      ctx.fillStyle = damaged
        ? "#503b37"
        : ["#294954", "#30434e", "#243b4b"][i];
      ctx.fill();
      ctx.strokeStyle = damaged
        ? "#b88169"
        : ["#84b9bf", "#8da7b5", "#668caa"][i];
      ctx.lineWidth = 1;
      ctx.stroke();
      arc(
        ctx,
        def.outerRadius - 3,
        start + 0.7,
        end - 0.7,
        damaged ? "#c5906f" : "#abc3c7",
        1,
      );
      arc(
        ctx,
        def.innerRadius + 4,
        start + 1,
        end - 1,
        damaged ? "#51322f" : "#101f2d",
        3,
      );
      const divisions = i === 0 ? 5 : 4;
      for (let j = 1; j < divisions; j++) {
        const a = start + (j * def.targetArcDeg) / divisions,
          p = polar(def.innerRadius + 6, a),
          q = polar(def.outerRadius - 5, a);
        line(ctx, p.x, p.y, q.x, q.y, "#0c1c29", 1);
      }
      const center = start + def.targetArcDeg / 2,
        p = polar(def.midRadius, center);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((center + 90) * RAD);
      ctx.fillStyle = damaged ? "#f3a376" : i === 1 ? "#d9c6a0" : "#b5d0d3";
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = "#354b55";
      ctx.fillRect(-2, -2, 4, 4);
      if (damaged) {
        line(ctx, -13, -8, -5, 2, "#e8a386");
        line(ctx, -5, 2, -9, 8, "#e8a386");
      }
      ctx.restore();
    }
  }
  ctx.setLineDash([2, 9]);
  arc(ctx, 240, 0, 360, "#203642");
  arc(ctx, C.DEFLECTOR_TRACK_INNER - 10, 0, 360, "#27414c");
  ctx.setLineDash([]);
  for (let a = 0; a < 360; a += 90) {
    const p = polar(252, a);
    text(
      ctx,
      ["E", "S", "W", "N"][a / 90],
      p.x,
      p.y + 4,
      10,
      "#45616e",
      "center",
    );
  }
  const half = span(s) / 2;
  sector(
    ctx,
    C.DEFLECTOR_TRACK_INNER,
    C.DEFLECTOR_TRACK_OUTER,
    s.angle - half,
    s.angle + half,
  );
  ctx.fillStyle = "#70b9c5";
  ctx.fill();
  ctx.strokeStyle = "#d4ffff";
  ctx.lineWidth = 1;
  ctx.stroke();
  arc(
    ctx,
    C.DEFLECTOR_TRACK_OUTER - 2,
    s.angle - half + 1,
    s.angle + half - 1,
    "#f0ffff",
    3,
  );
  arc(
    ctx,
    C.DEFLECTOR_TRACK_INNER + 3,
    s.angle - half + 2,
    s.angle + half - 2,
    "#183844",
    5,
  );
  const p = polar(
    (C.DEFLECTOR_TRACK_INNER + C.DEFLECTOR_TRACK_OUTER) / 2,
    s.angle,
  );
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((s.angle + 90) * RAD);
  ctx.fillStyle = "#fff3cf";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  if (s.effects.shieldActive) {
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 14;
    arc(ctx, C.SHIELD_RADIUS, 0, 360, CYAN, 2);
    ctx.shadowBlur = 0;
    arc(ctx, C.SHIELD_RADIUS + 4, 0, 360, "#254855");
  }
  sprite(
    ctx,
    s,
    C.SPRITE_PATHS.planet,
    C.STAGE_CX,
    C.STAGE_CY,
    C.PLANET_SPRITE_SIZE,
  );
  for (const pod of s.pods) {
    const p = polar(pod.r, pod.angle);
    sprite(ctx, s, C.SPRITE_PATHS.pods[pod.kind], p.x, p.y, C.POD_SPRITE_SIZE);
  }
  for (const ball of s.balls) {
    if (s.effects.pierceTicks > 0) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = GOLD;
    }
    const frame =
      Math.floor((s.simTicks - ball.born) / C.BALL_FRAME_TICKS) %
      C.BALL_SPIN_FRAMES;
    sprite(
      ctx,
      s,
      C.SPRITE_PATHS.ball[frame],
      ball.x,
      ball.y,
      C.BALL_SPRITE_SIZE,
    );
    ctx.shadowBlur = 0;
  }
}
// Particle players are disposable presentation caches; they never write game state.
const players = new WeakMap<Context, Map<number, ParticleCanvasPlayer>>();
function particles(ctx: Context, s: StateView, api: RenderApi) {
  const view = api.viewport();
  let cache = players.get(ctx);
  if (!cache) {
    cache = new Map();
    players.set(ctx, cache);
  }
  for (const id of cache.keys())
    if (!s.effectsVisual.some((e) => e.id === id)) cache.delete(id);
  for (const e of s.effectsVisual) {
    const system = s.assets.particles[e.kind] as ParticleSystem;
    ctx.save();
    ctx.translate(e.x - 64, e.y - 64);
    // The library fits to its context's backing store. Undo that fit locally so
    // the authored 128-unit effect retains its stage size at every viewport fit.
    ctx.scale(
      128 / (view.width * view.scale + 2 * view.offsetX),
      128 / (view.height * view.scale + 2 * view.offsetY),
    );
    let player = cache.get(e.id);
    if (!player) {
      player = new ParticleCanvasPlayer(system, ctx, {
        clear: false,
        composite: "lighter",
        pixelRadius: 2,
      });
      cache.set(e.id, player);
    }
    player.update(s.frameDt);
    ctx.restore();
  }
}
function hud(ctx: Context, s: StateView) {
  text(ctx, "K / ORBITAL OPERATIONS", 24, 27, 11, MUTED);
  text(ctx, "SCORE", 24, 54, 11, MUTED);
  text(ctx, String(s.score).padStart(6, "0"), 24, 83, 27, INK, "left", 600);
  text(ctx, "WAVE", 976, 27, 11, MUTED, "right");
  text(ctx, String(s.wave).padStart(2, "0"), 976, 59, 30, INK, "right", 600);
  text(ctx, "LIVES", 976, 82, 11, MUTED, "right");
  text(ctx, "● ".repeat(s.lives), 976, 102, 16, GOLD, "right");
  text(ctx, "A / D   ROTATE", 24, 958, 11, MUTED);
  text(ctx, "SPACE   LAUNCH", 24, 980, 11, MUTED);
  text(ctx, "P / ESC   PAUSE", 976, 978, 11, MUTED, "right");
  let y = 916;
  for (const kind of C.POD_KINDS) {
    const active =
      kind === "shield"
        ? s.effects.shieldActive
        : kind === "multiball"
          ? false
          : s.effects[`${kind}Ticks`] > 0;
    if (!active) continue;
    sprite(ctx, s, C.SPRITE_PATHS.pods[kind], 960, y, C.POD_SPRITE_SIZE);
    text(ctx, kind.toUpperCase(), 938, y + 4, 11, CYAN, "right");
    y -= 29;
  }
  if (s.balls.some((b) => b.parked)) {
    text(ctx, "SPACE TO DEPLOY", 500, 615, 11, CYAN, "center");
    text(ctx, "KEEP THE ORBIT CLEAN", 500, 636, 9, MUTED, "center");
  }
}
function menu(ctx: Context, s: StateView) {
  const items = s.screen === "title" ? C.TITLE_ITEMS : C.PAUSE_ITEMS;
  items.forEach((item, i) => {
    const r = menuRect(s, i)!;
    const selected = i === s.menu.index;
    ctx.fillStyle = selected ? "#bbdce1" : "#0c1b29";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = selected ? "#e3fcff" : "#2b4553";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    text(
      ctx,
      item,
      r.x + 25,
      r.y + 34,
      16,
      selected ? "#102333" : "#93acb7",
      "left",
      600,
    );
    text(
      ctx,
      selected ? "↗" : "·",
      r.x + r.width - 24,
      r.y + 35,
      23,
      selected ? "#102333" : "#547080",
      "right",
    );
  });
}
function title(ctx: Context, s: StateView) {
  ctx.fillStyle = "#070e19a6";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const grad = ctx.createLinearGradient(0, 230, 0, 790);
  grad.addColorStop(0, "#070e1900");
  grad.addColorStop(0.25, "#070e19ef");
  grad.addColorStop(0.85, "#070e19f5");
  grad.addColorStop(1, "#070e1900");
  ctx.fillStyle = grad;
  ctx.fillRect(100, 230, 800, 560);
  text(
    ctx,
    "O R B I T A L   D E M O L I T I O N",
    500,
    298,
    13,
    CYAN,
    "center",
  );
  text(ctx, C.TITLE_TEXT, 500, 417, 100, INK, "center", 800);
  line(ctx, 344, 445, 656, 445, "#587785");
  text(ctx, "THE SKY IS FULL. MAKE ROOM.", 500, 480, 13, GOLD, "center");
  text(
    ctx,
    "One planet. Three debris belts.",
    500,
    535,
    18,
    "#a1b5bd",
    "center",
  );
  text(
    ctx,
    "Keep the ball alive. Bring the orbit down.",
    500,
    562,
    18,
    "#a1b5bd",
    "center",
  );
  menu(ctx, s);
  text(
    ctx,
    "↑ ↓  SELECT     ENTER / SPACE  CONFIRM",
    500,
    782,
    11,
    MUTED,
    "center",
  );
  text(ctx, "K / 01", 48, 60, 15, CYAN);
  text(ctx, "DEORBIT DIVISION", 952, 60, 12, MUTED, "right");
  text(ctx, "AN ENDLESS CLEANUP OPERATION", 48, 950, 11, MUTED);
  text(ctx, "EST. LOW EARTH ORBIT", 952, 950, 11, MUTED, "right");
}
function overlay(ctx: Context) {
  ctx.fillStyle = "#050c16dc";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
}
function howto(ctx: Context, s: StateView) {
  overlay(ctx);
  text(ctx, "FLIGHT MANUAL / 01", 140, 150, 13, CYAN);
  text(ctx, C.TITLE_ITEMS[1], 140, 211, 44, INK, "left", 700);
  const rows = [
    [
      "01",
      "DEFEND THE PLANET",
      "Circle the planet. Meet the returning ball with your deflector.",
      "A hit near either tip steers the ball into a new orbit.",
    ],
    [
      "02",
      "BREAK THE BELTS",
      "Hit derelicts to score. Clear all three belts to advance.",
      "Miss a ball and it burns up. Lose the last ball, lose a life.",
    ],
    [
      "03",
      "CATCH THE SALVAGE",
      "Broken derelicts may shed pods. Sweep beneath them to catch.",
      "Widen, split, shield or pierce. Beware the red narrowing pod.",
    ],
  ];
  rows.forEach(([n, heading, a, b], i) => {
    const y = 285 + i * 132;
    text(ctx, n, 140, y, 14, GOLD);
    text(ctx, heading, 190, y, 18, INK, "left", 600);
    text(ctx, a, 190, y + 32, 16, "#a8bcc5");
    text(ctx, b, 190, y + 57, 16, "#a8bcc5");
    line(ctx, 140, y + 84, 860, y + 84, "#243b49");
  });
  C.POD_KINDS.forEach((k, i) => {
    const x = 210 + i * 145;
    sprite(ctx, s, C.SPRITE_PATHS.pods[k], x, 691, C.POD_SPRITE_SIZE);
    text(ctx, k.toUpperCase(), x, 722, 10, MUTED, "center");
  });
  text(
    ctx,
    "← → / A D  ROTATE     SPACE  LAUNCH     P / ESC  PAUSE",
    500,
    789,
    13,
    CYAN,
    "center",
  );
  text(
    ctx,
    "↑ ↓ / W S  MENU     ENTER / SPACE  CONFIRM",
    500,
    817,
    13,
    MUTED,
    "center",
  );
  text(ctx, "ENTER / SPACE / ESC  —  RETURN", 500, 894, 13, INK, "center");
}
export function render(s: StateView, api: RenderApi): void {
  const ctx = api.ctx;
  background(ctx);
  field(ctx, s);
  particles(ctx, s, api);
  if (s.screen === "playing") {
    hud(ctx, s);
    return;
  }
  if (s.screen === "title") {
    title(ctx, s);
    return;
  }
  if (s.screen === "howto") {
    howto(ctx, s);
    return;
  }
  hud(ctx, s);
  overlay(ctx);
  if (s.screen === "paused") {
    text(ctx, "SIGNAL HELD", 500, 350, 13, CYAN, "center");
    text(ctx, "PAUSED", 500, 441, 65, INK, "center", 700);
    text(ctx, "Your orbit will be here.", 500, 489, 19, MUTED, "center");
    menu(ctx, s);
    text(ctx, "P / ESC  RESUME", 500, 790, 12, MUTED, "center");
  }
  if (s.screen === "waveclear") {
    text(ctx, "ALL DERELICTS REMOVED", 500, 390, 13, CYAN, "center");
    text(ctx, `WAVE ${s.wave} CLEAR`, 500, 470, 57, INK, "center", 700);
    text(
      ctx,
      `+ ${C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave}  CLEANUP BONUS`,
      500,
      523,
      18,
      GOLD,
      "center",
    );
    text(ctx, "REPOPULATING ORBIT", 500, 604, 12, MUTED, "center");
    ctx.fillStyle = CYAN;
    ctx.fillRect(
      350,
      630,
      300 * (1 - s.interstitialTicks / C.WAVECLEAR_TICKS),
      2,
    );
  }
  if (s.screen === "gameover") {
    text(ctx, "CONTACT LOST", 500, 330, 13, GOLD, "center");
    text(ctx, C.GAMEOVER_TEXT, 500, 428, 64, INK, "center", 700);
    text(ctx, String(s.score).padStart(6, "0"), 500, 520, 46, CYAN, "center");
    text(
      ctx,
      `FINAL SCORE   /   WAVE ${String(s.wave).padStart(2, "0")}`,
      500,
      557,
      13,
      MUTED,
      "center",
    );
    text(ctx, "ENTER / SPACE  —  RETURN TO BASE", 500, 695, 14, INK, "center");
  }
}
