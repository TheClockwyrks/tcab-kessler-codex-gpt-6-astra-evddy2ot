import type { Game } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import { boot, span, type KesslerState, type Assets } from "./model";
import { debug, type KesslerDebugApi } from "./debug";
import { update } from "./simulation";
import { render } from "./render";
export { BACKGROUND } from "./render";
export type { KesslerState } from "./model";
export type { KesslerDebugApi } from "./debug";
export const game: Game<KesslerState, KesslerDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    const paths = [
      C.SPRITE_PATHS.planet,
      ...Object.values(C.SPRITE_PATHS.pods),
      ...C.SPRITE_PATHS.ball,
    ];
    const [images, particles] = await Promise.all([
      Promise.all(
        paths.map(
          async (path) => [path, await api.assets.loadImage(path)] as const,
        ),
      ),
      Promise.all(
        Object.entries(C.PARTICLE_PATHS).map(
          async ([name, path]) =>
            [
              name,
              JSON.parse(
                await (await api.assets.load(path)).text(),
              ) as ParticleSystem,
            ] as const,
        ),
      ),
      Promise.all(
        Object.entries(C.CUE_PATHS).map(([cue, path]) =>
          api.audio.load(cue, path),
        ),
      ),
      Promise.all(
        Object.entries(C.BED_PATHS).map(([cue, path]) =>
          api.audio.load(`music-${cue}`, path),
        ),
      ),
    ]);
    for (const key of ["screen", "score", "lives", "wave"] as const)
      api.diagnostics.register(key, (s) => s[key]);
    api.diagnostics.register("paddle angle", (s) => s.angle);
    api.diagnostics.register("paddle span", span);
    api.diagnostics.register("balls", (s) => s.balls.length);
    api.diagnostics.register("targets", (s) =>
      s.rings.reduce((sum, r) => sum + r.hp.filter((hp) => hp > 0).length, 0),
    );
    api.diagnostics.register("pods", (s) => s.pods.length);
    for (const key of [
      "widenTicks",
      "narrowTicks",
      "pierceTicks",
      "shieldActive",
    ] as const)
      api.diagnostics.register(key, (s) => s.effects[key]);
    const assets: Assets = {
      images: Object.fromEntries(images),
      particles: Object.fromEntries(particles),
    };
    return [boot(assets), debug];
  },
  update,
  render,
};
