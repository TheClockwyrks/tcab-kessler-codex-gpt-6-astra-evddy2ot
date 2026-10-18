import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  parked: boolean;
  born: number;
}
export interface Pod {
  kind: C.PodKind;
  r: number;
  angle: number;
}
export interface Ring {
  angleDeg: number;
  speedDegPerSec: number;
  hp: number[];
}
export interface Assets {
  images: Readonly<Record<string, ImageBitmap>>;
  particles: Readonly<Record<string, ParticleSystem>>;
}
export interface KesslerState {
  assets: Assets;
  screen: C.Screen;
  ticks: number;
  simTicks: number;
  accumulator: number;
  wave: number;
  score: number;
  lives: number;
  interstitialTicks: number;
  waveAdvance: boolean;
  podSpawn: boolean;
  nextPod: C.PodKind | "none" | null;
  angle: number;
  balls: Ball[];
  rings: Ring[];
  pods: Pod[];
  effects: {
    widenTicks: number;
    narrowTicks: number;
    pierceTicks: number;
    shieldActive: boolean;
  };
  menu: { index: number };
  pointerPress: number | null;
  effectsVisual: {
    id: number;
    kind: "burst" | "spark" | "burnup";
    x: number;
    y: number;
    age: number;
  }[];
  serial: number;
  frameDt: number;
}
export type StateView = DeepReadonly<KesslerState>;
export const RAD = Math.PI / 180;
export const wrap = (a: number) => ((a % 360) + 360) % 360;
export const offset = (a: number, b: number) => wrap(a - b + 180) - 180;
export const polar = (r: number, a: number) => ({
  x: C.STAGE_CX + r * Math.cos(a * RAD),
  y: C.STAGE_CY + r * Math.sin(a * RAD),
});
export const radius = (x: number, y: number) =>
  Math.hypot(x - C.STAGE_CX, y - C.STAGE_CY);
export const angleOf = (x: number, y: number) =>
  wrap(Math.atan2(y - C.STAGE_CY, x - C.STAGE_CX) / RAD);
export const span = (s: StateView) =>
  s.effects.widenTicks > 0
    ? C.WIDEN_SPAN_DEG
    : s.effects.narrowTicks > 0
      ? C.NARROW_SPAN_DEG
      : C.DEFLECTOR_BASE_SPAN_DEG;
export const speed = (s: StateView) =>
  Math.min(
    C.BALL_SPEED_BASE + C.BALL_SPEED_PER_WAVE * (s.wave - 1),
    C.BALL_SPEED_CAP,
  );
export const orbit = (i: number, w: number) => {
  const r = C.RINGS[i];
  return (
    r.orbitSign *
    Math.min(
      r.orbitBaseDegPerSec + r.orbitPerWaveDegPerSec * (w - 1),
      r.orbitCapDegPerSec,
    )
  );
};
export const freshRings = (w: number): Ring[] =>
  C.RINGS.map((r, i) => ({
    angleDeg: 0,
    speedDegPerSec: orbit(i, w),
    hp: Array<number>(r.slots).fill(r.hitPoints),
  }));
export const emptyEffects = () => ({
  widenTicks: 0,
  narrowTicks: 0,
  pierceTicks: 0,
  shieldActive: false,
});
export function boot(assets: Assets): KesslerState {
  return {
    assets,
    screen: "title",
    ticks: 0,
    simTicks: 0,
    accumulator: 0,
    wave: C.START_WAVE,
    score: 0,
    lives: C.START_LIVES,
    interstitialTicks: 0,
    waveAdvance: true,
    podSpawn: true,
    nextPod: null,
    angle: C.DEFLECTOR_START_ANGLE_DEG,
    balls: [],
    rings: freshRings(C.START_WAVE),
    pods: [],
    effects: emptyEffects(),
    menu: { index: 0 },
    pointerPress: null,
    effectsVisual: [],
    serial: 0,
    frameDt: 0,
  };
}
/** Copy mutable simulation branches; loaded assets are immutable shared resources. */
export function copy(s: StateView): KesslerState {
  return {
    ...s,
    assets: s.assets as Assets,
    balls: s.balls.map((b) => ({ ...b })),
    rings: s.rings.map((r) => ({ ...r, hp: [...r.hp] })),
    pods: s.pods.map((p) => ({ ...p })),
    effects: { ...s.effects },
    menu: { ...s.menu },
    effectsVisual: s.effectsVisual.map((e) => ({ ...e })),
  };
}
export function park(s: KesslerState): void {
  if (s.balls.length >= C.BALL_CAP || s.balls.some((b) => b.parked))
    throw new Error("Cannot park another ball");
  s.balls.push({
    ...polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.angle),
    vx: 0,
    vy: 0,
    parked: true,
    born: s.simTicks,
  });
}
export function launch(s: KesslerState): void {
  const b = s.balls.find((b) => b.parked);
  if (!b) throw new Error("No parked ball");
  b.parked = false;
  b.vx = Math.cos(s.angle * RAD) * speed(s);
  b.vy = Math.sin(s.angle * RAD) * speed(s);
}
export function drawPod(): C.PodKind | null {
  if (Math.random() >= C.POD_DROP_CHANCE) return null;
  const n = Math.random();
  let total = 0;
  for (const entry of C.POD_KIND_TABLE) {
    total += entry.probability;
    if (n < total) return entry.kind;
  }
  return C.POD_KIND_TABLE[C.POD_KIND_TABLE.length - 1].kind;
}
export function setEffect(
  s: KesslerState,
  kind: "widen" | "narrow" | "pierce",
  ticks: number,
): void {
  s.effects[`${kind}Ticks`] = ticks;
  if (ticks > 0 && kind !== "pierce")
    s.effects[kind === "widen" ? "narrowTicks" : "widenTicks"] = 0;
}
export function menuRect(s: StateView, index: number) {
  return (s.screen === "title" || s.screen === "paused") &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < C.TITLE_ITEMS.length
    ? { x: 340, y: 612 + index * 66, width: 320, height: 54 }
    : null;
}
export function snapshot(s: StateView) {
  return {
    screen: s.screen,
    ticks: s.ticks,
    wave: s.wave,
    score: s.score,
    lives: s.lives,
    interstitialTicks: s.interstitialTicks,
    waveAdvance: s.waveAdvance,
    podSpawn: s.podSpawn,
    nextPod: s.nextPod,
    paddle: { angleDeg: s.angle, spanDeg: span(s) },
    balls: s.balls.map(({ x, y, vx, vy, parked }) => ({
      x,
      y,
      vx,
      vy,
      parked,
      piercing: s.effects.pierceTicks > 0,
    })),
    rings: s.rings.map((r) => ({
      angleDeg: r.angleDeg,
      speedDegPerSec: r.speedDegPerSec,
      targets: r.hp.flatMap((hp, slot) => (hp > 0 ? [{ slot, hp }] : [])),
    })),
    pods: s.pods.map((p) => ({ kind: p.kind, ...polar(p.r, p.angle) })),
    effects: { ...s.effects },
    menu: {
      index: s.screen === "title" || s.screen === "paused" ? s.menu.index : 0,
    },
  };
}
