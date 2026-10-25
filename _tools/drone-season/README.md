# Drone Season workspace

Source, build scripts and tests for the game at `/drone-season/`. Jekyll does not publish folders whose names start with `_`, so nothing here appears on the site.

The game is built in milestones; the design doc lives in Claude Docs. Milestone 5 (Campaign) is the current build: a campaign of short scenarios (below) that also replaces the training round, on top of milestone 4's four rival styles, milestone 3's links and jamming (the Relay and the Harrier), milestone 2.6's two-player games (below), and milestone 2.5's command tools on the milestone 2 skirmish (a 12-minute short game or a 6-minute duel with Glints, Stings, Decoys, Wardens, Raiders and Nests). Research (the capability grid) is parked.

**Rival styles** (milestone 4). The computer plays one of four styles, built from the same units, set in `STYLES` in `sim.js`: the force it keeps in each phase, when and how big it raids, how hard it holds the Crown, how many Stings it keeps home, and its tricks.

- **Reaper**: an early swarm of Stings and Decoys; raids early and often, hunts Foragers at the blooms, and floods the Crown 45 seconds before it scores.
- **Bulwark**: a turtle; keeps posts (the same posts a player sets) with Wardens on its Heart, two blooms, its Nests and, late on, the Crown, whose post takes a Relay out with it; grows a second Nest early, parks a Harrier over the Crown, and raids rarely but big.
- **Listener**: up to three Glints perched on ridges near the middle, quicker strikes with an extra Sting on anything worth ◆30 or more, so your Harriers, Raiders and Relays go first.
- **Mimic**: Decoys everywhere; half its Decoys feint along the far flank five seconds before a raid on the Heart, a pair run wide of each Raider, its Raiders go through canopy, and a Harrier rides with its raids.

Every style also adapts. It first looks at what it has seen of you after 60 seconds on normal (90 on easy, 30 on hard), then every 15 seconds, waiting the full time again after each change, and adds to its build once each: more Decoys if it has seen five Wardens, more Wardens once it has lost six Foragers, more Stings once it has seen a Harrier, a Glint once it has seen eight Decoys, and it hunts Relays first once it has seen two. Difficulty still sets reaction time, income and (on easy) force size. The title screen picks a style or Any (random from the map seed, the default). A card at the start of the round names the style and how to beat it; the pause card repeats it, and the end screen says what it was and what it adapted to. AI Harriers now wait 40 seconds between launches. Two-player rounds have no computer, so no style, until a player leaves and the computer takes over (with a random style, named on the same card).

**Links and jamming** (milestone 3). Nothing for the player to configure:

**Links and jamming** (milestone 3). Nothing for the player to configure:

- A drone is **in link** when it is within reach of your Heart (520), a Nest (320) or a Relay (300) that is itself in link, so Relays chain. The Crown is just beyond the Heart's reach. Only drones in link take new orders: retask, recall, stance, and moving or dropping a post's units. Out of link, a drone carries on with its last orders until its battery sends it home, which is what it would have done anyway. When a sortie is part in, part out, the part out of link is split off on a sortie of its own and carries on.
- A **Harrier** (◆45, reusable) jams rival drones within 200. A jammed drone is out of link, cannot report what it sees (it drops out of the hive's picture and its owner's fog closes in), and cannot use the hive's picture: jammed Wardens and Raiders engage only what their own sensors see, a jammed Raider loses a moving target, jammed Stings on a strike hunt with their own seekers, and a jammed drone takes a Decoy for a Raider. A jammed Relay passes nothing on. A Harrier's noise gives it away: the side it jams sees it as a track while it does.
- A **Relay** (◆30, reusable) hovers where it is sent and carries the link 300 further.
- **Posts** are staffed only while their spot is in link and not jammed. A post out of link takes a ready Relay out to the edge of the link towards it, chaining up to three, keeps it relieved, and Auto builds the Relay it needs. Jamming cannot be bridged: a jammed post gets no relief however many units are ready, so the answer is to kill the Harrier.
- The computer (normal and hard) builds a Harrier late in the round, sends it to jam the Crown at Last Light, and otherwise sends one in behind its raids on the Heart. Its Wardens and Stings go for Harriers first.
- The map shows where your link reaches while you give orders, the Relay mesh, Harriers' jamming as a ragged ring, a crackle on your jammed drones and a broken ring on those out of link. Posts, the Flying list and the context bar say when something is jammed or out of link.

The command tools from milestone 2.5:

- **Squads**: six editable unit mixes in the dock (the sixth, Jam, a Harrier), armed with one tap or Q W E R T Y; **Again** resends the last one the same way.
- **Production plan and Auto**: a priority list of unit targets; Auto keeps two items queued from it, saving up rather than skipping ahead.
- **Posts**: map spots the hive keeps staffed with Glints, Wardens, Decoys or a Harrier, relieving and replacing them, by priority.
- **Quick orders**: tap a contact for Strike, Bomb or Intercept; press and hold open ground for Scout, Hunt, Patrol, Post, Jam, Relay or Nest.
- Parked Stings guard Nests against inbound Stings and Raiders, as well as the Heart.

The plan, squad and post sheets pause a round against the computer while open. There is no slow time. The plan, squads and the Auto setting are remembered in the browser.

**Two players** (the title screen's Play a friend button). The host gets an invite link (`?join=<id>`); the friend who opens it plays the cobalt hive and the round starts for both. There is no computer on either side and no joining a round already under way. Both browsers run the same deterministic battle in lockstep: every 0.1 s turn each sends the orders its player gave (everything that changes the battle goes through `act()` in `game.js`), to be applied two turns later by both, and a browser only steps a turn once it holds both players' orders for it. They compare a hash of the battle every 2 s. The second player is side 1 in the simulation but sees the map turned half round (`cam.flip`), in amber, so the game code refers to `ME` and `OP` rather than to sides 0 and 1. Pause stops both; either can resume. If a player leaves, the other can finish against the computer. Rematch starts a new map for both. [Trystero](https://github.com/dmotz/trystero) introduces the two browsers through public Nostr relays: both use the same ten relays from Trystero's own list (`RELAYS` in `game.js`) and only one needs to answer. After that they talk directly over WebRTC, with Google and Cloudflare STUN and PeerJS's public TURN servers for awkward networks. Trystero is bundled into `drone-season/trystero-0.26.0.js` by `build/vendor-trystero.sh`, loaded only when needed. The link only works on the site, not in the Claude artifact preview. Tests point it at a local relay with `?relays=ws://127.0.0.1:9123`. (An earlier version used PeerJS's single public server, which proved unreachable in real use.)

**Campaign** (milestone 5; the title screen's Campaign button, which replaced Training). Chapters of short scenarios, each on a fixed map with one objective, a time limit, and two optional goals: three stars a scenario, kept in the browser (`ds1.camp1`). Each scenario opens once the one before it is won; the skirmish is always open. Three chapters so far, all with the standard hive:

- **1 First light** teaches the game, with coach tips: *Eyes* (find a hidden Nest with Glints), *First blood* (the quick menu, building, a Strike squad on a route: destroy six Foragers), *Harvest* (Foragers, Auto, the plan and Wardens on patrol: bank ◆450 through raids), *Hold* (a post on the Crown that takes a Relay out, link, the Guard, and first to 60 Crown score).
- **2 Spectrum**: *Long reach* (hold a post far beyond your link, through a chain of Relays Cobalt hunts), *Static* (find and kill three jamming Harriers), *Smoke* (survive Decoy feints and raids on your Heart), *Nest-breaker* (Raiders on two guarded Nests).
- **3 Rivals**: full short rounds against a style with a twist: *Reaper* with a head start, *Bulwark* dug in with two Nests and no Crown score (destroy its Heart before frost), and *Two faces*, a Listener that turns Mimic halfway.

Scenarios are data in `src/campaign.js` (built into the page after `sim.js`): the map seed, what each side starts with, what you may build (`kit`), the rival (a timed `script` and per-tick `watch` rules, or an AI style), `progress` (the objective, shown in the top bar), `fail`, the stars, and the coach `steps`, which can highlight a control, mark the map and wait for something to happen. `CAMP.start(id)` builds the round and hangs the rules on the simulation's `hook`, which `step()` calls every tick, so the rules run the same in the page and in the headless tests. New chapters are added to `CHAPTERS` and `SCENARIOS`. The simulation takes a scenario's overrides through `createSim` (`cfg` timings, `noFrost`, `start`, `kit`, `nectar`, `heartHp`) and ends a round through `endGame`.

- `src/shell.html`: the page markup, with three markers where the stylesheet and scripts go.
- `src/style.css`: the stylesheet.
- `src/sim.js`: the simulation. Pure logic, no DOM, deterministic for a given map number and the same in every browser: it uses its own sine, cosine, arctangent and distance built from basic arithmetic, because `Math.sin` and friends can differ in the last bit between Chrome and Safari. Map, detection, units, combat and the rival hive's AI all live here.
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
- `node test/sim-checks.js`: unit behaviour: Raiders fly their routes; link range, Relays chaining and dropping, jamming (no reports, no orders, no picture for Wardens), posts cut off, jammed and bridged by a Relay, and a sortie split when only part of it is in link; each style's signature (a Reaper's early raid, a Bulwark's posts, a Listener's Glints, a Mimic's feint) and a rival adapting to Wardens it has seen.
- `node test/campaign.js [ids]`: every scenario headless: doing nothing does not win it, and a scripted player does (the full rounds of chapter 3 get four tries; the scripted player wins about half).
- `node test/styles.js [short|duel] [games per pairing and side] [diff]`: the four styles against each other from both sides. Prints each style's win rate (the milestone 4 gate: none above about 60%), each pairing, and how each style plays (harvest, raids, bombs, Crown score, what it builds and what it adapted to). At 20 games a pairing and side on normal: Reaper 50%, Bulwark 60%, Listener 49%, Mimic 41%. On hard Reaper does better (65%) and Listener worse (30%).
- `node test/players.js [short|duel] [easy,normal,hard] [turtle,active,m2,command] [reaper,bulwark,listener,mimic|any]`: scripted players against each difficulty and style: one that only defends, one that contests the Crown, one that also uses the milestone 2 units, and one that sets a plan with Auto and a Crown post and otherwise only strikes and holds. `N=16` plays 16 games a line instead of 8. The scripts use `Math.random`, so results move a little between runs. Against the four styles on normal they win about 28% of games, close to the 31% they managed against the single milestone 3 rival; Reaper is the easiest for them and Bulwark the hardest.

The browser tests drive the built page in headless Chromium, so build the site page first and `npm install playwright`:

- `node test/controls.js`: on desktop and phone sizes, the Auto chip, builds, cancels from the queue, places a Nest, edits a squad, and launches, retasks and recalls squads.
- `node test/groups.js`: squad launches (a Raider with Decoys as one package, Again, two squads at once), and that the map never flips orientation or rescales on a small phone unless the phone is turned.
- `node test/twoplayer.js`: a desktop host and a phone guest in two browsers, meeting through a local Nostr relay (`test/nostr-relay.js`): invite, join, a third person turned away, the turned-round view, orders reaching both battles, shared pause, ten seconds of matching hashes, both ending at the same tick, rematch, leaving (the host finishes against the computer), and the message when no relay answers. Needs `npm install ws` as well.
- `node test/chapter1.js`: the campaign screen, then chapter 1 played through the real controls on desktop and phone sizes (its coach tips, each scenario's end screen and stars, progress saved, the next chapter opening), the first scenario on a small phone, and every other scenario started and played for a minute and a half.
- `node test/rivals.js`: picking a style on the title screen, the card that names it (taps pass through it to the map), the pause card, the end screen, Any, and no card in a scenario without a style.
- `node test/command.js`: Auto and the production plan sheet (it pauses the round), a post set from the hold menu and staffed by the hive, quick orders on a contact, and the Flying list.

Open the page with `?debug` (for example `drone-season/index.html?debug`) to expose the game's internals as `window.__ds`; the browser tests rely on it.
