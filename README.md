# michaelchapman.github.io

Source for [michaelchapman.me](https://michaelchapman.me), built with Jekyll
and deployed to GitHub Pages by a GitHub Actions workflow.

## Structure

The site is the Long Gallery: one room of a castle library, drawn in code.
Things kept on the site are objects in the room, and you walk along it bay
by bay. Every object also has an ordinary page, and the card catalogue
(`/catalogue/`) lists everything for anyone who'd rather not walk.

- `_data/gallery.yml`: the bays, left to right. Each has a `template`
  (how it's drawn) and an `id` that objects use to say where they live.
- `_objects/`: one Markdown file per object (`kind`, `bay`, `year`, plus a
  `file` or `link`). Each gets a page at `/library/<name>/`. To add a paper,
  copy one of the existing files.
- `_data/cv.yml`: the career history. It drives both `/cv/` and the
  certificates on the gallery wall.
- `assets/js/gallery.js`: lays out the gallery (an iron-and-glass reading
  room) as SVG, with a bay template for each kind of object.
- `assets/js/library-kit.js`: the camera and the furniture it is built from
  (bookcases, chairs, gears, pipes, the castle outside). Shapes of one colour
  are joined and rows of books are drawn once, which keeps scrolling smooth.
  The hour and season follow the visitor's clock (try `?hour=night&season=winter`).
  "Pixel art" redraws the same scene at 320px with a limited palette.
- `_layouts/`: `library` (every page), `gallery` (the home page, with the
  inspect views), `object`, and `redirect` (keeps `/work/` working).
- `assets/css/library.css`: all styles.
- `.github/workflows/`: build/deploy (`pages.yml`) and link checking (`links.yml`)
- `CNAME`: custom domain config; do not edit, DNS is already set up

## Local preview

Requires Ruby and Bundler.

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000. `jekyll serve` watches for changes and
rebuilds automatically; stop it with Ctrl-C.

## Deploying

Push to `main`. The `Build and deploy site` workflow builds the site with the
exact Jekyll version in `Gemfile.lock` (the same one `bundle exec jekyll
serve` uses locally) and publishes it. Changes are usually live within a
couple of minutes at https://michaelchapman.me. Pull requests get a build
check but are not deployed.

This needs the repository's Pages source set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source).

The `Check links` workflow checks every link on the built site on each push
and weekly, so a dead external link (e.g. one of the PDFs on the reading table) shows up
as a failed run.
