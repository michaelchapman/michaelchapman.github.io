# Brasshaven workspace

Source, build script and tests for the game at `/brasshaven/`. Jekyll does not publish folders whose names start with `_`, so nothing here appears on the site.

- `brasshaven.html`: the game's source, a single HTML fragment. This is the file published as the Claude artifact.
- `build/site.py`: turns the source into the live page.
- `build/*.py` and `build/*.js`: the patch scripts and code that built each milestone. They have already been applied to `brasshaven.html` and are kept for reference. `life-with-boats.js` and `m5_patch-with-boats.py` keep the steam launches and paddle steamer, which were set aside after milestone 5.
- `test/`: browser tests and render scripts.

All scripts find files relative to their own folder, so they run from any working directory.

## Build the live page

```bash
python3 _tools/brasshaven/build/site.py
```

This writes `brasshaven/index.html`, `icon.svg` and `manifest.webmanifest` at the top of the repo. Pass a folder to write somewhere else.

## Run the tests

They run the game in headless Chromium through Playwright, with three.js served from a local copy.

```bash
cd _tools/brasshaven
npm install                                  # three 0.160, into node_modules/
pip install playwright pillow
python3 -m playwright install chromium
```

- `python3 test/touch.py`, `touch2.py`, `gest.py`, `gest2.py`, `gest3.py`: tapping, holding and camera gestures on a phone-sized screen.
- `python3 test/keys.py`, `m4test.py`, `m4mobile.py`, `m5menu.py`, `migrate.py`: the time-of-day dial, tips, postcards, settings, the Ambience slider, and loading older saves.
- `python3 test/m6.py`: milestone 6 landmarks. Builds one of each of the seven landmarks (`test/m6build.js`), checks each appears, is named once, shows in the Landmarks list, works by day and night, and goes away when its arrangement changes.
- `python3 test/m7slots.py`: milestone 7 save slots. Moves a pre-slot save into slot 1, then checks New, Open, Copy and Delete, the eight-harbour limit, and that town codes open in a harbour of their own.
- `python3 test/m7grow.py [old.html]`: milestone 7 growth. Grows the harbour band by band to its largest, checks there are no holes where bands meet, that cells numbered past 4095 can be picked, and that a grown harbour reloads and shrinks again. Given an older build of the page (`git show 812ecfc:brasshaven/index.html > /tmp/old.html`), it also checks that towns coded on the old grid open cell for cell.
- `python3 test/m7chimp.py`: checks found on Michael's own harbour (`test/town-chimphaven.txt`): the shallows sit under the quays, and the airship mast and lamppost poles stay drawn at a distance.
- `python3 test/m10play.py`: milestone 10 on an iPad-sized screen. The harbour sheet on the name plate and the settings on the gear, a tap that closes a menu building nothing, tapping and riding along with a person, a boat and the airship, the turning day and the lamplighter, and Little hands mode with its own harbour. Set `SHOTS=/some/folder` to save screenshots.
- `test/m7perf.js`: builds a densely packed harbour and reports triangles and draw calls from four views, the time a tap takes, and the moving town's update time per frame. It builds the largest harbour; change `window.__m7size ?? 4` to `0` for the first size. Run it with `python3 test/run2.py 1280 800 m7perf.js`.
- `python3 test/run2.py 1280 800 codes.js`: runs a page script after loading, here the town-code round trip. Other scripts (`power.js`, which checks machines turn without power, `m5g.js` and so on) work the same way. Add `name:JS(code)` arguments to take screenshots into `test/`.

If Playwright's own browser download does not match the installed one, point the tests at a Chromium binary with `BH_CHROMIUM=/path/to/chromium`.

To look at a landmark, run `python3 test/run2.py 1000 700 m6build.js "shot:JSwindow.__m6look('gate',{time:3})"`; the screenshot lands in `test/`.

The software renderer is slow. A postcard snap takes about 30 seconds, so those tests allow 2 minutes. Run tests one at a time, because tests that wait on timing drift when several browsers share the machine.
