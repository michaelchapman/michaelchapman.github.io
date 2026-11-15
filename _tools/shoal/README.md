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
- `build/audit.mjs`, `review.py`, `sim.mjs`, `measure.mjs` — checks on every board, the stem pairs, fish clear rates, and a comparison with wider word lists
- `build/merge.mjs` — joins generator runs into `puzzles.json`
- `build/play*.cjs`, `shelf.cjs` — playthrough tests of `shoal/index.html` (`play2` and `play5` cover the Frenzy, `play6` the word rules and saved streaks), and a look at the home page shelf. Set `OUT` to a folder for screenshots

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
PART=0/2 node gen.mjs 275 101 pa.json & PART=1/2 node gen.mjs 275 202 pb.json & wait   # about 12 minutes on two cores
SKIP=pa.json,pb.json PART=0/2 node gen.mjs 150 303 pc.json & SKIP=pa.json,pb.json PART=1/2 node gen.mjs 150 404 pd.json & wait
node merge.mjs pa.json pb.json pc.json pd.json   # keeps 800 boards with distinct star words
# A single run slows down as it goes, because it steers away from words it has already used. Short runs avoid that.
node bundle.mjs && node audit.mjs && python3 review.py
```

`words.mjs` builds the dictionary: British spellings from SCOWL up to size 70, with American-only spellings, rude words
and words known only to a 274k Scrabble-style list classed separately. Read `review.py`'s output after a regeneration,
because hand-allowed stem pairs in `stems.py` are the part a machine can't vouch for. `measure.mjs` compares any
`puzzles.json` with the wider word lists.

## Rules worth knowing

- A board's word list is every accepted dictionary word that can be traced along its links, and each word can be traced
  exactly one way. There are no optional words. `gen.mjs` refuses any board on which something else that looks like a
  word could be formed: an obscure or name-like dictionary word, a rude word, an American spelling, or a familiar word
  from outside the dictionary. So "Not in the dictionary" should only ever meet non-words, proper names and strings
  known only to Scrabble lists. `audit.mjs` re-derives all of this from the built page.
- Boards may hold at most one less familiar word (`HARD`, frequency score 2.3 to 2.6); everything else scores 2.6 or more.

- The Frenzy has two styles. Pop is the standard: 12 seconds (`DUR_POP`) of popping matching fish, starting from the
  shoal the word game left, with random fish dropping in from the top. Swim is the earlier one, kept as a setting on the
  Frenzy's start screen (`saved.fzm`). Each keeps its own best per board, and the score counts the higher.

- Fish take colours in a fixed rotation as letters are freed, so a finished board always has four of each. The rotation's
  order changes by board. This is the secret: don't explain it in the game.
- No. 1 is 5 November 2026. The daily board wraps after 800 days. Reordering or regenerating `puzzles.json` changes every
  future board, and `STORE` in `game.js` should change with it so old progress isn't replayed onto new boards.
