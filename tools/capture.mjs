/* global document */
import { Buffer } from "node:buffer";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1000 },
  });
  await page.route("**/capture.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<style>body{margin:0;background:#070e19}canvas{width:1000px;height:1000px}</style><canvas id="capture"></canvas>',
    }),
  );
  await page.goto("http://localhost:5173/capture.html");
  const recording = await page.evaluate(async () => {
    const { createEngine, ConstantClock } =
      await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
    const { game, BACKGROUND } = await import("/src/game.ts");
    const e = createEngine({
      canvas: document.querySelector("canvas"),
      width: 1000,
      height: 1000,
      game,
      background: BACKGROUND,
      clock: new ConstantClock(1000 / 60),
    });
    await e.initialize();
    await e.advance(1);
    const title = document.querySelector("canvas").toDataURL();
    const d = e.debug;
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setPaddleAngle(s, 36));
    e.apply((s) => d.setShield(s, true));
    e.apply((s) => d.setEffectTicks(s, "widen", 600));
    e.apply((s) => d.setScore(s, 2450));
    e.apply((s) => d.setNextPod(s, "multiball"));
    e.apply((s) => d.setWaveAdvance(s, false));
    for (const [r, a, v] of [
      [275, 36, 240],
      [400, 150, 270],
      [330, 260, -240],
    ]) {
      const rad = (a * Math.PI) / 180;
      e.apply((s) =>
        d.spawnBall(
          s,
          500 + r * Math.cos(rad),
          500 + r * Math.sin(rad),
          v * Math.cos(rad),
          v * Math.sin(rad),
        ),
      );
    }
    for (const [kind, r, a] of [
      ["pierce", 242, 36],
      ["shield", 295, 160],
      ["narrow", 360, 275],
    ]) {
      const rad = (a * Math.PI) / 180;
      e.apply((s) =>
        d.spawnPod(s, kind, 500 + r * Math.cos(rad), 500 + r * Math.sin(rad)),
      );
    }
    e.startRecording();
    let field;
    for (let i = 0; i < 240; i++) {
      await e.advance(1);
      if (i === 8) field = document.querySelector("canvas").toDataURL();
      if (i > 60) {
        const b = e.state.balls.find(
          (b) => !b.parked && (b.x - 500) * b.vx + (b.y - 500) * b.vy < 0,
        );
        if (b)
          e.apply((s) =>
            d.setPaddleAngle(
              s,
              (Math.atan2(b.y - 500, b.x - 500) * 180) / Math.PI,
            ),
          );
      }
    }
    const replay = e.stopRecording();
    e.destroy();
    return { title, field, replay };
  });
  await mkdir("showcase", { recursive: true });
  for (const key of ["title", "field"])
    await writeFile(
      `showcase/${key}.png`,
      Buffer.from(recording[key].split(",")[1], "base64"),
    );
  await writeFile(
    "showcase/orbital-cleanup.json.gz",
    gzipSync(JSON.stringify(recording.replay)),
  );
} finally {
  await browser.close();
}
