/// <reference types="node" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  createEngine,
  ConstantClock,
  SequenceClock,
  type Engine,
} from "@clockwyrks/simple-2d";
import {
  game,
  BACKGROUND,
  type KesslerState,
  type KesslerDebugApi,
} from "./game";
import * as C from "./constants";
import { polar, type StateView } from "./model";
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      decodeAudioData(data: ArrayBuffer) {
        expect(new TextDecoder().decode(data.slice(0, 4))).toBe("RIFF");
        return Promise.resolve({});
      }
      resume() {
        return Promise.resolve();
      }
    },
  );
});
const engines: Engine<KesslerState, KesslerDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
  vi.restoreAllMocks();
});
async function setup() {
  const canvas = createCanvas(1000, 1000),
    target = new EventTarget();
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => 1000,
      cssHeight: () => 1000,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(e);
  await e.initialize();
  const cues: string[] = [];
  e.events.on("cue:played", (x) => cues.push(x.cue));
  const key = async (code: string) => {
    target.dispatchEvent(Object.assign(new Event("keydown"), { code }));
    await e.advance(1);
    target.dispatchEvent(Object.assign(new Event("keyup"), { code }));
  };
  const pose = (f: (s: StateView, d: KesslerDebugApi) => KesslerState) =>
    e.apply((s) => f(s, e.debug));
  const snap = () => e.debug.snapshot(e.state);
  const play = () =>
    pose((s, d) =>
      d.setScreen(
        d.setPodSpawn(
          d.setWaveAdvance(d.clearBalls(d.clearTargets(s)), false),
          false,
        ),
        "playing",
      ),
    );
  const ball = (r: number, a: number, radialSpeed: number) => {
    const p = polar(r, a);
    pose((s, d) =>
      d.spawnBall(
        s,
        p.x,
        p.y,
        radialSpeed * Math.cos((a * Math.PI) / 180),
        radialSpeed * Math.sin((a * Math.PI) / 180),
      ),
    );
  };
  return { e, target, key, pose, snap, play, ball, cues, canvas };
}
describe("engine integration and screens", () => {
  it("boots, loads every asset, reports diagnostics, and keeps input edges on their originating screen", async () => {
    const { e, key, snap } = await setup();
    expect(snap().screen).toBe("title");
    expect(snap().rings.map((r) => r.targets.length)).toEqual([12, 16, 20]);
    expect(e.diagnostics()).toHaveLength(13);
    await key("Space");
    expect(snap().screen).toBe("playing");
    expect(snap().balls[0].parked).toBe(true);
    await key("Space");
    expect(snap().balls[0].parked).toBe(false);
    await key("KeyP");
    const frozen = snap();
    await e.advance(8);
    expect(snap().balls).toEqual(frozen.balls);
    expect(snap().rings).toEqual(frozen.rings);
    expect(snap().ticks).toBe(frozen.ticks + 8);
    await key("Escape");
    expect(snap().screen).toBe("playing");
  });
  it("navigates help, pause, quit, game over and pointer menus", async () => {
    const { e, key, snap, pose, target } = await setup();
    await key("ArrowDown");
    await key("Enter");
    expect(snap().screen).toBe("howto");
    await key("Escape");
    expect(snap().menu.index).toBe(1);
    const rect = e.debug.menuItemRect(e.state, 0)!;
    const pointer = (type: string, x: number, y: number) =>
      target.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerdown" ? 1 : 0,
        }),
      );
    pointer("pointerdown", rect.x + 20, rect.y + 20);
    pointer("pointerup", 0, 0);
    await e.advance(1);
    expect(snap().screen).toBe("title");
    pointer("pointerdown", rect.x + 20, rect.y + 20);
    pointer("pointerup", rect.x + 20, rect.y + 20);
    await e.advance(1);
    expect(snap().screen).toBe("playing");
    await key("Escape");
    await key("ArrowDown");
    await key("Enter");
    expect(snap().screen).toBe("title");
    pose((s, d) => d.setScreen(s, "gameover"));
    await e.advance(1);
    await key("Enter");
    expect(snap().screen).toBe("title");
  });
  it("advances equal simulation time with irregular frames", async () => {
    const a = await setup(),
      b = await setup();
    a.play();
    b.play();
    a.ball(210, 0, 10);
    b.ball(210, 0, 10);
    b.e.setClock(new SequenceClock([5, 20, 25]));
    await a.e.advance(60);
    await b.e.advance(60);
    expect(a.snap()).toEqual(b.snap());
  });
});
describe("polar crossings, scoring and lifecycle", () => {
  it("reflects the deflector in place at wave speed and containment at incoming speed", async () => {
    const { e, play, ball, snap, cues, pose } = await setup();
    play();
    ball(196, 90, -240);
    await e.advance(1);
    expect(snap().balls[0].y).toBeCloseTo(692);
    expect(snap().balls[0].vy).toBeCloseTo(240);
    expect(cues).toContain(C.CUES.paddleBounce);
    pose((s, d) => d.clearBalls(s));
    ball(470, 0, 300);
    await e.advance(1);
    expect(snap().balls[0].x).toBeCloseTo(975);
    expect(snap().balls[0].vx).toBeCloseTo(-300);
    expect(cues).toContain(C.CUES.fieldBounce);
  });
  it("damages armored targets, destroys on a fresh crossing, and consumes a forced pod draw", async () => {
    const { e, play, pose, ball, snap, cues } = await setup();
    play();
    pose((s, d) =>
      d.setRingSpeed(
        d.spawnTarget(d.setPodSpawn(d.setNextPod(s, "shield"), true), 2, 0, 2),
        2,
        0,
      ),
    );
    ball(350, 10, 240);
    await e.advance(1);
    expect(snap().score).toBe(C.HIT_SCORE);
    expect(snap().rings[1].targets[0].hp).toBe(1);
    expect(cues).toContain(C.CUES.targetHit);
    pose((s, d) => d.clearBalls(s));
    ball(350, 10, 240);
    await e.advance(1);
    expect(snap().score).toBe(250);
    expect(snap().pods[0].kind).toBe("shield");
    expect(snap().nextPod).toBeNull();
    expect(cues).toContain(C.CUES.targetBreak);
  });
  it("resolves moving-ring edges, but lets balls pass through gaps", async () => {
    const { e, play, pose, ball, snap } = await setup();
    play();
    pose((s, d) => d.setRingSpeed(d.spawnTarget(s, 1, 0, 1), 1, 60));
    ball(300, 28.5, 0);
    await e.advance(1);
    expect(snap().score).toBe(100);
    pose((s, d) => d.spawnTarget(d.clearBalls(s), 1, 0, 1));
    ball(280, 0, 240);
    await e.advance(1);
    expect(snap().score).toBe(100);
    expect(snap().balls[0].vx).toBe(240);
  });
  it("pierces without a velocity change and clears a wave only on a destruction", async () => {
    const { e, play, pose, ball, snap, cues } = await setup();
    play();
    pose((s, d) =>
      d.setWaveAdvance(
        d.setEffectTicks(d.spawnTarget(s, 1, 0, 20), "pierce", 100),
        true,
      ),
    );
    ball(280, 15, 240);
    const vx = snap().balls[0].vx;
    await e.advance(1);
    expect(snap().screen).toBe("waveclear");
    expect(snap().score).toBe(600);
    expect(snap().interstitialTicks).toBe(C.WAVECLEAR_TICKS);
    expect(snap().balls).toHaveLength(0);
    expect(cues).toContain(C.CUES.waveClear);
    await e.advance(C.WAVECLEAR_TICKS);
    expect(snap().wave).toBe(2);
    expect(snap().balls[0].parked).toBe(true);
    expect(snap().rings[1].speedDegPerSec).toBe(15);
    play();
    pose((s, d) => d.setEffectTicks(d.spawnTarget(s, 1, 0, 5), "pierce", 20));
    ball(280, 15, 240);
    await e.advance(1);
    expect(snap().balls[0].vx).toBeCloseTo(vx);
  });
  it("burns balls, loses only the final ball’s life, clears effects and ends a session", async () => {
    const { e, play, pose, ball, snap, cues } = await setup();
    play();
    pose((s, d) => d.setEffectTicks(s, "widen", 20));
    ball(80, 0, -240);
    ball(220, 0, 0);
    await e.advance(1);
    expect(snap().lives).toBe(3);
    pose((s, d) => d.clearBalls(s));
    await e.advance(1);
    expect(snap().lives).toBe(3);
    ball(80, 0, -240);
    await e.advance(1);
    expect(snap().lives).toBe(2);
    expect(snap().balls[0].parked).toBe(true);
    expect(snap().effects.widenTicks).toBe(0);
    pose((s, d) => d.setLives(d.clearBalls(s), 1));
    ball(80, 0, -240);
    await e.advance(1);
    expect(snap().screen).toBe("gameover");
    expect(cues.slice(-2)).toEqual([C.CUES.ballLost, C.CUES.gameOver]);
  });
});
describe("salvage and debug poses", () => {
  it.each(C.POD_KINDS)("catches %s with its exact effect", async (kind) => {
    const { e, play, pose, snap, cues } = await setup();
    play();
    const p = polar(197, 90);
    pose((s, d) => d.spawnPod(s, kind, p.x, p.y));
    await e.advance(1);
    expect(snap().score).toBe(C.POD_CATCH_SCORE);
    expect(snap().pods).toHaveLength(0);
    expect(cues).toContain(
      kind === "narrow" ? C.CUES.podCatchNarrow : C.CUES.podCatch,
    );
    if (kind === "widen")
      expect(snap().effects.widenTicks).toBe(C.WIDEN_DURATION_TICKS);
    if (kind === "narrow")
      expect(snap().paddle.spanDeg).toBe(C.NARROW_SPAN_DEG);
    if (kind === "shield") expect(snap().effects.shieldActive).toBe(true);
    if (kind === "pierce")
      expect(snap().effects.pierceTicks).toBe(C.PIERCE_DURATION_TICKS);
    if (kind === "multiball")
      expect(snap().balls).toHaveLength(C.MULTIBALL_LAUNCH_COUNT);
  });
  it("expires timers before catches, burns missed pods, and consumes one shield in spawn order", async () => {
    const { e, play, pose, ball, snap, cues } = await setup();
    play();
    pose((s, d) => d.setShield(d.setEffectTicks(s, "narrow", 1), true));
    const p = polar(197, 110);
    pose((s, d) => d.spawnPod(s, "widen", p.x, p.y));
    ball(102, 0, -240);
    ball(102, 180, -240);
    await e.advance(1);
    expect(snap().effects.widenTicks).toBe(600);
    expect(snap().balls[0].vx).toBeGreaterThan(0);
    expect(snap().balls[1].vx).toBeGreaterThan(0);
    expect(snap().effects.shieldActive).toBe(false);
    const q = polar(79, 0);
    pose((s, d) => d.spawnPod(s, "shield", q.x, q.y));
    await e.advance(1);
    expect(cues).toContain(C.CUES.podBurn);
  });
  it("poses immutably on any screen, normalizes angles, enforces capacity and rejects invalid domains", async () => {
    const { e, pose, snap } = await setup();
    const before = snap();
    pose((s, d) => d.parkBall(d.setPaddleAngle(s, -90)));
    expect(snap().paddle.angleDeg).toBe(270);
    expect(before.balls).toHaveLength(0);
    pose((s, d) => d.launchBall(s));
    expect(snap().balls[0].vy).toBe(-240);
    for (let i = 1; i < C.BALL_CAP; i++)
      pose((s, d) => d.spawnBall(s, 600, 500, 0, 0));
    expect(() => pose((s, d) => d.parkBall(s))).toThrow();
    expect(() => pose((s, d) => d.spawnBall(s, 0, 0, 0, 0))).toThrow();
    expect(() => pose((s, d) => d.setScore(s, -1))).toThrow();
    expect(() => pose((s, d) => d.setWave(s, 0))).toThrow();
    expect(() => pose((s, d) => d.spawnTarget(s, 4, 0, 1))).toThrow();
    pose((s, d) => d.setEffectTicks(s, "widen", 40));
    pose((s, d) => d.setEffectTicks(s, "narrow", 30));
    expect(snap().effects.widenTicks).toBe(0);
    const reconciled = e.debug.reconcile(e.state);
    expect(e.debug.reconcile(reconciled)).toEqual(reconciled);
    pose((s, d) => d.reset(s));
    expect(snap()).toEqual(before);
  });
  it("holds a forced drop while disabled and draws independently without consuming it", async () => {
    const { e, play, pose, ball, snap } = await setup();
    play();
    pose((s, d) => d.setNextPod(d.spawnTarget(s, 1, 0, 1), "pierce"));
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    expect(e.debug.drawPod(e.state)).toBe("widen");
    expect(snap().nextPod).toBe("pierce");
    ball(280, 15, 240);
    await e.advance(1);
    expect(snap().nextPod).toBe("pierce");
  });
});

describe("boundary and automation regressions", () => {
  it("holds either rotation binding at the fixed angular rate and moves the parked ball", async () => {
    const { e, key, target, snap } = await setup();
    await key("Enter");
    target.dispatchEvent(Object.assign(new Event("keydown"), { code: "KeyD" }));
    await e.advance(20);
    target.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyD" }));
    expect(snap().paddle.angleDeg).toBeCloseTo(180);
    expect(snap().balls[0].x).toBeCloseTo(
      C.STAGE_CX - C.DEFLECTOR_BALL_CONTACT_RADIUS,
    );
    target.dispatchEvent(
      Object.assign(new Event("keydown"), { code: "ArrowLeft" }),
    );
    await e.advance(20);
    expect(snap().paddle.angleDeg).toBeCloseTo(C.DEFLECTOR_START_ANGLE_DEG);
  });
  it("sets wave speeds without changing existing velocities or ring angles", async () => {
    const { e, pose, snap } = await setup();
    pose((s, d) =>
      d.setWave(
        d.setRingAngle(
          d.setRingSpeed(d.spawnBall(s, 700, 500, 123, 45), 2, -99),
          2,
          -5,
        ),
        20,
      ),
    );
    expect(snap().rings[1].speedDegPerSec).toBe(45);
    expect(snap().rings[2].speedDegPerSec).toBe(-30);
    expect(snap().rings[1].angleDeg).toBe(355);
    expect(snap().balls[0].vx).toBe(123);
    pose((s, d) =>
      d.setInterstitialTicks(d.setScreen(d.clearBalls(s), "waveclear"), 0),
    );
    await e.advance(1);
    expect(snap().wave).toBe(21);
    expect(snap().balls[0].parked).toBe(true);
  });
  it("caps multiball without losing the parked ball and scores redundant shield catches", async () => {
    const { e, play, pose, snap } = await setup();
    play();
    pose((s, d) => d.parkBall(s));
    for (let i = 0; i < 4; i++) pose((s, d) => d.spawnBall(s, 700, 500, 0, 0));
    const p = polar(197, 90);
    pose((s, d) => d.spawnPod(s, "multiball", p.x, p.y));
    await e.advance(1);
    expect(snap().balls).toHaveLength(C.BALL_CAP);
    expect(snap().balls[0].parked).toBe(true);
    pose((s, d) => d.spawnPod(d.setShield(s, true), "shield", p.x, p.y));
    await e.advance(1);
    expect(snap().score).toBe(2 * C.POD_CATCH_SCORE);
    expect(snap().effects.shieldActive).toBe(true);
    pose((s, d) => d.clearPods(s));
    expect(snap().pods).toHaveLength(0);
  });
  it("applies English and the outgoing angle clamp while preserving the contact position", async () => {
    const { e, play, pose, snap } = await setup();
    play();
    pose((s, d) => d.setPaddleAngle(s, 0));
    const p = polar(196, 20);
    const nx = Math.cos((20 * Math.PI) / 180),
      ny = Math.sin((20 * Math.PI) / 180);
    pose((s, d) =>
      d.spawnBall(s, p.x, p.y, -240 * nx - 600 * ny, -240 * ny + 600 * nx),
    );
    await e.advance(1);
    const b = snap().balls[0];
    const theta = (Math.atan2(b.y - 500, b.x - 500) * 180) / Math.PI;
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(C.BALL_SPEED_BASE);
    expect((Math.atan2(b.vy, b.vx) * 180) / Math.PI - theta).toBeCloseTo(
      C.BOUNCE_CLAMP_DEG,
    );
    expect(b.x).toBeCloseTo(p.x + (-240 * nx - 600 * ny) * C.TICK_DT);
  });
  it("draws the specified distribution and leaves poses untouched", async () => {
    const { e, pose, snap } = await setup();
    pose((s, d) => d.setNextPod(s, "none"));
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0.9);
    expect(e.debug.drawPod(e.state)).toBeNull();
    for (const [n, kind] of [
      [0.1, "widen"],
      [0.3, "multiball"],
      [0.5, "shield"],
      [0.7, "pierce"],
      [0.9, "narrow"],
    ] as const) {
      random.mockReturnValueOnce(0).mockReturnValueOnce(n);
      expect(e.debug.drawPod(e.state)).toBe(kind);
    }
    expect(snap().nextPod).toBe("none");
  });
});

it("keeps the tick clock through quit and replaces a posed field at the next wave", async () => {
  const { e, key, pose, snap } = await setup();
  await key("Enter");
  await key("Escape");
  await key("ArrowDown");
  const ticks = snap().ticks;
  await key("Enter");
  expect(snap().ticks).toBe(ticks + 1);
  pose((s, d) =>
    d.setInterstitialTicks(d.setScreen(d.parkBall(s), "waveclear"), 1),
  );
  await e.advance(1);
  expect(snap().balls).toHaveLength(1);
  expect(snap().balls[0].parked).toBe(true);
  expect(snap().wave).toBe(2);
});
