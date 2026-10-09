# michaelchapman.github.io

Source for [michaelchapman.me](https://michaelchapman.me), built with Jekyll
and deployed to GitHub Pages by a GitHub Actions workflow.

## Structure

- `_config.yml` — site settings and the `minima` theme configuration
- `index.md`, `about.md`, `cv.md`, `work.md`, `writing.md` — top-level pages
- `_posts/` — blog posts (`YYYY-MM-DD-title.md`), listed on `/writing/`
- `_sass/minima/custom-styles.scss` — style overrides on top of the `minima` 3 theme
- `assets/images/social-card.png` — default image for link previews
- `.github/workflows/` — build/deploy (`pages.yml`) and link checking (`links.yml`)
- `CNAME` — custom domain config; do not edit, DNS is already set up

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
and weekly, so a dead external link (e.g. a PDF on the Work page) shows up
as a failed run.
