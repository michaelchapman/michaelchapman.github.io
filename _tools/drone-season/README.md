# Drone Season workspace

Source, build scripts and tests for the game at `/drone-season/`. Jekyll does not publish folders whose names start with `_`, so nothing here appears on the site.

The game is built in milestones; the design doc lives in Claude Docs. Milestone 2.5 ("Command") is the current build: the milestone 2 skirmish (a 12-minute short game or a 6-minute duel with Glints, Stings, Decoys, Wardens, Raiders and Nests) plus tools that let the hive carry out standing orders:

- **Squads**: five editable unit mixes in the dock, armed with one tap; **Again** resends the last one the same way.
- **Production plan and Auto**: a priority list of unit targets; Auto keeps two items queued from it, saving up rather than skipping ahead.
- **Posts**: map spots the hive keeps staffed with Glints, Wardens or Decoys, relieving and replacing them, by priority.
- **Quick orders**: tap a contact for Strike, Bomb or Intercept; press and hold open ground for Scout, Hunt, Patrol, Post or Nest.
- Parked Stings guard Nests against inbound Stings and Raiders, as well as the Heart.

The plan, squad and post sheets pause the round while open. The plan, squads and the Auto setting are remembered in the browser.

**Training** (the title screen's Training button) is a guided round of 14 steps on a fixed map (7729) with no rival commander: scouting from a ridge, a contact to strike, building, Auto and the plan, a Strike squad on a route, a post on the Crown, a raid beaten off by the guard, and holding the Crown in Last Light. Each step waits for the player to do it, highlights the control and marks the spot on the map; training tops up units rather than making you wait. The steps live in `TSTEPS` in `game.js`; the `training` round mode in `sim.js` opens the Crown from the start and lets the lesson switch Crown scoring on.

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
- `node test/players.js [short|duel] [easy,normal,hard] [turtle,active,m2,command]`: scripted players against each difficulty: one that only defends, one that contests the Crown, one that also uses the milestone 2 units, and one that sets a plan with Auto and a Crown post and otherwise only strikes and holds. The scripts use `Math.random`, so results move a little between runs.

The browser tests drive the built page in headless Chromium, so build the site page first and `npm install playwright`:

- `node test/controls.js`: on desktop and phone sizes, the Auto chip, builds, cancels from the queue, places a Nest, edits a squad, and launches, retasks and recalls squads.
- `node test/groups.js`: squad launches (a Raider with Decoys as one package, Again, two squads at once), and that the map never flips orientation or rescales on a small phone unless the phone is turned.
- `node test/training.js`: plays the whole training round through the real controls on desktop and phone sizes.
- `node test/command.js`: Auto and the production plan sheet (it pauses the round), a post set from the hold menu and staffed by the hive, quick orders on a contact, and the Flying list.

Open the page with `?debug` (for example `drone-season/index.html?debug`) to expose the game's internals as `window.__ds`; the browser tests rely on it.
