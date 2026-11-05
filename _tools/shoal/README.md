# Shoal

A daily 4×4 word puzzle at `/shoal/`, a single self-contained page with its fonts and 800 boards built in.
Letters connect only where a remaining word needs them. Paths wash away as words are found, and a letter
that no remaining word uses becomes a tropical fish. Pop the fish, clear them all, and the Frenzy unlocks.

## Layout

- `src/` — the game: `game.js`, `style.css`, `body.html`
- `build/bundle.mjs` — packs everything into `../../shoal/index.html`
- `build/art.mjs`, `build/art.cjs` — box art for the home page, icons and `preview.jpg`, drawn from the game's own fish.
  `art/cover.svg.html` is the block pasted into the site's `index.html`
- `build/words.mjs`, `freq.py`, `cand.py`, `stems.py`, `gen.mjs` — the word list, stem table and board generator
- `build/audit.mjs`, `review.py`, `sim.mjs` — checks on every board, the stem pairs and fish clear rates
- `build/play*.cjs`, `shelf.cjs` — playthrough tests of `shoal/index.html`, and a look at the home page shelf. Set `OUT` to a folder for screenshots

## Change the game

From `build/`, after `npm install` in this folder:

```bash
node bundle.mjs
```

`bundle.mjs` uses the committed `puzzles.json` and `stems.board.json`, so a game change needs nothing else.

## Regenerate the boards

```bash
pip install wordfreq lemminflect
node words.mjs && python3 freq.py && python3 cand.py && python3 stems.py
node gen.mjs 800 41 puzzles.json
node bundle.mjs && node audit.mjs && python3 review.py
```

`words.mjs` builds British spellings from SCOWL, removes American-only spellings and holds the blocklist. Read
`review.py`'s output after a regeneration, because hand-allowed stem pairs in `stems.py` are the part a machine can't vouch for.

## Rules worth knowing

- Fish take colours in a fixed rotation as letters are freed, so a finished board always has four of each. The rotation's
  order changes by board. This is the secret: don't explain it in the game.
- No. 1 is 5 November 2026. The daily board wraps after 800 days. Reordering or regenerating `puzzles.json` changes every
  future board, and `STORE` in `game.js` should change with it so old progress isn't replayed onto new boards.
