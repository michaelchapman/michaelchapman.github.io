# Drone Season workspace

Source, build scripts and tests for the game at `/drone-season/`. Jekyll does not publish folders whose names start with `_`, so nothing here appears on the site.

The game is built in milestones; the design doc lives in Claude Docs. Milestone 2 ("Skirmish") is the current build: a 12-minute short game (or a 6-minute duel) with Glints, Stings, Decoys, Wardens, Raiders and Nests, a cancellable build queue, and grouped launches.

- `src/shell.html`: the page markup, with three markers where the stylesheet and scripts go.
- `src/style.css`: the stylesheet.
- `src/sim.js`: the simulation. Pure logic, no DOM, deterministic for a given map number. Map, detection, units, combat and the rival hive's AI all live here.
- `src/game.js`: drawing, input, sound, the dock and the overlays.
- `drone-season.html`: the assembled single-file fragment. This is the file published as the Claude artifact.
- `build/build.py`: assembles `src/` into `drone-season.html`.
- `build/site.py`: wraps the same fragment into the full page for the site.
- `test/`: headless balance runs and browser tests.

All scripts find files relative to their own folder, so they run from any working directory.

## Build

```bash
python3 _tools/drone-season/build/build.py   # the artifact fragment
python3 _tools/drone-season/build/site.py    # drone-season/index.html, icon.svg, manifest.webmanifest
```

`site.py --images` also renders `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` and the 1200×630 `preview.jpg` link image with Playwright's Chromium. Only redo those when the icon or the title screen changes. If Google Fonts can't be reached where you run it, install the same faces from npm and point `DS_FONTSOURCE` at them so the preview uses the right type:

```bash
npm install @fontsource/chakra-petch @fontsource/atkinson-hyperlegible @fontsource/ibm-plex-mono
DS_FONTSOURCE="$PWD/node_modules/@fontsource" python3 _tools/drone-season/build/site.py --images
```

## Test

The simulation tests need only Node:

- `node test/balance.js [short|duel] [rounds]`: computer against computer. Prints the win split (it should stay close to even), how often a Heart falls, and how often each new unit is built and used.
- `node test/players.js [short|duel] [easy,normal,hard]`: three scripted players (one that only defends, one that contests the Crown, one that also uses the new units) against each difficulty.

The browser tests drive the built page in headless Chromium, so build the site page first and `npm install playwright`:

- `node test/controls.js`: on desktop and phone sizes, builds, cancels from the queue, places a Nest, and launches, retasks and recalls each unit type.
- `node test/groups.js`: grouped launches (Raiders with Decoys), and that the map never flips orientation on a small phone unless the phone is turned.

Open the page with `?debug` (for example `drone-season/index.html?debug`) to expose the game's internals as `window.__ds`; the browser tests rely on it.
