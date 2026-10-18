import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  RAD,
  wrap,
  offset,
  polar,
  radius,
  angleOf,
  span,
  speed,
  copy,
  boot,
  park,
  launch,
  freshRings,
  emptyEffects,
  drawPod,
  setEffect,
  menuRect,
  type Ball,
  type KesslerState,
  type StateView,
} from "./model";
type Audio = UpdateApi["audio"];
function effect(
  s: KesslerState,
  kind: "burst" | "spark" | "burnup",
  x: number,
  y: number,
) {
  s.effectsVisual.push({ id: ++s.serial, kind, x, y, age: 0 });
}
function clearEffects(s: KesslerState) {
  s.effects = emptyEffects();
  s.pods = [];
}
function setVelocity(b: Ball, angle: number, magnitude: number) {
  b.vx = Math.cos(angle * RAD) * magnitude;
  b.vy = Math.sin(angle * RAD) * magnitude;
}
/** Reflection preserves the advanced position; only velocity is changed. */
export function reflect(b: Ball, edge: boolean, ringSpeed = 0) {
  const theta = angleOf(b.x, b.y),
    r = radius(b.x, b.y),
    nx = Math.cos(theta * RAD),
    ny = Math.sin(theta * RAD);
  const ax = edge ? -ny : nx,
    ay = edge ? nx : ny,
    mag = Math.hypot(b.vx, b.vy),
    dot = b.vx * ax + b.vy * ay;
  b.vx -= 2 * dot * ax;
  b.vy -= 2 * dot * ay;
  b.vx += -ny * C.RING_KICK_FACTOR * ringSpeed * RAD * r;
  b.vy += nx * C.RING_KICK_FACTOR * ringSpeed * RAD * r;
  let heading = Math.atan2(b.vy, b.vx) / RAD;
  const radial = Math.abs(offset(heading, theta)) <= 90 ? theta : theta + 180;
  const phi = offset(heading, radial);
  heading -= Math.sign(phi) * Math.min(C.ORBITAL_DECAY_DEG, Math.abs(phi));
  setVelocity(b, heading, mag);
}
function paddleBounce(s: KesslerState, b: Ball, theta: number) {
  const nx = Math.cos(theta * RAD),
    ny = Math.sin(theta * RAD),
    dot = b.vx * nx + b.vy * ny;
  const heading =
    Math.atan2(b.vy - 2 * dot * ny, b.vx - 2 * dot * nx) / RAD +
    C.ENGLISH_DEG_PER_OFFSET_DEG * offset(theta, s.angle);
  const a = Math.max(
    -C.BOUNCE_CLAMP_DEG,
    Math.min(C.BOUNCE_CLAMP_DEG, offset(heading, theta)),
  );
  setVelocity(b, theta + a, speed(s));
}
function catchPod(s: KesslerState, kind: C.PodKind, audio: Audio) {
  s.score += C.POD_CATCH_SCORE;
  audio.play(kind === "narrow" ? C.CUES.podCatchNarrow : C.CUES.podCatch);
  switch (kind) {
    case "widen":
      setEffect(s, kind, C.WIDEN_DURATION_TICKS);
      break;
    case "narrow":
      setEffect(s, kind, C.NARROW_DURATION_TICKS);
      break;
    case "pierce":
      setEffect(s, kind, C.PIERCE_DURATION_TICKS);
      break;
    case "shield":
      s.effects.shieldActive = true;
      break;
    case "multiball":
      for (
        let i = 0;
        i < C.MULTIBALL_LAUNCH_COUNT && s.balls.length < C.BALL_CAP;
        i++
      ) {
        const b: Ball = {
          ...polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.angle),
          vx: 0,
          vy: 0,
          parked: false,
          born: s.simTicks,
        };
        setVelocity(
          b,
          s.angle + (i === 0 ? 1 : -1) * C.MULTIBALL_OFFSET_DEG,
          speed(s),
        );
        s.balls.push(b);
      }
      break;
  }
}
const member = (a: number, center: number, width: number) =>
  Math.abs(offset(a, center)) <= width / 2 + 1e-9;
function destroy(s: KesslerState, ri: number, slot: number, audio: Audio) {
  const def = C.RINGS[ri],
    ring = s.rings[ri];
  s.score += def.destroyScore;
  audio.play(C.CUES.targetBreak);
  const angle = wrap(
      ring.angleDeg +
        slot * def.slotWidthDeg +
        C.STRUCTURAL_GAP_DEG +
        def.targetArcDeg / 2,
    ),
    p = polar(def.midRadius, angle);
  effect(s, "burst", p.x, p.y);
  if (s.podSpawn) {
    const kind =
      s.nextPod === null ? drawPod() : s.nextPod === "none" ? null : s.nextPod;
    s.nextPod = null;
    if (kind) s.pods.push({ kind, r: def.midRadius, angle });
  }
  if (s.waveAdvance && s.rings.every((r) => r.hp.every((hp) => hp === 0))) {
    s.score += C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave;
    s.balls = [];
    clearEffects(s);
    s.screen = "waveclear";
    s.menu.index = 0;
    s.interstitialTicks = C.WAVECLEAR_TICKS;
    audio.play(C.CUES.waveClear);
  }
}
/** One ordered tick. All mutation is confined to the newly copied next state. */
export function tick(s: KesslerState, turn: number, audio: Audio): void {
  s.ticks++;
  if (s.screen === "waveclear") {
    s.interstitialTicks = Math.max(0, s.interstitialTicks - 1);
    if (s.interstitialTicks === 0) {
      s.wave++;
      s.rings = freshRings(s.wave);
      s.balls = [];
      clearEffects(s);
      s.screen = "playing";
      park(s);
    }
    return;
  }
  if (s.screen !== "playing") return;
  s.simTicks++;
  s.angle = wrap(s.angle + turn * C.DEFLECTOR_TURN_DEG_PER_SEC * C.TICK_DT);
  const oldAngles = s.rings.map((r) => r.angleDeg);
  s.rings.forEach(
    (r) => (r.angleDeg = wrap(r.angleDeg + r.speedDegPerSec * C.TICK_DT)),
  );
  for (const key of ["widenTicks", "narrowTicks", "pierceTicks"] as const)
    s.effects[key] = Math.max(0, s.effects[key] - 1);
  const catchSpan = span(s);
  s.pods = s.pods.filter((p) => {
    const prev = p.r;
    p.r -= C.POD_FALL_SPEED * C.TICK_DT;
    if (
      prev > C.DEFLECTOR_POD_CATCH_RADIUS &&
      p.r <= C.DEFLECTOR_POD_CATCH_RADIUS &&
      member(p.angle, s.angle, catchSpan)
    ) {
      catchPod(s, p.kind, audio);
      return false;
    }
    if (p.r <= C.BURNUP_RADIUS) {
      const pos = polar(p.r, p.angle);
      effect(s, "burnup", pos.x, pos.y);
      audio.play(C.CUES.podBurn);
      return false;
    }
    return true;
  });
  let burned = false;
  const survivors: Ball[] = [];
  for (const b of s.balls) {
    if (b.parked) {
      Object.assign(b, polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.angle));
      survivors.push(b);
      continue;
    }
    const prevR = radius(b.x, b.y),
      prevAngle = angleOf(b.x, b.y);
    b.x += b.vx * C.TICK_DT;
    b.y += b.vy * C.TICK_DT;
    const r = radius(b.x, b.y),
      theta = angleOf(b.x, b.y),
      radialDot = (b.x - C.STAGE_CX) * b.vx + (b.y - C.STAGE_CY) * b.vy;
    if (
      prevR > C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      r <= C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      radialDot < 0 &&
      member(theta, s.angle, span(s))
    ) {
      paddleBounce(s, b, theta);
      audio.play(C.CUES.paddleBounce);
      effect(s, "spark", b.x, b.y);
    }
    for (let ri = 0; ri < s.rings.length; ri++) {
      const def = C.RINGS[ri],
        ring = s.rings[ri];
      const face =
        (prevR < def.innerContactRadius && r >= def.innerContactRadius) ||
        (prevR > def.outerContactRadius && r <= def.outerContactRadius);
      const inBand = r >= def.innerContactRadius && r <= def.outerContactRadius;
      if (!face && !inBand) continue;
      for (let slot = 0; slot < ring.hp.length; slot++) {
        if (ring.hp[slot] <= 0) continue;
        const local =
          slot * def.slotWidthDeg + C.STRUCTURAL_GAP_DEG + def.targetArcDeg / 2;
        if (!member(theta, ring.angleDeg + local, def.targetArcDeg)) continue;
        const edge =
          inBand && !member(prevAngle, oldAngles[ri] + local, def.targetArcDeg);
        if (!face && !edge) continue;
        const piercing = s.effects.pierceTicks > 0;
        if (!piercing) reflect(b, !face, ring.speedDegPerSec);
        ring.hp[slot] = piercing ? 0 : ring.hp[slot] - 1;
        if (ring.hp[slot] === 0) destroy(s, ri, slot, audio);
        else {
          s.score += C.HIT_SCORE;
          audio.play(C.CUES.targetHit);
        }
        break;
      }
      if (s.interstitialTicks === C.WAVECLEAR_TICKS && s.balls.length === 0)
        return;
    }
    if (
      s.effects.shieldActive &&
      prevR > C.SHIELD_CONTACT_RADIUS &&
      r <= C.SHIELD_CONTACT_RADIUS
    ) {
      reflect(b, false);
      s.effects.shieldActive = false;
      audio.play(C.CUES.shieldReflect);
      effect(s, "spark", b.x, b.y);
    }
    if (
      prevR < C.FIELD_CONTACT_RADIUS &&
      r >= C.FIELD_CONTACT_RADIUS &&
      radialDot > 0
    ) {
      reflect(b, false);
      audio.play(C.CUES.fieldBounce);
      effect(s, "spark", b.x, b.y);
    }
    if (r <= C.BURNUP_RADIUS) {
      burned = true;
      audio.play(C.CUES.ballLost);
      effect(s, "burnup", b.x, b.y);
    } else survivors.push(b);
  }
  s.balls = survivors;
  if (burned && s.balls.length === 0) {
    s.lives = Math.max(0, s.lives - 1);
    clearEffects(s);
    if (s.lives > 0) park(s);
    else {
      s.screen = "gameover";
      s.menu.index = 0;
      audio.play(C.CUES.gameOver);
    }
  }
}
function arrive(s: KesslerState, screen: C.Screen, index = 0) {
  s.screen = screen;
  s.menu.index = index;
  s.pointerPress = null;
}
export function update(
  state: StateView,
  api: UpdateApi,
  dt: number,
): KesslerState {
  let s = copy(state);
  s.frameDt = dt;
  s.effectsVisual = s.effectsVisual
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 1.5);
  const pressed = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  ) as Record<C.ActionName, boolean>;
  const turn = api.input.value("right") - api.input.value("left");
  const original = s.screen;
  if (original === "title" || original === "paused") {
    let accept = false;
    const highlight = (i: number) => {
      if (i !== s.menu.index) {
        s.menu.index = i;
        api.audio.play(C.CUES.menuMove);
      }
    };
    if (pressed.up)
      highlight(
        (s.menu.index + C.TITLE_ITEMS.length - 1) % C.TITLE_ITEMS.length,
      );
    if (pressed.down) highlight((s.menu.index + 1) % C.TITLE_ITEMS.length);
    for (const sample of api.input.pointerSamples()) {
      if (!sample.primary) continue;
      const index = C.TITLE_ITEMS.findIndex((_, i) => {
        const r = menuRect(s, i);
        return (
          r !== null &&
          sample.x >= r.x &&
          sample.x <= r.x + r.width &&
          sample.y >= r.y &&
          sample.y <= r.y + r.height
        );
      });
      if (index >= 0) highlight(index);
      if (sample.type === "down") s.pointerPress = index >= 0 ? index : null;
      if (sample.type === "up") {
        if (index >= 0 && index === s.pointerPress) accept = true;
        s.pointerPress = null;
      }
    }
    if (pressed.confirm || accept) {
      api.audio.play(C.CUES.menuSelect);
      if (original === "title") {
        if (s.menu.index === 0) {
          const ticks = s.ticks,
            acc = s.accumulator;
          s = boot(s.assets);
          s.ticks = ticks;
          s.accumulator = acc;
          s.screen = "playing";
          park(s);
        } else arrive(s, "howto");
      } else if (s.menu.index === 0) arrive(s, "playing");
      else {
        const ticks = s.ticks,
          accumulator = s.accumulator;
        s = boot(s.assets);
        s.ticks = ticks;
        s.accumulator = accumulator;
      }
    } else if (original === "paused" && (pressed.back || pressed.pause))
      arrive(s, "playing");
  } else if (original === "howto" && (pressed.confirm || pressed.back))
    arrive(s, "title", 1);
  else if (original === "gameover" && pressed.confirm) arrive(s, "title");
  else if (original === "playing") {
    if (pressed.back || pressed.pause) arrive(s, "paused");
    else if (pressed.launch && s.balls.some((b) => b.parked)) launch(s);
  }
  s.accumulator += dt;
  while (s.accumulator + 1e-10 >= C.TICK_DT) {
    s.accumulator -= C.TICK_DT;
    tick(s, original === "playing" ? turn : 0, api.audio);
  }
  s.accumulator = Math.max(0, s.accumulator);
  const title = s.screen === "title" || s.screen === "howto",
    play =
      s.screen === "playing" ||
      s.screen === "paused" ||
      s.screen === "waveclear";
  if (title) {
    api.audio.stop("music-play");
    api.audio.loop("music-title");
  } else if (play) {
    api.audio.stop("music-title");
    api.audio.loop("music-play");
  } else {
    api.audio.stop("music-title");
    api.audio.stop("music-play");
  }
  return s;
}
