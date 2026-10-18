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
- `python3 test/keys.py`, `m4test.py`, `m4mobile.py`, `m5menu.py`, `migrate.py`: key and time controls, tips, postcards, settings, the Ambience slider, and loading older saves.
- `python3 test/run2.py 1280 800 codes.js`: runs a page script after loading, here the town-code round trip. Other scripts (`power.js`, `m5g.js` and so on) work the same way. Add `name:JS(code)` arguments to take screenshots into `test/`.

The software renderer is slow. A postcard snap takes about 30 seconds, so those tests allow 2 minutes. Run tests one at a time, because tests that wait on timing drift when several browsers share the machine.
