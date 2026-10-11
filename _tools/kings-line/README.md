# King's Line tree builder

Regenerates `kings-line/tree.js` from Wikidata.

- `old.json` is the hand-checked tree the page used before; its links always win.
- `qid.json` maps each hand-checked person to their Wikidata item.
- `anc.py` pulls every recorded ancestor of those people (father P22, mother P25) into `anc.json`.
- `build.py` merges the two, applies the reviewed blocks and doubts, trims to the people the page needs, and writes `tree.js`.

```
cd _tools/kings-line
python3 anc.py      # slow the first time; answers are cached in cache/
python3 build.py
cp tree.js ../../kings-line/tree.js
```
