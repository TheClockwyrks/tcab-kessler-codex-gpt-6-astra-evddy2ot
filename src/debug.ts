import * as C from "./constants";
import {
  boot,
  copy,
  launch,
  park,
  wrap,
  polar,
  orbit,
  angleOf,
  radius,
  drawPod,
  setEffect,
  menuRect,
  snapshot,
  type StateView,
  type KesslerState,
} from "./model";
function valid(ok: boolean): asserts ok {
  if (!ok) throw new RangeError("Invalid Kessler debug argument");
}
const whole = (n: number, min = 0) => valid(Number.isInteger(n) && n >= min);
const finite = (...ns: number[]) => valid(ns.every(Number.isFinite));
function pose(s: StateView, fn: (n: KesslerState) => void) {
  const n = copy(s);
  fn(n);
  return n;
}
function ringIndex(r: number) {
  whole(r, 1);
  valid(r <= C.RINGS.length);
  return r - 1;
}
export const debug = {
  reset: (s: StateView) => boot(s.assets as KesslerState["assets"]),
  reconcile: copy,
  snapshot,
  menuItemRect: menuRect,
  setScreen: (s: StateView, name: C.Screen) =>
    pose(s, (n) => {
      valid(C.SCREENS.includes(name));
      n.screen = name;
    }),
  setScore: (s: StateView, v: number) =>
    pose(s, (n) => {
      whole(v);
      n.score = v;
    }),
  setLives: (s: StateView, v: number) =>
    pose(s, (n) => {
      whole(v);
      n.lives = v;
    }),
  setMenuIndex: (s: StateView, v: number) =>
    pose(s, (n) => {
      valid(menuRect(s, v) !== null);
      n.menu.index = v;
    }),
  setInterstitialTicks: (s: StateView, v: number) =>
    pose(s, (n) => {
      whole(v);
      n.interstitialTicks = v;
    }),
  setWave: (s: StateView, v: number) =>
    pose(s, (n) => {
      whole(v, 1);
      n.wave = v;
      n.rings.forEach((r, i) => (r.speedDegPerSec = orbit(i, v)));
    }),
  setPaddleAngle: (s: StateView, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.angle = wrap(v);
      n.balls
        .filter((b) => b.parked)
        .forEach((b) =>
          Object.assign(b, polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, n.angle)),
        );
    }),
  launchBall: (s: StateView) => pose(s, launch),
  clearBalls: (s: StateView) =>
    pose(s, (n) => {
      n.balls = [];
    }),
  spawnBall: (s: StateView, x: number, y: number, vx: number, vy: number) =>
    pose(s, (n) => {
      finite(x, y, vx, vy);
      valid(n.balls.length < C.BALL_CAP);
      n.balls.push({ x, y, vx, vy, parked: false, born: n.simTicks });
    }),
  parkBall: (s: StateView) => pose(s, park),
  clearTargets: (s: StateView) =>
    pose(s, (n) => n.rings.forEach((r) => r.hp.fill(0))),
  spawnTarget: (s: StateView, r: number, slot: number, hp: number) =>
    pose(s, (n) => {
      const i = ringIndex(r);
      whole(slot);
      valid(slot < C.RINGS[i].slots);
      whole(hp, 1);
      n.rings[i].hp[slot] = hp;
    }),
  setRingAngle: (s: StateView, r: number, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.rings[ringIndex(r)].angleDeg = wrap(v);
    }),
  setRingSpeed: (s: StateView, r: number, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.rings[ringIndex(r)].speedDegPerSec = v;
    }),
  clearPods: (s: StateView) =>
    pose(s, (n) => {
      n.pods = [];
    }),
  spawnPod: (s: StateView, kind: C.PodKind, x: number, y: number) =>
    pose(s, (n) => {
      valid(C.POD_KINDS.includes(kind));
      finite(x, y);
      n.pods.push({ kind, r: radius(x, y), angle: angleOf(x, y) });
    }),
  setNextPod: (s: StateView, kind: C.PodKind | "none") =>
    pose(s, (n) => {
      valid(kind === "none" || C.POD_KINDS.includes(kind));
      n.nextPod = kind;
    }),
  drawPod: (_s: StateView) => drawPod(),
  setEffectTicks: (
    s: StateView,
    kind: "widen" | "narrow" | "pierce",
    ticks: number,
  ) =>
    pose(s, (n) => {
      valid(["widen", "narrow", "pierce"].includes(kind));
      whole(ticks);
      setEffect(n, kind, ticks);
    }),
  setShield: (s: StateView, v: boolean) =>
    pose(s, (n) => {
      valid(typeof v === "boolean");
      n.effects.shieldActive = v;
    }),
  setWaveAdvance: (s: StateView, v: boolean) =>
    pose(s, (n) => {
      valid(typeof v === "boolean");
      n.waveAdvance = v;
    }),
  setPodSpawn: (s: StateView, v: boolean) =>
    pose(s, (n) => {
      valid(typeof v === "boolean");
      n.podSpawn = v;
    }),
};
export type KesslerDebugApi = typeof debug;
