# Kessler

An orbital demolition arcade game. Circle a warm planet with your deflector,
steer a spinning demolition ball into three belts of derelicts, and catch the
salvage they shed. Survive endless, accelerating waves and chase a higher score.

Install with `npm ci` (Node.js 22.12 or newer), then run `npm run dev` and open
the local URL. `npm run build` produces the complete static site in `dist/`;
`npm run preview` serves that build. Deploy the contents of `dist/` at a site
root or a subdirectory. No server, account, or external service is required.

- **Left / Right** or **A / D**: rotate the deflector.
- **Space**: launch the parked ball.
- **P / Escape**: pause or resume.
- **Up / Down** or **W / S**: choose a menu item.
- **Enter / Space**: confirm. **Escape**: leave help.
- Mouse and touch operate the menus. Play uses the keyboard.
- **Backtick**: toggle the engine's diagnostic overlay.

Widen and narrow replace each other. Multiball adds two balls, shield saves one
returning ball, and pierce tears through armored targets. Losing your last ball
costs one of three lives. Every cleared wave earns a bonus and increases speed.

The game uses the Simple 2D engine and a 60 Hz simulation. `src/game.ts` exports
the game and its typed state/debug interface; scenarios use `engine.debug` with
`engine.apply`, without page globals. `npm test` exercises the running engine
with a controlled clock and a native canvas. Other checks: `npm run typecheck`,
`npm run lint`, and `npm run format`.

All art, six spin frames, three live particle systems, thirteen sound cues, and
two looping music beds are committed under `assets/`. The `public/assets`
symlink exposes that directory to Vite's static bundler without duplicating it.
The production build only copies these finished files. The optional one-time
recipe in `tools/produce-assets.py` documents their procedural authorship and
requires the development asset binaries; it is never invoked by install or
build. Particle playback is supplied by `@clockwyrks/particle-runtime`.

See `showcase/showcase.md` for a player introduction and the captured carousel.
